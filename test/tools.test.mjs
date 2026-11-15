import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { cleanComposition, identifyMedicine, findSameSalt, janAushadhiMatch, nearestKendra, computeSaving, compositionFromText, brandCandidatesFromText, nameScore } from '../worker/src/tools.js';
import { runAgent } from '../worker/src/agent.js';
import { composeAnswer, noOption } from '../public/strings.js';

// Jan Aushadhi / Kendra rows here are TEST FIXTURES ONLY (made-up codes and prices), used to
// exercise the matching code paths. Production data comes from data/build_ja.py.
const JA = [
  { drug_code: 'TEST-1', generic_name: 'Paracetamol Tablets IP 650 mg', unit_size: '10 tablets', mrp: 10, ckey: 'paracetamol:650mg|tablet', units: 10, unit_price: 1.0 },
  { drug_code: 'TEST-2', generic_name: 'Amoxycillin and Potassium Clavulanate Tablets IP 500 mg + 125 mg', unit_size: '10 tablets', mrp: 80, ckey: 'amoxicillin:500mg+clavulanic acid:125mg|tablet', units: 10, unit_price: 8.0 },
];
const KENDRAS = [
  { code: 'K1', name: 'Test Kendra Dharwad A', pin: '580001', lat: 15.4589, lng: 75.0078 },
  { code: 'K2', name: 'Test Kendra Dharwad B', pin: '580008', lat: 15.47, lng: 75.02 },
  { code: 'K3', name: 'Test Kendra Hubballi', pin: '580020', lat: 15.3647, lng: 75.124 },
  { code: 'K4', name: 'Test Kendra Bengaluru', pin: '560034', lat: 12.9352, lng: 77.6245 },
];
const db = fixtureDb({ ja: JA, kendras: KENDRAS, meta: { ja_loaded_at: 'test', kendras_loaded_at: 'test', ja_list_date: 'test' } });

test('identify: brand names in the ways people type or print them', async () => {
  for (const q of ['Dolo 650', 'DOLO-650', 'dolo 650 tablet', 'Dolo650']) {
    const r = await identifyMedicine(db, { brand: q });
    assert.equal(r.found, true, q);
    assert.equal(r.medicine.name, 'Dolo 650 Tablet', q);
    assert.equal(r.medicine.ckey, 'paracetamol:650mg|tablet');
  }
  assert.equal((await identifyMedicine(db, { brand: 'Pan 40' })).medicine.name, 'PAN 40 Tablet');
  assert.equal((await identifyMedicine(db, { brand: 'Telma 40' })).medicine.ckey, 'telmisartan:40mg|tablet');
  assert.equal((await identifyMedicine(db, { brand: 'Augmentin 625 Duo' })).medicine.ckey, 'amoxicillin:500mg+clavulanic acid:125mg|tablet');
});

test('identify: the number on the strip must match (Dolo 650 is never Dolo 500 or 1000)', () => {
  assert.ok(nameScore('Dolo 650', 'Dolo 500 Tablet') <= 0);
  assert.ok(nameScore('Dolo 650', 'Dolo 1000mg Tablet') <= 0);
});

test('identify: composition read off the strip confirms the brand guess', async () => {
  const r = await identifyMedicine(db, { brand: 'Dolo 650', composition: 'Paracetamol IP 650 mg', form: 'tablet' });
  assert.equal(r.via, 'brand+composition');
  assert.equal(r.composition_agrees, true);
});

test('identify: "salt form eq. to base" compositions (found via AgentFoundry Replay) agree with the brand', async () => {
  assert.equal(cleanComposition('Rosuvastatin Calcium I.P. eq. to Rosuvastatin ..... 10 mg'), 'Rosuvastatin 10 mg');
  const r = await identifyMedicine(db, { brand: 'ROSUVAS 10', composition: 'Rosuvastatin Calcium I.P. eq. to Rosuvastatin ..... 10 mg', form: 'tablet' });
  assert.equal(r.composition_agrees, true);
  const p = await identifyMedicine(db, { brand: 'PAN-40', composition: 'Pantoprazole Sodium I.P. eq. to Pantoprazole ..... 40 mg', form: 'tablet' });
  assert.equal(p.medicine.name, 'PAN 40 Tablet');
  assert.equal(p.composition_agrees, true);
});

test('identify: unknown brand still works from the printed composition', async () => {
  const r = await identifyMedicine(db, { brand: 'Zqxparamol 650', composition: 'Paracetamol (650mg)', form: 'tablet' });
  assert.equal(r.found, true);
  assert.equal(r.via, 'composition');
  assert.equal(r.medicine.ckey, 'paracetamol:650mg|tablet');
});

