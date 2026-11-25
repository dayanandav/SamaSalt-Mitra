// Owner's decision 24 Nov 2026 (2.0.14): the brand list keeps at most two salts (three or more were cut).
// 1. a brand marked incomplete is never answered, compared or priced;
// 2. a typed two-salt brand is asked about before any price;
// 3. other brands are never listed as the same for a two-salt medicine; the Jan Aushadhi product is;
// 4. a strip whose three salts were read decides by its salts, never by the cut brand row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';
import { runAgent } from '../worker/src/agent.js';
import { identifyMedicine } from '../worker/src/tools.js';
import { handleMessage } from '../worker/src/whatsapp.js';
import { asksToSwitch, canShowPharmacist, savableAnswer } from '../public/rules.js';
import { STRINGS, composeAnswer } from '../public/strings.js';

// TEST FIXTURES ONLY: made-up codes and prices.
const JA = [
  ['T1', 'Aceclofenac 100mg and Paracetamol 325mg Tablets', 'aceclofenac:100mg+paracetamol:325mg|tablet'],
  ['T2', 'Aspirin 75mg, Atorvastatin 20mg and Clopidogrel 75mg Capsules', 'aspirin:75mg+atorvastatin:20mg+clopidogrel:75mg|capsule'],
].map(([drug_code, generic_name, ckey]) => ({ drug_code, generic_name, ckey, unit_size: "10's", mrp: 10, units: 10, unit_price: 1 }));
async function db() {
  const DB = fixtureDb({ ja: JA, kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
  const add = (id, name, ckey, form, incomplete) => DB.prepare('INSERT INTO medicines (id,name,manufacturer,salt,ckey,price,pack,unit_price,form,rel,nti,incomplete) VALUES (?1,?2,?3,?4,?5,90,10,9,?6,NULL,0,?7)').bind(id, name, 'M', '', ckey, form, incomplete).run();
  await add(900001, 'Trizol Two Tablet', 'aceclofenac:100mg+paracetamol:325mg|tablet', 'tablet', 0);
  await add(900002, 'Trizol Other Tablet', 'aceclofenac:100mg+paracetamol:325mg|tablet', 'tablet', 0);
  await add(900003, 'Triplet Gold Capsule', 'aspirin:75mg+atorvastatin:20mg|capsule', 'capsule', 1);
  await add(900004, 'Triplet Silver Capsule', 'aspirin:75mg+atorvastatin:20mg|capsule', 'capsule', 0);
  return DB;
}
const ask = (DB, text, more = {}) => runAgent({ DB, AI: null }, { text, lang: 'en', ...more });

test('1: a brand marked incomplete is never answered, also when the salts are said to be confirmed', async () => {
  const DB = await db();
  for (const more of [{}, { saltsConfirmed: true }]) {
    const r = await ask(DB, 'Triplet Gold Capsule', more);
    assert.equal(r.status, 'incomplete');
    for (const k of ['answer', 'same_salt', 'jan_aushadhi', 'saving', 'medicine']) assert.ok(!(k in r), `no ${k}`);
    assert.ok(!/unit_price|mrp|₹/.test(JSON.stringify(r)), 'nothing priced');
  }
  const c = await ask(DB, 'Triplet');
  const gold = c.choices.find((x) => x.name === 'Triplet Gold Capsule');
  assert.ok(gold.composition.includes('+ …'), 'a choice says that salts are missing');
});

test('2: a typed two-salt brand waits for "exactly these two salts"; nothing is offered before', async () => {
  const DB = await db();
  const r = await ask(DB, 'Trizol Two Tablet');
  assert.equal(r.status, 'ok');
  assert.equal(r.needs_confirmation, true);
  assert.equal(r.confirm, 'two_salts');
  assert.equal(asksToSwitch(r), false);
  assert.equal(canShowPharmacist(r), false);
  assert.equal(savableAnswer(r), null);
  assert.equal((await ask(DB, 'Trizol Two Tablet', { saltsConfirmed: true })).needs_confirmation, false);
  assert.equal((await ask(DB, JA[0].generic_name)).needs_confirmation, false, 'the official list has every salt');
  assert.equal((await ask(DB, 'Dolo 650')).needs_confirmation, false, 'one salt: as before');
});

test('3: no other brand is listed for a two-salt medicine; the Jan Aushadhi product still is', async () => {
  const DB = await db();
  const r = await ask(DB, 'Trizol Two Tablet', { saltsConfirmed: true });
  assert.deepEqual(r.same_salt.items, []);
  assert.equal(r.same_salt.count, 0);
  assert.equal(r.same_salt.hidden, true);
  assert.equal(r.jan_aushadhi.product.drug_code, 'T1');
  assert.equal(r.saving.best_unit, 1, 'the saving is from the Jan Aushadhi product only');
  assert.ok(!r.answer.includes('Trizol Other') && !/exactly the same salt/i.test(r.answer), r.answer);
  const gap = await ask(DB, 'Triplet Silver Capsule', { saltsConfirmed: true });
  assert.ok(!/in our list|lowest-priced/.test(gap.answer), 'never "no other brand in our list" when brands are hidden');
  for (const l of Object.keys(STRINGS)) {
    const f = { brand: 'X', composition: 'A 1 mg + B 1 mg', count: 0, cheapBrand: null, jaUnit: null, jaName: null, yourUnit: 5, brandsLoaded: true, form: 'tablet' };
    assert.ok(composeAnswer(l, { ...f, brandsHidden: true }).length < composeAnswer(l, f).length, l + ': no "no other brand in our list" line when brands are hidden');
  }
  const dolo = await ask(DB, 'Dolo 650');
  assert.ok(!dolo.same_salt.hidden && dolo.same_salt.count > 0, 'one salt: brands as before');
});

test('4: a strip with three salts read in full decides by its salts; a cut row never does', async () => {
  const DB = await db();
  for (const brand of ['Triplet Gold', 'Triplet Silver']) {
    const r = await identifyMedicine(DB, { brand, composition: 'Aspirin 75mg + Atorvastatin 20mg + Clopidogrel 75mg', form: 'capsule' });
    assert.equal(r.found, true, brand);
    assert.equal(r.via, 'composition', brand);
    assert.equal(r.medicine.ckey, 'aspirin:75mg+atorvastatin:20mg+clopidogrel:75mg|capsule', brand);
    assert.equal(r.medicine.price, null, 'no price from the cut row');
  }
  const other = await identifyMedicine(DB, { brand: 'Triplet Silver', composition: 'Aspirin 150mg + Atorvastatin 20mg + Clopidogrel 75mg', form: 'capsule' });
  assert.notEqual(other.via, 'composition', 'another strength than the row: not decided by the strip alone');
});

test('the chat and the bot ask the same question before any price', async () => {
  const DB = await db();
  const env = { DB, AI: null, WA_HASH_KEY: 'k' };
  const say = (msg) => handleMessage(env, { from: '919999999999', ...msg }, { lang: 'en', isTest: true });
  const q = (await say({ kind: 'text', text: 'Trizol Two Tablet' })).at(-1);
  assert.equal(q.kind, 'buttons');
  assert.ok(!/₹/.test(q.body), 'nothing priced before yes');
  const a = (await say({ kind: 'button', button: 'confirm:yes' })).at(-1);
  assert.match(a.body, /Jan Aushadhi/);
  assert.ok(!a.body.includes('Trizol Other'));
  const i = (await say({ kind: 'text', text: 'Triplet Gold Capsule' })).at(-1);
  assert.ok(!/₹/.test(i.body));
});

test('the new texts in every language, with no price and no dosage; the screen uses them', () => {
  for (const l of Object.keys(STRINGS)) for (const k of ['incompleteTitle', 'incompleteBody', 'confirmTwoTitle', 'confirmTwoHint', 'confirmTwoNo', 'brandsHidden']) {
    assert.ok(STRINGS[l][k], `${l}.${k}`);
    assert.ok(!/₹|\d|dose|twice|daily/i.test(STRINGS[l][k]), `${l}.${k}`);
  }
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  for (const k of ['incompleteTitle', 'incompleteBody', 'confirmTwoTitle', 'confirmTwoHint', 'confirmTwoNo', 'brandsHidden']) assert.ok(app.includes(`'${k}'`), k);
});
