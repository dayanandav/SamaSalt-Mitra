// 23 Nov 2026 (found by the S3.9 search set): "Amoxicillin 500 Clavulanic acid 125" was answered as one
// salt with no strength, with "no other brand ... is in our list". A composition is answered by itself
// only when every salt has its own strength.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { identifyMedicine } from '../worker/src/tools.js';

const ctx = () => fixtureDb({ ja: [], kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
const comp = (DB, composition, form = '') => identifyMedicine(DB, { brand: '', composition, form });

test('a composition where a salt has no clear strength is never answered', async () => {
  const DB = ctx();
  for (const c of ['Amoxicillin 500 Clavulanic acid 125', 'Amoxicillin 500 Clavulanic acid 125mg', 'Amoxicillin 500 + Clavulanic acid 125', 'Paracetamol', 'Paracetamol 325mg + Tramadol']) {
    const r = await comp(DB, c);
    assert.equal(r.found, false, `${c} -> ${r.medicine?.ckey}`);
  }
});

test('a composition with every strength is answered as before', async () => {
  const DB = ctx();
  for (const [c, key] of [
    ['Amoxicillin 500mg + Clavulanic Acid 125mg', 'amoxicillin:500mg+clavulanic acid:125mg|tablet'],
    ['Amoxicillin 500mg Clavulanic Acid 125mg', 'amoxicillin:500mg+clavulanic acid:125mg|tablet'],
    ['Paracetamol 650mg', 'paracetamol:650mg|tablet'],
  ]) {
    const r = await comp(DB, c, 'tablet');
    assert.equal(r.found, true, c);
    assert.equal(r.medicine.ckey, key, c);
  }
});
