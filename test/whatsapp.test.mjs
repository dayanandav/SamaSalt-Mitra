// v2.0 WhatsApp bot: conversation, safety (NTI, photo confirmation, no dose advice), privacy
// (no phone number stored, 24-hour memory, DELETE), webhook signature, Cloud API payloads.
// Kendra rows and numbers are TEST FIXTURES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { handleMessage, parseInbound, signatureOk, chatKey, graphPayload, handleWebhook } from '../worker/src/whatsapp.js';
import { registerKendra, adminDecideKendra } from '../worker/src/kendra.js';
import { STRINGS } from '../public/strings.js';

const JA = [{ drug_code: 'TEST-1', generic_name: 'Paracetamol Tablets IP 650 mg', unit_size: '10 tablets', mrp: 10, ckey: 'paracetamol:650mg|tablet', units: 10, unit_price: 1.0 }];
const KENDRAS = [{ code: 'PMBJK00964', name: 'x', address: 'Test Road 1', district: 'Dharwad', state: 'Karnataka', pin: '580001' }];
const meta = { ja_loaded_at: 'test', kendras_loaded_at: 'test', ja_list_date: 'test' };
const vision = (brand, composition) => ({ run: async () => ({ response: JSON.stringify({ brand, composition, form: 'tablet', release: '', readable: true }) }) });
const FROM = '919876500001';

function setup(extra = {}) {
  const db = fixtureDb({ ja: JA, kendras: KENDRAS, meta });
  const logged = [];
  const env = { DB: db, AI: null, WA_HASH_KEY: 'test-hash-key', ...extra };
  const say = (msg, deps = {}) => handleMessage(env, { from: FROM, id: `m${Math.random()}`, ...msg }, { log: async (b, r) => logged.push([b, r.status]), ...deps });
  return { db, env, say, logged };
}
const bodyOf = (replies) => replies.map((r) => r.body).join('\n---\n');

test('hello: welcome and language buttons; a language choice is remembered', async () => {
  const { say } = setup();
  const r = await say({ kind: 'text', text: 'Hi' });
  assert.match(r[0].body, /SamaSalt-Mitra/);
  assert.match(r[0].body, /never give dose advice/);
  assert.deepEqual(r[1].buttons.map((b) => b.id), ['lang:en', 'lang:kn', 'lang:hi']);
  assert.match((await say({ kind: 'button', button: 'lang:kn' }))[0].body, /ಕನ್ನಡ/);
  assert.match((await say({ kind: 'text', text: 'Dolo 650' }))[0].body, /ಫಾರ್ಮಸಿಸ್ಟ್/, 'answers now in Kannada');
  assert.match((await say({ kind: 'text', text: 'hindi' }))[0].body, /हिन्दी/);
});

test('typed name: templated answer with the Jan Aushadhi generic and MRP, cheaper brands, then PIN → nearest Kendra', async () => {
  const { say, logged } = setup();
  const a = bodyOf(await say({ kind: 'text', text: 'Dolo 650' }));
  assert.match(a, /\*Dolo 650 Tablet\*/);
  assert.match(a, /Jan Aushadhi generic medicine:\* Paracetamol Tablets IP 650 mg \(PMBJP TEST-1\) · 10 tablets · MRP ₹10/);
  assert.match(a, /Please check with your doctor or pharmacist before switching/);
  assert.match(a, /Send your 6-digit PIN code/);
  assert.doesNotMatch(a, /\b(dose of|twice a day|once a day|take \d)/i);
  assert.deepEqual(logged.map(([b, s]) => [b.mode, b.text, s]), [['whatsapp', 'Dolo 650', 'ok']]);
  assert.equal(logged[0][0].from, undefined, 'the impact log never gets the number');
  const p = bodyOf(await say({ kind: 'text', text: '580 001' }));
  assert.match(p, /PIN 580001 saved/);
  assert.match(p, /PMBJK00964: Test Road 1, Dharwad \(580001\)/);
  const b = bodyOf(await say({ kind: 'text', text: 'Dolo 650' }));
  assert.match(b, /Nearest Jan Aushadhi Kendras\* \(PIN 580001\)/);
});