test('identify: nonsense is not found', async () => {
  assert.equal((await identifyMedicine(db, { brand: 'qwertyuiop' })).found, false);
});

test('same salt: identical key only, cheapest first, one row per brand', async () => {
  const r = await findSameSalt(db, 'paracetamol:650mg|tablet', { limit: 50 });
  assert.ok(r.count >= 20);
  const prices = r.items.map((x) => x.unit_price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  assert.equal(new Set(r.items.map((x) => x.name.toLowerCase())).size, r.items.length);
  assert.ok(!r.items.some((x) => /crocin pain relief/i.test(x.name)), 'paracetamol+caffeine must not appear');
});

test('same salt: multi-salt combo excludes other strength ratios', async () => {
  const r = await findSameSalt(db, 'amoxicillin:500mg+clavulanic acid:125mg|tablet', { limit: 200 });
  assert.ok(r.count > 5);
  assert.ok(!r.items.some((x) => /Augmentin 1000 Duo/i.test(x.name)));
});

test('jan aushadhi: exact key match only', async () => {
  const a = await janAushadhiMatch(db, 'paracetamol:650mg|tablet');
  assert.equal(a.available, true);
  assert.equal(a.product.drug_code, 'TEST-1');
  assert.equal((await janAushadhiMatch(db, 'paracetamol:500mg|tablet')).available, false);
});

test('kendra: by exact PIN, then nearby PINs, then by location', async () => {
  const exact = await nearestKendra(db, { pin: '580001' });
  assert.equal(exact.by, 'pin');
  assert.equal(exact.items[0].code, 'K1');
  const near = await nearestKendra(db, { pin: '580007' });
  assert.equal(near.by, 'nearby-pin');
  assert.equal(near.items[0].code, 'K2');
  const loc = await nearestKendra(db, { lat: 15.36, lng: 75.12 });
  assert.equal(loc.by, 'location');
  assert.equal(loc.items[0].code, 'K3');
  assert.ok(loc.items[0].km < 2);
});

test('saving: per pack, against the cheaper of best brand and Jan Aushadhi', () => {
  const s = computeSaving({ pack: 15, unit_price: 2.2847 }, { cheapest_unit: 0.331 }, { available: true, product: { unit_price: 1.0 } });
  assert.equal(s.best_unit, 0.331);
  assert.equal(s.saving_pack, Math.round((2.2847 - 0.331) * 15 * 100) / 100);
  assert.equal(s.pct, 86);
});

test('OCR text: composition and brand candidates', () => {
  const text = 'DOLO-650\nParacetamol Tablets IP 650 mg\nEach uncoated tablet contains: Paracetamol IP 650 mg\nMicro Labs Limited';
  assert.match(compositionFromText(text), /Paracetamol \(650mg\)/);
  assert.ok(brandCandidatesFromText(text).some((c) => /DOLO 650/i.test(c.replace('-', ' '))));
});

test('answer: same facts, safety line in all three languages; NTI never suggests a switch', () => {
  const f = { brand: 'Dolo 650 Tablet', composition: 'Paracetamol 650 mg', count: 532, cheapBrand: 'Alice 650mg Tablet', cheapUnit: 0.331, yourUnit: 2.2847, jaName: null, jaUnit: null, saving: 29.31, pack: 15, form: 'tablet', nti: false };
  assert.match(composeAnswer('en', f), /check with your doctor or pharmacist/);
  assert.match(composeAnswer('kn', f), /ವೈದ್ಯರು ಅಥವಾ ಫಾರ್ಮಸಿಸ್ಟ್/);
  assert.match(composeAnswer('hi', f), /डॉक्टर या फ़ार्मासिस्ट/);
  for (const lang of ['en', 'kn', 'hi']) assert.match(composeAnswer(lang, f), /532/);
  const nti = composeAnswer('en', { ...f, brand: 'Warf 5 Tablet', composition: 'Warfarin 5 mg', nti: true });
  assert.match(nti, /Do not switch/);
  assert.doesNotMatch(nti, /lowest-priced/);
});

test('agent end-to-end on typed text (no model needed)', async () => {
  const env = { DB: db, AI: null };
  const r = await runAgent(env, { text: 'Dolo 650 580001', lang: 'kn' });
  assert.equal(r.status, 'ok');
  assert.equal(r.medicine.name, 'Dolo 650 Tablet');
  assert.equal(r.pin3, '580');
  assert.equal(r.jan_aushadhi.available, true);
  assert.equal(r.kendras.items[0].code, 'K1');
  assert.ok(r.saving.saving_pack > 0);
  assert.deepEqual(r.trace.map((s) => s.tool), ['identify_medicine', 'find_same_salt', 'jan_aushadhi_match', 'nearest_kendra', 'compose_answer']);
  assert.match(r.answer, /ಫಾರ್ಮಸಿಸ್ಟ್/);
});

test('agent: photo path uses the vision tool, and reports when vision is unavailable', async () => {
  const okEnv = { DB: db, AI: { run: async () => ({ response: '{"brand":"Dolo 650","composition":"Paracetamol (650mg)","form":"tablet","release":"","readable":true}' }) } };
  const r = await runAgent(okEnv, { image: 'data:image/jpeg;base64,AAAA', lang: 'en' });
  assert.equal(r.status, 'ok');
  assert.equal(r.trace[0].tool, 'read_strip');
  assert.equal(r.medicine.name, 'Dolo 650 Tablet');
  const downEnv = { DB: db, AI: { run: async () => { throw new Error('quota exceeded'); } } };
  const d = await runAgent(downEnv, { image: 'data:image/jpeg;base64,AAAA', lang: 'en' });
  assert.equal(d.status, 'vision_unavailable');
});

test('agent: narrow-therapeutic-index medicine shows no cheaper list', async () => {
  const r = await runAgent({ DB: db, AI: null }, { text: 'Warf 5', lang: 'en' });
  assert.equal(r.status, 'ok');
  assert.equal(r.medicine.nti, true);
  assert.equal(r.same_salt.items.length, 0);
  assert.match(r.answer, /Do not switch/);
});

test('identify: typed generic combination without "+" or dosage form still gets the exact key', async () => {
  assert.equal(cleanComposition('Amoxicillin 500mg Clavulanic Acid 125mg'), 'Amoxicillin 500mg + Clavulanic Acid 125mg');
  assert.equal(cleanComposition('Paracetamol 650 mg Tablet'), 'Paracetamol 650 mg Tablet');
  const r = await identifyMedicine(db, { brand: '', composition: 'amoxicillin 500mg + clavulanic acid 125mg', form: '' });
  assert.equal(r.medicine.ckey, 'amoxicillin:500mg+clavulanic acid:125mg|tablet');
  const s = await identifyMedicine(db, { brand: '', composition: 'Amoxicillin 500mg Clavulanic Acid 125mg', form: 'tablet' });
  assert.equal(s.medicine.ckey, 'amoxicillin:500mg+clavulanic acid:125mg|tablet');
});

test('agent: narrow-therapeutic-index medicine gets no Jan Aushadhi "cheaper" suggestion either', async () => {
  const r = await runAgent({ DB: db, AI: null }, { text: 'Warf 5', lang: 'hi', pin: '580020' });
  assert.equal(r.jan_aushadhi.available, false);
  assert.equal(r.jan_aushadhi.nti, true);
  assert.equal(r.saving.saving_pack, null);
  assert.equal(r.kendras.items.length > 0, true);
});

test('answer: a typed generic name is not repeated as if it were a brand', async () => {
  const r = await identifyMedicine(db, { brand: 'Amoxicillin Clavulanic Acid 500 125', composition: 'Amoxicillin 500mg Clavulanic Acid 125mg', form: 'tablet' });
  assert.equal(r.medicine.name, 'Amoxicillin 500 mg + Clavulanic Acid 125 mg');
  const a = composeAnswer('en', { brand: r.medicine.name, composition: r.medicine.name, count: 3, form: 'tablet' });
  assert.doesNotMatch(a, /contains/);
  assert.match(a, /check with your doctor/);
});

// What the phone keyboard's "Scan text" (Gboard / iPhone Live Text) puts into the name box.
const SCANNED_DOLO = `DOLO-650
Paracetamol Tablets I.P. 650 mg
Each uncoated tablet contains:
Paracetamol I.P. 650 mg
Mfg. Lic. No. 123456
Batch No. DOBS3975 Exp. 05/2027
Micro Labs Limited`;

test('agent: keyboard "Scan text" in the name box is read for free, without any model', async () => {
  let modelCalls = 0;
  const env = { DB: db, AI: { run: async () => { modelCalls++; throw new Error('should not be called'); } } };
  const r = await runAgent(env, { text: SCANNED_DOLO, lang: 'en' });
  assert.equal(r.status, 'ok');
  assert.equal(r.source, 'text-scan');
  assert.equal(r.medicine.name, 'Dolo 650 Tablet');
  assert.equal(r.medicine.ckey, 'paracetamol:650mg|tablet');
  assert.equal(modelCalls, 0);
  assert.equal(r.trace[0].tool, 'parse_ocr_text');
  assert.ok(!r.trace.some((s) => s.tool === 'understand_text'));
  assert.equal(r.pin3, null); // the 6-digit licence number is not a PIN code
});

test('agent: short typed names and phrases are not treated as scanned text', async () => {
  const { looksScanned } = await import('../worker/src/agent.js');
  assert.equal(looksScanned('Dolo 650'), false);
  assert.equal(looksScanned('dolo 650 ka sasta option batao'), false);
  assert.equal(looksScanned('ಡೋಲೋ 650 ಮಾತ್ರೆ ಬೆಲೆ ಎಷ್ಟು ಇದೆ ಹೇಳಿ ದಯವಿಟ್ಟು'), false);
  assert.equal(looksScanned(SCANNED_DOLO), true);
  assert.equal(looksScanned('Paracetamol Tablets IP 650 mg each uncoated tablet contains'), true);
});

test('OCR text: "I.P." with dots, and a salt printed twice, give one clean composition', () => {
  assert.equal(compositionFromText(SCANNED_DOLO), 'Paracetamol (650mg)');
  assert.equal(compositionFromText('Amoxycillin I.P. 500 mg\nPotassium Clavulanate B.P. 125 mg'), 'Amoxycillin (500mg) + Potassium Clavulanate (125mg)');
});

test('answer: says why there is no cheaper option, in all three languages', () => {
  const base = { brand: 'Brivaracetam 50 mg', composition: 'Brivaracetam 50 mg', count: 0, cheapBrand: null, cheapUnit: null, yourUnit: null, jaName: null, jaUnit: null, saving: null, pack: 10, form: 'tablet', nti: false };
  assert.equal(noOption({ ...base, brandsLoaded: false }), 'notLoaded');
  assert.equal(noOption({ ...base, brandsLoaded: true }), 'none');
  assert.equal(noOption({ ...base, brandsLoaded: true, count: 12 }), 'cheapest');
  assert.equal(noOption({ ...base, brandsLoaded: true, cheapBrand: 'X' }), null);
  assert.equal(noOption({ ...base, brandsLoaded: true, jaUnit: 1 }), null);
  assert.equal(noOption({ ...base, nti: true }), null);
  assert.match(composeAnswer('en', { ...base, brandsLoaded: false }), /not loaded yet.*check with your doctor or pharmacist/);
  assert.match(composeAnswer('en', { ...base, brandsLoaded: true }), /No other brand with exactly the same salt/);
  for (const lang of ['kn', 'hi']) {
    const a = composeAnswer(lang, { ...base, brandsLoaded: true });
    assert.ok(a.length > 40 && !/undefined|null/.test(a), lang);
  }
});

test('agent: reports whether brand prices are loaded', async () => {
  const r = await runAgent({ DB: db, AI: null }, { text: 'Dolo 650', lang: 'en' });
  assert.equal(r.data.brands_loaded, true);
});

test('safety: anti-epileptic medicines never get a cheaper suggestion, even if the brand data predates the list', async () => {
  const { ntiFromKey, isNti } = await import('../worker/src/normalize.js');
  for (const k of ['brivaracetam:50mg|tablet', 'levetiracetam:500mg|tablet', 'lamotrigine:100mg|tablet', 'clonazepam:0.5mg+escitalopram:10mg|tablet', 'phenobarbital:30mg|tablet', 'phenobarbitone:30mg|tablet', 'pregabalin:75mg|capsule']) {
    assert.equal(ntiFromKey(k), true, k);
  }
  assert.equal(ntiFromKey('paracetamol:650mg|tablet'), false);
  assert.equal(isNti([['brivaracetam', '50mg']]), true);
  // A scanned strip with only its composition (brand unknown to the database).
  const r = await runAgent({ DB: db, AI: null }, { text: 'Brivapride 50\nBrivaracetam Tablets 50 mg\nEach film coated tablet contains Brivaracetam 50 mg', lang: 'en' });
  assert.equal(r.status, 'ok');
  assert.equal(r.medicine.nti, true);
  assert.equal(r.jan_aushadhi.available, false);
  assert.equal(r.same_salt.items.length, 0);
  assert.equal(r.saving.saving_pack, null);
});

test('identify: a typed generic without its form still finds the Jan Aushadhi key when no brand uses it', async () => {
  const jaOnly = fixtureDb({ ja: [{ drug_code: 'T9', generic_name: 'Zzzolamide Tablets IP 5 mg', unit_size: "10's", mrp: 10, ckey: 'zzzolamide:5mg|tablet', units: 10, unit_price: 1 }], meta: { ja_loaded_at: 'test' } });
  const r = await identifyMedicine(jaOnly, { brand: 'zzzolamide 5', composition: 'Zzzolamide 5mg', form: '' });
  assert.equal(r.found, true);
  assert.equal(r.medicine.ckey, 'zzzolamide:5mg|tablet');
  assert.equal((await janAushadhiMatch(jaOnly, r.medicine.ckey)).available, true);
});
