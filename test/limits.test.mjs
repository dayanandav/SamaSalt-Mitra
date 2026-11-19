// Abuse protection: per-address limits (checks, staff sign-in) and the daily photo cap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';
import { STRINGS } from '../public/strings.js';

const JA = [{ drug_code: 'TEST-1', generic_name: 'Paracetamol Tablets IP 650 mg', unit_size: '10 tablets', mrp: 10, ckey: 'paracetamol:650mg|tablet', units: 10, unit_price: 1.0 }];
const KENDRAS = [{ code: 'PMBJK00964', name: 'x', address: 'Test Road 1', district: 'Dharwad', state: 'Karnataka', pin: '580001' }];
const meta = { ja_loaded_at: 'test', kendras_loaded_at: 'test', ja_list_date: 'test' };

// A stand-in for Cloudflare's rate limiter: `allow` requests per key, then refuse.
function limiter(allow) {
  const seen = new Map();
  const keys = [];
  return { keys, async limit({ key }) { keys.push(key); const n = (seen.get(key) || 0) + 1; seen.set(key, n); return { success: n <= allow }; } };
}

async function setup(env = {}) {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb({ ja: JA, kendras: KENDRAS, meta });
  const go = (path, body, ip = '203.0.113.7') => worker.fetch(new Request(`https://samasalt.example${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(body) }), { DB: db, WA_HASH_KEY: 'k', ...env }, { waitUntil() {} });
  return { db, go };
}

test('checks: over the per-address limit → 429 "busy" for the app, a bot message for the chat; other addresses unaffected', async () => {
  const L = limiter(2);
  const { go } = await setup({ LIMIT_CHECK: L, APP_CHAT: 'on' });
  assert.equal((await go('/api/ask', { text: 'Dolo 650' })).status, 200);
  assert.equal((await go('/api/ask', { text: 'Dolo 650' })).status, 200);
  const r = await go('/api/ask', { text: 'Dolo 650' });
  assert.equal(r.status, 429);
  assert.equal(r.headers.get('retry-after'), '60');
  assert.deepEqual(await r.json(), { status: 'busy', error: 'too_many' });
  const c = await go('/api/chat', { chat: 'a1b2c3d4e5f60718', text: 'Hi', lang: 'kn' });
  assert.equal(c.status, 429);
  assert.equal((await c.json()).replies[0].body, STRINGS.kn.tooMany, 'in the patient\'s language');
  assert.equal((await go('/api/ask', { text: 'Dolo 650' }, '198.51.100.9')).status, 200, 'another address is not blocked');
  assert.ok(L.keys.every((k) => k.startsWith('check:')));
});

test('staff sign-in: limited per address (the setup key has no account lock of its own)', async () => {
  const { go } = await setup({ LIMIT_LOGIN: limiter(1), ADMIN_TOKEN: 'right-token-123456' });
  assert.equal((await go('/api/admin/login', { token: 'wrong' })).status, 401);
  const r = await go('/api/admin/login', { token: 'wrong' });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'locked');
});

test('no limiter configured (tests, local dev) or a failing limiter: never blocks', async () => {
  const broken = { async limit() { throw new Error('down'); } };
  const { go } = await setup({ LIMIT_CHECK: broken });
  for (let i = 0; i < 5; i++) assert.equal((await go('/api/ask', { text: 'Dolo 650' })).status, 200);
});

test('daily photo cap: past DAILY_PHOTO_LIMIT a photo is not read (app: "type the name"; chat: the same message); typed names still work', async () => {
  const { db, go } = await setup({ DAILY_PHOTO_LIMIT: '1', APP_CHAT: 'on' });
  const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  await db.prepare("INSERT INTO lookups (id, ts, day, status, input, lang, mode, is_test) VALUES ('x', ?1, ?2, 'ok', 'photo', 'en', 'self', 0)").bind(new Date().toISOString(), day).run();
  const img = 'data:image/jpeg;base64,AAAA';
  assert.deepEqual(await (await go('/api/ask', { image: img })).json(), { status: 'vision_unavailable', reason: 'daily_photo_limit' });
  const c = await (await go('/api/chat', { chat: 'a1b2c3d4e5f60718', image: img, lang: 'hi' })).json();
  assert.equal(c.replies[0].body, STRINGS.hi.visionDown);
  assert.equal((await go('/api/ask', { text: 'Dolo 650' })).status, 200);
});

test('limits are configured for live and the test site; the "busy" text exists in every language', () => {
  const toml = readFileSync(new URL('../worker/wrangler.toml', import.meta.url), 'utf8');
  for (const name of ['LIMIT_CHECK', 'LIMIT_LOGIN']) assert.equal(toml.split(`name = "${name}"`).length - 1, 2, name);
  assert.equal(toml.split('DAILY_PHOTO_LIMIT = ').length - 1, 2);
  for (const l of Object.keys(STRINGS)) assert.ok(STRINGS[l].tooMany, l);
});
