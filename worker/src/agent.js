// The SamaSalt-Mitra agent: a fixed, auditable tool plan. Models are used only where they are
// needed (reading a photo, understanding free text in any script); every price, match and
// safety decision comes from deterministic tools over official / published data.
//
//   read_strip ─► identify_medicine ─► find_same_salt ─► jan_aushadhi_match ─► nearest_kendra ─► compose_answer
//
// Every step is recorded in `trace` (tool, input, short output, ms) and returned to the UI,
// and the eval runner writes the same trace as AgentFoundry run JSONL (.codenow/runs/).
import { readStrip, understandText, readPrescription } from './vision.js';
import { identifyMedicine, janAushadhiByName, suggestNames, soundsLikeChoices, saltChoices, formGuessChoices, otherSaltChoices, findSameSalt, janAushadhiMatch, ceilingPrice, nearestKendra, computeSaving, compositionFromText, brandCandidatesFromText } from './tools.js';
import { describeKey, extractDosageForm, ntiFromKey, parseSaltComposition } from './normalize.js';
import { assetMeds, d1Meds } from './medstore.js';
import { composeAnswer } from '../../public/strings.js';
import { expandShortForms } from '../../public/short-forms.js';
import { hasIndic, transliterate } from '../../public/indic.js';

const RX_FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops']; // the forms the reader may return

/**
 * v2.0.4 Scan a prescription: read the medicine names (read_prescription), then match each one to
 * the medicine list (identify_medicine, by name). Nothing is priced here: the patient picks each
 * medicine, and only then is it checked like a typed name (the pick is the confirmation).
 */
export async function readPrescriptionAgent(env, { image }) {
  const files = env.ASSETS ? await assetMeds(env.ASSETS) : null;
  const ctx = { db: env.DB, meds: files || d1Meds(env.DB) };
  const read = await readPrescription(env, image);
  if (!read.ok) return { status: read.unreadable ? 'unreadable' : 'vision_unavailable' };
  const items = [];
  for (const it of read.items) {
    const brand = [it.name, it.strength && !it.name.includes(it.strength.replace(/\s+/g, '')) ? it.strength : ''].filter(Boolean).join(' ');
    // "Ask, don't guess" as for a typed name: the form written on the prescription counts, and a salt
    // written without a form, or a brand with other salts, is a choice, never one medicine.
    const form = RX_FORMS.includes(it.form) && !extractDosageForm(brand) ? it.form : '';
    const asked = [brand, form].filter(Boolean).join(' ');
    let id = { found: false };
    try {
      id = await identifyMedicine(ctx, { brand: asked });
      if (id.found && id.via === 'brand' && ((await formGuessChoices(ctx, asked, id)).length || (await otherSaltChoices(ctx, asked, id)).length)) id = { found: false, choices: [id] };
      if (!id.found && !id.choices?.length && (await saltChoices(ctx, asked)).length) id = { found: false, choices: [id] };
    } catch { id = { found: false }; }
    items.push(id.found
      ? { read: asked, found: true, name: id.medicine.name, composition: describeKey(id.medicine.ckey), nti: !!id.medicine.nti || ntiFromKey(id.medicine.ckey) }
      : { read: asked, found: false, ...(id.choices?.length ? { choose: true } : {}) });
  }
  return { status: items.length ? 'ok' : 'unreadable', items, model: read.model };
}

const NON_LATIN = /[^\u0000-ɏ\s\d.,()+\-/]/;

