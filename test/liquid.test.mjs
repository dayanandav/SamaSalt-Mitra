// Salts read from a strip or a bottle label (photo text, or the keyboard's "Scan text"):
// a liquid's strength is per volume ("Each 5 ml contains Paracetamol IP 120 mg" = 120mg/5ml, as
// brands list it, never 120 mg), and stray words never end up in a salt name ("h" of "Each",
// "and", "reconstituted", "gastro resistant").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { compositionFromText } from '../worker/src/tools.js';
import { runAgent } from '../worker/src/agent.js';

const db = fixtureDb({ meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
const scan = (ocr) => runAgent({ DB: db, AI: null }, { ocr, lang: 'en' });

test('liquid strengths: per 5 ml, per ml, inline "mg/5 ml"', () => {
  assert.equal(compositionFromText('Each 5 ml contains Paracetamol IP 120 mg Oral Suspension'), 'Paracetamol (120mg/5ml)');
  assert.equal(compositionFromText('DOLO 250 Oral Suspension Each 5ml contains: Paracetamol I.P. 250 mg'), 'Paracetamol (250mg/5ml)');
  assert.equal(compositionFromText('Paracetamol 120 mg/5 ml syrup'), 'Paracetamol (120mg/5ml)');
  assert.equal(compositionFromText('Paracetamol 120 mg per 5 ml syrup'), 'Paracetamol (120mg/5ml)');
  assert.equal(compositionFromText('Each ml contains Paracetamol IP 100 mg drops'), 'Paracetamol (100mg/ml)');
  assert.equal(compositionFromText('Each 5 ml of reconstituted suspension contains Amoxycillin IP 400 mg and Clavulanic Acid 57 mg'), 'Amoxycillin (400mg/5ml) + Clavulanic Acid (57mg/5ml)');
});

test('tablets keep a plain strength; stray words never become part of a salt name', () => {
  assert.equal(compositionFromText('Each tablet contains Paracetamol IP 500 mg'), 'Paracetamol (500mg)');
  assert.equal(compositionFromText('Each film coated tablet contains Amoxycillin 500 mg Clavulanic acid 125 mg'), 'Amoxycillin (500mg) + Clavulanic acid (125mg)');
  assert.equal(compositionFromText('Batch 2231 Pantoprazole Gastro Resistant Tablets IP 40 mg Mfd by PMBI'), 'Pantoprazole (40mg)');
  assert.equal(compositionFromText('TELMA-H Each uncoated tablet contains Telmisartan IP 40 mg Hydrochlorothiazide IP 12.5 mg'), 'Telmisartan (40mg) + Hydrochlorothiazide (12.5mg)');
});

test('a liquid read from a label finds the brands with the same strength per volume, and is never a tablet', async () => {
  const r = await scan('Each 5 ml contains Paracetamol IP 120 mg Oral Suspension');
  assert.equal(r.medicine.ckey, 'paracetamol:120mg/5ml|liquid');
  assert.ok(r.same_salt.count > 0);
  const amox = await scan('Each 5 ml of reconstituted suspension contains Amoxycillin IP 400 mg and Clavulanic Acid 57 mg');
  assert.equal(amox.medicine.ckey, 'amoxicillin:400mg/5ml+clavulanic acid:57mg/5ml|liquid');
  // No form word read, but a strength per ml: a liquid.
  const noForm = await scan('Each 10 ml contains Magaldrate IP 800 mg Simethicone IP 40 mg');
  assert.match(noForm.medicine.ckey, /\|liquid$/);
  assert.equal((await scan('Each tablet contains Paracetamol IP 500 mg')).medicine.ckey, 'paracetamol:500mg|tablet');
});
