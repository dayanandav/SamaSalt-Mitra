// v2.0.9 (owner's go-ahead 23 Nov 2026, roadmap P2 / P3 / P5).
// P2 "Is the quality the same?": fixed text under the Jan Aushadhi card, never for a never-switch medicine.
// P3 "Show this to your doctor": the list by salt + strength + form (+ release) from our data; no prices,
//    no dosage; never-switch medicines and medicines without salts are left out.
// P5 demand by area: counts only, per PIN area (first 3 digits), real traffic, at least 3 different phones
//    (changed 23 Nov 2026 with the owner's yes: it counted checks, so one person could be listed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';
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

test('P5: demand by area counts real checks of Jan Aushadhi medicines per PIN area, only from 3 different phones, nothing else', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const JA = [
    { drug_code: '101', generic_name: 'Metformin SR Tablets 500mg', unit_size: "10's", mrp: 9, group_name: 'X', ckey: 'metformin:500mg|tablet|SR', units: 10, unit_price: 0.9 },
    { drug_code: '102', generic_name: 'Telmisartan Tablets 40mg', unit_size: "10's", mrp: 12, group_name: 'X', ckey: 'telmisartan:40mg|tablet', units: 10, unit_price: 1.2 },
  ];
  const DB = fixtureDb({ ja: JA, kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
  let n = 0;
  const add = (pin3, ckey, extra = {}) => {
    const r = { status: 'ok', is_test: 0, ja_unit: 1, switched: null, device: `phone${n}aaaa`, ...extra };
    return DB.prepare(`INSERT INTO lookups (id, ts, day, status, input, medicine, ckey, ja_unit, lang, pin3, mode, is_test, switched, device) VALUES (?1, '2026-11-23T10:00:00Z', '2026-11-23', ?2, 'text', 'Brand', ?3, ?4, 'en', ?5, 'self', ?6, ?7, ?8)`)
      .bind(`id${n++}`, r.status, ckey, r.ja_unit, pin3, r.is_test, r.switched, r.device).run();
  };
  for (let i = 0; i < 4; i++) await add('560', 'metformin:500mg|tablet|SR');
  for (let i = 0; i < 3; i++) await add('560', 'telmisartan:40mg|tablet');
  for (let i = 0; i < 2; i++) await add('110', 'metformin:500mg|tablet|SR'); // only 2 phones: not shown
  for (let i = 0; i < 9; i++) await add('120', 'metformin:500mg|tablet|SR', { device: 'onephone1' }); // one phone, many checks
  for (let i = 0; i < 9; i++) await add('130', 'metformin:500mg|tablet|SR', { device: i % 2 ? 'phoneaaa1' : 'phonebbb2' }); // two phones
  for (let i = 0; i < 9; i++) await add('140', 'metformin:500mg|tablet|SR', { device: null }); // no phone id
  for (let i = 0; i < 5; i++) await add('400', 'telmisartan:40mg|tablet', { is_test: 1 }); // test traffic
  for (let i = 0; i < 5; i++) await add('400', 'metformin:500mg|tablet|SR', { switched: 'wrong' }); // wrong read
  for (let i = 0; i < 5; i++) await add('600', 'metformin:500mg|tablet|SR', { ja_unit: null }); // no Jan Aushadhi product
  const env = { DB, AI: null };
  const d = await (await worker.fetch(new Request('https://samasalt.example/api/impact'), env, { waitUntil() {} })).json();
  const off = await (await worker.fetch(new Request('https://samasalt.example/api/impact'), { ...env, DEMAND_BY_AREA: 'off' }, { waitUntil() {} })).json();
  assert.equal(off.demand_by_area, null, 'switched off: nothing is sent');
  assert.equal(d.demand_by_area.min_devices, 3);
  assert.deepEqual(d.demand_by_area.areas, [{
    pin3: '560', checks: 7, medicines: [
      { drug_code: '101', name: 'Metformin SR Tablets 500mg', composition: 'Metformin 500 mg · tablet · SR', n: 4 },
      { drug_code: '102', name: 'Telmisartan Tablets 40mg', composition: 'Telmisartan 40 mg · tablet', n: 3 },
    ],
  }]);
  const page = read('../public/impact.html');
  assert.match(page, /id="demand"/);
  assert.match(page, /Demand by area \(min \$\{DA\.min_devices\} phones\)/, 'in the CSV too');
  assert.doesNotMatch(page, /no single person/, 'no promise the count cannot keep');
  assert.match(page, /id="demandBox" hidden/, 'hidden unless the data is sent');
});
