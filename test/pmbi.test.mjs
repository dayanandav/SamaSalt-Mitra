// PMBI product-list import (public/pmbi.js + the /api/admin/pmbi/* endpoints).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';
import { Vocab, parseGeneric, unitsIn, parseCsv, readTable, buildProducts, diffProducts, insertStatements, sqlLit, validateProducts, summarize } from '../public/pmbi.js';
import worker from '../worker/src/index.js';

const OFFICIAL_CSV = readFileSync(new URL('../data/raw/ja_products_2026-10-11.csv', import.meta.url), 'utf8');

// The same cases as test/test_build_ja.py. Python runs them against the full brand database;
// here the brand vocabulary is the fixture subset plus the keys these names should map onto.
const CASES = [
  ['Paracetamol Tablets IP 650 mg', 'paracetamol:650mg|tablet'],
  ['Paracetamol Tablets IP 500mg', 'paracetamol:500mg|tablet'],
  ['Amoxycillin and Potassium Clavulanate Tablets IP 500 mg + 125 mg', 'amoxicillin:500mg+clavulanic acid:125mg|tablet'],
  ['Telmisartan Tablets IP 40 mg', 'telmisartan:40mg|tablet'],
  ['Metformin Hydrochloride Sustained Release Tablets IP 500 mg', 'metformin:500mg|tablet|SR'],
  ['Metformin Hydrochloride Tablets IP 500 mg', 'metformin:500mg|tablet'],
  ['Pantoprazole Gastro-resistant Tablets IP 40 mg', 'pantoprazole:40mg|tablet'],
  ['Atorvastatin Tablets IP 10 mg', 'atorvastatin:10mg|tablet'],
  ['Amlodipine Tablets IP 5 mg', 'amlodipine:5mg|tablet'],
  ['Paracetamol Tablets IP 0.65 g', 'paracetamol:650mg|tablet'],
  ['Aceclofenac 100mg and Paracetamol 325mg Tablets', 'aceclofenac:100mg+paracetamol:325mg|tablet'],
  ['Amoxycillin 500mg and Potassium Clavulanate 125mg Tablets IP', 'amoxicillin:500mg+clavulanic acid:125mg|tablet'],
  ['Ibuprofen 400mg and Paracetamol 325mg Tablets IP', 'ibuprofen:400mg+paracetamol:325mg|tablet'],
  ['Mupirocin Ointment IP 2 % w/w', 'mupirocin:2% w/w|topical'],
  ['Clotrimazole 1% w/v and Lignocaine Hydrochloride 2% w/v Ear Drops', 'clotrimazole:1% w/v+lidocaine:2% w/v|drops'],
];
const fixtureKeys = JSON.parse(readFileSync(new URL('./fixtures/med_subset.json', import.meta.url), 'utf8')).map((r) => r[4]);
const VOCAB = new Vocab([...fixtureKeys, ...CASES.map((c) => c[1])]);

test('pmbi: PMBJP generic names parse to the brand database key (same cases as test_build_ja.py)', () => {
  for (const [name, want] of CASES) assert.equal(parseGeneric(name, VOCAB).key, want, name);
});

test('pmbi: salt suffixes and synonyms map onto the brand vocabulary', () => {
  assert.equal(VOCAB.map('Metformin Hydrochloride'), 'metformin');
  assert.equal(VOCAB.map('Lignocaine Hydrochloride'), 'lidocaine');
  assert.equal(VOCAB.map('Potassium Clavulanate'), 'clavulanic acid');
  // With no brand database loaded, names are kept as written (as build_ja.py does without --medicines-db).
  assert.equal(new Vocab().map('Metformin Hydrochloride'), 'metformin hydrochloride');
});

test('pmbi: unclear names are left out with a reason, never guessed', () => {
  assert.deepEqual(parseGeneric('Multivitamin Syrup', VOCAB), { key: null, reason: 'no salts or strengths' });
  assert.equal(parseGeneric('Glucometer', VOCAB).reason, 'no dosage form');
  assert.equal(parseGeneric('Ibuprofen 400mg and Paracetamol Tablets', VOCAB).reason, 'strengths on some salts only');
});

