// 2.0.19 (roadmap C6): the same medicine or photo checked again in a visit is answered from the phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { answerKey, cacheableAnswer, rememberAnswer, ANSWER_CACHE_MAX } from '../public/rules.js';

test('the key: the name as typed (case and spaces aside), or the photo, with language and PIN', () => {
  assert.equal(answerKey({ text: ' Dolo  650 ', lang: 'en', pin: '' }), answerKey({ text: 'dolo 650', lang: 'en' }));
  assert.notEqual(answerKey({ text: 'Dolo 650', lang: 'en' }), answerKey({ text: 'Dolo 650', lang: 'kn' }), 'another language: asked again');
  assert.notEqual(answerKey({ text: 'Dolo 650', lang: 'en', pin: '580020' }), answerKey({ text: 'Dolo 650', lang: 'en', pin: '560001' }), 'another PIN: asked again');
  assert.equal(answerKey({ image: 'data:x', lang: 'en' }), null, 'a photo without its fingerprint is never kept');
  assert.match(answerKey({ image: 'data:x', imageHash: 'ab12', lang: 'en' }), /^p\|ab12\|/);
  assert.equal(answerKey({ text: '  ', lang: 'en' }), null);
});

test('only finished answers are kept, as the server sent them', () => {
  for (const status of ['busy', 'offline', 'slow', 'error', 'vision_down', 'photo_limit', 'vision_unavailable']) assert.equal(cacheableAnswer({ status }), null, status);
  const r = { status: 'ok', needs_confirmation: true, confirm: 'two_salts', medicine: { name: 'X' }, confirmed: true, addedToList: true, fresh: true, image: 'data:x' };
  assert.deepEqual(cacheableAnswer(r), { status: 'ok', needs_confirmation: true, confirm: 'two_salts', medicine: { name: 'X' } }, 'a "yes" given on screen is asked again');
});

test('at most a few answers, newest kept, one per key', () => {
  let list = [];
  for (let i = 0; i < ANSWER_CACHE_MAX + 5; i++) list = rememberAnswer(list, `k${i}`, { status: 'ok', n: i });
  assert.equal(list.length, ANSWER_CACHE_MAX);
  assert.equal(list.at(-1)[0], `k${ANSWER_CACHE_MAX + 4}`);
  list = rememberAnswer(list, 'k19', { status: 'ok', n: 'again' });
  assert.equal(list.filter(([k]) => k === 'k19').length, 1);
  assert.deepEqual(rememberAnswer(list, 'kx', { status: 'busy' }), list);
});

test('the app uses the kept answer before any request, and forgets them with the visit', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /if \(kept\) r = JSON\.parse\(JSON\.stringify\(kept\[1\]\)\);\n\s+for \(let attempt = 0; attempt < 2 && !kept;/);
  assert.match(app, /session\.set\('ss_answers', null\)/);
  assert.doesNotMatch(app, /store\.set\('ss_answers'/, 'never kept beyond the visit');
});
