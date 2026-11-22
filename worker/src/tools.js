// The agent's tools. Each takes a D1-compatible `db` (prepare().bind().all()/first())
// and returns plain JSON, so they are unit-testable with node:sqlite (see test/).
import { keyFor, buildCanonicalKey, parseSaltComposition, extractDosageForm, extractReleaseType, describeKey, isNti, ntiFromKey } from './normalize.js';
import { d1Meds } from './medstore.js';
import { namePrefixes, soundsAlike, soundKey } from '../../public/indic.js';

// Tools take a plain D1 `db` (tests) or { db, meds } (the Worker, where brand medicines are
// read from static files: see medstore.js). Jan Aushadhi and Kendras are always in D1.
const ctxCache = new WeakMap();
export function ctxOf(x) {
  if (x && x.meds && x.db) return x;
  if (!ctxCache.has(x)) ctxCache.set(x, { db: x, meds: d1Meds(x) });
  return ctxCache.get(x);
}

const STOP = new Set(['tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'cap', 'caps', 'strip', 'ip', 'bp', 'usp', 'mg', 'the', 'of', 'and', 'each', 'film', 'coated', 'uncoated', 'contains']);

export function tokens(s) {
  return (s || '')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)\s*(mg|mcg|g|ml)\b/g, '$1')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\b(\d+)\.0\b/g, '$1')
    .split(' ')
    .filter((t) => t && !STOP.has(t));
}

/** Score how well a medicine name matches a typed/read query (0..1). Numbers must match exactly. */
export function nameScore(query, name) {
  const q = tokens(query);
  const n = tokens(name);
  if (!q.length || !n.length) return 0;
  if (q[0] !== n[0] && !n[0].startsWith(q[0])) return 0;
  const nset = new Set(n);
  let hit = 0;
  for (const t of q) {
    if (nset.has(t)) hit += 1;
    else if (/^\d/.test(t)) return 0; // query says 650, name says 500: not this medicine
    else if (n.some((x) => x.startsWith(t) && t.length >= 3)) hit += 0.7;
  }
  const extra = n.filter((t) => !q.includes(t)).length;
  // Names with numbers the query didn't mention (e.g. "Dolo 1000" for "Dolo") rank lower.
  const extraNums = n.filter((t) => /^\d/.test(t) && !q.includes(t)).length;
  return hit / q.length - 0.04 * extra - 0.15 * extraNums + (q[0] === n[0] ? 0.05 : 0);
}

// Salt-form words printed on strips ("Rosuvastatin Calcium", "Pantoprazole Sodium") that the
// brand database usually drops. Tried only when the literal key is unknown to the database.
const SALT_FORMS = /\s+(?:calcium|sodium|potassium|magnesium|hydrochloride|hcl|besilate|besylate|maleate|succinate|tartrate|mesylate|mesilate|fumarate|citrate|sulphate|sulfate|phosphate|hyclate|dihydrate|monohydrate|trihydrate|anhydrous|bromide|acetate)\b/gi;

// Salts listed without "+" ("Amoxicillin 500mg Clavulanic Acid 125mg", as people and models
// often write them) get the separator back.
const MISSING_PLUS = /(\d(?:\.\d+)?\s*(?:mg|mcg|g|gm|iu|%))\s*(?:,|&|\band\b|\bwith\b)?\s+(?=(?!(?:tablets?|tabs?|capsules?|caps?|syrup|suspension|injection|drops?|cream|gel|ointment|inhaler|sachets?|solution|film|coated|uncoated|sr|er|xr|cr|ip|bp|usp)\b)[A-Za-z]{3,})/gi;

/** Printed composition -> text the salt parser understands. Found via an AgentFoundry Replay of a
 *  vision run: "Rosuvastatin Calcium I.P. eq. to Rosuvastatin ..... 10 mg" produced a key no brand had. */