test('pmbi: pack units', () => {
  assert.equal(unitsIn("10's"), 10);
  assert.equal(unitsIn('15 Tablets'), 15);
  assert.equal(unitsIn('100 ml'), 100);
  assert.equal(unitsIn(''), null);
});

test('pmbi: the official CSV export is read as-is (BOM, quotes)', () => {
  const rows = parseCsv(OFFICIAL_CSV);
  assert.equal(rows.length, 2439);
  assert.deepEqual(rows[0], { 'Sr No': '1', 'Drug Code': '1', 'Generic Name': 'Aceclofenac 100mg and Paracetamol 325mg Tablets', 'Unit Size': "10's", MRP: '10.32', 'Group Name': 'Analgesic/Antipyretic/Anti-Inflammatory' });
  assert.deepEqual(parseCsv('a,b\n"x, ""y""",2\r\n'), [{ a: 'x, "y"', b: '2' }]);
  // A saved JSON response from the portal's product list works too.
  assert.equal(readTable('{"responseBody":{"data":[{"genericName":"Paracetamol Tablets IP 650 mg","mrp":"15.47","unitSize":"15\'s","drugCode":"9"}]}}').length, 1);
});

test('pmbi: parity with build_ja.py on the official 11 Oct 2026 list (525 left out)', () => {
  const { items, unparsed, stats } = buildProducts(parseCsv(OFFICIAL_CSV), new Vocab());
  assert.equal(stats.rows, 2439);
  assert.equal(stats.unparsed, 525); // data/raw/README.md: "525 left out on purpose"
  assert.equal(stats.ok + stats.no_equivalent, 1914); // "1,914 in ja_products"
  assert.equal(items.length, 1914);
  assert.equal(unparsed.length, 525);
  const pcm = items.find((p) => p.generic_name === 'Paracetamol Tablets IP 650 mg');
  assert.equal(pcm.ckey, 'paracetamol:650mg|tablet');
  assert.ok(pcm.unit_price > 0 && pcm.units > 0);
});

test('pmbi: diff finds new, removed and re-priced products', () => {
  const current = [
    { drug_code: '1', generic_name: 'A Tablets 10 mg', unit_size: "10's", mrp: 10, ckey: 'a:10mg|tablet' },
    { drug_code: '2', generic_name: 'B Tablets 5 mg', unit_size: "10's", mrp: 20, ckey: 'b:5mg|tablet' },
  ];
  const items = [
    { drug_code: '1', generic_name: 'A Tablets 10 mg', unit_size: "10's", mrp: 12, ckey: 'a:10mg|tablet' },
    { drug_code: '3', generic_name: 'C Tablets 1 mg', unit_size: "10's", mrp: 5, ckey: 'c:1mg|tablet' },
  ];
  const d = diffProducts(current, items);
  assert.deepEqual(d.added.map((x) => x.drug_code), ['3']);
  assert.deepEqual(d.removed.map((x) => x.drug_code), ['2']);
  assert.equal(d.changed.length, 1);
  assert.equal(d.changed[0].old_mrp, 10);
  assert.equal(d.changed[0].new_mrp, 12);
});

test('pmbi: SQL literals are escaped', () => {
  assert.equal(sqlLit("Children's Syrup"), "'Children''s Syrup'");
  assert.equal(sqlLit(null), 'NULL');
  assert.equal(sqlLit(NaN), 'NULL');
  assert.equal(insertStatements([{ drug_code: "x'); DROP TABLE meta; --", generic_name: 'n', unit_size: 'u', mrp: 1, group_name: null, ckey: 'k', units: 1, unit_price: 1 }])[0].includes("'x''); DROP TABLE meta; --'"), true);
});

