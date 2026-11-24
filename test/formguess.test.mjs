// Owner's decision 24 Nov 2026: a salt and strength typed with no form is not answered by a brand that is
// named like the salt ("Tramadol 50 mg" -> "Tramadol 50mg Capsule"): that would choose the form.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { runAgent } from '../worker/src/agent.js';
import { formGuessChoices } from '../worker/src/tools.js';

const db = () => fixtureDb({ ja: [], kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
const ask = (DB, text) => runAgent({ DB, AI: null }, { text, lang: 'en' });

test('a typed salt + strength with no form is offered in every form, never answered by a brand named like the salt', async () => {
  const DB = db();
  const r = await ask(DB, 'Tramadol 50 mg');
  assert.equal(r.status, 'not_found', 'not answered');
  const comps = r.choices.map((c) => c.composition);
  assert.ok(comps.includes('Tramadol 50 mg · capsule'), comps.join(' | '));
  assert.ok(new Set(comps).size > 1, 'more than one form');
  assert.ok(comps.every((c) => c.startsWith('Tramadol 50 mg')), 'never another salt or strength');
  for (const c of r.choices) {
    const tapped = await ask(DB, c.name);
    assert.equal(tapped.status, 'ok', c.name);
    assert.equal(tapped.medicine.composition, c.composition, `${c.name}: tapped = shown`);
  }
});

test('a typed form, a full name and an ordinary brand are answered as before', async () => {
  const DB = db();
  assert.equal((await ask(DB, 'Tramadol 50mg Capsule')).medicine.composition, 'Tramadol 50 mg · capsule');
  assert.equal((await ask(DB, 'Tramadol 50 capsule')).medicine?.composition, 'Tramadol 50 mg · capsule');
  assert.equal((await ask(DB, 'Dolo 650')).medicine.name, 'Dolo 650 Tablet');
  assert.equal((await ask(DB, 'Telma 40')).medicine.name, 'Telma 40 Tablet');
});

test('only a brand match is questioned, and only when another composition exists', async () => {
  const DB = db();
  const med = { name: 'Tramadol 50mg Capsule', ckey: 'tramadol:50mg|capsule' };
  assert.deepEqual(await formGuessChoices(DB, 'Tramadol 50 mg', { found: true, via: 'jan_aushadhi_name', medicine: med }), []);
  assert.deepEqual(await formGuessChoices(DB, 'Dolo 650', { found: true, via: 'brand', medicine: { name: 'Dolo 650 Tablet', ckey: 'paracetamol:650mg|tablet' } }), []);
  assert.deepEqual(await formGuessChoices(DB, 'Tramadol 50 mg', { found: false }), []);
});
