// v1.1 Kendra registry: what a pharmacist can register, what an admin must do before a number
// is shown, and who may see it. Kendra rows are TEST FIXTURES (made-up addresses).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { kendraCode, mobile10, showMobile, validateKendraRegistration, kendraContactsVisible } from '../public/rules.js';
import { lookupKendra, registerKendra, attachContacts, adminListKendras, adminDecideKendra } from '../worker/src/kendra.js';
import { STRINGS } from '../public/strings.js';

const KENDRAS = [
  { code: 'PMBJK00964', name: 'x', address: 'Test Road 1', district: 'Dharwad', state: 'Karnataka', pin: '580001' },
  { code: 'PMBJK00965', name: 'x', address: 'Test Road 2', district: 'Dharwad', state: 'Karnataka', pin: '580001' },
  { code: 'PMBJK01000', name: 'x', address: 'Test Road 3', district: 'Pune', state: 'Maharashtra', pin: '411001' },
];
const freshDb = () => fixtureDb({ kendras: KENDRAS });
const ALL = { called: true, details: true, terms: true };
const form = (over = {}) => ({ code: 'PMBJK00964', whatsapp: '98765 43210', contact_name: 'Test Pharmacist', role: 'pharmacist', hours: '9 am to 9 pm', consent: true, ...over });

test('kendra code: only the official PMBJK + 5 digits form', () => {
  assert.equal(kendraCode(' pmbjk00964 '), 'PMBJK00964');
  assert.equal(kendraCode('PMBJK 00964'), 'PMBJK00964');
  for (const bad of ['PMBJK0964', 'PMBJ00964', '00964', '', null, 'PMBJK00964X']) assert.equal(kendraCode(bad), null, String(bad));
});

test('mobile numbers: the ways people write them; landlines and short numbers refused', () => {
  for (const ok of ['9876543210', '+91 98765 43210', '098765-43210', '919876543210', '(+91) 98765-43210']) assert.equal(mobile10(ok), '9876543210', ok);
  // (An 11-digit landline like 0836 2234567 can look like a mobile number; the admin's call catches it.)
  for (const bad of ['0836 223456', '2234567', '12345', '5876543210', '98765432101', '', null]) assert.equal(mobile10(bad), null, String(bad));
  assert.equal(showMobile('9876543210'), '98765 43210');
});

test('registration form: every field checked, terms must be accepted', () => {
  assert.equal(validateKendraRegistration(form()).ok, true);
  const err = (over) => validateKendraRegistration(form(over)).error;
  assert.equal(err({ code: 'X1' }), 'krErrCode');
  assert.equal(err({ whatsapp: '0836 223456' }), 'krErrWhatsapp');
  assert.equal(err({ sms: '123' }), 'krErrSms');
  assert.equal(err({ contact_name: ' ' }), 'krErrName');
  assert.equal(err({ role: 'doctor' }), 'krErrRole');
  assert.equal(err({ consent: false }), 'krErrConsent');
  assert.equal(err({ consent: 'yes' }), 'krErrConsent'); // only a real tick counts
  // The same number twice is stored once; markup is stripped from free text.
  const v = validateKendraRegistration(form({ sms: '+91 98765 43210', hours: '<b>9-9</b>' })).value;
  assert.equal(v.sms, null);
  assert.equal(/[<>]/.test(v.hours), false);
  // Every error the form can show has text in every language.
  for (const key of ['krErrCode', 'krErrWhatsapp', 'krErrSms', 'krErrName', 'krErrRole', 'krErrConsent', 'krErrNotFound', 'krErrTaken', 'krErrNetwork']) {
    for (const l of Object.keys(STRINGS)) assert.ok(STRINGS[l][key], `${l}.${key}`);
  }
});

test('who sees a number: pilot = test traffic only until PMBJP agrees; off = nobody', () => {
  assert.equal(kendraContactsVisible('pilot', true), true);
  assert.equal(kendraContactsVisible('pilot', false), false);
  assert.equal(kendraContactsVisible('public', false), true);
  assert.equal(kendraContactsVisible('off', true), false);
  assert.equal(kendraContactsVisible(undefined, true), false);
});

