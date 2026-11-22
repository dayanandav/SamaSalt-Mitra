// Salt names typed in Kannada/Hindi (roadmap S2.5, refinement): official Jan Aushadhi products whose
// name starts with a word that sounds like the typed one are offered first, under their full official
// name, as choices (never an answer by themselves). The typed strength must be the strength of the
// salt the patient named; tablets and capsules come before injections; tapping a choice answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { runAgent } from '../worker/src/agent.js';

// TEST FIXTURES: official name styles, made-up codes and prices.
const JA = [
  { drug_code: 'T145', generic_name: 'Metformin Hydrochloride Tablets IP 500mg', unit_size: "10's", mrp: 5, ckey: 'metformin:500mg|tablet', units: 10, unit_price: 0.5 },
  { drug_code: 'T372', generic_name: 'Metformin Hydrochloride Prolonged release Tablets IP 500 mg', unit_size: "10's", mrp: 9, ckey: 'metformin:500mg|tablet|SR', units: 10, unit_price: 0.9 },
  { drug_code: 'T240', generic_name: 'Cetrizine Hydrochloride Tablets IP 10mg', unit_size: "10's", mrp: 3, ckey: 'cetirizine:10mg|tablet', units: 10, unit_price: 0.3 },
  { drug_code: 'T999', generic_name: 'Cetirizine Dihydrochloride 5mg, Phenylephrine Hydrochloride 10mg and Paracetamol 325mg Tablets', unit_size: "10's", mrp: 8, ckey: 'cetirizine:5mg+paracetamol:325mg+phenylephrine:10mg|tablet', units: 10, unit_price: 0.8 },
  { drug_code: 'T213', generic_name: 'Pantoprazole Injection 40mg', unit_size: '1 vial', mrp: 40, ckey: 'pantoprazole:40mg|injection', units: 1, unit_price: 40 },
  { drug_code: 'T212', generic_name: 'Pantoprazole Gastro Resistant Tablets IP 40 mg', unit_size: "10's", mrp: 12, ckey: 'pantoprazole:40mg|tablet', units: 10, unit_price: 1.2 },
];
const db = () => fixtureDb({ ja: JA, kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't', ja_list_date: 't' } });
const ask = (d, text) => runAgent({ DB: d, AI: null }, { text, lang: 'hi' });

test('a salt name in Hindi or Kannada: the Jan Aushadhi product first, as a choice; tapping it answers with its code', async () => {
  const d = db();
  const r = await ask(d, 'मेटफॉर्मिन 500');
  assert.equal(r.status, 'not_found', 'a choice, never an answer');
  assert.equal(r.choices[0].name, 'Metformin Hydrochloride Tablets IP 500mg');
  assert.ok(r.choices.some((c) => c.name.includes('Prolonged release')), 'the release is in the name and the salts shown');
  const tap = await ask(d, r.choices[0].name);
  assert.equal(tap.status, 'ok');
  assert.equal(tap.jan_aushadhi.product.drug_code, 'T145');
  assert.equal((await ask(d, 'ಮೆಟ್ಫಾರ್ಮಿನ್ 500')).choices[0].name, 'Metformin Hydrochloride Tablets IP 500mg', 'Kannada too');
});

test('the typed strength belongs to the named salt; tablets come before injections', async () => {
  const d = db();
  const c = await ask(d, 'सिटिरिजिन 10');
  assert.ok(c.choices.some((x) => x.name === 'Cetrizine Hydrochloride Tablets IP 10mg'));
  assert.ok(!c.choices.some((x) => x.name.includes('Phenylephrine')), '10 mg is phenylephrine there, not cetirizine');
  const p = await ask(d, 'पैंटोप्राजोल 40');
  assert.equal(p.choices[0].name, 'Pantoprazole Gastro Resistant Tablets IP 40 mg');
  assert.ok(p.choices.findIndex((x) => x.name.includes('Injection')) > 0);
  assert.equal((await ask(d, 'मेटफॉर्मिन 999')).choices, undefined, 'no product of that strength: nothing offered');
});
