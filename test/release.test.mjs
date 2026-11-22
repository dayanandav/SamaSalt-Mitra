// Release type in brand names: "Tablet PR" / "Prolonged Release" and "-DSR" (domperidone sustained
// release) are SR, as the official Jan Aushadhi list reads them. An unread release grouped
// prolonged-release brands with plain ones (same salt, but not the same medicine) and hid the
// Jan Aushadhi product (Pan-D PR = PMBJP "Pantoprazole 40mg and Domperidone 30mg (Prolonged
// Release) Capsules").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { keyFor, extractReleaseType } from '../worker/src/normalize.js';
import { runAgent } from '../worker/src/agent.js';
import { pharmacistEntry } from '../public/rules.js';

const PAN_D = 'Domperidone (30mg) + Pantoprazole (40mg)';

test('release: PR, prolonged release and DSR are SR; words that merely contain the letters are not', () => {
  assert.equal(keyFor(PAN_D, { name: 'Pan-D Capsule PR' }).key, 'domperidone:30mg+pantoprazole:40mg|capsule|SR');
  assert.equal(keyFor(PAN_D, { name: 'Pantocid DSR Capsule' }).key, 'domperidone:30mg+pantoprazole:40mg|capsule|SR');
  assert.equal(keyFor('Mesalazine (1gm)', { name: 'Pentasa 1gm Prolonged Release Tablet' }).key, 'mesalazine:1000mg|tablet|SR');
  assert.equal(keyFor('Glimepiride (1mg) + Metformin (500mg)', { name: 'Glimetek-M 1 Tablet PR' }).key, 'glimepiride:1mg+metformin:500mg|tablet|SR');
  // Plain brands stay plain: never merged with the prolonged-release ones.
  assert.equal(keyFor(PAN_D, { name: 'Pan D Capsule' }).key, 'domperidone:30mg+pantoprazole:40mg|capsule');
  for (const n of ['Pregaba 75 Capsule', 'Prolomet 25 Tablet', 'Sprint Tablet', 'Apri Tablet', 'Dsrin Tablet']) assert.equal(extractReleaseType(n), null, n);
  // The release patterns already known are unchanged.
  assert.equal(extractReleaseType('Metformin SR 500'), 'SR');
  assert.equal(extractReleaseType('Nicardia XL 30'), 'XL');
  assert.equal(extractReleaseType('Depakote ER 500'), 'XR');
});

test('Pan-D PR: the Jan Aushadhi prolonged-release capsule and its code; plain capsules are not listed as the same', async () => {
  const db = fixtureDb({
    ja: [{ drug_code: 'T465', generic_name: 'Pantoprazole 40mg (Gastro-resistant) and Domperidone 30mg (Prolonged Release) Capsules IP', unit_size: "10's", mrp: 22.69, ckey: 'domperidone:30mg+pantoprazole:40mg|capsule|SR', units: 10, unit_price: 2.269 }],
    meta: { ja_loaded_at: 't', kendras_loaded_at: 't', ja_list_date: 't' },
  });
  const ins = 'INSERT INTO medicines (id,name,manufacturer,salt,ckey,price,pack,unit_price,form,rel,nti,incomplete) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)';
  // Priced below every real brand, so they are in the (cheapest-first) list whatever the fixture holds.
  await db.prepare(ins).bind(990001, 'Zzpand Capsule PR', 'Test Ltd', PAN_D, keyFor(PAN_D, { name: 'Zzpand Capsule PR' }).key, 0.3, 15, 0.02, 'capsule', 'SR', 0, 0).run();
  await db.prepare(ins).bind(990002, 'Zzpandsr DSR Capsule', 'Test Ltd', PAN_D, keyFor(PAN_D, { name: 'Zzpandsr DSR Capsule' }).key, 0.1, 10, 0.01, 'capsule', 'SR', 0, 0).run();
  await db.prepare(ins).bind(990003, 'Zzplain Capsule', 'Test Ltd', PAN_D, keyFor(PAN_D, { name: 'Zzplain Capsule' }).key, 0.05, 10, 0.005, 'capsule', null, 0, 0).run();
  const r = await runAgent({ DB: db, AI: null }, { text: 'Zzpand Capsule PR', lang: 'en' });
  assert.equal(r.status, 'ok');
  assert.equal(r.medicine.ckey, 'domperidone:30mg+pantoprazole:40mg|capsule|SR');
  assert.equal(r.jan_aushadhi.product.drug_code, 'T465');
  assert.equal(pharmacistEntry(r).ja.code, 'T465');
  const names = r.same_salt.items.map((x) => x.name);
  assert.ok(names.includes('Zzpandsr DSR Capsule'), 'the DSR brand is the same medicine');
  assert.ok(!names.includes('Zzplain Capsule'), 'a plain capsule is never listed as the same');
});
