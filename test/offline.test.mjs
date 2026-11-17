// v1.3 weak-network mode: photo size on slow connections, waiting times, the saved last answer,
// the service worker's file list and version, and the text in every language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { photoSendSize, askTimeoutMs, savableAnswer, PHOTO_SEND, PHOTO_SEND_LIGHT, shouldAddToList } from '../public/rules.js';
import { STRINGS } from '../public/strings.js';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

test('photo: full size on a good connection; lighter on 2G/3G or Save-Data, never below 1024 px', () => {
  assert.deepEqual(photoSendSize(null), PHOTO_SEND);
  assert.deepEqual(photoSendSize({ effectiveType: '4g' }), PHOTO_SEND);
  for (const effectiveType of ['slow-2g', '2g', '3g']) assert.deepEqual(photoSendSize({ effectiveType }), PHOTO_SEND_LIGHT);
  assert.deepEqual(photoSendSize({ effectiveType: '4g', saveData: true }), PHOTO_SEND_LIGHT);
  assert.ok(PHOTO_SEND_LIGHT.side >= 1024 && PHOTO_SEND_LIGHT.quality >= 0.7);
});

test('waiting time: photos longer than names, doubled on 2G', () => {
  assert.equal(askTimeoutMs(false, null), 25_000);
  assert.equal(askTimeoutMs(true, null), 45_000);
  assert.equal(askTimeoutMs(true, { effectiveType: '2g' }), 90_000);
});

test('last answer kept for the visit: only a finished answer, no photo, never added to the list again', () => {
  const ok = { status: 'ok', medicine: { ckey: 'k', name: 'Dolo 650' }, image: 'data:image/jpeg;base64,xx', trace: [{}], fresh: true };
  const kept = savableAnswer(ok);
  assert.equal(kept.image, undefined);
  assert.equal(kept.trace, undefined);
  assert.equal(kept.fresh, false);
  assert.equal(shouldAddToList({ ...kept, jan_aushadhi: {} }), false, 'showing it again does not add it twice');
  assert.equal(savableAnswer({ status: 'offline' }), null);
  assert.equal(savableAnswer({ status: 'not_found' }), null);
  assert.equal(savableAnswer({ ...ok, needs_confirmation: true }), null, 'an unconfirmed photo read is not kept');
  assert.ok(savableAnswer({ ...ok, needs_confirmation: true, confirmed: true }));
});

test('service worker: same version as the Worker, every saved file exists, never stores /api or staff pages', () => {
  const sw = read('public/sw.js');
  const version = sw.match(/const VERSION = '([^']+)'/)[1];
  assert.equal(version, read('worker/src/index.js').match(/const APP_VERSION = '([^']+)'/)[1]);
  const shell = JSON.parse(sw.match(/const SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  for (const p of shell) if (p !== '/') assert.ok(existsSync(new URL('public' + p, root)), p);
  assert.ok(!shell.some((p) => /api|admin|kendra|dev|impact|volunteer/.test(p)));
  // Every module the app imports is in the saved set (else it would not open offline).
  for (const m of read('public/app.js').matchAll(/from '(\/[^']+)'/g)) assert.ok(shell.includes(m[1]), m[1]);
  assert.match(read('public/app.js'), /serviceWorker\.register\('\/sw\.js'/);
});

test('every weak-network text exists in every language', () => {
  for (const key of ['offlineBar', 'offlineWait', 'offlineAuto', 'slowNet', 'tryAgain', 'offlineLang', 'lastAnswer']) {
    for (const l of Object.keys(STRINGS)) assert.ok(STRINGS[l][key], `${l}.${key}`);
  }
});
