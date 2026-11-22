// Search quality numbers (roadmap S1.4): each lookup records how a typed name was chosen, as one
// of a fixed set of words (never the typed text), and the impact page shows found / not found by
// way in, by how the name was chosen, and by language. Test traffic is never counted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('search quality: "via" is one of four words, only for typed names; the impact page counts found and not found', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb({ ja: [], kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
  const env = { DB: db, AI: null };
  const ask = async (body) => (await worker.fetch(new Request('https://samasalt.example/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: 'en', ...body }) }), env, { waitUntil() {} })).json();
  await ask({ text: 'Dolo 650', via: 'suggest' });
  await ask({ text: 'Dolo 650', via: 'typed' });
  await ask({ text: 'Zzqxw 999', via: 'typed' });
  await ask({ text: 'Dolo 650', via: 'didyoumean' });
  await ask({ text: 'Crocin Advance', via: 'rx' });
  await ask({ text: 'Dolo 650', via: 'my phone is 9876543210' }); // anything else: not stored
  await ask({ text: 'Dolo 650' }); // older app: nothing sent
  await ask({ text: 'Dolo 650', via: 'suggest', test: true }); // test traffic

  const vias = (await db.prepare('SELECT via FROM lookups').all()).results.map((r) => r.via);
  for (const v of vias) assert.ok(v === null || ['typed', 'suggest', 'didyoumean', 'rx'].includes(v), String(v));
  assert.equal(vias.filter((v) => v === null).length, 2);

  const imp = await (await worker.fetch(new Request('https://samasalt.example/api/impact'), env, { waitUntil() {} })).json();
  const via = Object.fromEntries(imp.search.by_via.map((r) => [r.via, r]));
  assert.equal(via.suggest.n, 1, 'test traffic not counted');
  assert.equal(via.suggest.found, 1);
  assert.equal(via.typed.n, 2);
  assert.equal(via.typed.found, 1);
  assert.equal(via.typed.not_found, 1);
  assert.equal(via.didyoumean.found, 1);
  assert.equal(via.rx.n, 1);
  const way = Object.fromEntries(imp.search.by_way.map((r) => [r.way, r]));
  assert.equal(way.typed.n, 7);
  assert.equal(imp.search.by_language[0].lang, 'en');
  assert.equal(imp.search.by_language[0].n, 7);
});

test('search quality: the app sends the way a name was chosen, and the impact page shows it', () => {
  const app = read('public/app.js');
  for (const v of ['typed', 'suggest', 'didyoumean', 'rx']) assert.match(app, new RegExp(`via: '${v}'`), v);
  const html = read('public/impact.html');
  assert.match(html, /Finding the medicine/);
  assert.match(html, /search\.by_via|S\.by_via/);
  assert.match(read('worker/migrations/0011_search_via.sql'), /ALTER TABLE lookups ADD COLUMN via TEXT/);
});
