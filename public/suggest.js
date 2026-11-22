// Suggestions while typing (roadmap S1.1): brand names that start like what the patient types
// ("dol" → Dolo 650 Tablet, Dolo 500 Tablet …). Read in the phone from the static name index
// (/meds/n/<hex of a name prefix>.json, built by data/build_meds.mjs), so typing costs no Worker
// request and the typed text never leaves the phone: only a 3+ letter prefix file is fetched.
// Names only: tapping one runs the normal check; nothing is assumed from a suggestion.

const NAME_PREFIX = 3; // first level of the name index (worker/src/medstore.js)
const MAX_FILES = 12; // files read for one suggestion list (split index levels)

const hexOf = (s) => [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** "Dolo-650mg Tab" -> ["dolo", "650", "mg", "tab"]: letters and numbers as separate words. */
export function words(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(/[^a-z0-9.]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
}

/** Text worth suggesting for: Latin letters, starting with at least 3 letters. */
export function suggestable(typed) {
  const t = String(typed || '').trim().toLowerCase();
  return /^[a-z][a-z0-9 .\-+/]*$/.test(t) && /^[a-z]{3}/.test(t.replace(/[^a-z0-9]/g, '')) ? t : null;
}

/**
 * Rank brand rows for what was typed: every typed word must start a word of the name, in order,
 * and the first typed word must start the name. A typed number must be a whole number of the
 * name ("65" does not match 650 once a space or more text follows it), so a strength is never
 * changed; while the last word is being typed it may be a prefix ("Dolo 6" → Dolo 650).
 */
export function rankNames(rows, typed, limit = 6) {
  const q = words(typed);
  if (!q.length) return [];
  const typingLast = !/\s$/.test(String(typed));
  const seen = new Map();
  for (const r of rows) {
    const name = Array.isArray(r) ? r[1] : r.name;
    if (!name) continue;
    const n = words(name);
    if (!n.length || !n[0].startsWith(q[0])) continue;
    let at = 0;
    let ok = true;
    for (let i = 0; i < q.length && ok; i++) {
      const last = i === q.length - 1 && typingLast;
      const isNum = /^\d/.test(q[i]);
      const j = n.findIndex((w, k) => k >= at && (isNum && !last ? w === q[i] : w.startsWith(q[i])));
      if (j < 0) ok = false;
      else at = j + 1;
    }
    if (!ok) continue;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.set(k, { name, exact: n[0] === q[0] ? 0 : 1, extra: n.length - q.length, len: name.length });
  }
  return [...seen.values()].sort((a, b) => a.exact - b.exact || a.extra - b.extra || a.len - b.len || (a.name < b.name ? -1 : 1)).slice(0, limit).map((x) => x.name);
}

/**
 * Rows of the name index under the typed prefix. `getJson(path)` returns the parsed file or null.
 * Follows split levels (dol → dolo → …) only as far as the typed letters go.
 */
export async function rowsFor(typed, getJson) {
  const t = (suggestable(typed) || '').split(' ')[0];
  if (t.length < NAME_PREFIX) return [];
  const out = [];
  let files = 0;
  async function walk(prefix) {
    if (files >= MAX_FILES) return;
    files += 1;
    const f = await getJson(`/meds/n/${hexOf(prefix)}.json`);
    if (!f) return;
    out.push(...(f.rows || [])); // rankNames keeps the ones that fit
    // Children whose prefix fits what was typed (all of them while the typed word is shorter).
    const kids = (f.split || []).filter((c) => (t.length <= c.length ? c.startsWith(t) : t.startsWith(c)));
    for (const c of kids.slice(0, MAX_FILES)) await walk(c);
  }
  await walk(t.slice(0, NAME_PREFIX));
  return out;
}

// Index files read during this visit (each keystroke reuses them).
const memo = new Map();
async function fetchJson(path) {
  if (!memo.has(path)) {
    memo.set(path, fetch(path).then((res) => (res.ok ? res.json() : null)).catch(() => null));
    if (memo.size > 200) memo.delete(memo.keys().next().value);
  }
  return memo.get(path);
}

/** Up to `limit` brand names for the typed text (browser: reads the index files, kept for the visit). */
export async function suggestWhileTyping(typed, { limit = 6, getJson } = {}) {
  if (!suggestable(typed)) return [];
  const get = getJson || fetchJson;
  return rankNames(await rowsFor(typed, get), typed, limit);
}
