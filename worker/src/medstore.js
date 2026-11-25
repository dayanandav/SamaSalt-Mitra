// The brand medicine list (246,068 rows, read-only) can live in two places:
//
//   * D1 `medicines` table: used by the tests and as a fallback.
//   * Static files under public/meds/ (built by data/build_meds.mjs): used in production.
//     Cloudflare serves static assets free and without read/write limits, while the free D1
//     plan allows only 100,000 rows written per day (this list needs ~740,000 with indexes).
//
// Both stores answer the same three questions with the same results:
//   byNamePrefix(token): rows whose name starts with token (what `name LIKE 'token%'` returned)
//   sameSalt(ckey):      the find_same_salt summary for a composition key
//   hasKey(ckey):        does any brand use this composition key?
//
// File layout (all JSON):
//   meds/meta.json            { rows, keys, dataset_date, built_at, buckets }
//   meds/keys.json            every composition key (the /dev importer's vocabulary)
//   meds/k/<bucket>.json      { [ckey]: same-salt summary }, bucket = fnv1a(ckey) % buckets
//   meds/n/<hex prefix>.json  { rows: [...], split?: [child prefixes] }: names by lowercase prefix

import { soundGroup } from '../../public/indic.js';

export const ROW_FIELDS = ['id', 'name', 'manufacturer', 'ckey', 'price', 'pack', 'unit_price', 'form', 'rel', 'nti', 'incomplete'];
export const BUCKETS = 2048;
export const NAME_PREFIX = 3; // first level of the name index
const MAX_SHARD_BYTES = 100_000; // keeps each JSON.parse well inside the Worker's CPU budget
const SUMMARY_ITEMS = 20; // same-salt items kept per key (the app shows 8)
const NAME_ROW_LIMIT = 400; // as `LIMIT 400` in the original query

