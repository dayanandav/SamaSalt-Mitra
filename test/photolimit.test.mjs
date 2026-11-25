// 2.0.18 (owner's decision 25 Nov 2026): 10 photos per device per day, strips and prescriptions together.
// Typing is never limited; nothing personal is kept (the app's random code, for 2 days).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';
import { photoLimitReached } from '../worker/src/limits.js';
import { STRINGS } from '../public/strings.js';

const meta = { ja_loaded_at: 't', kendras_loaded_at: 't' };
const img = 'data:image/jpeg;base64,AAAA';
const AI = { run: async () => ({ response: '{"medicines": [], "readable": false}' }) };
async function setup(env = {}) {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb({ ja: [], kendras: [], meta });
  const go = async (path, body) => (await worker.fetch(new Request(`https://samasalt.example${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { DB: db, AI, WA_HASH_KEY: 'k', ...env }, { waitUntil() {} })).json();
  return { db, go };
}

test('strips and prescriptions count together per device; past the limit nothing is read; typing still works', async () => {
  let reads = 0;
  const { go } = await setup({ PHOTO_PER_DEVICE: '3', AI: { run: async () => { reads++; return { response: '{"medicines": [], "readable": false}' }; } } });
  const a = { device: 'deviceaaaa', image: img };
  await go('/api/ask', a); await go('/api/prescription', a); await go('/api/ask', a);
  const before = reads;
  const limited = { status: 'vision_unavailable', reason: 'device_photo_limit', limit: 3 };
  assert.deepEqual(await go('/api/ask', a), limited);
  assert.deepEqual(await go('/api/prescription', a), limited);
  assert.equal(reads, before, 'the AI is not called');
  assert.notEqual((await go('/api/ask', { device: 'deviceaaaa', text: 'Dolo 650' })).status, 'vision_unavailable', 'typing is not limited');
  assert.notEqual((await go('/api/ask', { device: 'devicebbbb', image: img })).reason, 'device_photo_limit', 'another device is not limited');
  assert.equal((await go('/api/ask', { ...a, test: true })).reason, 'device_photo_limit', 'saying "test" does not lift it');
});

test('the chat has the same limit and says so in the patient\'s language; no device code cannot go round it', async () => {
  const { go } = await setup({ PHOTO_PER_DEVICE: '1', APP_CHAT: 'on' });
  const chat = { chat: 'a1b2c3d4e5f60718', device: 'devicecccc', image: img, lang: 'kn' };
  await go('/api/chat', chat);
  assert.equal((await go('/api/chat', chat)).replies[0].body, STRINGS.kn.photoLimit.replace('{n}', '1'));
  await go('/api/ask', { image: img });
  assert.equal((await go('/api/ask', { image: img })).reason, 'device_photo_limit', 'photos with no code are counted together');
  assert.equal((await go('/api/ask', { image: img, device: 'x' })).reason, 'device_photo_limit', 'a code that is not one');
});

test('a new day starts again, old counts are deleted, nothing else is kept; no setting or a database fault never blocks', async () => {
  const { db } = await setup();
  const env = { DB: db, PHOTO_PER_DEVICE: '1' };
  assert.equal(await photoLimitReached(env, 'devicedddd', '2026-11-20'), false);
  assert.equal(await photoLimitReached(env, 'devicedddd', '2026-11-20'), true);
  assert.equal(await photoLimitReached(env, 'devicedddd', '2026-11-25'), false);
  const rows = (await db.prepare('SELECT * FROM photo_uses').all()).results;
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ device: 'devicedddd', day: '2026-11-25', n: 1 }]);
  assert.equal(await photoLimitReached({ DB: db }, 'devicedddd', '2026-11-25'), false, 'no setting: no limit');
  const dead = { prepare: () => { throw new Error('D1'); } };
  assert.equal(await photoLimitReached({ DB: dead, PHOTO_PER_DEVICE: '1' }, 'devicedddd', '2026-11-25'), false);
});

test('live and the test site have the limit; the text is in every language, with the number; the app offers typing', () => {
  const toml = readFileSync(new URL('../worker/wrangler.toml', import.meta.url), 'utf8');
  assert.equal(toml.split('PHOTO_PER_DEVICE = "10"').length - 1, 2);
  assert.equal(toml.split('name = "LIMIT_PHOTO"').length - 1, 2);
  for (const l of Object.keys(STRINGS)) assert.match(STRINGS[l].photoLimit, /\{n\}/, l);
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /JSON\.stringify\(\{ image, lang, device,/, 'prescriptions send the device code');
  assert.match(app, /photo_limit' \? `<div class="crop-actions"[^`]*id="typeBtn"/);
});