test('safety: a never-switch (NTI) medicine gets the warning only: no brands, no generic, no order link', async () => {
  const { say, db, env } = setup({ KENDRA_REGISTRY: 'public', ORDER_REQUESTS: 'public' });
  await registerKendra(db, { code: 'PMBJK00964', whatsapp: '9876543210', contact_name: 'Test Pharmacist', role: 'pharmacist', consent: true });
  await adminDecideKendra(db, { code: 'PMBJK00964', action: 'approve', checks: { called: true, details: true, terms: true }, note: 'Called, ok' });
  await say({ kind: 'text', text: '580001' });
  const n = bodyOf(await say({ kind: 'text', text: 'Thyronorm 50' }));
  assert.match(n, /Do not change its brand/);
  assert.doesNotMatch(n, /Jan Aushadhi generic|lower price|Order 1 pack/);
  // A switchable medicine at a registered Kendra with orders on: the order link, to the Kendra.
  const d = bodyOf(await say({ kind: 'text', text: 'Dolo 650' }));
  assert.match(d, /Registered Kendra · WhatsApp 98765 43210/);
  assert.match(d, /Order 1 pack for pickup .*https:\/\/wa\.me\/919876543210\?text=/);
  assert.ok(env.ORDER_REQUESTS);
});

test('photo: never acted on before the patient confirms; Yes → full answer, No → please type', async () => {
  const { say } = setup({ AI: vision('Dolo 650', 'Paracetamol (650mg)') });
  const img = { image: async () => 'data:image/jpeg;base64,AAAA' };
  const c = await say({ kind: 'image', mediaId: 'x' }, img);
  assert.equal(c.length, 1);
  assert.match(c[0].body, /I read this from your photo:\n\*Dolo 650 Tablet/);
  assert.doesNotMatch(c[0].body, /₹|Jan Aushadhi/, 'no price before confirmation');
  assert.deepEqual(c[0].buttons.map((b) => b.id), ['confirm:yes', 'confirm:no']);
  assert.match(bodyOf(await say({ kind: 'button', button: 'confirm:yes' })), /MRP ₹10/);
  assert.match(bodyOf(await say({ kind: 'button', button: 'confirm:yes' })), /Send a medicine name/, 'nothing pending any more');
  await say({ kind: 'image', mediaId: 'y' }, img);
  assert.match(bodyOf(await say({ kind: 'button', button: 'confirm:no' })), /type the medicine name exactly/);
});

test('privacy: the number is never stored; DELETE erases the chat; memory lasts 24 hours', async () => {
  const { say, db, env } = setup();
  await say({ kind: 'text', text: '580001' });
  const dump = JSON.stringify(await db.prepare('SELECT * FROM wa_chats').all());
  assert.doesNotMatch(dump, /9876500001/);
  const key = await chatKey(env, FROM);
  assert.equal(key.length, 40);
  assert.equal((await db.prepare('SELECT pin FROM wa_chats WHERE chat = ?1').bind(key).first()).pin, '580001');
  assert.match(bodyOf(await say({ kind: 'text', text: 'DELETE' })), /erased/);
  assert.equal(await db.prepare('SELECT * FROM wa_chats WHERE chat = ?1').bind(key).first(), null);
  // 24 hours later another message clears old chats.
  await say({ kind: 'text', text: '580001' });
  await handleMessage(env, { from: '919876500002', kind: 'text', text: 'Hi' }, {}, Date.now() + 25 * 3600_000);
  assert.equal(await db.prepare('SELECT * FROM wa_chats WHERE chat = ?1').bind(key).first(), null);
});

