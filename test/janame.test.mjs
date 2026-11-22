// A typed name that is an official Jan Aushadhi product ("Paracetamol Tablets IP 650 mg", as
// printed on a Jan Aushadhi strip, or shorter: "Paracetamol 650") gets that product's composition
// key, so the PMBJP code reaches the answer and the pharmacist list. The match is strict: a
// different release, form, salt or strength is never picked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { identifyMedicine, janAushadhiByName } from '../worker/src/tools.js';
import { runAgent } from '../worker/src/agent.js';
import { pharmacistEntry } from '../public/rules.js';

// TEST FIXTURES ONLY: real PMBJP name styles, made-up codes and prices.
const JA = [
  { drug_code: 'T511', generic_name: 'Paracetamol Tablets IP 650 mg', unit_size: "15's", mrp: 15.47, ckey: 'paracetamol:650mg|tablet', units: 15, unit_price: 1.03 },
  { drug_code: 'T212', generic_name: 'Pantoprazole Gastro Resistant Tablets IP 40 mg', unit_size: "10's", mrp: 12.47, ckey: 'pantoprazole:40mg|tablet', units: 10, unit_price: 1.25 },
  { drug_code: 'T39', generic_name: 'Amoxycillin 500mg and Potassium Clavulanate 125mg Tablets IP', unit_size: "6's", mrp: 57.85, ckey: 'amoxicillin:500mg+clavulanic acid:125mg|tablet', units: 6, unit_price: 9.64 },
  { drug_code: 'T372', generic_name: 'Metformin Hydrochloride Prolonged release Tablets IP 500 mg', unit_size: "10's", mrp: 10.79, ckey: 'metformin:500mg|tablet|SR', units: 10, unit_price: 1.08 },
  { drug_code: 'T298', generic_name: 'Telmisartan 40 mg and Hydrochlorothiazide 12.5 mg Tablets IP', unit_size: "10's", mrp: 20, ckey: 'hydrochlorothiazide:12.5mg+telmisartan:40mg|tablet', units: 10, unit_price: 2 },
  { drug_code: 'T900', generic_name: 'Diclofenac Sodium Tablets IP 50 mg', unit_size: "10's", mrp: 5, ckey: 'diclofenac sodium:50mg|tablet', units: 10, unit_price: 0.5 },
  { drug_code: 'T901', generic_name: 'Diclofenac Potassium Tablets IP 50 mg', unit_size: "10's", mrp: 6, ckey: 'diclofenac potassium:50mg|tablet', units: 10, unit_price: 0.6 },
  { drug_code: 'T902', generic_name: 'Cetirizine Oral Solution IP 5 mg', unit_size: '60 ml', mrp: 15, ckey: 'cetirizine:5mg|liquid', units: 60, unit_price: 0.25 },
  { drug_code: 'T1221', generic_name: 'Levothyroxine Sodium Tablets IP 50 mcg', unit_size: "100's", mrp: 90, ckey: 'levothyroxine:50mcg|tablet', units: 100, unit_price: 0.9 },
  { drug_code: 'T000', generic_name: 'Unparsed Product', unit_size: '', mrp: 1, ckey: null, units: 1, unit_price: 1 },
];
const db = fixtureDb({ ja: JA, kendras: [], meta: { ja_loaded_at: 'test', kendras_loaded_at: 'test', ja_list_date: 'test' } });

test('Jan Aushadhi name: the full printed name and short forms give the product and its code', async () => {
  for (const [q, code] of [
    ['Paracetamol Tablets IP 650 mg', 'T511'], ['Paracetamol 650', 'T511'], ['paracetamol 650mg tablets', 'T511'],
    ['Pantoprazole Gastro Resistant Tablets IP 40 mg', 'T212'], ['Pantoprazole 40', 'T212'],
    ['Amoxycillin 500mg and Potassium Clavulanate 125mg Tablets IP', 'T39'],
    ['Metformin Hydrochloride Prolonged release Tablets IP 500 mg', 'T372'],
    ['Telmisartan 40 Hydrochlorothiazide 12.5', 'T298'],
  ]) {
    const m = await janAushadhiByName(db, q);
    assert.equal(m?.product.drug_code, code, q);
  }
});

test('Jan Aushadhi name: never a different release, form, salt or strength; two possible medicines = no match', async () => {
  const none = [
    'Metformin 500', // only a prolonged-release product: release must be typed
    'Telmisartan 40', // only the combination: a combination is never its part
    'Diclofenac 50', // sodium and potassium are both listed: ambiguous
    'Cetirizine 5', // only a liquid: "oral solution" was not typed
    'Paracetamol 500', // another strength
    'Paracetamol', // no strength typed
    'Unparsed Product', // a list row without a composition key is never used
  ];
  for (const q of none) assert.equal(await janAushadhiByName(db, q), null, q);
});

test('Jan Aushadhi name: identify returns the product as the medicine; a photo read never takes this path', async () => {
  const r = await identifyMedicine(db, { brand: 'Paracetamol Tablets IP 650 mg' });
  assert.equal(r.found, true);
  assert.equal(r.via, 'jan_aushadhi_name');
  assert.equal(r.medicine.ckey, 'paracetamol:650mg|tablet');
  assert.equal(r.medicine.form, 'tablet');
  const photo = await identifyMedicine(db, { brand: 'Paracetamol Tablets IP 650 mg', composition: 'Paracetamol 650 mg', form: 'tablet' });
  assert.notEqual(photo.via, 'jan_aushadhi_name', 'photos keep the composition check');
});

test('Jan Aushadhi name: the answer and the pharmacist list carry the PMBJP code (also for long names, not mistaken for a scan)', async () => {
  for (const [q, code] of [['Paracetamol Tablets IP 650 mg', 'T511'], ['Pantoprazole Gastro Resistant Tablets IP 40 mg', 'T212'], ['Amoxycillin 500mg and Potassium Clavulanate 125mg Tablets IP', 'T39']]) {
    const r = await runAgent({ DB: db, AI: null }, { text: q, lang: 'en' });
    assert.equal(r.status, 'ok', q);
    assert.equal(r.source, 'text', `${q}: typed, not a scan`);
    assert.equal(r.jan_aushadhi.product.drug_code, code, q);
    assert.equal(pharmacistEntry(r).ja.code, code, `${q}: code on the pharmacist list`);
  }
  // A real scan with stray words (batch, maker) is still read as a scan.
  const scan = await runAgent({ DB: db, AI: null }, { text: 'Batch 2231 Pantoprazole Gastro Resistant Tablets IP 40 mg Mfd by PMBI', lang: 'en' });
  assert.equal(scan.source, 'text-scan');
});

test('Jan Aushadhi name: a never-switch medicine typed by its Jan Aushadhi name: the warning, the code for the pharmacist, no price', async () => {
  const r = await runAgent({ DB: db, AI: null }, { text: 'Levothyroxine Sodium Tablets IP 50 mcg', lang: 'en' });
  assert.equal(r.status, 'ok');
  assert.equal(r.medicine.nti, true);
  assert.equal(r.same_salt.items.length, 0);
  assert.equal(pharmacistEntry(r).ja.code, 'T1221', 'the code is shown to the pharmacist (with the never-switch warning)');
  assert.equal(pharmacistEntry(r).ja.mrp, null, 'never a price for a never-switch medicine');
  assert.doesNotMatch(r.answer, /₹/);
});
