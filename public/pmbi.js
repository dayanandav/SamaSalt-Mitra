// PMBI (Jan Aushadhi) product-list import, run from the developer page (/dev).
// Shared by the browser (which parses and previews, so the Worker stays within its CPU limit)
// and the Worker (which validates and writes), like strings.js.
//
// A JavaScript port of data/build_ja.py's product path: each PMBJP generic name
// ("Amoxycillin and Potassium Clavulanate Tablets IP 500 mg + 125 mg") is parsed into the
// SAME canonical key the brand database uses ("amoxicillin:500mg+clavulanic acid:125mg|tablet"),
// so a Jan Aushadhi product is only ever shown for an exact salt + strength + form match.
// Rows that cannot be parsed with confidence are reported, never guessed.
//
// Input: the CSV from the PMBI portal's product MRP list export
// (https://janaushadhi.gov.in/product-portfolio/product-mrp-list), columns
// "Sr No, Drug Code, Generic Name, Unit Size, MRP, Group Name", or the same table as JSON.

const FORM_WORDS = [
  [/dispersible tablets?|chewable tablets?|tablets?|tab\b/, 'tablet'],
  [/capsules?|cap\b/, 'capsule'],
  [/eye\/ear drops|eye drops|ear drops|nasal drops|drops/, 'drops'],
  [/oral suspension|suspension|syrup|oral solution|solution|elixir/, 'liquid'],
  [/injection|infusion/, 'injection'],
  [/cream|ointment|gel|lotion/, 'topical'],
  [/respules?/, 'respule'],
  [/inhalation|inhaler/, 'inhaler'],
  [/mouthwash|mouth wash/, 'mouthwash'],
  [/nasal spray|spray/, 'spray'],
  [/suppositor(?:y|ies)/, 'suppository'],
];
// The brand database writes the same strength in more than one way; try each spelling, never a different strength.
const ALT_FORMS = { drops: ['liquid'], liquid: ['drops'] };
const RELEASE_WORDS = [
  [/sustained[- ]release|\bsr\b|prolonged[- ]release|\bpr\b/, 'SR'],
  [/extended[- ]release|\ber\b|\bxr\b/, 'XR'],
  [/controlled[- ]release|\bcr\b/, 'CR'],
  [/modified[- ]release|\bmr\b/, 'MR'],
];
const SALT_SUFFIXES = new Set([
  'hydrochloride', 'hcl', 'sodium', 'potassium', 'calcium', 'magnesium', 'besilate', 'besylate',
  'maleate', 'succinate', 'tartrate', 'mesylate', 'mesilate', 'fumarate', 'citrate', 'sulphate',
  'sulfate', 'phosphate', 'hyclate', 'dihydrate', 'monohydrate', 'trihydrate', 'bromide',
  'acetate', 'valerate', 'propionate', 'dipropionate', 'hydrobromide', 'bitartrate',
]);
const SYNONYMS = {
  'potassium clavulanate': 'clavulanic acid',
  'clavulanate potassium': 'clavulanic acid',
  'diluted potassium clavulanate': 'clavulanic acid',
  amoxycillin: 'amoxicillin',
  acetaminophen: 'paracetamol',
  'vitamin c': 'ascorbic acid',
  'levothyroxine sodium': 'thyroxine',
  levothyroxine: 'thyroxine',
  'glyceryl trinitrate': 'nitroglycerin',
  salbutamol: 'albuterol',
  frusemide: 'furosemide',
  lignocaine: 'lidocaine',
  'lignocaine hydrochloride': 'lidocaine',
};
const STRENGTH = String.raw`(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|gm|g|iu|%\s*w/[wv]|%|ml)(?![a-z])`;
const MULTI_STRENGTH = String.raw`(\d+(?:\.\d+)?(?:\s*/\s*\d+(?:\.\d+)?)+)\s*(mg|mcg|µg|ug|gm|g|iu)(?![a-z])`;
const UNIT_TO_MG = { g: 1000, gm: 1000, mg: 1, mcg: 0.001, 'µg': 0.001, ug: 0.001 };

// Python repr() of a float, for the values we produce (0.0045, 2.5, 0.25 ...).
const pyNum = (v) => (Number.isInteger(v) ? String(v) : String(v));

export function stdStrength(num, unit) {
  const u = unit.toLowerCase().replace(/\s+/g, '');
  if (u === 'iu') return `${num}IU`;
  if (u.startsWith('%')) return u.slice(1) ? `${num}% ${u.slice(1)}` : `${num}%`;
  if (u === 'ml') return `${num}ml`;
  const v = Math.round(parseFloat(num) * (UNIT_TO_MG[u] ?? 1) * 1e6) / 1e6;
  return `${pyNum(v)}mg`;
}

