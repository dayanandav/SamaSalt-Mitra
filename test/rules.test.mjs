// What the web app shows, on the critical safety paths: the pharmacist list, the "lower-priced
// option" question, Listen, and the warning texts. Real agent runs over the test fixtures, then
// the same rules the page uses (public/rules.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { runAgent } from '../worker/src/agent.js';
import { STRINGS, composeAnswer } from '../public/strings.js';
import { pharmacistEntry, mergeMedList, asksToSwitch, canShowPharmacist, shouldAddToList, listenAllowed, pickVoice } from '../public/rules.js';

// TEST FIXTURES ONLY (made-up codes and prices).
const JA = [
  { drug_code: 'TEST-1', generic_name: 'Paracetamol Tablets IP 650 mg', unit_size: '10 tablets', mrp: 10, ckey: 'paracetamol:650mg|tablet', units: 10, unit_price: 1.0 },
  { drug_code: 'TEST-NTI', generic_name: 'Warfarin Tablets IP 5 mg', unit_size: '10 tablets', mrp: 20, ckey: 'warfarin:5mg|tablet', units: 10, unit_price: 2.0 },
  { drug_code: 'TEST-AED', generic_name: 'Brivaracetam Tablets IP 50mg', unit_size: "10's", mrp: 79.69, ckey: 'brivaracetam:50mg|tablet', units: 10, unit_price: 7.969 },
];
const db = fixtureDb({ ja: JA, meta: { ja_loaded_at: 'test', ja_list_date: 'test' } });
const ask = (text, lang = 'en') => runAgent({ DB: db, AI: null }, { text, lang });
const scan = (text) => runAgent({ DB: db, AI: null }, { text, lang: 'en' }); // keyboard "Scan text": needs confirmation

test('critical: a never-switch medicine never gets a Jan Aushadhi code on the pharmacist list', async () => {
  const r = await ask('Warf 5');
  assert.equal(r.status, 'ok');
  assert.equal(r.medicine.nti, true);
  const e = pharmacistEntry(r);
  assert.equal(e.nti, true);
  assert.equal(e.ja, null);
});

test('critical: anti-epileptic read from a scan (Jan Aushadhi product exists) gets no code either', async () => {
  const r = await scan('Brivapride 50\nBrivaracetam Tablets 50 mg\nEach film coated tablet contains Brivaracetam 50 mg');
  assert.equal(r.status, 'ok');
  assert.equal(r.jan_aushadhi.available, true); // shown as information on the result
  r.confirmed = true;
  const e = pharmacistEntry(r);
  assert.equal(e.nti, true);
  assert.equal(e.ja, null);
});

test('critical: never-switch flag on the Jan Aushadhi result alone is enough to drop the code', () => {
  const r = { status: 'ok', medicine: { name: 'X', ckey: 'x:1mg|tablet', composition: 'X 1 mg · tablet', nti: false }, jan_aushadhi: { available: true, nti: true, product: { generic_name: 'X', drug_code: '9' } } };
  assert.equal(pharmacistEntry(r).ja, null);
  assert.equal(asksToSwitch(r), false);
});

test('pharmacist list: a normal medicine carries its Jan Aushadhi name and code', async () => {
  const r = await ask('Dolo 650');
  const e = pharmacistEntry(r);
  assert.equal(e.nti, false);
  assert.deepEqual(e.ja, { name: 'Paracetamol Tablets IP 650 mg', code: 'TEST-1' });
  assert.equal(e.composition, 'Paracetamol 650 mg');
});

test('pharmacist list: newest first, one entry per composition, capped', () => {
  const a = { ckey: 'a' }, b = { ckey: 'b' }, a2 = { ckey: 'a', name: 'other brand' };
  assert.deepEqual(mergeMedList([], a), [a]);
  assert.deepEqual(mergeMedList([a], b), [b, a]);
  assert.deepEqual(mergeMedList([b, a], a2), [a2, b]);
  const many = Array.from({ length: 20 }, (_, i) => ({ ckey: String(i) }));
  assert.equal(mergeMedList(many, { ckey: 'new' }, 15).length, 15);
  assert.deepEqual(mergeMedList('corrupt', a), [a]); // bad stored data never breaks the page
});

