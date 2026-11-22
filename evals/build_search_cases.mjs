#!/usr/bin/env node
// Builds evals/search_cases.json from evals/search_cases.src.json: each case's expected composition
// key comes from the data, never written by hand: `brand` = exact brand name in the brand database,
// `ja` = Jan Aushadhi drug code in data/raw (parsed with data/build_ja.py, the importer's own parser).
//
//   node evals/build_search_cases.mjs --db ../samesalt/assets/samesalt.db
import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const dbPath = process.argv[process.argv.indexOf('--db') + 1];
if (!process.argv.includes('--db') || !dbPath) { console.error('usage: node evals/build_search_cases.mjs --db ../samesalt/assets/samesalt.db'); process.exit(1); }

const src = JSON.parse(readFileSync(join(HERE, 'search_cases.src.json'), 'utf8'));
const db = new DatabaseSync(dbPath, { readOnly: true });
const byName = db.prepare('SELECT DISTINCT canonical_key AS k FROM medicines WHERE name = ?');

const py = spawnSync('python', ['-I', '-c', `
import sys, json, csv
sys.path.insert(0, 'data')
from build_ja import parse_generic, Vocab
v = Vocab(${JSON.stringify(dbPath)})
with open('data/raw/ja_products_2026-10-11.csv', encoding='utf-8-sig') as f:
    print(json.dumps({r['Drug Code']: parse_generic(r['Generic Name'], v)[0] for r in csv.DictReader(f)}))
`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
if (py.status !== 0) { console.error(py.stderr); process.exit(1); }
const ja = JSON.parse(py.stdout);

const problems = [];
const cases = src.cases.map((c) => {
  let ckey = null;
  if (c.brand) {
    const keys = byName.all(c.brand).map((r) => r.k);
    if (keys.length !== 1) problems.push(`${c.id}: brand "${c.brand}" has ${keys.length} keys`);
    ckey = keys[0] || null;
  } else if (c.ja) {
    ckey = ja[c.ja] || null;
    if (!ckey) problems.push(`${c.id}: Jan Aushadhi code ${c.ja} has no key`);
  } else if (c.expect !== 'none') problems.push(`${c.id}: needs brand or ja`);
  return { ...c, expect_ckey: ckey };
});
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
writeFileSync(join(HERE, 'search_cases.json'), JSON.stringify({ name: src.name, description: src.description, built: new Date().toISOString().slice(0, 10), cases }, null, 1) + '\n');
console.log(`${cases.length} cases -> evals/search_cases.json`);
