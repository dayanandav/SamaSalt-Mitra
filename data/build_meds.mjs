#!/usr/bin/env node
// Build the brand medicine list as static files (public/meds/) from SameSalt's SQLite database.
//
// Why files and not D1: the list is read-only reference data (246,068 rows). Cloudflare serves
// static assets free and without limits, while a free D1 database allows only 100,000 rows
// written per day; this list needs ~740,000 (each row plus its two indexes). The Worker reads
// one small file per lookup (worker/src/medstore.js), with the same results as the D1 queries
// (test/medstore.test.mjs).
//
// Source: SameSalt's assets/samesalt.db (github.com/darshanrajagoli/samesalt, Git LFS), built
// from the Kaggle "A-Z Medicine Dataset of India" (Shudhanshu Singh, CC BY-SA 4.0, Nov 2022).
//
// Usage (Node 22+, no Python needed):
//   node data/build_meds.mjs --db ../samesalt/assets/samesalt.db
//   cd worker && npx wrangler deploy        # uploads public/ including public/meds/
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMedFiles } from '../worker/src/medstore.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []));
if (!args.db) {
  console.error('usage: node data/build_meds.mjs --db ../samesalt/assets/samesalt.db [--out public]');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = args.out || join(root, 'public');

// Same cleaning as data/build_d1.py clean_key(): "formoterol:0.0045000000000000005mg" -> "formoterol:0.0045mg",
// so keys are byte-identical to what worker/src/normalize.js produces at runtime.
const cleanKey = (k) => k && k.replace(/(\d+\.\d{7,})mg/g, (_, n) => `${Math.round(parseFloat(n) * 1e6) / 1e6}mg`);

const db = new DatabaseSync(args.db, { readOnly: true });
const rows = db
  .prepare('SELECT id, name, manufacturer, canonical_key, price, pack_size, per_unit_price, dosage_form, release_type, is_nti, composition_incomplete FROM medicines ORDER BY id')
  .all()
  .map((r) => ({
    id: r.id,
    name: r.name,
    manufacturer: r.manufacturer,
    ckey: cleanKey(r.canonical_key),
    price: r.price,
    pack: r.pack_size,
    unit_price: r.per_unit_price,
    form: r.dosage_form,
    rel: r.release_type,
    nti: r.is_nti,
    incomplete: r.composition_incomplete,
  }));
const meta = Object.fromEntries(db.prepare('SELECT key, value FROM metadata').all().map((r) => [r.key, r.value]));

const files = buildMedFiles(rows, { datasetDate: meta.dataset_date || null });
rmSync(join(out, 'meds'), { recursive: true, force: true });
let bytes = 0;
let largest = 0;
for (const [path, text] of files) {
  const file = join(out, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  bytes += text.length;
  largest = Math.max(largest, text.length);
}
console.log(`${rows.length.toLocaleString('en-IN')} medicines -> ${files.size.toLocaleString('en-IN')} files in ${join(out, 'meds')} (${(bytes / 1e6).toFixed(1)} MB, largest ${(largest / 1e3).toFixed(0)} KB)`);