export function fnv1a(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
export const bucketOf = (ckey, buckets = BUCKETS) => fnv1a(ckey) % buckets;
export const hexOf = (s) => [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('');

const toRow = (a) => Object.fromEntries(ROW_FIELDS.map((f, i) => [f, a[i] ?? null]));
const fromRow = (r) => ROW_FIELDS.map((f) => r[f] ?? null);
// SQLite's NOCASE order (ASCII case folded), then rowid: the order the name index returned rows in.
const byNameThenId = (a, b) => {
  const x = a.name.toLowerCase();
  const y = b.name.toLowerCase();
  return x < y ? -1 : x > y ? 1 : a.id - b.id;
};

/** find_same_salt over rows of one key: priced, complete rows, cheapest first, one per brand name. */
export function summarizeSameSalt(rows, limit = SUMMARY_ITEMS) {
  const priced = rows.filter((r) => r.unit_price > 0 && !r.incomplete).sort((a, b) => a.unit_price - b.unit_price || a.id - b.id).slice(0, 2000);
  const seen = new Set();
  const uniq = [];
  for (const r of priced) {
    const k = r.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(r);
  }
  const prices = uniq.map((r) => r.unit_price);
  return {
    count: uniq.length,
    cheapest_unit: prices[0] ?? null,
    median_unit: prices.length ? prices[Math.floor(prices.length / 2)] : null,
    max_unit: prices.length ? prices[prices.length - 1] : null,
    items: uniq.slice(0, limit).map(({ name, manufacturer, price, pack, unit_price }) => ({ name, manufacturer, price, pack, unit_price })),
  };
}

// ── D1 store (tests, fallback) ───────────────────────────────────────────────
export function d1Meds(db) {
  return {
    kind: 'd1',
    async byNamePrefix(token) {
      const res = await db
        .prepare('SELECT id, name, manufacturer, salt, ckey, price, pack, unit_price, form, rel, nti, incomplete FROM medicines WHERE name LIKE ?1 LIMIT 400')
        .bind(`${token}%`)
        .all();
      return res.results || [];
    },
    async sameSalt(ckey, limit = 8) {
      const res = await db
        .prepare('SELECT name, manufacturer, price, pack, unit_price FROM medicines WHERE ckey = ?1 AND unit_price > 0 AND incomplete = 0 ORDER BY unit_price ASC LIMIT 2000')
        .bind(ckey)
        .all();
      const all = res.results || [];
      const seen = new Set();
      const uniq = [];
      for (const r of all) {
        const k = r.name.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        uniq.push(r);
      }
      const prices = uniq.map((r) => r.unit_price);
      return {
        count: uniq.length,
        cheapest_unit: prices[0] ?? null,
        median_unit: prices.length ? prices[Math.floor(prices.length / 2)] : null,
        max_unit: prices.length ? prices[prices.length - 1] : null,
        items: uniq.slice(0, limit),
      };
    },
    async hasKey(ckey) {
      return !!(await db.prepare('SELECT 1 AS ok FROM medicines WHERE ckey = ?1 LIMIT 1').bind(ckey).first());
    },
    async loaded() {
      return !!(await db.prepare('SELECT 1 AS ok FROM medicines LIMIT 1').first());
    },
    async count() {
      return (await db.prepare('SELECT COUNT(*) AS n FROM medicines').first())?.n ?? 0;
    },
    async keysJson() {
      const keys = await db.prepare('SELECT DISTINCT ckey FROM medicines WHERE ckey IS NOT NULL').raw();
      return JSON.stringify(keys.map((r) => r[0]));
    },
    async meta() {
      return null;
    },
  };
}

// ── Static-file store (production) ───────────────────────────────────────────
/** `get(path)` returns the file's text, or null when it does not exist. */
export function fileMeds(get, meta) {
  const cache = new Map(); // per isolate: recently used files, parsed
  const json = async (path) => {
    if (cache.has(path)) return cache.get(path);
    const text = await get(path);
    const v = text == null ? null : JSON.parse(text);
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    cache.set(path, v);
    return v;
  };
  const bucket = (ckey) => json(`meds/k/${bucketOf(ckey, meta.buckets)}.json`);

  // Rows under a name prefix, in name order, stopping once `limit` rows are collected.
  async function collect(prefix, token, out, limit) {
    const f = await json(`meds/n/${hexOf(prefix)}.json`);
    if (!f) return;
    for (const a of f.rows || []) {
      const r = toRow(a);
      if (r.name.toLowerCase().startsWith(token)) out.push(r);
    }
    const kids = (f.split || []).filter((c) => token.length <= prefix.length || token.startsWith(c));
    // When every child is needed (the token ends here), fetch them a few at a time in parallel,
    // in name order, and stop once enough rows are collected.
    for (let i = 0; i < kids.length && out.length < limit; i += 6) {
      const batch = kids.slice(i, i + 6);
      await Promise.all(batch.map((c) => json(`meds/n/${hexOf(c)}.json`)));
      for (const c of batch) {
        if (out.length >= limit) return;
        await collect(c, token, out, limit); // reads the files just fetched
      }
    }
  }

  return {
    kind: 'files',
    async byNamePrefix(token) {
      const t = String(token || '').toLowerCase();
      if (!t) return [];
      const out = [];
      if (t.length >= NAME_PREFIX) {
        // A token like "telma" may sit several split levels deep (tel > telm > telma): fetch every
        // level in one parallel round trip instead of one after another. Missing files are cheap.
        const depth = Math.min(t.length, NAME_PREFIX + 4);
        await Promise.all(Array.from({ length: depth - NAME_PREFIX + 1 }, (_, i) => json(`meds/n/${hexOf(t.slice(0, NAME_PREFIX + i))}.json`)));
        await collect(t.slice(0, NAME_PREFIX), t, out, NAME_ROW_LIMIT);
      }
      else {
        const index = (await json('meds/n/index.json')) || [];
        for (const p of index) {
          if (out.length >= NAME_ROW_LIMIT) break;
          if (p.startsWith(t)) await collect(p, t, out, NAME_ROW_LIMIT);
        }
      }
      return out.sort(byNameThenId).slice(0, NAME_ROW_LIMIT).map((r) => ({ ...r, salt: null }));
    },
    /** First words of brand names that may sound like `word` (null: the index is not there). */
    async soundWords(word) {
      return json(`meds/s/${soundGroup(word)}.json`);
    },
    async sameSalt(ckey, limit = 8) {
      const s = (await bucket(ckey))?.[ckey];
      if (!s) return { count: 0, cheapest_unit: null, median_unit: null, max_unit: null, items: [] };
      return { ...s, items: s.items.slice(0, limit) };
    },
    async hasKey(ckey) {
      return !!(await bucket(ckey))?.[ckey];
    },
    async loaded() {
      return meta.rows > 0;
    },
    async count() {
      return meta.rows;
    },
    async keysJson() {
      return (await get('meds/keys.json')) || '[]';
    },
    async meta() {
      return meta;
    },
  };
}

/** The production store, from the Worker's static assets; null if the files were not built/deployed. */
let filesStore; // per isolate: undefined = not checked yet, null = no files
export async function assetMeds(assets) {
  if (filesStore !== undefined) return filesStore;
  const get = async (path) => {
    const res = await assets.fetch(new Request(`https://assets.invalid/${path}`));
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return null;
    return res.text();
  };
  const metaText = await get('meds/meta.json').catch(() => null);
  filesStore = metaText ? fileMeds(get, JSON.parse(metaText)) : null;
  return filesStore;
}
export function resetAssetMeds() {
  filesStore = undefined;
}

// ── Building the files (data/build_meds.mjs, and the tests) ───────────────────
/** rows: objects with ROW_FIELDS. Returns Map(path -> JSON text). */
export function buildMedFiles(rows, { datasetDate = null, builtAt = new Date().toISOString(), buckets = BUCKETS, maxShardBytes = MAX_SHARD_BYTES } = {}) {
  const files = new Map();
  const put = (path, v) => files.set(path, JSON.stringify(v));

  // Same-salt summaries by key bucket.
  const byKey = new Map();
  for (const r of rows) {
    if (!r.ckey) continue;
    if (!byKey.has(r.ckey)) byKey.set(r.ckey, []);
    byKey.get(r.ckey).push(r);
  }
  const bucketMaps = new Map();
  for (const [k, rs] of byKey) {
    const b = bucketOf(k, buckets);
    if (!bucketMaps.has(b)) bucketMaps.set(b, {});
    bucketMaps.get(b)[k] = summarizeSameSalt(rs);
  }
  for (const [b, m] of bucketMaps) put(`meds/k/${b}.json`, m);
  put('meds/keys.json', [...byKey.keys()]);

  // Name index: split a prefix one character further while its file is too big.
  const sorted = [...rows].sort(byNameThenId);
  const top = new Map();
  for (const r of sorted) {
    const p = r.name.toLowerCase().slice(0, NAME_PREFIX);
    if (!top.has(p)) top.set(p, []);
    top.get(p).push(r);
  }
  const writeShard = (prefix, rs) => {
    const plain = { rows: rs.map(fromRow) };
    if (JSON.stringify(plain).length <= maxShardBytes || prefix.length >= NAME_PREFIX + 4) {
      put(`meds/n/${hexOf(prefix)}.json`, plain);
      return;
    }
    const here = [];
    const kids = new Map();
    for (const r of rs) {
      const n = r.name.toLowerCase();
      if (n.length <= prefix.length) here.push(r);
      else {
        const c = n.slice(0, prefix.length + 1);
        if (!kids.has(c)) kids.set(c, []);
        kids.get(c).push(r);
      }
    }
    const order = [...kids.keys()].sort();
    put(`meds/n/${hexOf(prefix)}.json`, { rows: here.map(fromRow), split: order });
    for (const c of order) writeShard(c, kids.get(c));
  };
  const prefixes = [...top.keys()].sort();
  for (const p of prefixes) writeShard(p, top.get(p));
  put('meds/n/index.json', prefixes);

  // Sounds-like index: every first word, grouped by the first two consonants of its sound (public/indic.js).
  const bySound = new Map();
  for (const w of new Set(rows.map((r) => (r.name.toLowerCase().match(/^[a-z]{3,}/) || [])[0]).filter(Boolean))) {
    const g = soundGroup(w);
    if (!bySound.has(g)) bySound.set(g, []);
    bySound.get(g).push(w);
  }
  for (const [g, words] of bySound) put(`meds/s/${g}.json`, words.sort());

  put('meds/meta.json', { rows: rows.length, keys: byKey.size, dataset_date: datasetDate, built_at: builtAt, buckets });
  return files;
}
