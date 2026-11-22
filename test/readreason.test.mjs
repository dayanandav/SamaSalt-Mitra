// Why a photo or scan could not be read (impact page): each unreadable lookup records one of the
// agent's fixed reasons (never the photo or any text); the impact page counts them; test traffic
// is never counted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';

test('unreadable lookups record the reason (fixed words only); the impact page counts them', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb({ ja: [], kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
  const env = { DB: db, AI: null };
  const ask = async (body) => (await worker.fetch(new Request('https://samasalt.example/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: 'en', ...body }) }), env, { waitUntil() {} })).json();
  // Strip text with no salts or strengths: not read, reason "no_composition".
  const r = await ask({ ocr: 'MICRO LABS LIMITED BATCH 23A MFG 08/2026 EXP 07/2028 KEEP OUT OF REACH OF CHILDREN' });
  assert.equal(r.status, 'unreadable');
  assert.equal(r.reason, 'no_composition');
  await ask({ ocr: 'MICRO LABS LIMITED BATCH 23A', test: true }); // test traffic
  await ask({ text: 'Dolo 650' }); // found: no reason
  const rows = (await db.prepare('SELECT status, read_reason, is_test FROM lookups').all()).results;
  for (const x of rows) assert.ok(x.read_reason === null || ['no_composition', 'brand_mismatch', 'low_confidence'].includes(x.read_reason), String(x.read_reason));
  assert.equal(rows.filter((x) => x.status === 'ok')[0].read_reason, null);
  const imp = await (await worker.fetch(new Request('https://samasalt.example/api/impact'), env, { waitUntil() {} })).json();
  assert.deepEqual(imp.search.unreadable_by_reason, [{ way: 'photo', reason: 'no_composition', n: 1 }], 'real traffic only');
});

test('the impact page shows why photos were not read; the column holds only fixed words', () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.match(read('public/impact.html'), /Why photos and scans were not read/);
  assert.match(read('worker/migrations/0013_read_reason.sql'), /ALTER TABLE lookups ADD COLUMN read_reason TEXT/);
  assert.match(read('worker/src/index.js'), /READ_REASONS = new Set\(\['no_composition', 'brand_mismatch', 'low_confidence'\]\)/);
});