const strip = (s, chars) => {
  let a = 0;
  let b = s.length;
  while (a < b && chars.includes(s[a])) a++;
  while (b > a && chars.includes(s[b - 1])) b--;
  return s.slice(a, b);
};

/** Salt names as they appear in the brand database's canonical keys. */
export class Vocab {
  constructor(keys = []) {
    this.keys = new Set();
    this.names = new Set();
    for (const k of keys) {
      if (!k) continue;
      this.keys.add(k);
      for (const part of k.split('|')[0].split('+')) this.names.add(part.split(':')[0]);
    }
  }

  map(name) {
    let n = strip(name.toLowerCase().replace(/\s+/g, ' '), ' ,.-');
    n = SYNONYMS[n] ?? n;
    if (!this.names.size || this.names.has(n)) return n;
    let base = n.split(' ').filter((w) => !SALT_SUFFIXES.has(w)).join(' ');
    base = SYNONYMS[base] ?? base;
    if (this.names.has(base)) return base;
    for (const cand of [`${base} hydrochloride`, `${base} sodium`, `${base} potassium`, `${base} calcium`]) {
      if (this.names.has(cand)) return cand;
    }
    return base || n;
  }
}

/** PMBJP generic name -> { key: canonical key | null, reason }. Mirrors parse_generic() in data/build_ja.py. */
export function parseGeneric(name, vocab) {
  const s = name.replace(/\s+/g, ' ').trim();
  const low = s.toLowerCase();
  let form = null;
  let formAt = low.length;
  for (const [re, f] of FORM_WORDS) {
    const m = low.match(re);
    if (m && m.index < formAt) {
      form = f;
      formAt = m.index;
    }
  }
  if (!form) return { key: null, reason: 'no dosage form' };
  let release = null;
  for (const [re, r] of RELEASE_WORDS) {
    if (re.test(low)) {
      release = r;
      break;
    }
  }
  let saltText = s.slice(0, formAt);
  saltText = saltText.replace(/\((?:sr|er|xr|cr|mr|pr)\)/gi, ' ');
  saltText = saltText.replace(/\b(sustained|prolonged|extended|controlled|modified)[- ]release\b/gi, ' ');
  saltText = saltText.replace(/\b(gastro[- ]resistant|enteric[- ]coated|film[- ]coated|uncoated|orally disintegrating|dispersible|chewable)\b/gi, ' ');
  const chunks = saltText.split(/\s*(?:,|&|\+|\band\b|\bwith\b)\s*/i).map((x) => x.trim()).filter(Boolean);
  const inline = chunks.map((c) => c.match(new RegExp(STRENGTH, 'i')));
  let salts;
  let strengths;
  if (chunks.length && inline.every(Boolean)) {
    // "Ibuprofen 400mg and Paracetamol 325mg Tablets": each salt carries its own strength.
    salts = chunks.map((c, i) => strip(c.slice(0, inline[i].index).replace(/\b(ip|bp|usp)\b/gi, ' '), ' ()'));
    strengths = inline.map((m) => [m[1], m[2]]);
    if (!salts.every(Boolean)) return { key: null, reason: 'strength without a salt name' };
  } else if (inline.some(Boolean)) {
    return { key: null, reason: 'strengths on some salts only' };
  } else {
    salts = chunks;
    const tail = s.slice(formAt);
    strengths = [...tail.matchAll(new RegExp(STRENGTH, 'gi'))].map((m) => [m[1], m[2]]);
    const multi = tail.match(new RegExp(MULTI_STRENGTH, 'i'));
    if (strengths.length < salts.length && multi) {
      // "Losartan + Chlorthalidone Tablet (25/6.25 Mg)": one unit for all strengths.
      strengths = multi[1].split('/').map((v) => [v.trim(), multi[2]]);
    }
  }
  if (!salts.length || !strengths.length) return { key: null, reason: 'no salts or strengths' };
  // "500 mg + 125 mg" / "1mg/500mg": the k-th strength belongs to the k-th salt.
  if (strengths.length < salts.length || (strengths.length > salts.length && salts.length > 1)) {
    return { key: null, reason: `${salts.length} salts but ${strengths.length} strengths` };
  }
  strengths = strengths.slice(0, salts.length);
  const names = salts.map((n) => vocab.map(n));
  const per5 = form === 'liquid' && /\bper\s*5\s*ml\b|\/\s*5\s*ml\b/.test(low);
  const keys = [];
  for (const f of [form, ...(ALT_FORMS[form] || [])]) {
    for (const barePct of [false, true]) {
      for (const per of per5 ? [true, false] : [false]) {
        const sts = strengths.map(([v, u]) => {
          let st = stdStrength(v, u);
          if (barePct) st = st.split(' ')[0];
          if (per && st.endsWith('mg')) st += '/5ml';
          return st;
        });
        const pairs = names.map((n, i) => [n, sts[i]]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
        const k = pairs.map(([n, st]) => `${n}:${st}`).join('+') + `|${f}` + (release ? `|${release}` : '');
        if (!keys.includes(k)) keys.push(k);
      }
    }
  }
  for (const k of keys) if (!vocab.keys.size || vocab.keys.has(k)) return { key: k, reason: 'ok' };
  return { key: keys[0], reason: 'no branded equivalent in database' };
}

/** Units in a pack: "10's" -> 10, "15 Tablets" -> 15, "100 ml" -> 100. */
export function unitsIn(unitSize) {
  const s = String(unitSize || '').toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:'s|s\b|tab|cap|x|nos|ml)/) || s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return v > 0 ? v : null;
}

/** Minimal RFC 4180 CSV parser (quoted fields, "" escapes, CRLF, BOM). Returns row objects. */
export function parseCsv(text) {
  const src = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x !== '')) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/** The product table from a CSV export or a saved JSON response of the portal's product list. */
