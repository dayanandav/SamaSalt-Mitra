// Jan Aushadhi list names -> the brand list's names (public/ja-synonyms.js), and the list parser's
// reading of "%", Indian digit grouping, totals given with a concentration and "delayed release". Spelling variants of the
// SAME medicine match; different salts, forms, strengths or releases never do. The Python
// importer (data/build_ja.py) must give exactly the same keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { JA_SYNONYMS, JA_ROUTE_WORDS } from '../public/ja-synonyms.js';
import { parseGeneric, Vocab, parseCsv } from '../public/pmbi.js';

const key = (name, keys = []) => parseGeneric(name, new Vocab(keys)).key;

test('synonym list: plain lowercase salt names, no chains, never two different medicines', () => {
  for (const [from, to] of Object.entries(JA_SYNONYMS)) {
    assert.equal(from, from.toLowerCase(), from);
    assert.equal(to, to.toLowerCase(), to);
    assert.doesNotMatch(to, /[+:|]/, `${from} -> ${to}: one salt name`);
    assert.notEqual(from, to);
    assert.equal(JA_SYNONYMS[to], undefined, `${to}: a target is never itself mapped again`);
  }
  // Different medicines that look alike: never the same.
  const NEVER = [['metoprolol', 'metoprolol succinate'], ['metoprolol', 'metoprolol tartrate'], ['metoprolol tartrate', 'metoprolol succinate'], ['escitalopram', 'citalopram'], ['chlorpheniramine', 'pheniramine'], ['perindopril', 'perindopril erbumine'], ['perindopril arginine', 'perindopril erbumine'], ['insulin', 'human insulin'], ['erythromycin stearate', 'erythromycin']];
  for (const [a, b] of NEVER) assert.ok(JA_SYNONYMS[a] !== b && JA_SYNONYMS[b] !== a, `${a} / ${b}`);
  // Route words only, never a form or a release.
  for (const w of JA_ROUTE_WORDS) assert.doesNotMatch(w, /effervescent|dissolving|dispersible|release|tablet|capsule|syrup|cream|gel/, w);
});

test('Jan Aushadhi names: spelling variants and route words give the brand list\'s key', () => {
  // Brand-list names (as in public/meds/keys.json) the official names are mapped onto.
  const BRANDS = ['olopatadine:0.1% w/v|liquid', 'clotrimazole:100mg|tablet', 'metformin:500mg|tablet', 'amlodipine:5mg|tablet'];
  assert.equal(key('Chlorthalidone Tablets IP 12.5mg'), 'chlortalidone:12.5mg|tablet');
  assert.equal(key('Torsemide Tablets IP 20 mg'), 'torasemide:20mg|tablet');
  assert.equal(key('Olmesartan 20mg and Amlodipine 5mg Tablets'), 'amlodipine:5mg+olmesartan medoxomil:20mg|tablet');
  assert.equal(key('Olopatadine Hydrochloride Ophthalmic Solution IP 0.1% w/v', BRANDS), 'olopatadine:0.1% w/v|liquid');
  assert.equal(key('Clotrimazole Vaginal Tablets IP 100mg', BRANDS), 'clotrimazole:100mg|tablet');
  assert.equal(key('Metformin Hydrchloride 500mg (Sustained-release) and Glimipride 3mg Tablet IP', BRANDS), 'glimepiride:3mg+metformin:500mg|tablet|SR');
});

test('Jan Aushadhi strengths: Indian digit grouping, a total with a concentration, "%" as brands write it; delayed release is DR', () => {
  assert.equal(key('Streptokinase Injection IP 15,00,000 IU'), 'streptokinase:1500000IU|injection');
  // A name with a total and a concentration keeps the total, as the brand list writes injections.
  assert.equal(key('Tranexamic Acid Injection IP 500 mg (100mg per ml)', ['tranexamic acid:500mg|injection']), 'tranexamic acid:500mg|injection');
  assert.equal(key('Paclitaxel Injection IP 100mg (6mg/ml)', ['paclitaxel:100mg|injection']), 'paclitaxel:100mg|injection');
  assert.equal(key('Ketoprofen 2.5% Gel', ['ketoprofen:2.5% w/w|topical']), 'ketoprofen:2.5% w/w|topical');
  assert.equal(key('Magnesium Sulphate Injection 50%', ['magnesium sulphate:50% w/v|injection']), 'magnesium sulphate:50% w/v|injection');
  assert.equal(key('Mesalazine Delayed release Tablets 800 mg'), 'mesalazine:800mg|tablet|DR');
  // A different strength is never offered: "%" spelling only, never another number.
  assert.equal(key('Ketoprofen 2.5% Gel', ['ketoprofen:1% w/w|topical']), 'ketoprofen:2.5%|topical');
});

test('the Python importer gives exactly the same keys as the browser importer (official 11 Oct 2026 list)', (t) => {
  const py = spawnSync('python', ['-I', '-c', `
import sys, json, csv
sys.path.insert(0, 'data')
from build_ja import parse_generic, Vocab
v = Vocab(None)
with open('data/raw/ja_products_2026-10-11.csv', encoding='utf-8-sig') as f:
    print(json.dumps({r['Drug Code']: parse_generic(r['Generic Name'], v)[0] for r in csv.DictReader(f)}))
`], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (py.error) return t.skip('python not available');
  assert.equal(py.status, 0, py.stderr);
  const pyKeys = JSON.parse(py.stdout);
  const rows = parseCsv(readFileSync(new URL('../data/raw/ja_products_2026-10-11.csv', import.meta.url), 'utf8'));
  const diffs = rows.filter((r) => key(r['Generic Name']) !== pyKeys[r['Drug Code']]).map((r) => r['Generic Name']);
  assert.deepEqual(diffs.slice(0, 5), []);
  assert.equal(rows.length, 2439);
});
