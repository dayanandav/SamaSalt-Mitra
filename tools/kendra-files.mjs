// Writes public/meds/kp/<first 3 PIN digits>.json: the 3 nearest Kendras of every PIN with a known place, from
// the newest backup, so a PIN needs no Kendra rows from D1 (nearestKendra in worker/src/tools.js). Run by
// tools/backup.mjs. Kendra points are the centre of their PIN, as in D1: distances are approximate.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const file = readdirSync(join(root, 'backups')).filter((f) => /^samasalt-mitra-\d{4}-\d{2}-\d{2}\.sql$/.test(f)).sort().at(-1);
const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync(join(root, 'backups', file), 'utf8'));
const date = raw.prepare("SELECT value FROM meta WHERE key = 'kendra_list_date'").get()?.value;
const kendras = raw.prepare('SELECT code, name, address, district, state, pin, lat, lng, phone FROM kendras WHERE lat IS NOT NULL AND lng IS NOT NULL').all();
const pins = raw.prepare('SELECT pin, lat, lng FROM pin_locations').all();
if (!date || kendras.length < 5000 || pins.length < 5000) throw new Error(`${file}: ${kendras.length} Kendras, ${pins.length} PINs, not full lists`);

const rad = (d) => (d * Math.PI) / 180;
const km = (a, b) => { const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); };
const cells = new Map();
const cell = (la, lo) => `${Math.floor(la * 4)},${Math.floor(lo * 4)}`;
for (const k of kendras) { const c = cell(k.lat, k.lng); if (!cells.has(c)) cells.set(c, []); cells.get(c).push(k); }
function nearest(p) {
  // The same widening boxes as nearestKendra: 0.25, 1 and 3 degrees.
  for (const box of [0.25, 1, 3]) {
    const n = Math.ceil(box * 4);
    const found = [];
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) for (const k of cells.get(`${Math.floor(p.lat * 4) + a},${Math.floor(p.lng * 4) + b}`) || []) {
      if (Math.abs(k.lat - p.lat) <= box && Math.abs(k.lng - p.lng) <= box) found.push([k, Math.round(km(p, k) * 10) / 10]);
    }
    if (found.length >= 3 || (box === 3 && found.length)) return found.sort((x, y) => x[1] - y[1] || (y[0].pin === p.pin) - (x[0].pin === p.pin) || (x[0].code < y[0].code ? -1 : 1)).slice(0, 3);
  }
  return null;
}
const out = new Map();
for (const p of pins) {
  if (!/^[1-8]\d{5}$/.test(p.pin)) continue; // 9xxxxx is not a place
  const near = nearest(p);
  if (!near) continue; // D1 is asked, as before
  const key = p.pin.slice(0, 3);
  if (!out.has(key)) out.set(key, { list_date: date, kendras: {}, pins: {} });
  const f = out.get(key);
  f.pins[p.pin] = near.map(([k, d]) => { const { code, ...rest } = k; f.kendras[code] = rest; return [code, d]; });
}
const dir = join(root, 'public/meds/kp');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
let bytes = 0;
for (const [key, f] of out) { const s = JSON.stringify(f); bytes += s.length; writeFileSync(join(dir, `${key}.json`), s); }
console.log(`public/meds/kp: ${out.size} files, ${(bytes / 1e6).toFixed(1)} MB, Kendra list of ${date}`);
