// PIN code locations for "Kendras by distance" (v2.0.4).
//
// Source: India Post's All India Pincode Directory (data.gov.in, Government Open Data License -
// India), which gives latitude/longitude per post office. One point per PIN code: the median of its
// post offices, after dropping points outside India and points over 40 km from the first median
// (misplaced offices). Kendras get the point of their PIN code, so distances are approximate
// ("≈ X km"): the official Kendra list has no coordinates of its own.
//
//   node data/build_pins.mjs --csv <pincode.csv> [--out data/build/pin_locations.sql]
//   npx wrangler d1 execute <db> [--env staging] --remote --file data/build/pin_locations.sql
//
// Writes ~19,300 pin_locations rows and fills kendras.lat/lng where empty (free D1: 100k rows/day).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseCsv } from '../public/pmbi.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const km = (a, b) => { const r = (d) => (d * Math.PI) / 180; const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const inIndia = (lat, lng) => lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5;

/** Rows of the India Post file → Map(pin → [lat, lng]). Exported for the test. */
export function pinPoints(rows) {
  const by = new Map();
  for (const r of rows) {
    const pin = String(r.Pincode ?? r.pincode ?? '').trim();
    const lat = parseFloat(r.Latitude ?? r.latitude);
    const lng = parseFloat(r.Longitude ?? r.longitude);
    if (!/^[1-8]\d{5}$/.test(pin) || !inIndia(lat, lng)) continue; // 9xxxxx is army post, not a place
    if (!by.has(pin)) by.set(pin, []);
    by.get(pin).push([lat, lng]);
  }
  const res = new Map();
  for (const [pin, pts] of by) {
    const first = [median(pts.map((p) => p[0])), median(pts.map((p) => p[1]))];
    const near = pts.filter((p) => km(first, p) <= 40);
    const use = near.length ? near : pts;
    res.set(pin, [Math.round(median(use.map((p) => p[0])) * 1e5) / 1e5, Math.round(median(use.map((p) => p[1])) * 1e5) / 1e5]);
  }
  return res;
}

export function pinSql(points, rowsPerStatement = 500) {
  const L = ['CREATE TABLE IF NOT EXISTS pin_locations (pin TEXT PRIMARY KEY, lat REAL NOT NULL, lng REAL NOT NULL);', 'DELETE FROM pin_locations;'];
  const all = [...points].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (let i = 0; i < all.length; i += rowsPerStatement) {
    L.push(`INSERT INTO pin_locations (pin, lat, lng) VALUES ${all.slice(i, i + rowsPerStatement).map(([p, [la, lo]]) => `('${p}',${la},${lo})`).join(',')};`);
  }
  // Kendras: the point of their PIN code (approximate), only where none is set.
  L.push('UPDATE kendras SET lat = (SELECT lat FROM pin_locations WHERE pin = kendras.pin), lng = (SELECT lng FROM pin_locations WHERE pin = kendras.pin) WHERE lat IS NULL AND pin IN (SELECT pin FROM pin_locations);');
  L.push(`INSERT OR REPLACE INTO meta (key, value) VALUES ('pin_locations_loaded_at', '${new Date().toISOString().slice(0, 10)}');`);
  return L.join('\n') + '\n';
}

if (process.argv[1] && process.argv[1].endsWith('build_pins.mjs')) {
  const csvPath = arg('--csv');
  const out = arg('--out', 'data/build/pin_locations.sql');
  if (!csvPath) { console.error('usage: node data/build_pins.mjs --csv <pincode.csv> [--out file.sql]'); process.exit(1); }
  const pts = pinPoints(parseCsv(readFileSync(csvPath, 'utf8')));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, pinSql(pts));
  console.log(`${pts.size} PIN codes → ${out}`);
}