test('critical: nothing reaches the pharmacist before a photo/scan read is confirmed, nor when not found', async () => {
  const r = await scan('Dolo 650\nParacetamol Tablets IP 650 mg\nEach uncoated tablet contains Paracetamol IP 650 mg');
  assert.equal(r.status, 'ok');
  assert.equal(r.needs_confirmation, true);
  assert.equal(canShowPharmacist(r), false);
  assert.equal(asksToSwitch(r), false);
  r.confirmed = true;
  assert.equal(canShowPharmacist(r), true);
  const nf = await ask('Zzqx 999');
  assert.equal(nf.status, 'not_found');
  assert.equal(canShowPharmacist(nf), false);
  assert.equal(asksToSwitch(nf), false);
  assert.equal(canShowPharmacist({ status: 'unreadable', reason: 'low_confidence' }), false);
});

test('critical: "lower-priced option" question — always when an option is listed, never for never-switch', async () => {
  const dolo = await ask('Dolo 650');
  assert.ok(dolo.jan_aushadhi.available || dolo.same_salt.items.length > 1);
  assert.equal(asksToSwitch(dolo), true);
  assert.equal(asksToSwitch(await ask('Warf 5')), false);
  // Only a Jan Aushadhi generic listed (no other brand, no saving): still asked.
  const jaOnly = { status: 'ok', medicine: { name: 'A', nti: false }, same_salt: { items: [{ name: 'A' }] }, jan_aushadhi: { available: true }, saving: {} };
  assert.equal(asksToSwitch(jaOnly), true);
  // Only another brand listed, even if not cheaper: still asked.
  const brandOnly = { status: 'ok', medicine: { name: 'A', nti: false }, same_salt: { items: [{ name: 'A' }, { name: 'B' }] }, jan_aushadhi: { available: false }, saving: {} };
  assert.equal(asksToSwitch(brandOnly), true);
  // Nothing else listed: not asked.
  const none = { status: 'ok', medicine: { name: 'A', nti: false }, same_salt: { items: [{ name: 'A' }] }, jan_aushadhi: { available: false }, saving: {} };
  assert.equal(asksToSwitch(none), false);
});

test('critical: Listen never reads in the wrong language', () => {
  const voices = [{ lang: 'en-IN' }, { lang: 'hi_IN' }, { lang: 'en-US' }];
  assert.equal(listenAllowed('en', 'en', voices), true);
  assert.equal(listenAllowed('hi', 'hi', voices), true); // Android "hi_IN"
  assert.equal(listenAllowed('kn', 'kn', voices), false); // no Kannada voice: button hidden, not an English voice
  assert.equal(listenAllowed('en', 'kn', voices), false); // answer still English after switching to Kannada
  assert.equal(pickVoice('kn', voices), null);
  assert.equal(pickVoice('hi', voices).lang, 'hi_IN');
});

test('critical: never-switch answer has one caution, no price, no Jan Aushadhi, no switch prompt — in all languages', async () => {
  for (const lang of ['en', 'kn', 'hi']) {
    const r = await ask('Warf 5', lang);
    assert.equal(r.status, 'ok', lang);
    assert.ok(r.answer.includes(STRINGS[lang].nti), `${lang}: caution in the answer`);
    assert.equal(r.answer.split(STRINGS[lang].nti).length, 2, `${lang}: caution exactly once`);
    assert.doesNotMatch(r.answer, /₹|Jan Aushadhi|ಜನ ಔಷಧಿ|जन औषधि/, lang);
    assert.equal(r.same_salt.items.length, 0, lang);
  }
});