export function cleanComposition(text) {
  return String(text || '')
    .replace(MISSING_PLUS, '$1 + ')
    .split(/\s*\+\s*/)
    .map((part) => {
      let p = part.replace(/\b(?:I\.P\.|B\.P\.|U\.S\.P\.|Ph\.\s*Eur\.)/gi, ' ');
      const eq = p.match(/\b(?:eq\.?|equiv\.?|equivalent)\s*to\s+(.*)$/i);
      if (eq) p = eq[1];
      p = p.replace(/\(as [^)]*\)/gi, ' ').replace(/\.{2,}/g, ' ').replace(/\banhydrous\b/gi, ' ');
      return p.replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean)
    .join(' + ');
}

/** The canonical key for a printed composition, preferring a variant that brands actually use. */
export async function resolveCompositionKey(ctx, composition, hints) {
  const { db, meds } = ctxOf(ctx);
  const cleaned = cleanComposition(composition);
  const base = [keyFor(cleaned, hints), keyFor(cleaned.replace(SALT_FORMS, ''), hints), keyFor(composition, hints)];
  const keys = base.map((k) => k.key);
  // Typed generic names often carry no dosage form ("amoxicillin + clavulanic acid 500/125"):
  // try the common solid forms, but only accept a key that brands actually use.
  if (!base[0].form) for (const f of ['tablet', 'capsule']) keys.push(keyFor(cleaned, { ...hints, form: f }).key, keyFor(cleaned.replace(SALT_FORMS, ''), { ...hints, form: f }).key);
  const variants = [...new Set(keys.filter(Boolean))];
  for (const k of variants) {
    // A key is real if a brand uses it, or the official Jan Aushadhi list does.
    if (await meds.hasKey(k)) return k;
    if (await db.prepare('SELECT 1 AS ok FROM ja_products WHERE ckey = ?1 LIMIT 1').bind(k).first()) return k;
  }
  return variants[0] || '';
}

// Words a Jan Aushadhi product name may carry that do not change the medicine: salt forms and
// coating words. Anything else the person did not type (release, another form, another salt,
// another number) means it is not that product.
const JA_HARMLESS = new Set(['calcium', 'sodium', 'potassium', 'magnesium', 'hydrochloride', 'hcl', 'besilate', 'besylate', 'maleate', 'succinate', 'tartrate', 'mesylate', 'mesilate', 'fumarate', 'citrate', 'sulphate', 'sulfate', 'phosphate', 'hyclate', 'dihydrate', 'monohydrate', 'trihydrate', 'anhydrous', 'bromide', 'acetate', 'gastro', 'resistant', 'enteric', 'i.p.', 'b.p.', 'u.s.p.', 'usp.', 'ip.', 'bp.', 's']);

/**
 * A typed name that is a product in the official Jan Aushadhi list (as printed on a Jan Aushadhi
 * strip, or shorter: "Paracetamol 650"). Strict: every typed word and number is in the product
 * name, every number of the product was typed, and its other words are only salt-form words.
 * Two different compositions fitting = no match. Returns { product, ckey } or null.
 */
export async function janAushadhiByName(ctx, text) {
  const { db } = ctxOf(ctx);
  const q = tokens(text);
  if (!q.length || !q.some((t) => /^\d/.test(t)) || q[0].length < 4) return null;
  const res = await db
    .prepare("SELECT drug_code, generic_name, unit_size, mrp, group_name, units, unit_price, ckey FROM ja_products WHERE ckey IS NOT NULL AND ckey != '' AND lower(generic_name) LIKE ?1")
    .bind(`${q[0]}%`)
    .all();
  const fits = (res.results || []).filter((r) => {
    const n = tokens(r.generic_name);
    if (!q.every((t) => n.includes(t))) return false;
    return n.every((t) => q.includes(t) || (!/^\d/.test(t) && JA_HARMLESS.has(t)));
  });
  const keys = [...new Set(fits.map((r) => r.ckey))];
  if (keys.length !== 1) return null;
  fits.sort((a, b) => (a.unit_price ?? 1e9) - (b.unit_price ?? 1e9));
  return { product: fits[0], ckey: keys[0] };
}