// ── The admin API, end to end on the fixture database ───────────────────────
const TOKEN = 'test-admin-token';
const call = (env, path, body, token = TOKEN) =>
  worker.fetch(new Request(`https://example.test${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }), env).then(async (r) => ({ status: r.status, body: await r.json() }));

test('admin API: off without a secret, refuses a wrong token', async () => {
  const db = fixtureDb();
  assert.equal((await call({ DB: db }, '/api/admin/status')).status, 503);
  assert.equal((await call({ DB: db, ADMIN_TOKEN: TOKEN }, '/api/admin/status', null, 'wrong')).status, 401);
  assert.equal((await call({ DB: db, ADMIN_TOKEN: TOKEN }, '/api/admin/status', null, null)).status, 401);
});

test('admin API: context gives the brand keys and the current list; apply replaces it in one step', async () => {
  const db = fixtureDb({ ja: [{ drug_code: 'OLD-1', generic_name: 'Old product Tablets 1 mg', unit_size: "10's", mrp: 1, ckey: 'old:1mg|tablet', units: 10, unit_price: 0.1 }] });
  const env = { DB: db, ADMIN_TOKEN: TOKEN };

  const c = await call(env, '/api/admin/pmbi/context');
  assert.equal(c.status, 200);
  assert.ok(c.body.brand_keys.includes('paracetamol:650mg|tablet'));
  assert.equal(c.body.current.length, 1);

  // What the /dev page does in the browser.
  const built = buildProducts(parseCsv(OFFICIAL_CSV), new Vocab(c.body.brand_keys));
  const r = summarize(built, diffProducts(c.body.current, built.items), c.body.current.length, 0);
  assert.equal(r.removed, 1);
  assert.equal(r.added, built.items.length);
  const items = built.items.map(({ matched, ...p }) => p);

  assert.equal((await call(env, '/api/admin/pmbi/apply', { items, stats: built.stats, list_date: '13/11/2026' })).status, 400);
  const a = await call(env, '/api/admin/pmbi/apply', { items, stats: built.stats, list_date: '2026-11-13' });
  assert.equal(a.status, 200);
  assert.equal(a.body.new_count, 1914);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM ja_products').first()).n, 1914);
  assert.equal((await db.prepare("SELECT value FROM meta WHERE key = 'ja_list_date'").first()).value, '2026-11-13');
  assert.equal(JSON.parse((await db.prepare("SELECT value FROM meta WHERE key = 'ja_stats'").first()).value).unparsed, 525);
  const row = await db.prepare("SELECT mrp, unit_price FROM ja_products WHERE generic_name = 'Paracetamol Tablets IP 650 mg'").first();
  assert.ok(row.mrp > 0 && row.unit_price > 0);

  // The agent sees the new list at once (no stale 60 s meta cache).
  const h = await call(env, '/api/health', null, null);
  assert.equal(h.body.meta.ja_list_date, '2026-11-13');

  // A much shorter list is refused unless forced, and nothing changes.
  const s = await call(env, '/api/admin/pmbi/apply', { items: items.slice(0, 100), list_date: '2026-11-14' });
  assert.equal(s.status, 409);
  assert.equal(s.body.error, 'too_few_rows');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM ja_products').first()).n, 1914);
  assert.equal((await call(env, '/api/admin/pmbi/apply', { items: items.slice(0, 100), list_date: '2026-11-14', force: true })).status, 200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM ja_products').first()).n, 100);
});

test('admin API: products from the page are validated before anything is written', () => {
  const ok = { drug_code: '1', generic_name: 'Paracetamol Tablets IP 650 mg', unit_size: "15's", mrp: 15.47, group_name: null, ckey: 'paracetamol:650mg|tablet', units: 15, unit_price: 1.0313 };
  assert.equal(validateProducts([ok]), null);
  assert.match(validateProducts([]), /No products/);
  assert.match(validateProducts([ok, ok]), /duplicate/);
  assert.match(validateProducts([{ ...ok, mrp: -1 }]), /bad MRP/);
  assert.match(validateProducts([{ ...ok, mrp: '15' }]), /bad MRP/);
  assert.match(validateProducts([{ ...ok, ckey: 'not a key' }]), /composition key/);
  assert.match(validateProducts([{ ...ok, generic_name: '' }]), /generic name/);
  assert.equal(validateProducts([{ ...ok, ckey: 'metformin:500mg|tablet|SR' }]), null);
});