test('warning texts: standard disclaimer and caution exist in every language, never name the app', () => {
  for (const lang of Object.keys(STRINGS)) {
    for (const key of ['safety', 'nti', 'phNti', 'phJa', 'switchQ', 'switchYes', 'switchAsk', 'switchNo', 'cropUse', 'cropFull', 'pharmacistBtnN', 'pharmacistCardMany', 'listHint', 'ntiWhyTitle', 'ntiWhy']) {
      assert.equal(typeof STRINGS[lang][key], 'string', `${lang}.${key}`);
      assert.ok(STRINGS[lang][key].length > 0, `${lang}.${key}`);
    }
    assert.doesNotMatch(STRINGS[lang].safety, /SamaSalt/, `${lang}: disclaimer is a standard text`);
    assert.doesNotMatch(STRINGS[lang].nti, /SamaSalt|₹/, `${lang}: caution is a standard text`);
    assert.ok(STRINGS[lang].phJa.includes('{code}'), `${lang}: Jan Aushadhi code placeholder`);
  }
  // The caution itself must not point to any cheaper product.
  assert.doesNotMatch(composeAnswer('en', { brand: 'Warf 5 Tablet', composition: 'Warfarin 5 mg', nti: true, count: 9, cheapBrand: 'Cheap', cheapUnit: 1, yourUnit: 2, jaName: 'JA', jaUnit: 1, saving: 5, pack: 10, form: 'tablet' }), /Cheap|JA|₹/);
});

test('critical: a removed medicine does not come back after a language change', async () => {
  const r = await ask('Dolo 650');
  r.fresh = true; // a new lookup
  assert.equal(shouldAddToList(r), true);
  r.addedToList = true;
  assert.equal(shouldAddToList(r), false, 'the same result re-rendered is not added twice');
  const relang = await ask('Dolo 650', 'kn');
  relang.fresh = false; // the app re-asks with relog:false when only the language changes
  assert.equal(shouldAddToList(relang), false, 'language re-ask never re-adds');
  const scanned = await scan('Dolo 650\nParacetamol Tablets IP 650 mg\nEach uncoated tablet contains Paracetamol IP 650 mg');
  scanned.fresh = true;
  assert.equal(shouldAddToList(scanned), false, 'not before the read is confirmed');
  scanned.confirmed = true;
  assert.equal(shouldAddToList(scanned), true);
});

test('never-switch: the reason is explained in every language, with no price and no brand advice', () => {
  for (const lang of Object.keys(STRINGS)) {
    assert.ok(STRINGS[lang].ntiWhy.length > 80, lang);
    assert.doesNotMatch(STRINGS[lang].ntiWhy, /₹|SamaSalt|Jan Aushadhi|ಜನ ಔಷಧಿ|जन औषधि/, lang);
  }
});

test('phone camera options only on phones and tablets, never on a computer browser', async () => {
  const { isPhoneBrowser } = await import('../public/rules.js');
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0';
  const mac = ipad;
  assert.equal(isPhoneBrowser({ userAgent: android }), true);
  assert.equal(isPhoneBrowser({ userAgent: iphone }), true);
  assert.equal(isPhoneBrowser({ userAgent: ipad, maxTouchPoints: 5 }), true); // iPadOS
  assert.equal(isPhoneBrowser({ userAgent: windows, maxTouchPoints: 0 }), false);
  assert.equal(isPhoneBrowser({ userAgent: windows, userAgentData: { mobile: false } }), false);
  assert.equal(isPhoneBrowser({ userAgent: mac, maxTouchPoints: 0 }), false);
  assert.equal(isPhoneBrowser({ userAgent: 'x', userAgentData: { mobile: true } }), true);
  assert.equal(isPhoneBrowser(undefined), false);
});

test('critical: old medicines never reach the pharmacist list (1-hour limit, untimed entries dropped)', async () => {
  const { freshMedList, LIST_MAX_AGE_MS } = await import('../public/rules.js');
  const now = Date.UTC(2026, 10, 16, 12);
  const list = [
    { ckey: 'new', at: now - 5 * 60_000 },
    { ckey: 'edge', at: now - LIST_MAX_AGE_MS + 1000 },
    { ckey: 'old', at: now - LIST_MAX_AGE_MS - 1 },
    { ckey: 'yesterday', at: now - 24 * 3600_000 },
    { ckey: 'untimed' }, // saved by an earlier version
    { ckey: 'future', at: now + 3600_000 }, // phone clock changed
    null,
  ];
  assert.deepEqual(freshMedList(list, now).map((x) => x.ckey), ['new', 'edge']);
  assert.deepEqual(freshMedList('junk', now), []);
});
