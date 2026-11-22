// v1.2 order requests: what can be ordered, packs, the message, the links, and who sees the button.
// Kendra rows are TEST FIXTURES (made-up addresses).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderItems, orderQty, orderMessage, waLink, smsLink, pharmacistEntry, ORDER_MAX_PACKS } from '../public/rules.js';
import { STRINGS, t, rupees } from '../public/strings.js';
import { fixtureDb } from './d1shim.mjs';
import { registerKendra, adminDecideKendra } from '../worker/src/kendra.js';

const para = { ckey: 'k1', name: 'Dolo 650', nti: false, ja: { name: 'Paracetamol Tablets IP 650 mg', code: '1234', unit_size: "10's", mrp: 15.5 }, qty: 2 };
const thyro = { ckey: 'k2', name: 'Thyronorm 50', nti: true, ja: null };
const rare = { ckey: 'k3', name: 'Rarebrand 5', nti: false, ja: null };

test('packs: whole numbers from 1 to the maximum; anything else is 1', () => {
  assert.equal(orderQty(3), 3);
  assert.equal(orderQty('4'), 4);
  assert.equal(orderQty(0), 1);
  assert.equal(orderQty(-2), 1);
  assert.equal(orderQty(2.7), 2);
  assert.equal(orderQty(undefined), 1);
  assert.equal(orderQty('x'), 1);
  assert.equal(orderQty(99), ORDER_MAX_PACKS);
});

test('order list: only Jan Aushadhi generics; never-switch (NTI) and no-equivalent medicines are left out with the reason', () => {
  const o = orderItems([para, thyro, rare]);
  assert.deepEqual(o.items.map((i) => [i.name, i.qty, i.line]), [['Paracetamol Tablets IP 650 mg', 2, 31]]);
  assert.deepEqual(o.excluded.map((x) => [x.name, x.reason]), [['Thyronorm 50', 'nti'], ['Rarebrand 5', 'noja']]);
  assert.equal(o.total, 31);
  // An NTI entry is never ordered, even if it somehow carries a generic.
  assert.equal(orderItems([{ ...thyro, ja: para.ja }]).items.length, 0);
  // A total only when every item has an MRP.
  assert.equal(orderItems([para, { ...para, ckey: 'k4', ja: { ...para.ja, mrp: null } }]).total, null);
  assert.deepEqual(orderItems(null), { items: [], excluded: [], total: null });
});

test('the medicine list entry carries the generic\'s pack size and MRP from the PMBI list; for NTI the code only (no MRP, never ordered)', () => {
  const r = { medicine: { ckey: 'k1', name: 'Dolo 650', composition: 'Paracetamol 650 mg', form: 'tablet', nti: false },
    jan_aushadhi: { available: true, product: { generic_name: 'Paracetamol Tablets IP 650 mg', drug_code: '1234', unit_size: "10's", mrp: 15.5 } } };
  assert.deepEqual(pharmacistEntry(r).ja, { name: 'Paracetamol Tablets IP 650 mg', code: '1234', unit_size: "10's", mrp: 15.5 });
  const nti = pharmacistEntry({ ...r, medicine: { ...r.medicine, nti: true } });
  assert.deepEqual(nti.ja, { name: 'Paracetamol Tablets IP 650 mg', code: '1234', unit_size: "10's", mrp: null });
  assert.equal(orderItems([nti]).items.length, 0);
});

