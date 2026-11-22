// Missing-medicines list (roadmap S1.2): typed names not found are counted (real traffic only, and
// only text that looks like a medicine name: never a phone number, PIN, email or sentence); a
// Registrar adds the brand from the strip, another person (Reviewer) approves after comparing it;
// approved brands are found by name like any brand, with no price; removed ones are not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { missingName, recordMissing, keyForAdded, addMedicine, decideMedicine, listMissing, ignoreMissing } from '../worker/src/missing.js';
import { runAgent } from '../worker/src/agent.js';
import { can } from '../worker/src/admin.js';

const REG = { username: 'reg1', name: 'Registrar One', role: 'registrar' };
const REV = { username: 'rev1', name: 'Reviewer One', role: 'reviewer' };
const db = () => fixtureDb({ ja: [{ drug_code: 'T7', generic_name: 'Test Antacid Oral Suspension', unit_size: '170 ml', mrp: 50, ckey: 'calcium carbonate:80mg/5ml+sodium alginate:250mg/5ml+sodium bicarbonate:133.5mg/5ml|liquid', units: 170, unit_price: 0.3 }], kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });

test('only text that looks like a medicine name is ever counted', () => {
  assert.deepEqual(missingName('Gaviscon oral syrup'), { key: 'gaviscon oral syrup', shown: 'Gaviscon oral syrup' });
  assert.ok(missingName('Shelcal 500'));
  for (const s of ['9876543210', 'my number 98765 43210', 'Dolo 650 near 560001', 'me@example.com', 'please tell me which medicine is best for my fever', 'ಡೋಲೋ 650', 'ab', '<script>', '12 tablets']) {
    assert.equal(missingName(s), null, s);
  }
});

test('the Worker counts a typed name that is not found, for real traffic only, never a found name or a choice', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const d = db();
  const ask = (body) => worker.fetch(new Request('https://samasalt.example/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: 'en', ...body }) }), { DB: d, AI: null }, { waitUntil() {} });
  await ask({ text: 'Zzgaviscon Liquid' });
  await ask({ text: 'zzgaviscon   liquid' });
  await ask({ text: 'Zzshelcal 500', test: true }); // test traffic
  await ask({ text: 'Dolo 650' }); // found
  await ask({ text: 'call 9876543210' }); // not a medicine name
  const rows = (await d.prepare('SELECT name_key, shown, searches FROM missing_names').all()).results;
  assert.deepEqual(rows.map((r) => [r.name_key, r.searches]), [['zzgaviscon liquid', 2]]);
});

test('adding: salts and strengths read from the strip give the composition key; every salt needs a strength', () => {
  const k = keyForAdded({ name: 'Zzgaviscon Liquid', composition: 'Sodium alginate 250 mg/5 ml + Sodium bicarbonate 133.5 mg/5 ml + Calcium carbonate 80 mg/5 ml', form: 'liquid' });
  assert.equal(k.ckey, 'calcium carbonate:80mg/5ml+sodium alginate:250mg/5ml+sodium bicarbonate:133.5mg/5ml|liquid');
  assert.equal(keyForAdded({ name: 'X', composition: 'Paracetamol', form: 'tablet' }).error, 'name_required');
  assert.equal(keyForAdded({ name: 'Xyz', composition: 'Paracetamol', form: 'tablet' }).error, 'strength_required');
  assert.equal(keyForAdded({ name: 'Xyz', composition: 'Paracetamol 500 mg', form: '' }).error, 'form_required');
  assert.equal(keyForAdded({ name: 'Xyz', composition: 'Metformin 500 mg', form: 'tablet', rel: 'SR' }).ckey, 'metformin:500mg|tablet|SR');
});

test('Registrar adds, another person approves after comparing; then patients find it (no price), and not after removal', async () => {
  assert.ok(can(REG, 'register') && !can(REG, 'review'), 'a Registrar adds but cannot approve');
  assert.ok(can(REV, 'review'));
  const d = db();
  await recordMissing(d, 'Zzgaviscon Liquid', '2026-11-22');
  const body = { name: 'Zzgaviscon Liquid', manufacturer: 'Test', composition: 'Sodium alginate 250 mg/5 ml + Sodium bicarbonate 133.5 mg/5 ml + Calcium carbonate 80 mg/5 ml', form: 'liquid', source_name: 'zzgaviscon liquid' };
  assert.equal((await addMedicine(d, body, REG)).body.error, 'check_required');
  const added = await addMedicine(d, { ...body, checked: true }, REG);
  assert.equal(added.status, 200);
  const id = added.body.id;
  assert.equal((await addMedicine(d, { ...body, checked: true }, REG)).status, 409, 'no duplicate');
  // Not found while waiting.
  assert.equal((await runAgent({ DB: d, AI: null }, { text: 'Zzgaviscon Liquid', lang: 'en' })).status, 'not_found');
  // Approving needs the comparison and a note, and another person.
  assert.equal((await decideMedicine(d, { id, action: 'approve', note: 'checked' }, REV)).body.error, 'compare_required');
  assert.equal((await decideMedicine(d, { id, action: 'approve', compared: true }, REV)).body.error, 'note_required');
  assert.equal((await decideMedicine(d, { id, action: 'approve', compared: true, note: 'checked' }, { ...REG, role: 'reviewer' })).body.error, 'same_person');
  assert.equal((await decideMedicine(d, { id, action: 'approve', compared: true, note: 'Checked the strip photo' }, REV)).status, 200);
  const list = await listMissing(d);
  assert.equal(list.names.length, 0, 'the name leaves the open list once added');
  assert.equal(list.added[0].status, 'approved');
  // Patients find it: its composition, the Jan Aushadhi product, no price.
  const r = await runAgent({ DB: d, AI: null }, { text: 'Zzgaviscon Liquid', lang: 'en' });
  assert.equal(r.status, 'ok');
  assert.equal(r.medicine.ckey, 'calcium carbonate:80mg/5ml+sodium alginate:250mg/5ml+sodium bicarbonate:133.5mg/5ml|liquid');
  assert.equal(r.medicine.price, null);
  assert.equal(r.jan_aushadhi.product.drug_code, 'T7');
  // Removed: not found again.
  assert.equal((await decideMedicine(d, { id, action: 'remove', note: 'wrong strength' }, REV)).status, 200);
  assert.equal((await runAgent({ DB: d, AI: null }, { text: 'Zzgaviscon Liquid', lang: 'en' })).status, 'not_found');
  const log = (await d.prepare('SELECT action FROM added_medicine_reviews WHERE med_id = ?1 ORDER BY id').bind(id).all()).results.map((x) => x.action);
  assert.deepEqual(log, ['add', 'approve', 'remove']);
});

test('ignore: a counted name that is not a medicine leaves the list', async () => {
  const d = db();
  await recordMissing(d, 'Hello doctor', '2026-11-22');
  assert.equal((await listMissing(d)).names.length, 1);
  await ignoreMissing(d, { name_key: 'hello doctor' });
  assert.equal((await listMissing(d)).names.length, 0);
});
