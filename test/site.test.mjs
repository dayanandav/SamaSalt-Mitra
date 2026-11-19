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