test('message: list in packs, total, pickup with prescription; in the patient\'s language plus English', () => {
  const order = orderItems([para, thyro]);
  const en = orderMessage({ code: 'pmbjk00964' }, order, (k, v) => t('en', k, v), null, rupees);
  assert.match(en, /^Order request for pickup \(SamaSalt-Mitra\)/);
  assert.match(en, /Kendra: PMBJK00964/);
  assert.match(en, /1\. Paracetamol Tablets IP 650 mg \(PMBJP 1234\) - 10's - packs: 2/);
  assert.match(en, /Estimated total at MRP: ₹31/);
  assert.match(en, /bring my prescription/);
  assert.doesNotMatch(en, /Thyronorm/, 'never-switch medicines are not in the message');
  assert.doesNotMatch(en, /tablet(s)? (a|per) day|dose|twice/i, 'no dosage wording');
  const kn = orderMessage({ code: 'PMBJK00964' }, order, (k, v) => t('kn', k, v), (k, v) => t('en', k, v), rupees);
  assert.ok(kn.startsWith(STRINGS.kn.msgHead));
  assert.match(kn, /---\nOrder request for pickup/);
  assert.equal(kn.match(/Paracetamol/g).length, 1, 'the list is not repeated in English');
  // Odd text in names cannot break the message.
  const odd = orderMessage({ code: 'PMBJK00964' }, orderItems([{ ...para, ja: { ...para.ja, name: 'A<b>\nB' } }]), (k, v) => t('en', k, v));
  assert.match(odd, /1\. A b B/);
});

test('links: WhatsApp and SMS to the Kendra\'s 10-digit number, message encoded; bad numbers give no link', () => {
  assert.equal(waLink('98765 43210', 'Hi & bye'), 'https://wa.me/919876543210?text=Hi%20%26%20bye');
  assert.equal(smsLink('+91 98765 43210', 'Hi'), 'sms:+919876543210?body=Hi');
  assert.equal(waLink('12345', 'x'), null);
  assert.equal(smsLink(null, 'x'), null);
});

test('every order text exists in every language', () => {
  for (const key of ['orderBtn', 'orderTitle', 'orderAt', 'orderPacks', 'orderEach', 'orderTotal', 'orderPickup', 'orderNti', 'orderNoJa', 'orderNone', 'orderWhatsapp', 'orderSms', 'orderHint', 'orderFromList', 'msgHead', 'msgKendra', 'msgPacks', 'msgTotal', 'msgPickup', 'msgReply']) {
    for (const l of Object.keys(STRINGS)) assert.ok(STRINGS[l][key], `${l}.${key}`);
  }
});

test('Worker: "Order for pickup" only for approved Kendras, and only where ORDER_REQUESTS allows (pilot: test traffic)', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb({ kendras: [{ code: 'PMBJK00964', name: 'x', address: 'Test Road 1', district: 'Dharwad', state: 'Karnataka', pin: '580001' }] });
  await registerKendra(db, { code: 'PMBJK00964', whatsapp: '9876543210', contact_name: 'Test Pharmacist', role: 'pharmacist', consent: true });
  await adminDecideKendra(db, { code: 'PMBJK00964', action: 'approve', checks: { called: true, details: true, terms: true }, note: 'Called, ok' });
  const call = async (env, path, test) => (await worker.fetch(new Request(`https://samasalt.example${path}`, { headers: test ? { 'x-samasalt-mitra-test': '1' } : {} }), { DB: db, ...env }, { waitUntil() {} })).json();
  const pilot = { KENDRA_REGISTRY: 'public', ORDER_REQUESTS: 'pilot' };
  assert.equal((await call(pilot, '/api/kendra/PMBJK00964')).contact.orders, false, 'pilot: a patient sees the number but no order button');
  assert.equal((await call(pilot, '/api/kendra/PMBJK00964', true)).contact.orders, true);
  assert.equal((await call({ KENDRA_REGISTRY: 'public', ORDER_REQUESTS: 'public' }, '/api/kendras?pin=580001')).items[0].contact.orders, true);
  assert.equal((await call({ KENDRA_REGISTRY: 'public' }, '/api/kendra/PMBJK00964', true)).contact.orders, false, 'not set: off');
  assert.equal((await call({ KENDRA_REGISTRY: 'pilot', ORDER_REQUESTS: 'public' }, '/api/kendra/PMBJK00964')).contact, null, 'no number shown: no order either');
  assert.equal((await call(pilot, '/api/health')).order_requests, 'pilot');
});
