// "Ask, don't guess" (owner's decision 22 Nov 2026): a typed name is answered only when a brand's
// words are exactly the typed words (forms and units aside), the typed number is in its name or is
// its strength, and a typed form is its form. A brand with extra words (another combination), a
// longer first word, another form, or a strength the patient did not type is offered as a choice
// with its salts, never picked. A brand's full listed name is always answered directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { identifyMedicine, fitsTyped } from '../worker/src/tools.js';
import { runAgent } from '../worker/src/agent.js';

// Made-up brands with the real-life pattern (TEST DATA).
const BRANDS = [
  [990101, 'Zatorva Tablet', 'atorvastatin:10mg|tablet', 'tablet'],
  [990102, 'Zatorva 20 Tablet', 'atorvastatin:20mg|tablet', 'tablet'],
  [990103, 'Zatorva E 10mg/10mg Tablet', 'atorvastatin:10mg+ezetimibe:10mg|tablet', 'tablet'],
  [990104, 'Zcalpol T Tablet', 'paracetamol:325mg+tramadol:37.5mg|tablet', 'tablet'],
  [990105, 'Zcalpol 120mg Syrup', 'paracetamol:120mg/5ml|liquid', 'liquid'],
  [990106, 'Zcrocin 1000mg Tablet', 'paracetamol:1000mg|tablet', 'tablet'],
  [990107, 'Zcrocin Advance Tablet', 'paracetamol:500mg|tablet', 'tablet'],
  [990108, 'Zcetriva 10 Tablet', 'cetirizine:10mg|tablet', 'tablet'],
];
async function db() {
  const d = fixtureDb({ ja: [], kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
  for (const [id, name, ckey, form] of BRANDS) {
    await d.prepare('INSERT INTO medicines (id,name,manufacturer,salt,ckey,price,pack,unit_price,form,rel,nti,incomplete) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, name, 'Test', '', ckey, 10, 10, 1, form, null, 0, 0).run();
  }
  return d;
}

test('exact typed name: the number may be the strength ("Zatorva 10" = Zatorva Tablet, 10 mg), never another combination', async () => {
  const d = await db();
  const r = await identifyMedicine(d, { brand: 'Zatorva 10' });
  assert.equal(r.found, true);
  assert.equal(r.medicine.name, 'Zatorva Tablet');
  assert.equal(r.medicine.ckey, 'atorvastatin:10mg|tablet');
  assert.equal((await identifyMedicine(d, { brand: 'Zatorva 20' })).medicine.name, 'Zatorva 20 Tablet');
  assert.equal(fitsTyped('Zatorva 10', { name: 'Zatorva E 10mg/10mg Tablet', ckey: 'atorvastatin:10mg+ezetimibe:10mg|tablet', form: 'tablet' }), false, 'an extra word is another medicine');
});

test('partial fit: offered as choices with their salts, never picked', async () => {
  const d = await db();
  const calpol = await identifyMedicine(d, { brand: 'Zcalpol syp' });
  assert.equal(calpol.found, false, 'a typed syrup never picks a tablet (tramadol combination)');
  assert.ok(calpol.choices.every((c) => c.composition), 'each choice shows its salts');
  assert.ok(!calpol.choices.some((c) => c.name === 'Zcalpol T Tablet' && calpol.found));
  const cetri = await identifyMedicine(d, { brand: 'Zcetri 10' });
  assert.equal(cetri.found, false, 'a longer first word (another brand) is a choice');
  assert.equal(cetri.choices[0].name, 'Zcetriva 10 Tablet');
  const atorvaE = await identifyMedicine(d, { brand: 'Zatorva E' });
  assert.equal(atorvaE.found, false, 'no number typed: "Zatorva E 10mg/10mg" is a choice, not a guess');
});

test('no strength typed: several strengths, or one strength only in the name, is a choice', async () => {
  const d = await db();
  const atorva = await identifyMedicine(d, { brand: 'Zatorva' });
  assert.equal(atorva.found, false);
  assert.deepEqual(atorva.choices.map((c) => c.name).sort(), ['Zatorva 20 Tablet', 'Zatorva Tablet']);
  const crocin = await identifyMedicine(d, { brand: 'Zcrocin' });
  assert.equal(crocin.found, false, 'Zcrocin 1000mg would be a strength the patient did not type');
  assert.ok(crocin.choices.some((c) => c.name === 'Zcrocin Advance Tablet'));
});

test('a full listed name (as tapped in the choices) is always answered; every choice answers', async () => {
  const d = await db();
  for (const q of ['Zatorva', 'Zcalpol syp', 'Zcetri 10', 'Zcrocin', 'Zatorva E']) {
    for (const c of (await identifyMedicine(d, { brand: q })).choices || []) {
      const r = await identifyMedicine(d, { brand: c.name });
      assert.equal(r.found, true, `${q} -> ${c.name}`);
      assert.equal(r.medicine.name, c.name);
    }
  }
});

test('the answer: "not found" with choices (no medicine, no price); photos keep their composition check', async () => {
  const d = await db();
  const r = await runAgent({ DB: d, AI: null }, { text: 'Zcalpol syp', lang: 'en' });
  assert.equal(r.status, 'not_found');
  assert.ok(r.choices.length >= 1);
  assert.equal(r.medicine, undefined);
  assert.equal(r.answer, undefined);
  // A photo read (brand + composition) is unchanged: the composition decides.
  const photo = await identifyMedicine(d, { brand: 'Zcalpol', composition: 'Paracetamol (120mg/5ml)', form: 'syrup' });
  assert.equal(photo.medicine.name, 'Zcalpol 120mg Syrup');
  assert.equal(photo.composition_agrees, true);
});