export function readTable(text) {
  const t = String(text || '').trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    let data = JSON.parse(t);
    if (!Array.isArray(data)) {
      for (const k of ['data', 'responseBody', 'content', 'result', 'rows', 'list']) if (k in data) { data = data[k]; break; }
      if (!Array.isArray(data)) for (const k of ['content', 'list', 'data', 'rows']) if (data && k in data) { data = data[k]; break; }
    }
    if (!Array.isArray(data)) throw new Error('JSON has no product list');
    return data;
  }
  return parseCsv(t);
}

function pick(row, ...names) {
  const norm = {};
  for (const [k, v] of Object.entries(row)) norm[String(k).toLowerCase().replace(/[^a-z]/g, '')] = v;
  for (const n of names) {
    const v = norm[n.toLowerCase().replace(/[^a-z]/g, '')];
    if (v != null && v !== '') return String(v).trim();
  }
  return '';
}

/** Rows of the official list -> products ready for ja_products, plus what was left out and why. */
export function buildProducts(rows, vocab) {
  const byCode = new Map(); // as INSERT OR REPLACE: the last row with a drug code wins
  const unparsed = [];
  const stats = { rows: rows.length, ok: 0, no_equivalent: 0, unparsed: 0, skipped: 0 };
  for (const r of rows) {
    const code = pick(r, 'drugCode', 'drug_code', 'Drug Code', 'productCode', 'code');
    const name = pick(r, 'genericName', 'generic_name', 'Generic Name', 'productName', 'drugName', 'Name of the Product', 'name');
    const unit = pick(r, 'unitSize', 'unit_size', 'Unit Size', 'packSize', 'Pack Size', 'unit');
    const mrp = pick(r, 'mrp', 'MRP', 'MRP (Rs.)', 'MRP(in RS.)', 'mrpRs', 'price');
    const group = pick(r, 'groupName', 'group_name', 'Group Name', 'therapeuticGroup', 'category');
    const mrpV = parseFloat(String(mrp).replace(/[^\d.]/g, ''));
    if (!name || !Number.isFinite(mrpV)) {
      stats.skipped++;
      continue;
    }
    const { key, reason } = parseGeneric(name, vocab);
    if (!key) {
      stats.unparsed++;
      unparsed.push({ drug_code: code, generic_name: name, unit_size: unit, mrp: mrpV, reason });
      continue;
    }
    const drugCode = code || name;
    stats[reason === 'ok' ? 'ok' : 'no_equivalent']++;
    const units = unitsIn(unit);
    byCode.set(drugCode, {
      drug_code: drugCode,
      generic_name: name,
      unit_size: unit,
      mrp: mrpV,
      group_name: group || null,
      ckey: key,
      units,
      unit_price: units ? Math.round((mrpV / units) * 1e4) / 1e4 : null,
      matched: reason === 'ok',
    });
  }
  return { items: [...byCode.values()], unparsed, stats };
}

