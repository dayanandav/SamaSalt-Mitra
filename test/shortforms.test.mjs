// Short forms patients type (roadmap S1.3, public/short-forms.js): tried only when the name as
// typed is not found, whole words only, one meaning each, never a brand or a combination; the
// usual exact matching follows (same salt, strength, form, release).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { SHORT_FORMS, expandShortForms } from '../public/short-forms.js';
import { runAgent } from '../worker/src/agent.js';

test('short forms: whole words only, lowercase keys, one salt or a form word each', () => {
  assert.equal(expandShortForms('pcm 500'), 'paracetamol 500');
  assert.equal(expandShortForms('PCM 500 tabs'), 'paracetamol 500 tablets');
  assert.equal(expandShortForms('Calpol syp'), 'Calpol syrup');
  assert.equal(expandShortForms('Pcmol 500'), 'Pcmol 500', 'part of a word is never expanded');
  assert.equal(expandShortForms('Dolo 650'), 'Dolo 650');
  for (const [k, v] of Object.entries(SHORT_FORMS)) {
    assert.match(k, /^[a-z]+$/, k);
    assert.doesNotMatch(v, /[+,]|\band\b/, `${k}: never a combination`);
  }
  // Abbreviations with more than one meaning are never in the list.
  for (const k of ['mtx', 'ors', 'd', 'm', 'sr', 'ds', 'cv', 'h']) assert.equal(SHORT_FORMS[k], undefined, k);
});

test('short forms: used only after the name as typed is not found; exact matching follows', async () => {
  const db = fixtureDb({
    ja: [{ drug_code: 'T1', generic_name: 'Paracetamol Tablets IP 500 mg', unit_size: "10's", mrp: 5, ckey: 'paracetamol:500mg|tablet', units: 10, unit_price: 0.5 }],
    meta: { ja_loaded_at: 't', kendras_loaded_at: 't' },
  });
  const r = await runAgent({ DB: db, AI: null }, { text: 'pcm 500', lang: 'en' });
  assert.equal(r.status, 'ok');
  assert.equal(r.medicine.ckey, 'paracetamol:500mg|tablet');
  assert.ok(r.trace.some((s) => s.tool === 'identify_medicine' && s.input.short_forms), 'the expansion step is in the trace');
  // A name found as typed never goes through the list.
  const dolo = await runAgent({ DB: db, AI: null }, { text: 'Dolo 650', lang: 'en' });
  assert.ok(!dolo.trace.some((s) => s.input?.short_forms));
  // Expanded text still needs an exact strength: no 999 mg paracetamol is ever offered.
  assert.equal((await runAgent({ DB: db, AI: null }, { text: 'pcm 999', lang: 'en' })).status, 'not_found');
});
