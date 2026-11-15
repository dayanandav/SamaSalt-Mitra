// The SamaSalt-Mitra agent: a fixed, auditable tool plan. Models are used only where they are
// needed (reading a photo, understanding free text in any script); every price, match and
// safety decision comes from deterministic tools over official / published data.
//
//   read_strip ─► identify_medicine ─► find_same_salt ─► jan_aushadhi_match ─► nearest_kendra ─► compose_answer
//
// Every step is recorded in `trace` (tool, input, short output, ms) and returned to the UI,
// and the eval runner writes the same trace as AgentFoundry run JSONL (.codenow/runs/).
import { readStrip, understandText } from './vision.js';
import { identifyMedicine, findSameSalt, janAushadhiMatch, nearestKendra, computeSaving, compositionFromText, brandCandidatesFromText } from './tools.js';
import { describeKey, extractDosageForm, ntiFromKey } from './normalize.js';
import { assetMeds, d1Meds } from './medstore.js';
import { composeAnswer } from '../../public/strings.js';

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
  const scanned = looksScanned(rawText);
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
      r.ok ? { model: r.model, brand: r.brand, composition: r.composition, form: r.form, release: r.release, usage: r.usage } : { failed: r.errors }
    );
    if (!read.ok) return { status: 'vision_unavailable', lang, trace };
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
    r.found ? { name: r.medicine.name, composition: r.label, via: r.via, composition_agrees: r.composition_agrees } : { found: false }
  );

  // Typed text in Kannada/Devanagari script, or phrased as a question: let the language model
  // pull out the medicine name, then try again.
  if (!id.found && text && (NON_LATIN.test(text) || text.split(/\s+/).length > 3) && env.AI) {
    const u = await step('understand_text', { text }, () => understandText(env, text), (r) => (r.ok ? { brand: r.brand, composition: r.composition, usage: r.usage } : { failed: r.error }));
    if (u.ok) {
      // Keep the dosage form the person typed ("... 500/125 tablet"); the model may drop it.
      query = { brand: u.brand, composition: u.composition, form: extractDosageForm(text) || '' };
      id = await step('identify_medicine', query, () => identifyMedicine(ctx, query), (r) =>
        r.found ? { name: r.medicine.name, composition: r.label, via: r.via } : { found: false }
      );
    }
  }

  if (!id.found) return { status: 'not_found', lang, read, trace, source };

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
  const ja = ntiMed
    ? { available: false, nti: true }
    : meta.ja_loaded_at
    ? await step('jan_aushadhi_match', { ckey: med.ckey }, () => janAushadhiMatch(ctx, med.ckey), (r) =>
        r.available ? { drug_code: r.product.drug_code, name: r.product.generic_name, mrp: r.product.mrp, unit_size: r.product.unit_size } : { available: false }
      )
    : { available: false, pending: true };
  if (ntiMed) trace.push({ tool: 'jan_aushadhi_match', input: { ckey: med.ckey }, output: { skipped: 'narrow-therapeutic-index medicine: no switch suggested' }, ms: 0 });
  else if (!meta.ja_loaded_at) trace.push({ tool: 'jan_aushadhi_match', input: { ckey: med.ckey }, output: { skipped: 'PMBJP product list not loaded' }, ms: 0 });

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
    jaName: ja.available ? ja.product.generic_name : null,
    jaUnit: ja.available ? ja.product.unit_price : null,
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
    medicine: { name: med.name, manufacturer: med.manufacturer, composition: describeKey(med.ckey), ckey: med.ckey, price: med.price, pack: med.pack, unit_price: med.unit_price, form: med.form, nti, via: id.via, alternatives: id.alternatives },
    same_salt: nti ? { count: same.count, items: [], cheapest_unit: null } : same,
    jan_aushadhi: ja,
    kendras,
    saving,
    answer,
    pin3: pin.length === 6 ? pin.slice(0, 3) : null,
    data: { brand_prices: (await ctx.meds.meta())?.dataset_date || meta.medicines_dataset_date || 'November 2022', brands_loaded: brandsLoaded, ja_list_date: meta.ja_list_date || null, kendra_list_date: meta.kendra_list_date || null },
    trace,
  };
}

/** Typed text that is really a strip read by the keyboard's camera scan, not a name someone typed. */
export function looksScanned(text) {
  if (!text || NON_LATIN.test(text)) return false; // Kannada/Hindi typing goes to understand_text
  const words = text.split(/\s+/).filter(Boolean).length;
  return /\n/.test(text) || words > 6;
}

/** OCR-style text (on-device Tesseract, or the keyboard's Scan text) -> query, with no model call. */
async function readOcrText(ctx, ocr, trace) {
  const query = { brand: '', composition: compositionFromText(ocr), form: /capsule/i.test(ocr) ? 'capsule' : 'tablet' };
  const candidates = brandCandidatesFromText(ocr);
  trace.push({ tool: 'parse_ocr_text', input: { chars: ocr.length }, output: { brand_candidates: candidates.slice(0, 6), composition: query.composition }, ms: 0 });
  for (const c of candidates) {
    const r = await identifyMedicine(ctx, { brand: c, composition: query.composition, form: query.form });
    if (r.found && r.via !== 'composition' && r.composition_agrees !== false) {
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
