// v2.0.9 (owner's go-ahead 23 Nov 2026, roadmap P2 / P3).
// P2 "Is the quality the same?": fixed text under the Jan Aushadhi card, never for a never-switch medicine.
// P3 "Show this to your doctor": the list by salt + strength + form (+ release) from our data; no prices,
//    no dosage; never-switch medicines and medicines without salts are left out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { doctorNote } from '../public/rules.js';
import { STRINGS, t } from '../public/strings.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('P3: the doctor note lists salt, strength, form and release from the data; never-switch and unknown medicines are left out', () => {
  const list = [
    { name: 'Glycomet SR 500', ckey: 'metformin:500mg|tablet|SR', composition: 'Metformin 500 mg', nti: false },
    { name: 'Telma 40', ckey: 'telmisartan:40mg|tablet', composition: 'Telmisartan 40 mg', nti: false },
    { name: 'Telsartan 40', ckey: 'telmisartan:40mg|tablet', composition: 'Telmisartan 40 mg', nti: false },
    { name: 'Eltroxin 100', ckey: 'levothyroxine:100mcg|tablet', composition: 'Levothyroxine 100 mcg', nti: true },
    { name: 'Some syrup', unlisted: true },
    null,
  ];
  const r = doctorNote(list);
  assert.deepEqual(r.items, ['Metformin 500 mg · tablet · SR', 'Telmisartan 40 mg · tablet'], 'release kept, same composition once');
  assert.deepEqual(r.left, ['Eltroxin 100', 'Some syrup'], 'never-switch and unknown are left out, by name');
  assert.ok(!JSON.stringify(r).includes('₹'), 'no prices');
  assert.deepEqual(doctorNote('junk'), { items: [], left: [] });
});

test('P2 / P3: texts in every language, with no prices and no dosage; the note is in English for the doctor', () => {
  for (const l of Object.keys(STRINGS)) {
    for (const k of ['jaTrustTitle', 'jaTrust', 'doctorBtn', 'doctorLead', 'doctorHello', 'doctorAsk', 'doctorFoot', 'doctorLeft', 'doctorPrint', 'doctorShare']) {
      assert.ok(STRINGS[l][k], `${l}.${k}`);
      assert.ok(!/₹|\d+\s*(mg|ml)|times a day|twice|once daily|dose/i.test(STRINGS[l][k]), `${l}.${k}: no price or dosage`);
    }
    assert.match(t(l, 'doctorLeft', { names: 'X' }), /X/);
  }
  const app = read('../public/app.js');
  assert.match(app, /\$\{!m\.nti \? trustHtml\(\) : ''\}/, 'the quality note never shows for a never-switch medicine');
  for (const k of ['doctorHello', 'doctorAsk', 'doctorFoot']) assert.match(app, new RegExp(`t\\('en', '${k}'\\)`), `${k} in English for the doctor`);
  assert.match(app, /\$\('#phDoctor'\)\.hidden = !doctorNote\(list\)\.items\.length/, 'the button only when something can be listed');
  const html = read('../public/index.html');
  assert.match(html, /id="phDoctor"[^>]*hidden/, 'hidden until there is something to show');
  assert.match(html, /<dialog id="doctor"/);
});
