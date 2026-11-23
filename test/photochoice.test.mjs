// Front of the strip (owner's decision 23 Nov 2026): a photo or scan where the brand was read but
// not the salts is still "not read", but the brand read is matched like a typed name and offered as
// choices with their salts: never an answer, nothing priced. Only for "salts not clear"; a brand
// whose salts disagree with what was read gets no choices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';
import { runAgent } from '../worker/src/agent.js';

const db = () => fixtureDb({ ja: [], kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
// A stand-in for the vision model: returns what it "read" from the photo.
const vision = (read) => ({ run: async () => ({ response: JSON.stringify({ form: 'tablet', release: null, confidence: 0.9, ...read }) }) });
const photo = (read) => runAgent({ DB: db(), AI: vision(read) }, { image: 'data:image/jpeg;base64,AAAA', lang: 'en' });

test('front of the strip: the brand read is offered as a choice with its salts, never an answer', async () => {
  const r = await photo({ brand: 'Dolo 650', composition: '' });
  assert.equal(r.status, 'unreadable');
  assert.equal(r.reason, 'no_composition');
  assert.deepEqual(r.choices, [{ name: 'Dolo 650 Tablet', composition: 'Paracetamol 650 mg · tablet' }]);
  assert.equal(r.medicine, undefined, 'nothing answered');
  assert.equal(r.answer, undefined, 'nothing priced');
  // A partial fit is a choice too, never picked.
  const e = await photo({ brand: 'Atorva E', composition: '' });
  assert.ok(e.choices.length > 1);
  assert.ok(e.choices.every((c) => c.composition));
});

test('keyboard "Scan text" of the front works the same; text with no brand gets no choices', async () => {
  const r = await runAgent({ DB: db(), AI: null }, { text: 'DOLO 650 Tablets MICRO LABS LIMITED BATCH 23A MFG 08 2026 EXP 07 2028', lang: 'en' });
  assert.equal(r.status, 'unreadable');
  assert.equal(r.choices[0].name, 'Dolo 650 Tablet');
  const junk = await runAgent({ DB: db(), AI: null }, { text: 'BATCH 23A MFG 08 2026 EXP 07 2028 KEEP OUT OF REACH OF CHILDREN', lang: 'en' });
  assert.equal(junk.choices, undefined);
});

test('a brand whose salts disagree with what was read gets no choices; a full read is unchanged', async () => {
  const mismatch = await photo({ brand: 'Dolo 650', composition: 'Pantoprazole 40 mg' });
  assert.notEqual(mismatch.status, 'ok');
  assert.equal(mismatch.choices, undefined);
  const full = await photo({ brand: 'Dolo 650', composition: 'Paracetamol 650 mg' });
  assert.equal(full.status, 'ok');
  assert.equal(full.medicine.name, 'Dolo 650 Tablet');
});

test('the app shows the choices and counts a tap as "photochoice"', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /photoChoose/);
  assert.match(app, /via: 'photochoice'/);
  assert.match(readFileSync(new URL('../worker/src/index.js', import.meta.url), 'utf8'), /'photochoice'/);
});