test('register: code must be in the official list; saved as pending with a reference', async () => {
  const db = freshDb();
  assert.equal((await registerKendra(db, form({ code: 'PMBJK99999' }))).status, 404);
  assert.equal((await registerKendra(db, form({ consent: false }))).status, 400);
  const r = await registerKendra(db, form());
  assert.equal(r.status, 200);
  assert.match(r.body.ref, /^KR-[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(r.body.registry, 'pending');
  const k = await lookupKendra(db, 'PMBJK00964', { showContact: true });
  assert.equal(k.registry, 'pending');
  assert.equal(k.contact, null, 'a pending number is never shown, even to test traffic');
});

test('a pending number never reaches patients; approving needs a note on how it was checked', async () => {
  const db = freshDb();
  await registerKendra(db, form());
  const items = [{ code: 'PMBJK00964' }, { code: 'PMBJK00965' }];
  await attachContacts(db, items);
  assert.equal(items[0].registered, undefined);
  assert.equal((await adminDecideKendra(db, { code: 'PMBJK00964', action: 'approve', note: '' })).status, 400);
  const ok = await adminDecideKendra(db, { code: 'PMBJK00964', action: 'approve', checks: ALL, note: 'Called, confirmed code and address' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, 'approved');
  await attachContacts(db, items);
  assert.equal(items[0].registered, true);
  assert.deepEqual(items[0].contact, { whatsapp: '9876543210', sms: null, hours: '9 am to 9 pm' });
  assert.equal(items[1].registered, undefined, 'only the approved Kendra is marked');
  // The lookup shows the number only when allowed.
  assert.equal((await lookupKendra(db, 'PMBJK00964', { showContact: false })).contact, null);
  assert.equal((await lookupKendra(db, 'PMBJK00964', { showContact: true })).contact.whatsapp, '9876543210');
});

test('an approved number cannot be replaced from the public form; withdrawing hides it', async () => {
  const db = freshDb();
  await registerKendra(db, form());
  await adminDecideKendra(db, { code: 'PMBJK00964', action: 'approve', checks: ALL, note: 'Called, confirmed' });
  const again = await registerKendra(db, form({ whatsapp: '9123456789' }));
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'krErrTaken');
  assert.equal((await lookupKendra(db, 'PMBJK00964', { showContact: true })).contact.whatsapp, '9876543210');
  await adminDecideKendra(db, { code: 'PMBJK00964', action: 'withdraw', note: 'Kendra asked' });
  const items = [{ code: 'PMBJK00964' }];
  await attachContacts(db, items);
  assert.equal(items[0].registered, undefined);
  // After withdrawal (or rejection) the Kendra can register again, as pending.
  assert.equal((await registerKendra(db, form({ whatsapp: '9123456789' }))).body.registry, 'pending');
});

test('re-registering while pending replaces the earlier details; admin list and counts', async () => {
  const db = freshDb();
  await registerKendra(db, form());
  await registerKendra(db, form({ whatsapp: '9123456789' }));
  await registerKendra(db, form({ code: 'PMBJK01000' }));
  const pend = await adminListKendras(db, 'pending');
  assert.equal(pend.counts.pending, 2);
  assert.equal(pend.items.find((x) => x.code === 'PMBJK00964').whatsapp, '9123456789');
  assert.equal(pend.items[0].address !== undefined, true, 'the list carries the official address to check against');
  await adminDecideKendra(db, { code: 'PMBJK01000', action: 'reject', note: 'Number not answering' });
  const all = await adminListKendras(db, 'all');
  assert.equal(all.items.length, 2);
  assert.deepEqual(all.counts, { pending: 1, approved: 0, rejected: 1, withdrawn: 0 });
  assert.equal((await adminDecideKendra(db, { code: 'PMBJK00964', action: 'delete' })).status, 400);
  assert.equal((await adminDecideKendra(db, { code: 'PMBJK00999', action: 'reject', note: 'No such registration' })).status, 404);
});

test('Worker routes: QR link, lookup, register, and numbers hidden from patients in pilot mode', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const db = freshDb();
  const env = { DB: db, KENDRA_REGISTRY: 'pilot' };
  const host = 'https://samasalt.example';
  const call = (path, init = {}) => worker.fetch(new Request(host + path, init), env, { waitUntil() {} });

  const qr = await call('/k/pmbjk00964');
  assert.equal(qr.status, 302);
  assert.equal(qr.headers.get('location'), `${host}/?k=PMBJK00964`);

  // Self-registration is closed: Kendras register by email; staff enter it.
  const reg = await call('/api/kendra/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form()) });
  assert.equal(reg.status, 410);
  assert.equal((await reg.json()).error, 'krRegisterByEmail');
  assert.equal((await lookupKendra(db, 'PMBJK00964')).registry, 'none', 'nothing was saved');
  await registerKendra(db, form());
  await adminDecideKendra(db, { code: 'PMBJK00964', action: 'approve', checks: ALL, note: 'Called, confirmed' });

  const patient = await (await call('/api/kendra/PMBJK00964')).json();
  assert.equal(patient.registry, 'approved');
  assert.equal(patient.contact, null, 'pilot mode: a normal patient does not see the number yet');
  const tester = await (await call('/api/kendra/PMBJK00964', { headers: { 'x-samasalt-mitra-test': '1' } })).json();
  assert.equal(tester.contact.whatsapp, '9876543210');
  assert.equal((await call('/api/kendra/NOTACODE')).status, 400);
  assert.equal((await call('/api/kendra/PMBJK99999')).status, 404);
  assert.equal((await call('/api/admin/kendra/list')).status, 401, 'admin API needs sign-in');
});

test('registration email: standard subject and body, filled with the Kendra code and official address', async () => {
  const { registrationEmail } = await import('../public/rules.js');
  const e = registrationEmail({ code: 'pmbjk00964', address: 'Test Road 1', district: 'Dharwad', state: 'Karnataka', pin: '580001' });
  assert.equal(e.subject, 'Kendra registration request - PMBJK00964');
  assert.match(e.body, /Kendra code: PMBJK00964/);
  assert.match(e.body, /Test Road 1, Dharwad, Karnataka, 580001/);
  for (const doc of ['allotment or agreement letter', 'retail drug licence', 'State Pharmacy Council', 'Signed consent']) assert.match(e.body, new RegExp(doc), doc);
  assert.match(e.body, /no online sale, online payment or home delivery/);
  assert.match(e.body, /valid prescription/);
  const blank = registrationEmail();
  assert.match(blank.subject, /PMBJK_____/, 'blank template when no Kendra is chosen');
});

test('admin list: search by Kendra code (full, partial, any case), in code order', async () => {
  const { kendraSearch } = await import('../worker/src/kendra.js');
  assert.equal(kendraSearch('pmbjk 00964'), 'PMBJK00964');
  assert.equal(kendraSearch('0096'), '0096');
  assert.equal(kendraSearch('abc'), '', 'not a Kendra code: no search');
  const db = freshDb();
  for (const code of ['PMBJK01000', 'PMBJK00964', 'PMBJK00965']) await registerKendra(db, form({ code }));
  assert.deepEqual((await adminListKendras(db, 'all')).items.map((x) => x.code), ['PMBJK00964', 'PMBJK00965', 'PMBJK01000']);
  assert.deepEqual((await adminListKendras(db, 'all', '0096')).items.map((x) => x.code), ['PMBJK00964', 'PMBJK00965']);
  assert.deepEqual((await adminListKendras(db, 'pending', 'pmbjk01000')).items.map((x) => x.code), ['PMBJK01000']);
  assert.deepEqual((await adminListKendras(db, 'approved', '00964')).items, []);
  assert.equal((await adminListKendras(db, 'all', "0%' OR 1=1 --")).items.length, 3, 'odd input is ignored, never run as SQL');
});

test('registration email: the online form fills in the details (nothing is saved from the public page)', async () => {
  const { registrationEmail } = await import('../public/rules.js');
  const e = registrationEmail({ code: 'PMBJK00964', address: 'Test Road 1', district: 'Dharwad', state: 'Karnataka', pin: '580001' },
    { whatsapp: '+91 98765 43210', sms: '', hours: '9 am to 9 pm', contact_name: 'R Kumar', role: 'owner', pharmacist_name: 'S Rao', pharmacist_reg: 'KSPC 1234', date: '17 Nov 2026' });
  assert.match(e.body, /WhatsApp number: 98765 43210/);
  assert.match(e.body, /SMS and calls \(if different\): same as WhatsApp/);
  assert.match(e.body, /Opening hours: 9 am to 9 pm/);
  assert.match(e.body, /name S Rao, Pharmacy Council registration no\. KSPC 1234/);
  assert.match(e.body, /name R Kumar, role owner/);
  assert.match(e.body, /Name of the Kendra owner: R Kumar/);
  assert.match(e.body, /Date: 17 Nov 2026/);
  assert.match(e.body, /Signature \/ seal: __________/, 'the signature stays for the owner');
  const odd = registrationEmail({ code: 'PMBJK00964' }, { contact_name: '<script>x</script>', role: 'pharmacist' });
  assert.equal(/[<>]/.test(odd.body), false, 'markup is stripped');
  assert.match(odd.body, /Name of the Kendra owner: __________/);
});
