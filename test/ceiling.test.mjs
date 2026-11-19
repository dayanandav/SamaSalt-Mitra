// NPPA ceiling prices: parsing the NPPA list onto the same composition keys, the import (checked
// and atomic), and the answer line. Never shown for a never-switch (NTI) medicine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { Vocab, parseCsv } from '../public/pmbi.js';
import { buildCeilings, diffCeilings, validateCeilings, isoDate } from '../public/ceiling.js';
import { answerText } from '../worker/src/watext.js';
import { STRINGS } from '../public/strings.js';

const vocab = new Vocab(['paracetamol:650mg|tablet', 'thyroxine:0.1mg|tablet', 'amoxicillin:250mg/5ml|liquid']);
const CSV = `Medicine,Dosage form and strength,Unit,Ceiling Price (Rs.),S.O. No.,S.O. Date
Paracetamol,Tablet 650 mg,1 Tablet,1.80,S.O. 1000(E),01-04-2025
Paracetamol,Tablet 650 mg,1 Tablet,2.04,S.O. 1234(E),25.03.2026
Thyroxine,Tablet 100 mcg,1 Tablet,1.10,S.O. 1234(E),25-03-2026
Rarezole,Tablet 5 mg,1 Tablet,3.00,,
Something odd,,1 Tablet,4.00,,
Paracetamol,Tablet 650 mg,1 Tablet,n/a,,`;

test('NPPA list → ceiling prices on the brand composition keys; the latest notification wins', () => {
  const b = buildCeilings(parseCsv(CSV), vocab);
  const para = b.items.find((x) => x.ckey === 'paracetamol:650mg|tablet');
  assert.equal(para.unit_price, 2.04, 'the 2026 notification, not the 2025 one');
  assert.equal(para.notification, 'S.O. 1234(E)');
  assert.equal(para.notified_on, '2026-03-25');
  assert.ok(b.items.find((x) => x.ckey === 'thyroxine:0.1mg|tablet'), '100 mcg = 0.1 mg, as the brands');
  assert.equal(b.items.find((x) => x.name.startsWith('Rarezole')).matched, false, 'kept, marked: no brand equivalent');
  assert.equal(b.stats.skipped, 1, 'no price → skipped');
  assert.equal(b.stats.unparsed, 1, 'no form → left out, never guessed');
  assert.equal(isoDate('2026-03-25'), '2026-03-25');
  assert.equal(isoDate('5/3/2026'), '2026-03-05');
  assert.equal(isoDate('March 2026'), null);
});

test('per unit: "10 ml" divides; a combined name column also works', () => {
  const rows = [{ 'Name of the Scheduled Formulation': 'Paracetamol Tablet 650 mg', Unit: '10 Tablet', 'Ceiling Price': '20.40' }];
  const [x] = buildCeilings(rows, vocab).items;
  assert.equal(x.ckey, 'paracetamol:650mg|tablet');
  assert.equal(x.unit_price, 2.04);
});

test('import check: bad keys, prices, dates and duplicates are refused; diff counts changes', () => {
  const good = buildCeilings(parseCsv(CSV), vocab).items.map(({ matched, ...p }) => p);
  assert.equal(validateCeilings(good), null);
  assert.match(validateCeilings([{ ...good[0], ckey: 'DROP TABLE' }]), /composition key/);
  assert.match(validateCeilings([{ ...good[0], unit_price: -1 }]), /unit_price/);
  assert.match(validateCeilings([{ ...good[0], notified_on: '25-03-2026' }]), /date/);
  assert.match(validateCeilings([good[0], good[0]]), /duplicate/);
  const d = diffCeilings([{ ckey: 'paracetamol:650mg|tablet', unit_price: 1.8 }, { ckey: 'gone:1mg|tablet', unit_price: 1 }], good);
  assert.equal(d.changed.length, 1);
  assert.equal(d.removed.length, 1);
});

test('apply (system owner only) → the answer shows the government maximum price; never for an NTI medicine', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb({ ja: [], kendras: [], meta: { ja_loaded_at: 'test', kendras_loaded_at: 'test' } });
  const env = { DB: db, ADMIN_TOKEN: 'owner-token-1234567890' };
  const call = (path, body, auth = true) => worker.fetch(new Request(`https://samasalt.example${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${env.ADMIN_TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {} });
  const items = buildCeilings(parseCsv(CSV), vocab).items.map(({ matched, ...p }) => p);
  assert.equal((await call('/api/admin/ceiling/apply', { items, list_date: '2026-03-25' }, false)).status, 401);
  assert.equal((await call('/api/admin/ceiling/apply', { items: [{ ...items[0], ckey: 'x' }], list_date: '2026-03-25' })).status, 400);
  const ok = await (await call('/api/admin/ceiling/apply', { items, list_date: '2026-03-25' })).json();
  assert.equal(ok.new_count, items.length);
  assert.equal((await (await call('/api/admin/ceiling/current')).json()).current.length, items.length);

  const ask = async (text) => (await call('/api/ask', { text, test: true }, false)).json();
  const dolo = await ask('Dolo 650');
  assert.deepEqual({ a: dolo.ceiling.available, p: dolo.ceiling.unit_price }, { a: true, p: 2.04 });
  assert.equal(dolo.data.ceiling_list_date, '2026-03-25');
  assert.match(answerText('en', dolo, ''), /Government maximum price \(NPPA\): ₹2\.04 per tablet \+ GST/);
  const thy = await ask('Thyronorm 100mcg');
  assert.equal(thy.medicine.nti, true);
  assert.equal(thy.ceiling.available, false, 'no price talk for a never-switch medicine');
  assert.doesNotMatch(answerText('en', thy, ''), /maximum price/);

  // Too short a new list is refused unless forced (a wrong or truncated file must not wipe it).
  const short = (await call('/api/admin/ceiling/apply', { items: items.slice(0, 1), list_date: '2026-04-01' }));
  assert.equal(short.status, 409);
});

test('ceiling texts exist in every language', () => {
  for (const l of Object.keys(STRINGS)) for (const k of ['ceilingTitle', 'ceilingPrice', 'ceilingNote', 'ceilingSource', 'waCeiling']) assert.ok(STRINGS[l][k], `${l}.${k}`);
});