test('webhook: Meta verification, signature required, message parsing, Cloud API payloads', async () => {
  const env = { DB: fixtureDb({ ja: JA, kendras: KENDRAS, meta }), WA_VERIFY_TOKEN: 'vt', WA_APP_SECRET: 'secret', WHATSAPP_BOT: 'on' };
  const ok = await handleWebhook(new Request('https://x/api/wa/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=123'), env, { waitUntil() {} });
  assert.equal(await ok.text(), '123');
  assert.equal((await handleWebhook(new Request('https://x/api/wa/webhook?hub.mode=subscribe&hub.verify_token=no&hub.challenge=1'), env, {})).status, 403);
  const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [] } }] }] });
  assert.equal((await handleWebhook(new Request('https://x/api/wa/webhook', { method: 'POST', body: raw, headers: { 'x-hub-signature-256': 'sha256=00' } }), env, {})).status, 401);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))), (b) => b.toString(16).padStart(2, '0')).join('');
  assert.equal(await signatureOk(new TextEncoder().encode(raw), `sha256=${sig}`, 'secret'), true);
  assert.equal((await handleWebhook(new Request('https://x/api/wa/webhook', { method: 'POST', body: raw, headers: { 'x-hub-signature-256': `sha256=${sig}` } }), env, { waitUntil() {} })).status, 200);

  const msgs = parseInbound({ entry: [{ changes: [{ value: { messages: [
    { id: 'a', from: '91', type: 'text', text: { body: 'Dolo 650' } },
    { id: 'b', from: '91', type: 'image', image: { id: 'MEDIA', mime_type: 'image/jpeg' } },
    { id: 'c', from: '91', type: 'interactive', interactive: { button_reply: { id: 'confirm:yes', title: 'Yes' } } },
    { id: 'd', from: '91', type: 'audio' },
  ], statuses: [{ id: 'z' }] } }] }] });
  assert.deepEqual(msgs.map((m) => m.kind), ['text', 'image', 'button', 'other']);
  assert.equal(msgs[1].mediaId, 'MEDIA');
  const p = graphPayload('91', { kind: 'buttons', body: 'Q', buttons: [{ id: 'a', title: 'x'.repeat(30) }] });
  assert.equal(p.interactive.action.buttons[0].reply.title.length, 20);
  assert.deepEqual(graphPayload('91', { kind: 'text', body: 'Hi' }), { messaging_product: 'whatsapp', to: '91', type: 'text', text: { body: 'Hi', preview_url: false } });
});

test('Worker: the bot is off unless WHATSAPP_BOT = "on"; the simulator needs test traffic', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb({ ja: JA, kendras: KENDRAS, meta });
  const go = (env, path, init = {}) => worker.fetch(new Request(`https://samasalt.example${path}`, init), { DB: db, ...env }, { waitUntil() {} });
  const sim = { method: 'POST', headers: { 'content-type': 'application/json', 'x-samasalt-mitra-test': '1' }, body: JSON.stringify({ from: 'abc', text: 'Dolo 650' }) };
  assert.equal((await go({}, '/api/wa/webhook')).status, 404);
  assert.equal((await go({}, '/api/wa/simulate', sim)).status, 404);
  assert.equal((await go({ WHATSAPP_BOT: 'on' }, '/api/wa/simulate', { ...sim, headers: { 'content-type': 'application/json' } })).status, 404, 'patients cannot use the simulator');
  const r = await (await go({ WHATSAPP_BOT: 'on' }, '/api/wa/simulate', sim)).json();
  assert.match(r.replies.map((x) => x.body).join('\n'), /Dolo 650 Tablet/);
  const row = await db.prepare("SELECT mode, is_test, device FROM lookups WHERE mode = 'whatsapp'").first();
  assert.deepEqual({ ...row }, { mode: 'whatsapp', is_test: 1, device: null });
  assert.equal((await (await go({ WHATSAPP_BOT: 'on' }, '/api/health')).json()).whatsapp_bot, 'on');
});

test('every bot text exists in every language; button titles fit WhatsApp (20 characters)', () => {
  const keys = Object.keys(STRINGS.en).filter((k) => k.startsWith('wa'));
  assert.ok(keys.length >= 20);
  for (const l of Object.keys(STRINGS)) {
    for (const k of keys) assert.ok(STRINGS[l][k], `${l}.${k}`);
    for (const k of ['waYes', 'waNo']) assert.ok([...STRINGS[l][k]].length <= 20, `${l}.${k}`);
  }
});

