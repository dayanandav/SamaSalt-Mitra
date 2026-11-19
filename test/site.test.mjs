// Own domain (CANONICAL_HOST) and the privacy and disclaimer page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';
import { canonicalRedirect } from '../worker/src/index.js';
import { STRINGS } from '../public/strings.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const old = (p) => new URL(`https://samasalt-mitra.samasalt-mitra-worker.workers.dev${p}`);

test('own domain: old workers.dev links move to CANONICAL_HOST; /api, POSTs, the new host and an unset value never redirect', () => {
  const env = { CANONICAL_HOST: 'samasaltmitra.in' };
  assert.equal(canonicalRedirect(env, old('/k/PMBJK00964')), 'https://samasaltmitra.in/k/PMBJK00964');
  assert.equal(canonicalRedirect(env, old('/o/PMBJK00964/511?l=kn')), 'https://samasaltmitra.in/o/PMBJK00964/511?l=kn');
  assert.equal(canonicalRedirect(env, old('/api/health')), null, 'API stays (old app copies, WhatsApp webhook)');
  assert.equal(canonicalRedirect(env, old('/k/PMBJK00964'), 'POST'), null);
  assert.equal(canonicalRedirect(env, new URL('https://samasaltmitra.in/k/PMBJK00964')), null);
  assert.equal(canonicalRedirect({}, old('/k/PMBJK00964')), null, 'unset: stay on workers.dev');
  assert.equal(canonicalRedirect({ CANONICAL_HOST: 'not a host' }, old('/k/x')), null);
  assert.equal(canonicalRedirect(env, new URL('http://localhost:8787/k/PMBJK00964')), null, 'local dev untouched');
});

test('own domain: the Worker redirects with 301 and /api/health tells the app', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb({ ja: [], kendras: [], meta: {} });
  const env = { DB: db, CANONICAL_HOST: 'samasaltmitra.in' };
  const r = await worker.fetch(new Request(old('/v/SV-ABCDE'), { redirect: 'manual' }), env, { waitUntil() {} });
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), 'https://samasaltmitra.in/v/SV-ABCDE');
  const h = await (await worker.fetch(new Request(old('/api/health')), env, { waitUntil() {} })).json();
  assert.equal(h.canonical_host, 'samasaltmitra.in');
  assert.match(read('public/app.js'), /h\.canonical_host && location\.hostname !== h\.canonical_host/);
});

test('privacy page: in all three languages, says no dose advice, no photos/numbers kept, not a government service; linked from every public page', () => {
  const html = read('public/privacy.html');
  for (const l of ['en', 'kn', 'hi']) assert.match(html, new RegExp(`<article data-l="${l}"`), l);
  assert.match(html, /never tells you what dose to take/);
  assert.match(html, /not saved by us/);
  assert.match(html, /not run by PMBI, PMBJP or the Government of India/);
  assert.match(html, /first 3 digits of the PIN code/);
  for (const p of ['public/index.html', 'public/kendra.html', 'public/volunteer.html', 'public/impact.html']) assert.match(read(p), /href="\/privacy"/, p);
  for (const l of Object.keys(STRINGS)) assert.ok(STRINGS[l].privacyLink, l);
});

test('v2.0.5: monthly impact report (?month=), health usage for the live check, larger text, Kendra hours in the chat', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb({ ja: [], kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
  const ins = (day, input, test = 0) => db.prepare("INSERT INTO lookups (id, ts, day, status, input, lang, mode, is_test) VALUES (?1, ?2, ?3, 'ok', ?4, 'en', 'self', ?5)").bind(crypto.randomUUID(), `${day}T10:00:00Z`, day, input, test).run();
  await ins('2026-10-05', 'text'); await ins('2026-11-02', 'text'); await ins('2026-11-03', 'photo'); await ins('2026-11-03', 'text', 1);
  const imp = async (q) => (await worker.fetch(new Request(`https://samasalt.example/api/impact${q}`), { DB: db }, { waitUntil() {} })).json();
  assert.equal((await imp('')).totals.lookups, 3, 'all time, test traffic excluded');
  const nov = await imp('?month=2026-11');
  assert.equal(nov.month, '2026-11');
  assert.equal(nov.totals.lookups, 2);
  assert.deepEqual(nov.by_day.map((x) => x.day), ['2026-11-02', '2026-11-03']);
  assert.equal((await imp("?month=2026-11' OR 1=1")).month, null, 'anything else is ignored');
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  await ins(today, 'photo');
  await db.prepare("INSERT INTO meta (key, value) VALUES ('rx_reads_' || ?1, '2')").bind(today).run();
  const h = await (await worker.fetch(new Request('https://samasalt.example/api/health'), { DB: db, DAILY_PHOTO_LIMIT: '1500' }, { waitUntil() {} })).json();
  assert.deepEqual(h.usage, { day: today, photo_reads: 3, photo_cap: 1500 });
  assert.ok(!Object.keys(h.meta).some((k) => k.startsWith('rx_reads_')), 'internal counters not listed');
  const mon = read('.github/workflows/monitor.yml');
  assert.match(mon, /0\.8 \* u\.photo_cap/);
  assert.match(read('.github/workflows/test.yml'), /test\/\*\.test\.mjs/);
  assert.match(read('.gitignore'), /^backups\/$/m);
  assert.match(read('public/index.html'), /id="textSize"/);
  for (const l of Object.keys(STRINGS)) assert.ok(STRINGS[l].textSizeBtn, l);
  const { kendraLines } = await import('../worker/src/watext.js');
  const L = kendraLines('en', { items: [{ code: 'PMBJK00964', address: 'A', district: 'D', pin: '580001', contact: { whatsapp: '9876543210', hours: '9 am to 9 pm, Sunday closed' } }] }, '580001');
  assert.ok(L.some((x) => x.includes('Open: 9 am to 9 pm, Sunday closed')));
});