export async function runAgent(env, input) {
  const db = env.DB;
  // Brand medicines come from the static files when they are deployed, else from D1 (tests).
  const files = env.ASSETS ? await assetMeds(env.ASSETS) : null;
  const ctx = { db, meds: files || d1Meds(db) };
  const lang = ['en', 'hi', 'kn'].includes(input.lang) ? input.lang : 'en';
  const trace = [];
  const step = async (tool, args, fn, summarize) => {
    const t0 = Date.now();
    let out;
    try {
      out = await fn();
    } catch (e) {
      trace.push({ tool, input: args, error: String(e?.message || e).slice(0, 200), ms: Date.now() - t0 });
      throw e;
    }
    trace.push({ tool, input: args, output: summarize ? summarize(out) : out, ms: Date.now() - t0 });
    return out;
  };

  const rawText = String(input.text || '').trim().slice(0, 2000);
  // Text read off the strip by the phone keyboard's "Scan text" (Gboard / iPhone Live Text):
  // many words or lines. Read it like on-device OCR (free) before any model is asked.
  // A long typed name that is exactly an official Jan Aushadhi product ("Pantoprazole Gastro
  // Resistant Tablets IP 40 mg") is typed, not a scanned strip: the strict name match allows no stray words.
  const scanned = looksScanned(rawText) && !(input.image || input.ocr ? false : await janAushadhiByName(ctx, rawText.slice(0, 300)));
  let text = rawText.slice(0, 300);
  let pin = String(input.pin || '').replace(/\D/g, '').slice(0, 6);
  // A 6-digit number in typed text is a PIN code; on a scanned strip it is a batch or licence number.
  const pinInText = scanned ? null : text.match(/\b(\d{6})\b/);
  if (pinInText) {
    if (!pin) pin = pinInText[1];
    text = text.replace(pinInText[0], ' ').trim();
  }

  let query = { brand: '', composition: '', form: '' };
  let read = null;
  let source = 'text';

  if (input.image) {
    source = 'photo';
    read = await step('read_strip', { image: '(photo — processed in memory, not stored)' }, () => readStrip(env, input.image), (r) =>
      r.ok ? { model: r.model, brand: r.brand, composition: r.composition, form: r.form, release: r.release, confidence: r.confidence, usage: r.usage } : { failed: r.errors }
    );
    if (!read.ok) return { status: read.unreadable ? 'unreadable' : 'vision_unavailable', source, lang, trace };
    query = { brand: [read.brand, read.release].filter(Boolean).join(' '), composition: read.composition, form: read.form };
  } else if (input.ocr) {
    source = 'photo-ocr';
    query = await readOcrText(ctx, String(input.ocr).slice(0, 2000), trace);
  } else if (scanned) {
    source = 'text-scan';
    query = await readOcrText(ctx, rawText, trace);
    // Shown on the result (and on "not found") so the person sees what the scan was read as.
    const firstGuess = trace.at(-1)?.output?.brand_candidates?.[0] || '';
    read = { ok: true, brand: query.brand || firstGuess, composition: query.composition };
  } else {
    query = { brand: text, composition: '', form: '' };
  }

  let id = await step('identify_medicine', query, () => identifyMedicine(ctx, query), (r) =>
    r.found ? { name: r.medicine.name, composition: r.label, via: r.via, composition_agrees: r.composition_agrees } : { found: false, choices: r.choices?.length || 0 }
  );
  // "Ask, don't guess": brands that only partly fit the typed name, offered with their salts.
  const firstChoices = id.choices;

  // Read-confidence gate for anything read from a photo or a scan: below the pass mark nothing is
  // searched and the person is told the strip details could not be extracted. A misread must
  // never become a switch suggestion.
  let readCheck = null;
  if (source !== 'text') {
    readCheck = scoreRead(id, query, read);
    trace.push({ tool: 'check_read', input: { pass_mark: READ_PASS_MARK }, output: readCheck, ms: 0 });
    if (readCheck.score < READ_PASS_MARK) {
      // Front of the strip: the brand was read but no salts (owner's decision 23 Nov 2026). The brand
      // read is matched like a typed name and offered as choices with their salts: never an answer,
      // nothing priced until the person taps one; a partial fit is never picked.
      const brandRead = String(read?.brand || '').trim().slice(0, 80);
      let choices = [];
      if (readCheck.reason === 'no_composition' && brandRead) {
        choices = await step('brand_choices', { brand: brandRead }, async () => {
          const x = await identifyMedicine(ctx, { brand: brandRead });
          return x.found ? [{ name: x.medicine.name, composition: describeKey(x.medicine.ckey) }] : (x.choices || []);
        }, (c) => ({ choices: c.length }));
      }
      return { status: 'unreadable', reason: readCheck.reason, read_score: readCheck.score, lang, read, trace, source, ...(choices.length ? { choices } : {}) };
    }
  }

  // A typed short form ("pcm 500", "paracetamol syp 250"): the reviewed list (public/short-forms.js),
  // tried only when the name as typed was not found, before any model; exact matching as always.
  if (!id.found && source === 'text' && text) {
    const expanded = expandShortForms(text);
    if (expanded !== text) {
      query = { brand: expanded, composition: '', form: '' };
      id = await step('identify_medicine', { ...query, short_forms: true }, () => identifyMedicine(ctx, query), (r) =>
        r.found ? { name: r.medicine.name, composition: r.label, via: r.via } : { found: false }
      );
    }
  }

  // Kannada/Hindi script (roadmap S2.5): English letters by a fixed table (public/indic.js); an exact
  // fit is answered, otherwise brands that sound alike are offered as choices with their salts.
  // The language model below is asked only when nothing sounds alike.
  if (!id.found && source === 'text' && text && hasIndic(text)) {
    const latin = transliterate(text);
    query = { brand: latin, composition: '', form: '' };
    id = await step('identify_medicine', { ...query, transliterated: true }, () => identifyMedicine(ctx, query), (r) =>
      r.found ? { name: r.medicine.name, composition: r.label, via: r.via } : { found: false, choices: r.choices?.length || 0 }
    );
    if (!id.found && !id.choices?.length) {
      const choices = await step('sounds_like', { text: latin }, () => soundsLikeChoices(ctx, latin), (r) => ({ choices: r.length }));
      if (choices.length) id = { found: false, choices };
    }
  }

  // A salt and strength typed with no form must not be answered by a brand named like the salt in one
  // form ("Tramadol 50 mg" -> "Tramadol 50mg Capsule"): offered as choices when other forms exist.
  if (id.found && id.via === 'brand' && source === 'text' && text && !hasIndic(text)) {
    const choices = await formGuessChoices(ctx, query.brand, id);
    if (choices.length) {
      trace.push({ tool: 'form_guess', input: { text: query.brand }, output: { choices: choices.length }, ms: 0 });
      id = { found: false, choices };
    }
  }
  // A typed salt must not be answered by a brand that has other salts ("Doxepin 10 mg" -> "Doxepin
  // Tablet" = doxylamine + vitamin B6): asked, with the salts shown.
  if (id.found && id.via === 'brand' && source === 'text' && text && !hasIndic(text)) {
    const choices = await otherSaltChoices(ctx, query.brand, id);
    if (choices.length) {
      trace.push({ tool: 'other_salt', input: { text: query.brand }, output: { choices: choices.length }, ms: 0 });
      id = { found: false, choices };
    }
  }
  // Another form typed than the Jan Aushadhi product has ("Pregabalin tablets 75"): the medicines in the
  // typed form come first, then that product. Never an answer by itself.
  if (!id.found && id.formDiffers && source === 'text' && text && !hasIndic(text)) {
    const typed = await step('salt_choices', { text: query.brand }, () => saltChoices(ctx, query.brand), (r) => ({ choices: r.length }));
    id = { found: false, choices: [...typed, ...id.choices.filter((c) => !typed.some((x) => x.name === c.name))].slice(0, 5) };
  }

  // A salt and strength typed in English letters ("Metoprolol 50 mg") that no brand or Jan Aushadhi
  // name fits (roadmap S3.11): the real medicines with that salt and strength, as choices with their
  // salts; Jan Aushadhi products first. Never an answer by itself (form and release are not guessed).
  if (!id.found && !id.choices?.length && source === 'text' && text && !hasIndic(text)) {
    const choices = await step('salt_choices', { text }, () => saltChoices(ctx, text), (r) => ({ choices: r.length }));
    if (choices.length) id = { found: false, choices };
  }

  // Typed text in Kannada/Devanagari script, or phrased as a question: let the language model
  // pull out the medicine name, then try again. Not for scanned text: a model guessing a brand
  // from a strip's stray words could pick the wrong medicine. Never when there are choices to offer.
  if (!id.found && !id.choices?.length && source === 'text' && text && (NON_LATIN.test(text) || text.split(/\s+/).length > 3) && env.AI) {
    const u = await step('understand_text', { text }, () => understandText(env, text), (r) => (r.ok ? { brand: r.brand, composition: r.composition, usage: r.usage } : { failed: r.error }));
    if (u.ok) {
      // Keep the dosage form the person typed ("... 500/125 tablet"); the model may drop it.
      query = { brand: u.brand, composition: u.composition, form: extractDosageForm(text) || '' };
      id = await step('identify_medicine', query, () => identifyMedicine(ctx, query), (r) =>
        r.found ? { name: r.medicine.name, composition: r.label, via: r.via } : { found: false }
      );
    }
  }

  if (!id.found) {
    // "Did you mean…?": close brand names for a typed name (a typo, "65O" for 650). Only shown
    // for the person to tap; nothing is assumed, and a typed strength is never changed.
    const choices = source === 'text' ? id.choices || firstChoices || [] : [];
    const suggestions = source === 'text' && text && !hasIndic(text) ? await suggestNames(ctx, text).catch(() => []) : [];
    // Choices (brands that partly fit) and "Did you mean" (a typo: "Dolp 500" -> Dolo 500) can both apply.
    if (choices.length) {
      const more = suggestions.filter((n) => !choices.some((c) => c.name === n));
      return { status: 'not_found', lang, read, trace, source, choices, ...(more.length ? { suggestions: more } : {}) };
    }
    return { status: 'not_found', lang, read, trace, source, ...(suggestions.length ? { suggestions } : {}) };
  }

  const med = id.medicine;
  const meta = await loadMeta(db);
  const same = await step('find_same_salt', { ckey: med.ckey }, () => findSameSalt(ctx, med.ckey), (r) => ({
    count: r.count,
    cheapest: r.items[0] ? `${r.items[0].name} @ ₹${r.items[0].unit_price}/unit` : null,
  }));
  // Narrow-therapeutic-index medicines: no cheaper option of any kind is suggested, so the
  // Jan Aushadhi generic is not looked up either (the Kendra list is still shown).
  // The database's flag comes from the original pipeline; the key check covers salts added since.
  const ntiMed = !!med.nti || ntiFromKey(med.ckey);
  // Narrow-therapeutic-index medicines: the Jan Aushadhi product (same salt, same strength) is
  // shown as INFORMATION only, marked `nti`: no brand list, no saving, no price in the answer,
  // and "change only if your doctor agrees".
  const ja = meta.ja_loaded_at
    ? await step('jan_aushadhi_match', { ckey: med.ckey, ...(ntiMed ? { info_only: 'narrow-therapeutic-index medicine' } : {}) }, () => janAushadhiMatch(ctx, med.ckey), (r) =>
        r.available ? { drug_code: r.product.drug_code, name: r.product.generic_name, mrp: r.product.mrp, unit_size: r.product.unit_size } : { available: false }
      )
    : { available: false, pending: true };
  if (ntiMed) ja.nti = true;
  if (!meta.ja_loaded_at) trace.push({ tool: 'jan_aushadhi_match', input: { ckey: med.ckey }, output: { skipped: 'PMBJP product list not loaded' }, ms: 0 });

  // NPPA ceiling price: the legal maximum per unit. Never for a never-switch medicine (no price talk).
  const ceiling = meta.ceiling_list_date && !ntiMed
    ? await step('ceiling_price', { ckey: med.ckey }, () => ceilingPrice(ctx, med.ckey), (r) => (r.available ? { unit_price: r.unit_price, notified_on: r.notified_on } : { available: false }))
    : { available: false };

  const wantsKendra = pin.length === 6 || (input.lat != null && input.lng != null);
  let kendras = { by: null, items: [], pending: !meta.kendras_loaded_at };
  if (wantsKendra && meta.kendras_loaded_at) {
    kendras = await step('nearest_kendra', { pin: pin || undefined, location: input.lat != null ? 'approximate (not stored)' : undefined }, () =>
      nearestKendra(ctx, { pin, lat: input.lat, lng: input.lng }), (r) => ({ by: r.by, found: r.items.length, nearest: r.items[0]?.code }));
  } else if (wantsKendra) {
    trace.push({ tool: 'nearest_kendra', input: { pin }, output: { skipped: 'Kendra list not loaded' }, ms: 0 });
  }

  const nti = ntiMed;
  const saving = nti ? { pack: med.pack, scanned_unit: med.unit_price, best_unit: null, saving_pack: null, pct: null } : computeSaving(med, same, ja);
  const cheapest = same.items[0];
  // No same-salt brand at all: is that because this salt has none, or because the brand price
  // list is not loaded? The answer and the screen say which (one cheap query, only in this case).
  const brandsLoaded = same.count > 0 || (await ctx.meds.loaded());
  const facts = {
    brand: med.name,
    composition: describeKey(med.ckey).split(' · ')[0],
    count: same.count,
    cheapBrand: cheapest && cheapest.name.toLowerCase() !== med.name.toLowerCase() ? cheapest.name : null,
    cheapUnit: cheapest?.unit_price,
    yourUnit: med.unit_price,
    // Never in the answer for an NTI medicine (the answer stops at the doctor warning anyway).
    jaName: ja.available && !nti ? ja.product.generic_name : null,
    jaUnit: ja.available && !nti ? ja.product.unit_price : null,
    saving: saving.saving_pack,
    pack: saving.pack,
    form: med.form,
    nti,
    brandsLoaded,
  };
  const answer = await step('compose_answer', { lang }, async () => composeAnswer(lang, facts), (a) => ({ chars: a.length }));

  return {
    status: 'ok',
    lang,
    source,
    read,
    // Anything read from a photo or a scan is shown for the person to confirm before any
    // alternative or price is shown: a misread must never become a switch suggestion.
    needs_confirmation: source !== 'text',
    read_score: readCheck?.score ?? null,
    medicine: { name: med.name, manufacturer: med.manufacturer, composition: describeKey(med.ckey), ckey: med.ckey, price: med.price, pack: med.pack, unit_price: med.unit_price, form: med.form, nti, via: id.via, alternatives: id.alternatives },
    same_salt: nti ? { count: same.count, items: [], cheapest_unit: null } : same,
    jan_aushadhi: ja,
    ceiling,
    kendras,
    saving,
    answer,
    pin3: pin.length === 6 ? pin.slice(0, 3) : null,
    data: { brand_prices: (await ctx.meds.meta())?.dataset_date || meta.medicines_dataset_date || 'November 2022', brands_loaded: brandsLoaded, ja_list_date: meta.ja_list_date || null, kendra_list_date: meta.kendra_list_date || null, ceiling_list_date: meta.ceiling_list_date || null },
    trace,
  };
}

