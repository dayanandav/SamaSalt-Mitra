// "Not found" help: close brand names to tap ("Did you mean…?"), the form typed or printed with
// the salts (a syrup is never compared with tablets), and a typed name the pharmacist can check.
// Suggestions are names only: nothing is assumed until the person taps one, and a typed
// strength is never changed into another.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { suggestNames } from '../worker/src/tools.js';
import { runAgent } from '../worker/src/agent.js';
import { unlistedEntry, orderItems, pharmacistEntry } from '../public/rules.js';
import { t } from '../public/strings.js';

const db = fixtureDb({ meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });

test('did you mean: a typo in the name, or the letter O typed for a zero, gives the close brand names', async () => {
  assert.equal((await suggestNames(db, 'Dolo 65O'))[0], 'Dolo 650 Tablet');
  assert.deepEqual(await suggestNames(db, 'Dolp 500'), ['Dolo 500 Tablet']);
  assert.equal((await suggestNames(db, 'Augmentn 625'))[0], 'Augmentin 625 Duo Tablet');
  assert.equal((await suggestNames(db, 'Crocn advance'))[0], 'Crocin Advance Tablet');
  assert.ok((await suggestNames(db, 'Dolo 65O')).length <= 5);
});

test('did you mean: never a different strength, never a far-off name', async () => {
  assert.deepEqual(await suggestNames(db, 'Dolo 999'), [], 'no name has 999: nothing is offered');
  for (const name of await suggestNames(db, 'Dolo 65O')) assert.match(name, /\b650/, `${name}: the typed strength`);
  assert.deepEqual(await suggestNames(db, 'Gaviscon'), []);
  assert.deepEqual(await suggestNames(db, 'xy'), [], 'too short to guess');
  // A typed form must be the brand's form: no injection offered for a tablet or a syrup.
  for (const n of await suggestNames(db, 'Augmentn duo tablet')) assert.match(n, /Tablet/, n);
  for (const n of await suggestNames(db, 'Augmentn injection')) assert.match(n, /Injection/, n);
});

test('not found: the answer carries the suggestions; the medicine is not assumed', async () => {
  const r = await runAgent({ DB: db, AI: null }, { text: 'Dolo 65O', lang: 'en' });
  assert.equal(r.status, 'not_found');
  assert.equal(r.suggestions[0], 'Dolo 650 Tablet');
  assert.equal(r.medicine, undefined);
  assert.equal(r.answer, undefined);
});

test('form: salts typed or printed with "oral suspension" / "syrup" are a liquid, never a tablet', async () => {
  for (const ocr of ['Each 5 ml contains Paracetamol IP 250 mg Oral Suspension', 'Each 5 ml contains Paracetamol IP 250 mg syrup']) {
    const r = await runAgent({ DB: db, AI: null }, { ocr, lang: 'en' });
    assert.match(r.medicine.ckey, /\|liquid$/, ocr);
  }
  const typed = await runAgent({ DB: db, AI: null }, { text: 'Sodium alginate 250 mg sodium bicarbonate 133.5 mg calcium carbonate 80 mg oral suspension', lang: 'en' });
  assert.match(typed.medicine.ckey, /\|liquid$/);
  assert.equal(typed.same_salt.count, 0);
  assert.match(typed.answer, /No other brand with exactly the same salt, strength and form is in our list/);
  const tab = await runAgent({ DB: db, AI: null }, { ocr: 'Each tablet contains Paracetamol IP 500 mg', lang: 'en' });
  assert.equal(tab.medicine.ckey, 'paracetamol:500mg|tablet');
});

test('pharmacist list: a medicine not in our list goes by its typed name only, with no generic, never ordered', () => {
  const e = unlistedEntry('  Gaviscon   oral syrup ');
  assert.equal(e.name, 'Gaviscon oral syrup');
  assert.equal(e.unlisted, true);
  assert.equal(e.ja, null);
  assert.equal(e.composition, '');
  assert.equal(orderItems([{ ...e, qty: 1 }]).items.length, 0);
  assert.equal(unlistedEntry('   '), null);
  // A found medicine is never marked "not in our list".
  const found = pharmacistEntry({ medicine: { ckey: 'k', name: 'Dolo 650', composition: 'Paracetamol 650 mg', form: 'tablet', nti: false }, jan_aushadhi: { available: false } });
  assert.equal(found.unlisted, undefined);
});

test('not-found texts exist in every language (the chat names up to three suggestions)', () => {
  for (const l of ['en', 'kn', 'hi']) {
    for (const k of ['didYouMean', 'nfHow', 'nfScanBack', 'nfScanBackWhy', 'nfTypeSalts', 'nfAddPh', 'phUnlisted']) assert.ok(t(l, k), `${l}.${k}`);
    assert.match(t(l, 'waDidYouMean', { names: 'Dolo 650 Tablet' }), /Dolo 650 Tablet/);
  }
});
