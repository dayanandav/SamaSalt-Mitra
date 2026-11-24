// 2.0.13, found by the audit of all 241,990 brand names (owner's go-ahead 24 Nov 2026):
// 1. "7gm" and "35000IU" are numbers (they were "not a number", and equal to each other); another number
//    with letters ("3D", "2M", "200SR", "3MIU") is part of the name and must be the same;
// 2. a brand row with no form: its name says it ("Infusion", "Drop"), so a typed tablet never fits;
// 3. a prescription photo: the written form counts, and an unclear form or salt is "choose", never one medicine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { fitsTyped } from '../worker/src/tools.js';
import { readPrescriptionAgent, runAgent } from '../worker/src/agent.js';

const row = (name, ckey, form = null) => ({ name, ckey, form });

test('1: a strength in gm or IU must be the same strength', () => {
  const ctax = row('C Tax 1gm Injection', 'cefotaxime:1000mg|injection', 'injection');
  assert.equal(fitsTyped('C Tax 7gm', ctax), false);
  assert.equal(fitsTyped('C Tax 7gm Injection', ctax), false);
  for (const t of ['C Tax 1gm', 'C Tax 1 gm', 'C Tax 1g', 'C Tax 1000mg']) assert.equal(fitsTyped(t, ctax), true, t);
  const hcg = row('Deviron 2000IU Injection', 'human chorionic gonadotropin:hCG|injection', 'injection');
  assert.equal(fitsTyped('Deviron 35000IU Injection', hcg), false);
  assert.equal(fitsTyped('Deviron 5000 IU', hcg), false);
  for (const t of ['Deviron 2000IU', 'Deviron 2000 IU', 'Deviron 2000']) assert.equal(fitsTyped(t, hcg), true, t);
});

test('1: another number with letters is part of the name', () => {
  const g2m = row('Glismet-2M Tablet PR', 'glimepiride:2mg+metformin:500mg|tablet|SR', 'tablet');
  assert.equal(fitsTyped('Glismet-14M PR', g2m), false);
  assert.equal(fitsTyped('Glismet-2M PR', g2m), true);
  const threeD = row('Metapro 3D 12.5mg/50mg/40mg Tablet', 'chlorthalidone:12.5mg+metoprolol succinate:50mg+telmisartan:40mg|tablet', 'tablet');
  assert.equal(fitsTyped('Metapro 50', threeD), false, 'a combination with 3D in its name is not "Metapro 50"');
  assert.equal(fitsTyped('Clistril 2MIU', row('Clistril 1MIU Injection', 'colistimethate sodium:1Million IU|injection', 'injection')), false);
  assert.equal(fitsTyped('Dolo 650', row('Dolo 650 Tablet', 'paracetamol:650mg|tablet', 'tablet')), true);
});

test('2: a brand row with no form never fits another form than its name says', () => {
  const inf = row('Fungirap 200mg Infusion', 'fluconazole:200mg');
  for (const t of ['Fungirap 200mg tablet', 'Fungirap 200mg capsules', 'Fungirap 200 injection']) assert.equal(fitsTyped(t, inf), false, t);
  assert.equal(fitsTyped('Fungirap 200mg', inf), true);
  assert.equal(fitsTyped('Fungirap 200mg Infusion', inf), true);
  const drop = row('Abixim Drop', 'cefixime:25mg');
  assert.equal(fitsTyped('Abixim tablet', drop), false);
  assert.equal(fitsTyped('Abixim drops', drop), true);
  assert.equal(fitsTyped('Jubira 10 tablet', row('Jubira 10', 'rosuvastatin:10mg')), true, 'a name that says no form: as before');
});

// TEST FIXTURES ONLY: made-up codes and prices.
const JA = [{ drug_code: 'T3', generic_name: 'Glimepiride Tablets IP 2mg', ckey: 'glimepiride:2mg|tablet', unit_size: "10's", mrp: 10, units: 10, unit_price: 1 }];
async function rx(medicines) {
  const DB = fixtureDb({ ja: JA, kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
  const add = (id, name, ckey, form) => DB.prepare('INSERT INTO medicines (id,name,manufacturer,salt,ckey,price,pack,unit_price,form,rel,nti,incomplete) VALUES (?1,?2,?3,?4,?5,10,?6,1,?7,NULL,0,0)').bind(id, name, 'M', '', ckey, '10', form).run();
  await add(900001, 'Doxepin Tablet', 'doxylamine:10mg+vitamin b6:Pyridoxine|tablet', 'tablet');
  await add(900002, 'Doxepin 10mg Capsule', 'doxepin:10mg|capsule', 'capsule');
  const AI = { run: async () => ({ response: JSON.stringify({ medicines, readable: true }) }) };
  return { DB, items: (await readPrescriptionAgent({ DB, AI }, { image: 'data:image/jpeg;base64,AAAA' })).items };
}

test('3: prescription: a salt with no form, another form, or a brand with other salts is "choose", never one medicine', async () => {
  for (const m of [
    { name: 'Tramadol', strength: '50 mg' }, // capsule, SR tablet, injection
    { name: 'Glimepiride', strength: '2mg', form: 'capsule' }, // Jan Aushadhi has the tablet
    { name: 'Doxepin', strength: '10mg', form: 'tablet' }, // the brand of that name is doxylamine
  ]) {
    const { items } = await rx([m]);
    assert.equal(items[0].found, false, `${m.name} ${m.form || ''} -> ${items[0].name}`);
  }
  const { items: [t] } = await rx([{ name: 'Tramadol', strength: '50 mg' }]);
  assert.equal(t.choose, true);
});

test('3: prescription: the written form is used, and what is tapped is checked the same way', async () => {
  const { DB, items } = await rx([{ name: 'Tramadol 50', form: 'capsule' }, { name: 'Dolo 650', form: 'tablet' }, { name: 'Telma 40', form: 'other' }]);
  assert.deepEqual(items.map((x) => [x.found, x.composition]), [[true, 'Tramadol 50 mg · capsule'], [true, 'Paracetamol 650 mg · tablet'], [true, 'Telmisartan 40 mg · tablet']]);
  const { items: [c] } = await rx([{ name: 'Glimepiride', strength: '2mg', form: 'capsule' }]);
  const r = await runAgent({ DB, AI: null }, { text: c.read, lang: 'en' });
  assert.equal(r.status, 'not_found', 'the tapped text keeps the written form: offered, never answered');
  assert.ok(r.choices.some((x) => x.composition === 'Glimepiride 2 mg · tablet'));
  assert.ok(!JSON.stringify(items).includes('mrp') && !JSON.stringify(items).includes('price'), 'nothing priced');
});