// ── Read confidence ─────────────────────────────────────────────────────────
// The vision model gives no reliable score of its own, so the score comes from checks a guess
// cannot pass: salts with strengths were read (50); the brand read matches those salts (+50), or
// no known brand was read so the salts alone decide (+30); a brand that contradicts the salts adds
// nothing. If the model itself says the print is not clearly legible, the score is capped at 40.
export const READ_PASS_MARK = 70;

export function scoreRead(id, query, read) {
  const salts = parseSaltComposition(query.composition || '');
  const hasComposition = salts.length > 0 && salts.every(([, strength]) => !!strength);
  let score = 0;
  let reason = null;
  if (!hasComposition) reason = 'no_composition';
  else {
    score = 50;
    if (id.found && id.via === 'brand+composition' && id.composition_agrees === true) score += 50;
    else if (id.found && id.via === 'composition') score += 30;
    else reason = 'brand_mismatch'; // a known brand whose salts differ from what was read
  }
  const confidence = typeof read?.confidence === 'number' ? read.confidence : null;
  if (confidence != null && confidence < 0.6) {
    score = Math.min(score, 40);
    reason = reason || 'low_confidence';
  }
  if (score < READ_PASS_MARK && !reason) reason = 'low_confidence';
  return { score, reason: score >= READ_PASS_MARK ? null : reason, model_confidence: confidence };
}