test('short order link /o/<Kendra>/<PMBJP code>: approved Kendra + orders public only; never for a never-switch medicine', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const ja = [...JA, { drug_code: 'TEST-NTI', generic_name: 'Thyroxine Tablets 50 mcg', unit_size: '100 tablets', mrp: 50, ckey: 'levothyroxine:50mcg|tablet', units: 100, unit_price: 0.5 }];
  const db = fixtureDb({ ja, kendras: KENDRAS, meta });
  await registerKendra(db, { code: 'PMBJK00964', whatsapp: '9876543210', contact_name: 'Test Pharmacist', role: 'pharmacist', consent: true });
  await adminDecideKendra(db, { code: 'PMBJK00964', action: 'approve', checks: { called: true, details: true, terms: true }, note: 'Called, ok' });
  const go = (env, path) => worker.fetch(new Request(`https://samasalt.example${path}`, { redirect: 'manual' }), { DB: db, ...env }, { waitUntil() {} });
  const pub = { KENDRA_REGISTRY: 'public', ORDER_REQUESTS: 'public' };
  const ok = await go(pub, '/o/pmbjk00964/TEST-1?l=kn');
  assert.equal(ok.status, 302);
  const to = ok.headers.get('location');
  assert.match(to, /^https:\/\/wa\.me\/919876543210\?text=/);
  const msg = decodeURIComponent(to.split('?text=')[1]);
  assert.match(msg, /Paracetamol Tablets IP 650 mg \(PMBJP TEST-1\)/);
  assert.match(msg, /---\nOrder request for pickup/, 'Kannada first, English for the pharmacist');
  const home = 'https://samasalt.example/?k=PMBJK00964';
  assert.equal((await go({ ...pub, ORDER_REQUESTS: 'pilot' }, '/o/PMBJK00964/TEST-1')).headers.get('location'), home, 'pilot: no order link');
  assert.equal((await go(pub, '/o/PMBJK00964/NOPE')).headers.get('location'), home);
  assert.equal((await go(pub, '/o/PMBJK00964/TEST-NTI')).headers.get('location'), home, 'never-switch medicine: no order');
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../worker/wrangler.toml', import.meta.url), 'utf8'), /run_worker_first = \[[^\]]*"\/o\/\*"/);
});

test('v2.0.1 Chat in the app (/api/chat): off unless APP_CHAT = "on"; the app language and PIN; counted as chat; Ask on WhatsApp only with a number', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb({ ja: JA, kendras: KENDRAS, meta });
  const go = (env, path, init = {}) => worker.fetch(new Request(`https://samasalt.example${path}`, init), { DB: db, WA_HASH_KEY: 'k', ...env }, { waitUntil() {} });
  const post = (b) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  const id = 'a1b2c3d4e5f60718';
  assert.equal((await go({}, '/api/chat', post({ chat: id, text: 'Hi' }))).status, 404, 'off by default');
  assert.equal((await go({ APP_CHAT: 'on' }, '/api/chat', post({ chat: 'short', text: 'Hi' }))).status, 400, 'needs a chat id');
  const on = { APP_CHAT: 'on' };
  const hi = await (await go(on, '/api/chat', post({ chat: id, text: 'Hi', lang: 'kn' }))).json();
  assert.match(hi.replies[0].body, /ನಮಸ್ಕಾರ/, 'the app language wins');
  const a = (await (await go(on, '/api/chat', post({ chat: id, text: 'Dolo 650', lang: 'en', pin: '580001', device: 'abcdef123456' }))).json()).replies.map((r) => r.body).join('\n');
  assert.match(a, /Dolo 650 Tablet/);
  assert.match(a, /PMBJK00964/, "the app's PIN is used");
  const row = await db.prepare("SELECT mode, is_test, device FROM lookups WHERE mode = 'chat'").first();
  assert.deepEqual({ ...row }, { mode: 'chat', is_test: 0, device: 'abcdef123456' });
  const h = async (env) => (await go(env, '/api/health')).json();
  assert.equal((await h(on)).app_chat, 'on');
  assert.equal((await h({ WHATSAPP_BOT: 'on' })).wa_bot_number, null, 'no number set: no WhatsApp button');
  assert.equal((await h({ WA_BOT_NUMBER: '919876543210' })).wa_bot_number, null, 'bot off: no WhatsApp button');
  assert.equal((await h({ WHATSAPP_BOT: 'on', WA_BOT_NUMBER: '919876543210' })).wa_bot_number, '919876543210');
});