// Edit distance (insert, delete, change one letter), stopping early above `max`.
function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * "Did you mean…?" for a typed name that was not found: up to `limit` brand names whose first word
 * is the typed word with a small typo (or starts with it). A typed number ("65O" read as 650) must
 * be in the name: a different strength is never offered. Names only: the person taps one to check it.
 */
export async function suggestNames(ctx, text, { limit = 5 } = {}) {
  const { meds } = ctxOf(ctx);
  // Letter O / l typed inside a number ("65O", "5OO", "1O") is a zero / one.
  const fixed = String(text || '').replace(/\b\d+[oOlI\d]*\b/g, (m) => m.replace(/[oO]/g, '0').replace(/[lI]/g, '1'));
  const q = tokens(fixed);
  const word = q.find((t) => /^[a-z]/.test(t));
  if (!word || word.length < 3) return [];
  const nums = q.filter((t) => /^\d/.test(t));
  // A form typed with the name ("syrup", "tablet") must be the brand's form: never an injection for a syrup.
  const form = extractDosageForm(fixed);
  const max = word.length <= 4 ? 1 : 2;
  const seen = new Map();
  for (const p of [...new Set([word, word.slice(0, 4), word.slice(0, 3)])].filter((p) => p.length >= 3)) {
    for (const r of await meds.byNamePrefix(p)) {
      const n = tokens(r.name);
      if (!n.length || seen.has(r.name.toLowerCase())) continue;
      const d = n[0].startsWith(word) ? 0 : editDistance(word, n[0], max);
      if (d > max) continue;
      if (!nums.every((x) => n.includes(x))) continue;
      if (form && r.form !== form) continue;
      const hits = q.filter((t) => t !== word && n.some((x) => x === t || (t.length >= 3 && x.startsWith(t)))).length;
      seen.set(r.name.toLowerCase(), { name: r.name, d, hits, extra: n.length - q.length, len: r.name.length });
    }
    if (seen.size >= limit * 3) break;
  }
  return [...seen.values()].sort((a, b) => a.d - b.d || b.hits - a.hits || a.extra - b.extra || a.len - b.len).slice(0, limit).map((x) => x.name);
}

/** Approved staff-added brands (added_medicines) whose name starts with `token`, as brand rows (no price). */
export async function addedByNamePrefix(db, token) {
  try {
    const res = await db.prepare("SELECT id, name, manufacturer, ckey, form, rel, nti FROM added_medicines WHERE status = 'approved' AND lower(name) LIKE ?1 LIMIT 50").bind(`${String(token).toLowerCase()}%`).all();
    return (res.results || []).map((r) => ({ id: `A${r.id}`, name: r.name, manufacturer: r.manufacturer, salt: null, ckey: r.ckey, price: null, pack: null, unit_price: null, form: r.form, rel: r.rel, nti: r.nti, incomplete: 0, added: true }));
  } catch {
    return []; // table not there yet (migration 0012 not applied): brands from the list only
  }
}

function jaNameResult(ja) {
  const [, form = null, rel = null] = ja.ckey.split('|');
  return {
    found: true,
    via: 'jan_aushadhi_name',
    medicine: { id: null, name: ja.product.generic_name, manufacturer: null, salt: describeKey(ja.ckey).split(' · ')[0], ckey: ja.ckey, price: null, pack: null, unit_price: null, form, rel, nti: ntiFromKey(ja.ckey) ? 1 : 0, incomplete: 0 },
    label: describeKey(ja.ckey),
    alternatives: [],
    composition_key_from_strip: null,
    composition_agrees: null,
  };
}