/** Typed text that is really a strip read by the keyboard's camera scan, not a name someone typed. */
export function looksScanned(text) {
  if (!text || NON_LATIN.test(text)) return false; // Kannada/Hindi typing goes to understand_text
  const words = text.split(/\s+/).filter(Boolean).length;
  return /\n/.test(text) || words > 6;
}

/** OCR-style text (on-device Tesseract, or the keyboard's Scan text) -> query, with no model call. */
async function readOcrText(ctx, ocr, trace) {
  // The form printed or typed with the salts ("oral suspension", "syrup", "capsule"); a tablet
  // only when no form word is there. A syrup must never be compared with tablets.
  const composition = compositionFromText(ocr);
  // A strength per ml ("Each 10 ml contains ...") is a liquid even when no form word was read.
  const query = { brand: '', composition, form: extractDosageForm(ocr) || (/(?:mg|mcg|g|iu)\/\d*ml\)/i.test(composition) ? 'liquid' : 'tablet') };
  const candidates = brandCandidatesFromText(ocr);
  trace.push({ tool: 'parse_ocr_text', input: { chars: ocr.length }, output: { brand_candidates: candidates.slice(0, 6), composition: query.composition }, ms: 0 });
  // A word that merely looks like a brand ("APD", "Din A") is never enough: a brand is accepted
  // only when the salts and strengths read from the SAME text match that brand. Without a
  // readable composition there is no brand match at all (the person is asked to retake / type).
  if (!query.composition) return query;
  for (const c of candidates) {
    const r = await identifyMedicine(ctx, { brand: c, composition: query.composition, form: query.form });
    if (r.found && r.via === 'brand+composition' && r.composition_agrees === true) {
      query.brand = c;
      break;
    }
  }
  return query;
}

let metaCache = null;
let metaAt = 0;
/** Called after a data import so the next lookup sees the new list date at once. */
export function resetMetaCache() {
  metaCache = null;
  metaAt = 0;
}
export async function loadMeta(db) {
  if (metaCache && Date.now() - metaAt < 60_000) return metaCache;
  const res = await db.prepare('SELECT key, value FROM meta').all();
  metaCache = Object.fromEntries((res.results || []).map((r) => [r.key, r.value]));
  metaAt = Date.now();
  return metaCache;
}