/** What applying `items` would change in the current ja_products table. */
export function diffProducts(current, items) {
  const before = new Map(current.map((r) => [r.drug_code, r]));
  const after = new Map(items.map((r) => [r.drug_code, r]));
  const added = [];
  const changed = [];
  let unchanged = 0;
  for (const [code, n] of after) {
    const o = before.get(code);
    if (!o) added.push(n);
    else if (Math.abs((o.mrp ?? 0) - n.mrp) > 0.004 || o.ckey !== n.ckey || o.unit_size !== n.unit_size || o.generic_name !== n.generic_name) {
      changed.push({ drug_code: code, generic_name: n.generic_name, unit_size: n.unit_size, old_mrp: o.mrp, new_mrp: n.mrp, ckey_changed: o.ckey !== n.ckey });
    } else unchanged++;
  }
  const removed = current.filter((r) => !after.has(r.drug_code));
  return { added, changed, removed, unchanged };
}

/** Counts and the rows worth a human look, for the preview. */
export function summarize(built, diff, currentCount, vocabSize) {
  const pct = (c) => (c.old_mrp ? (c.new_mrp - c.old_mrp) / c.old_mrp : 0);
  const changed = [...diff.changed].sort((x, y) => Math.abs(pct(y)) - Math.abs(pct(x)));
  return {
    stats: built.stats,
    brand_vocabulary: vocabSize, // 0 = brand database not loaded: keys are not checked against brands
    current_count: currentCount,
    new_count: built.items.length,
    added: diff.added.length,
    removed: diff.removed.length,
    changed: diff.changed.length,
    mrp_up: diff.changed.filter((c) => c.new_mrp > c.old_mrp).length,
    mrp_down: diff.changed.filter((c) => c.new_mrp < c.old_mrp).length,
    unchanged: diff.unchanged,
    samples: {
      changed: changed.slice(0, 200),
      added: diff.added.slice(0, 100),
      removed: diff.removed.slice(0, 100),
      unparsed: built.unparsed.slice(0, 1000),
    },
  };
}

const MAX_PRODUCTS = 20000;
const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const numOrNull = (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);

/** Worker side: check products sent by the developer page before writing them. Returns an error string or null. */
export function validateProducts(items) {
  if (!Array.isArray(items) || !items.length) return 'No products to import.';
  if (items.length > MAX_PRODUCTS) return `Too many products (${items.length}).`;
  const codes = new Set();
  for (const [i, p] of items.entries()) {
    const where = `Product ${i + 1}`;
    if (!p || typeof p !== 'object') return `${where}: not an object.`;
    if (!str(p.drug_code, 200)) return `${where}: bad drug code.`;
    if (codes.has(p.drug_code)) return `${where}: duplicate drug code ${p.drug_code}.`;
    codes.add(p.drug_code);
    if (!str(p.generic_name, 500)) return `${where}: bad generic name.`;
    if (!(typeof p.mrp === 'number' && Number.isFinite(p.mrp) && p.mrp >= 0 && p.mrp < 1e6)) return `${where}: bad MRP.`;
    if (!str(p.ckey, 500) || !/^[^|]+\|[a-z_]+(\|[A-Z]{2})?$/.test(p.ckey)) return `${where}: bad composition key.`;
    if (!(p.unit_size == null || (typeof p.unit_size === 'string' && p.unit_size.length <= 100))) return `${where}: bad unit size.`;
    if (!(p.group_name == null || (typeof p.group_name === 'string' && p.group_name.length <= 200))) return `${where}: bad group name.`;
    if (!numOrNull(p.units) || !numOrNull(p.unit_price)) return `${where}: bad units or unit price.`;
  }
  return null;
}

// SQL literal for the batched INSERTs (D1 allows at most 100 bound parameters per statement,
// so ~2,400 products are written as a few literal multi-row INSERTs inside one atomic batch).
export function sqlLit(v) {
  if (v == null) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function insertStatements(items, rowsPerStatement = 300) {
  const out = [];
  for (let i = 0; i < items.length; i += rowsPerStatement) {
    const vals = items
      .slice(i, i + rowsPerStatement)
      .map((p) => `(${[p.drug_code, p.generic_name, p.unit_size, p.mrp, p.group_name, p.ckey, p.units, p.unit_price].map(sqlLit).join(',')})`);
    out.push(`INSERT OR REPLACE INTO ja_products (drug_code, generic_name, unit_size, mrp, group_name, ckey, units, unit_price) VALUES ${vals.join(',')}`);
  }
  return out;
}