// Words in a brand name that do not make it another medicine: forms, units and pack words.
// Anything else the patient did not type (E, T, H, AM, Plus, Forte, DS, SR, OD, MD …) may.
const NEUTRAL_WORDS = new Set(['tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'cap', 'caps', 'syrup', 'syp', 'syr', 'suspension', 'susp', 'oral', 'solution', 'drops', 'drop', 'injection', 'inj', 'infusion', 'cream', 'gel', 'ointment', 'oint', 'lotion', 'spray', 'nasal', 'inhaler', 'respules', 'sachet', 'powder', 'granules', 'strip', 'mg', 'mcg', 'gm', 'g', 'ml', 'iu', 'w', 'v', 'ip', 'bp', 'usp', 'film', 'coated', 'uncoated', 'sugar', 'free', 'the', 'of', 'and']);
const plainWords = (s) => tokens(s).filter((t) => !NEUTRAL_WORDS.has(t) && !/^\d/.test(t));
const numbersIn = (s) => tokens(s).filter((t) => /^\d/.test(t)).map(Number);
/** The brand's strengths as numbers ("atorvastatin:10mg+ezetimibe:10mg|tablet" -> [10, 10]). */
const keyStrengths = (ckey) => String(ckey || '').split('|')[0].split('+').map((p) => parseFloat(p.split(':')[1])).filter((n) => !Number.isNaN(n));

/**
 * Is this brand exactly what was typed? Its words (forms and units aside) are the typed words, the
 * first one in full; every typed number is in its name or is its strength ("Atorva 10" = "Atorva
 * Tablet", 10 mg); a typed form ("syrup", "syp") is its form.
 */
export function fitsTyped(typed, row) {
  const q = plainWords(typed);
  const n = plainWords(row.name);
  if (!q.length || q.length !== n.length || q.some((w, i) => w !== n[i])) return false;
  const nameNums = numbersIn(row.name);
  const strengths = keyStrengths(row.ckey);
  if (!numbersIn(typed).every((x) => nameNums.includes(x) || strengths.includes(x))) return false;
  const typedForm = extractDosageForm(String(typed).replace(/\bsy[pr]\b/gi, 'syrup').replace(/\bsusp\b/gi, 'suspension').replace(/\btabs?\b/gi, 'tablet').replace(/\bcaps?\b/gi, 'capsule'));
  return !typedForm || !row.form || row.form === typedForm;
}

/**
 * Kannada/Hindi names in English letters (roadmap S2.5): brands whose first word sounds like the
 * typed word (public/indic.js), with the typed number in the name or as the strength. Choices only
 * (name + salts): a transliteration is never trusted enough to answer by itself.
 */
export async function soundsLikeChoices(ctx, latin, limit = 5) {
  const { meds, db } = ctxOf(ctx);
  const word = String(latin || '').split(/\s+/).find((w) => /^[a-z]{3,}/.test(w));
  if (!word) return [];
  const nums = numbersIn(latin);
  const extra = plainWords(latin).filter((w) => w !== word && /^[a-z]{2,}$/.test(w));
  const prefixes = namePrefixes(word);
  const lists = await Promise.all(prefixes.map(async (p) => [...(await meds.byNamePrefix(p).catch(() => [])), ...(await addedByNamePrefix(db, p))]));
  const out = new Map();
  for (const r of lists.flat()) {
    const n = plainWords(r.name);
    if (!n.length || !soundsAlike(word, n[0])) continue;
    if (!extra.every((w) => n.slice(1).some((x) => soundsAlike(w, x) || x.startsWith(w)))) continue;
    const nameNums = numbersIn(r.name);
    const strengths = keyStrengths(r.ckey);
    if (!nums.every((x) => nameNums.includes(x) || strengths.includes(x))) continue;
    const k = r.name.toLowerCase();
    if (out.has(k)) continue;
    out.set(k, { name: r.name, composition: describeKey(r.ckey), rank: (soundKey(n[0]) === soundKey(word) ? 0 : 1) + (n.length - 1 - extra.length) * 0.1 + (r.form === 'tablet' ? 0 : 0.05) });
  }
  // Salt names typed in Kannada/Hindi ("मेटफॉर्मिन 500"): official Jan Aushadhi products whose name
  // starts with a word that sounds alike and has the typed strength, offered first under their full
  // official name (tapping it is the strict Jan Aushadhi name match). Never for a typed form it lacks.
  const ja = [];
  if (nums.length) {
    const res = await db.prepare("SELECT drug_code, generic_name, ckey FROM ja_products WHERE ckey IS NOT NULL AND ckey != ''").all().catch(() => ({ results: [] }));
    for (const p of res.results || []) {
      const first = tokens(p.generic_name)[0];
      if (!first || !soundsAlike(word, first)) continue;
      // One typed number is the strength of the salt the patient named ("cetirizine 10" is never a
      // combination where 10 mg is another salt's); several numbers must all be the product's.
      const [salts, form] = p.ckey.split('|');
      const named = salts.split('+').find((s) => soundsAlike(word, s.split(':')[0].split(' ')[0]));
      if (nums.length === 1 ? !named || parseFloat(named.split(':')[1]) !== nums[0] : !nums.every((x) => [...numbersIn(p.generic_name), ...keyStrengths(p.ckey)].includes(x))) continue;
      const oral = form === 'tablet' || form === 'capsule' ? 0 : 0.2; // no form typed: tablets and capsules first
      ja.push({ name: p.generic_name, composition: describeKey(p.ckey), rank: (soundKey(first) === soundKey(word) ? 0 : 0.5) + (salts.includes('+') ? 0.3 : 0) + oral });
    }
  }
  ja.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length);
  const brands = [...out.values()].sort((a, b) => a.rank - b.rank || a.name.length - b.name.length);
  return [...ja.slice(0, 3), ...brands].slice(0, limit).map(({ name, composition }) => ({ name, composition }));
}

/** Tool: identify_medicine. Resolve a brand name (and optional composition read off the strip) to one DB row. */
export async function identifyMedicine(ctx, { brand = '', composition = '', form = '' } = {}) {
  const { meds } = ctxOf(ctx);
  const q = tokens(brand);
  let rows = [];
  let candidates = [];
  if (q.length) {
    // v2.0.7 (roadmap S1.2): brands added by staff from the strip and approved by a Reviewer count as brands too.
    rows = [...(await meds.byNamePrefix(q[0])), ...(await addedByNamePrefix(ctxOf(ctx).db, q[0]))];
    candidates = rows.map((r) => ({ ...r, score: nameScore(brand, r.name) })).filter((r) => r.score > 0.45);
  }

  // Composition read from the strip, if any, gives a key to cross-check the brand guess.
  let compKey = '';
  if (composition) compKey = await resolveCompositionKey(ctx, composition, { name: `${brand} ${form}`, form });

  // A typed name (no composition to cross-check): "ask, don't guess" (owner's decision 22 Nov 2026).
  // Only a brand whose words are exactly the typed words is taken; one with extra words ("Atorva
  // E", "Calpol T": another combination), a longer first word, or another form than typed is
  // offered as a choice with its salts, never picked.
  const fullName = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  // A brand's full name exactly as listed (also a name tapped in the choices) is that brand.
  const named = !composition && q.length ? rows.filter((r) => fullName(r.name) === fullName(brand)) : [];
  if (named.length && new Set(named.map((r) => r.ckey)).size === 1) candidates = named.map((r) => ({ ...r, score: 2 }));
  else if (!composition && q.length) {
    const exact = rows.filter((r) => fitsTyped(brand, r)).map((r) => ({ ...r, score: 1 + nameScore(brand, r.name) }));
    // The same name in more than one strength or composition ("Atorva" = 5, 10, 20, 40, 80 mg) is a choice too.
    const several = new Set(exact.filter((r) => r.ckey).map((r) => r.ckey)).size > 1;
    // No number typed, but the brand's name has one ("Crocin" -> "Crocin 1000mg"): the strength would be a guess.
    const strengthGuess = !numbersIn(brand).length && exact.length > 0 && exact.every((r) => numbersIn(r.name).length > 0);
    if (exact.length && !several && !strengthGuess) candidates = exact;
    else if (exact.length || candidates.length) {
      const ja = await janAushadhiByName(ctx, brand);
      if (ja) return jaNameResult(ja);
      const seen = new Set();
      const choices = [];
      const pool = exact.length && !strengthGuess ? exact : [...exact, ...candidates];
      for (const c of [...pool].sort((a, b) => b.score - a.score || (a.form === 'tablet' ? 0 : 1) - (b.form === 'tablet' ? 0 : 1) || a.name.length - b.name.length)) {
        if (seen.has(c.name.toLowerCase())) continue;
        seen.add(c.name.toLowerCase());
        choices.push({ name: c.name, composition: describeKey(c.ckey) });
        if (choices.length >= 5) break;
      }
      return { found: false, choices };
    }
  }

  if (candidates.length) {
    candidates.sort((a, b) => {
      const ka = compKey && a.ckey === compKey ? 1 : 0;
      const kb = compKey && b.ckey === compKey ? 1 : 0;
      if (ka !== kb) return kb - ka;
      if (Math.abs(b.score - a.score) > 1e-9) return b.score - a.score;
      // Prefer the plain tablet/strip pack over syrups etc. when the query is ambiguous.
      const fa = a.form === 'tablet' ? 1 : 0;
      const fb = b.form === 'tablet' ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return a.name.length - b.name.length;
    });
    const best = candidates[0];
    return {
      found: true,
      via: compKey && best.ckey === compKey ? 'brand+composition' : 'brand',
      medicine: best,
      label: describeKey(best.ckey),
      alternatives: candidates.slice(1, 4).map((c) => c.name),
      composition_key_from_strip: compKey || null,
      composition_agrees: compKey ? best.ckey === compKey : null,
    };
  }

  // A typed name (no composition read from a photo) that is an official Jan Aushadhi product:
  // its composition key comes from the PMBJP list, so the code, MRP and same-salt brands all follow.
  if (!composition && brand) {
    const ja = await janAushadhiByName(ctx, brand);
    if (ja) return jaNameResult(ja);
  }

  if (compKey) {
    // Brand unknown to the database, but the strip's composition is enough to compare.
    const salts = parseSaltComposition(composition);
    // A typed generic name ("amoxicillin clavulanic acid 500 125") is not a brand: name it by its composition.
    const first = tokens(brand)[0];
    const generic = !first || compKey.split('|')[0].includes(first);
    const label = describeKey(compKey).split(' · ')[0];
    return {
      found: true,
      via: 'composition',
      medicine: { id: null, name: generic ? label : brand, manufacturer: null, salt: composition, ckey: compKey, price: null, pack: null, unit_price: null, form: extractDosageForm(form) || extractDosageForm(brand), rel: extractReleaseType(brand), nti: isNti(salts) ? 1 : 0, incomplete: 0 },
      label: describeKey(compKey),
      alternatives: [],
      composition_key_from_strip: compKey,
      composition_agrees: null,
    };
  }
  return { found: false };
}

/** Tool: find_same_salt. Every brand with an identical canonical key, cheapest first (per unit). */
// The source lists some brands several times (pack variants): both stores keep the cheapest per name.
export async function findSameSalt(ctx, ckey, { limit = 8 } = {}) {
  if (!ckey) return { count: 0, items: [] };
  return ctxOf(ctx).meds.sameSalt(ckey, limit);
}

/** Tool: jan_aushadhi_match. The PMBJP generic with the same canonical key, if the basket has one. */
export async function janAushadhiMatch(ctx, ckey) {
  const { db } = ctxOf(ctx);
  if (!ckey) return { available: false };
  const res = await db
    .prepare('SELECT drug_code, generic_name, unit_size, mrp, group_name, units, unit_price FROM ja_products WHERE ckey = ?1 ORDER BY unit_price ASC LIMIT 3')
    .bind(ckey)
    .all();
  const rows = res.results || [];
  if (!rows.length) return { available: false };
  return { available: true, product: rows[0], others: rows.slice(1) };
}

/** Tool: ceiling_price. NPPA's legal maximum per unit (before GST) for this composition, if notified. */
export async function ceilingPrice(ctx, ckey) {
  const { db } = ctxOf(ctx);
  if (!ckey) return { available: false };
  const row = await db.prepare('SELECT name, unit, price, unit_price, notification, notified_on FROM ceiling_prices WHERE ckey = ?1').bind(ckey).first().catch(() => null);
  return row ? { available: true, ...row } : { available: false };
}

const R = 6371;
function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Tool: nearest_kendra. By coordinates if given, else by PIN code (same PIN, then nearby PINs). */
export async function nearestKendra(ctx, { pin = '', lat = null, lng = null, limit = 3 } = {}) {
  const { db } = ctxOf(ctx);
  const cols = 'code, name, address, district, state, pin, lat, lng, phone';
  // Kendra coordinates are the centre of their PIN code (data/build_pins.mjs): distances are approximate.
  const byPoint = async (la, lo) => {
    const d = 0.25; // ~25 km box, widened until it holds `limit` Kendras (or ~300 km)
    let found = [];
    for (const box of [d, d * 4, d * 12]) {
      const res = await db
        .prepare(`SELECT ${cols} FROM kendras WHERE lat BETWEEN ?1 AND ?2 AND lng BETWEEN ?3 AND ?4 LIMIT 400`)
        .bind(la - box, la + box, lo - box, lo + box)
        .all();
      const rows = (res.results || [])
        .map((k) => ({ ...k, km: Math.round(haversine({ lat: la, lng: lo }, k) * 10) / 10, approx: true }))
        .sort((a, b) => a.km - b.km);
      found = rows;
      if (rows.length >= limit) break;
    }
    return found.slice(0, limit);
  };
  if (lat != null && lng != null && Number.isFinite(+lat) && Number.isFinite(+lng)) {
    const rows = await byPoint(+lat, +lng);
    if (rows.length) return { by: 'location', items: rows };
  }
  const p = String(pin || '').replace(/\D/g, '');
  // v2.0.4: a PIN code with a known location: the nearest Kendras by distance from its centre.
  if (p.length === 6) {
    const c = await db.prepare('SELECT lat, lng FROM pin_locations WHERE pin = ?1').bind(p).first().catch(() => null);
    if (c) {
      const rows = await byPoint(c.lat, c.lng);
      if (rows.length) return { by: rows[0].pin === p ? 'pin' : 'nearby-pin', items: rows };
    }
  }
  if (p.length === 6) {
    for (const n of [6, 5, 4, 3]) {
      const prefix = p.slice(0, n);
      const res = await db
        .prepare(`SELECT ${cols} FROM kendras WHERE pin LIKE ?1 LIMIT 200`)
        .bind(`${prefix}%`)
        .all();
      const rows = res.results || [];
      if (rows.length) {
        rows.sort((a, b) => Math.abs(+a.pin - +p) - Math.abs(+b.pin - +p));
        return { by: n === 6 ? 'pin' : 'nearby-pin', items: rows.slice(0, limit) };
      }
    }
    return { by: 'pin', items: [] };
  }
  return { by: null, items: [] };
}

/** Saving for one pack of the scanned brand against the cheapest option (brand or Jan Aushadhi). */
export function computeSaving(med, same, ja) {
  const pack = med.pack || 10;
  const scanned = med.unit_price;
  const options = [same.cheapest_unit, ja.available ? ja.product.unit_price : null].filter((x) => x != null && x > 0);
  if (scanned == null || !options.length) return { pack, scanned_unit: scanned ?? null, best_unit: options.length ? Math.min(...options) : null, saving_pack: null, pct: null };
  const best = Math.min(...options);
  const saving = Math.max(0, (scanned - best) * pack);
  return {
    pack,
    scanned_unit: scanned,
    best_unit: best,
    saving_pack: Math.round(saving * 100) / 100,
    pct: scanned > 0 ? Math.round((1 - best / scanned) * 100) : null,
  };
}

/** Pull salts + strengths out of free OCR text ("Each tablet contains: Paracetamol IP 650 mg"). */
export function compositionFromText(text) {
  // Strips print "Paracetamol I.P. 650 mg": the dots would break the salt-name match.
  const src = String(text || '').replace(/\b(?:I\.\s?P|B\.\s?P|U\.\s?S\.\s?P)\.?(?=\s|$|\d)/gi, ' IP ');
  const found = [];
  const seen = new Set();
  // Liquids give the strength per volume: "Each 5 ml contains Paracetamol IP 120 mg" is 120mg/5ml
  // (as brands list it), never 120 mg. An inline "120 mg/5 ml" or "120 mg per 5 ml" wins.
  const vol = (n) => (Number(n) === 1 ? 'ml' : `${Number(n)}ml`);
  const basis = src.match(/\b(?:each|per|every)\s+(\d+(?:\.\d+)?)?\s*ml\b/i);
  const perVol = basis ? `/${vol(basis[1] || 1)}` : '';
  // The name starts at a word start: never a tail of a longer word ("h" of "Each").
  const re = /\b([A-Za-z][A-Za-z\- ]{2,40}?)\s*(?:\b(?:IP|BP|USP)\b)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(mg|mcg|g|gm|iu)\b(?:\s*(?:\/|per)\s*(\d+(?:\.\d+)?)?\s*ml\b)?/gi;
  let m;
  while ((m = re.exec(src))) {
    let name = m[1].replace(/\b(each|per|every|ml|film|coated|uncoated|tablet|tablets|capsule|capsules|contains|composition|hard|gelatin|equivalent|to|as|oral|suspension|syrup|solution|drops|and|with|of|reconstituted|dispersible|chewable|gastro|resistant|enteric)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (name.length < 4) continue;
    const per = m[0].match(/(?:\/|per)\s*(\d+(?:\.\d+)?)?\s*ml\s*$/i) ? `/${vol(m[4] || 1)}` : perVol;
    const part = `${name} (${m[2]}${m[3].toLowerCase()}${per})`;
    // The salt is usually printed twice (title line and "Each tablet contains"): count it once.
    if (seen.has(part.toLowerCase())) continue;
    seen.add(part.toLowerCase());
    found.push(part);
  }
  return found.join(' + ');
}

/** Candidate brand strings from OCR text: "DOLO 650", "Pan-40" ... */
export function brandCandidatesFromText(text) {
  const out = [];
  const re = /\b([A-Za-z][A-Za-z\-]{2,20})(?:[\s\-]+([A-Za-z]{1,6}))?[\s\-]*(\d{1,4}(?:\.\d+)?)?\b/g;
  let m;
  while ((m = re.exec(text))) {
    const w = m[1].toLowerCase();
    if (STOP.has(w) || ['each', 'contains', 'store', 'keep', 'manufactured', 'composition', 'dosage', 'schedule', 'warning', 'batch', 'exp', 'mfg', 'price', 'incl', 'taxes'].includes(w)) continue;
    out.push([m[1].replace(/-+$/, ''), m[2], m[3]].filter(Boolean).join(' '));
  }
  return [...new Set(out)].slice(0, 12);
}

export { buildCanonicalKey, describeKey };
