// Owner's decisions 24 Nov 2026 (2.0.13):
// - a salt and strength typed with no form that is a Jan Aushadhi product is asked when another form of the
//   same salt and strength is a Jan Aushadhi product too ("Tranexamic acid 500": tablet, injection);
// - "of" at the start of a brand name counts: "OF Derm Cream" is never "Derm Cream" (other salts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { runAgent } from '../worker/src/agent.js';
import { fitsTyped } from '../worker/src/tools.js';

// TEST FIXTURES ONLY: made-up codes and prices.
const JA = [
  ['T1', 'Tranexamic Acid Tablets IP 500 mg', 'tranexamic acid:500mg|tablet'],
  ['T2', 'Tranexamic Acid Injection IP 500 mg per 5 ml', 'tranexamic acid:500mg|injection'],
  ['T3', 'Glimepiride Tablets IP 2mg', 'glimepiride:2mg|tablet'],
  ['T4', 'Glimepiride Prolonged release Tablets IP 2mg', 'glimepiride:2mg|tablet|SR'],
].map(([drug_code, generic_name, ckey]) => ({ drug_code, generic_name, ckey, unit_size: "10's", mrp: 10, units: 10, unit_price: 1 }));
async function db() {
  const DB = fixtureDb({ ja: JA, kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
  const add = (id, name, ckey, form) => DB.prepare('INSERT INTO medicines (id,name,manufacturer,salt,ckey,price,pack,unit_price,form,rel,nti,incomplete) VALUES (?1,?2,?3,?4,?5,10,?6,1,?7,NULL,0,0)').bind(id, name, 'M', '', ckey, '10', form).run();
  await add(900001, 'Glimster 2mg Capsule', 'glimepiride:2mg|capsule', 'capsule'); // another form, but only a brand
  await add(900002, 'Derm Cream', 'clobetasol:0.05% w/w+ofloxacin:0.75% w/w|topical', 'topical');
  await add(900003, 'OF Derm Cream', 'clobetasol:0.05% w/w+terbinafine:1% w/w|topical', 'topical');
  return DB;
}
const ask = (DB, text) => runAgent({ DB, AI: null }, { text, lang: 'en' });

test('no form typed: asked when Jan Aushadhi has another form of the same salt and strength', async () => {
  const DB = await db();
  for (const text of ['Tranexamic acid 500', 'tranexamic acid 500 mg']) {
    const r = await ask(DB, text);
    assert.equal(r.status, 'not_found', text);
    assert.deepEqual(r.choices.map((c) => c.composition).sort(), ['Tranexamic Acid 500 mg · injection', 'Tranexamic Acid 500 mg · tablet'], text);
    for (const c of r.choices) assert.equal((await ask(DB, c.name)).medicine?.composition, c.composition, `${c.name}: tapped = shown`);
  }
});

test('a typed form, a name in full, and a salt with one Jan Aushadhi form are answered as before', async () => {
  const DB = await db();
  assert.equal((await ask(DB, 'Tranexamic acid 500 tablet')).medicine?.ckey, 'tranexamic acid:500mg|tablet');
  assert.equal((await ask(DB, 'Tranexamic Acid Injection IP 500 mg per 5 ml')).medicine?.ckey, 'tranexamic acid:500mg|injection');
  assert.equal((await ask(DB, 'Glimepiride 2')).medicine?.ckey, 'glimepiride:2mg|tablet', 'the other form is only a brand; another release is not another form');
});

test('"OF Derm Cream" and "Derm Cream" are two medicines', async () => {
  const DB = await db();
  assert.equal((await ask(DB, 'OF Derm Cream')).medicine?.ckey, 'clobetasol:0.05% w/w+terbinafine:1% w/w|topical');
  assert.equal((await ask(DB, 'Derm Cream')).medicine?.ckey, 'clobetasol:0.05% w/w+ofloxacin:0.75% w/w|topical');
  assert.equal(fitsTyped('OF Derm', { name: 'Derm Cream', ckey: 'x:1mg|topical', form: 'topical' }), false);
  assert.equal(fitsTyped('Derm', { name: 'OF Derm Cream', ckey: 'x:1mg|topical', form: 'topical' }), false);
});
