// Owner's decision 24 Nov 2026 (2.0.12), found by the search cases for the form rule:
// 1. an official Jan Aushadhi name in full is that product, and "Tablets" / "Capsules" are forms;
// 2. another form typed than the Jan Aushadhi product has: that product is offered, never the answer;
// 3. a typed salt is never answered by a brand that has other salts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { runAgent } from '../worker/src/agent.js';
import { identifyMedicine, fitsTyped, janAushadhiByName } from '../worker/src/tools.js';

// TEST FIXTURES ONLY: made-up codes and prices; the names and salts are as in the real lists.
const JA = [
  ['T1', 'Ramipril Tablets IP 1.25mg', 'ramipril:1.25mg|tablet'],
  ['T2', 'Doxepin Capsules IP 10mg', 'doxepin:10mg|capsule'],
  ['T3', 'Glimepiride Tablets IP 2mg', 'glimepiride:2mg|tablet'],
  ['T4', 'Sodium Chloride Injection IP 0.9%w/v', 'sodium chloride:0.9% w/v|injection'],
].map(([drug_code, generic_name, ckey]) => ({ drug_code, generic_name, ckey, unit_size: "10's", mrp: 10, units: 10, unit_price: 1 }));
const BRANDS = [
  ['Ramipril 1.25mg Capsule', 'ramipril:1.25mg|capsule', 'capsule'],
  ['Doxepin Tablet', 'doxylamine:10mg+vitamin b6:Pyridoxine|tablet', 'tablet'],
  ['Glimster 2mg Capsule', 'glimepiride:2mg|capsule', 'capsule'],
  ['Sodium Chloride Infusion', 'dextrose:5% w/v+sodium chloride:0.9% w/v', null],
  ['Levo 500mg Tablet', 'levofloxacin:500mg|tablet', 'tablet'],
  ['Beta 25mg Tablet', 'atenolol:25mg|tablet', 'tablet'],
];
async function db() {
  const DB = fixtureDb({ ja: JA, kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
  let id = 900001;
  for (const [name, ckey, form] of BRANDS) await DB.prepare('INSERT INTO medicines (id,name,manufacturer,salt,ckey,price,pack,unit_price,form,rel,nti,incomplete) VALUES (?1,?2,?3,?4,?5,10,?6,1,?7,NULL,0,0)').bind(id++, name, 'M', '', ckey, '10', form).run();
  return DB;
}
const ask = (DB, text) => runAgent({ DB, AI: null }, { text, lang: 'en' });

test('1: every official Jan Aushadhi name in full is that product, also when a brand is named like its salt', async () => {
  const DB = await db();
  for (const p of JA) {
    const r = await ask(DB, p.generic_name);
    assert.equal(r.status, 'ok', p.generic_name);
    assert.equal(r.medicine.ckey, p.ckey, p.generic_name);
  }
});

test('1: "Tablets" and "Capsules" are forms: a brand in another form never fits', () => {
  const cap = { name: 'Ramipril 1.25mg Capsule', ckey: 'ramipril:1.25mg|capsule', form: 'capsule' };
  assert.equal(fitsTyped('Ramipril tablets 1.25mg', cap), false);
  assert.equal(fitsTyped('Ramipril tablet 1.25mg', cap), false);
  assert.equal(fitsTyped('Ramipril capsules 1.25mg', cap), true);
  assert.equal(fitsTyped('Ramipril 1.25mg', cap), true, 'no form typed: decided later (asked when other forms exist)');
});

test('2: another form typed than the Jan Aushadhi product has: offered, never answered', async () => {
  const DB = await db();
  for (const text of ['Glimepiride capsule 2mg', 'Glimepiride Capsules IP 2mg', 'glimepiride caps 2']) {
    assert.equal((await identifyMedicine(DB, { brand: text })).found, false, text);
    const r = await ask(DB, text);
    assert.equal(r.status, 'not_found', text);
    assert.ok(r.choices.some((c) => c.composition === 'Glimepiride 2 mg · tablet'), `${text}: the Jan Aushadhi tablet is offered`);
  }
  assert.equal((await ask(DB, 'Glimepiride syrup 2mg')).status, 'not_found', 'a syrup typed: never the tablet');
  assert.equal((await janAushadhiByName(DB, 'Glimepiride capsule 2mg')).formDiffers, true);
  for (const text of ['Glimepiride 2', 'Glimepiride tablets 2mg', 'Glimepiride tab 2']) {
    const r = await ask(DB, text);
    assert.equal(r.medicine?.ckey, 'glimepiride:2mg|tablet', `${text}: answered as before`);
  }
});

test('3: a typed salt is never answered by a brand that has other salts', async () => {
  const DB = await db();
  for (const text of ['Doxepin 10 mg', 'doxepin 10', 'Sodium Chloride 0.9%']) {
    const r = await ask(DB, text);
    assert.equal(r.status, 'not_found', `${text} -> ${r.medicine?.ckey}`);
    assert.ok(r.choices.length && r.choices.every((c) => c.composition), `${text}: asked, with the salts`);
  }
  assert.ok((await ask(DB, 'Doxepin 10 mg')).choices.some((c) => c.composition === 'Doxepin 10 mg · capsule'), 'the typed salt is offered');
});

test('3: an ordinary brand, and a brand name typed or tapped in full, are answered as before', async () => {
  const DB = await db();
  assert.equal((await ask(DB, 'Levo 500')).medicine?.ckey, 'levofloxacin:500mg|tablet');
  assert.equal((await ask(DB, 'Beta 25')).medicine?.ckey, 'atenolol:25mg|tablet');
  assert.equal((await ask(DB, 'Dolo 650')).medicine?.name, 'Dolo 650 Tablet');
  assert.equal((await ask(DB, 'Sodium Chloride Infusion')).medicine?.ckey, 'dextrose:5% w/v+sodium chloride:0.9% w/v');
});
