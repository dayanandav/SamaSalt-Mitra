// 24 Nov 2026 (2.0.14): the free plan's daily D1 reads were used up by scanning the Jan Aushadhi list on
// every check, and every check failed. The list is read once (one row), and checks go on when D1 refuses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { runAgent, resetMetaCache } from '../worker/src/agent.js';
import { buildMedFiles, resetAssetMeds } from '../worker/src/medstore.js';
import { jaList, resetJaList, resetAddedList } from '../worker/src/tools.js';

// TEST FIXTURES ONLY.
const JA = [{ drug_code: '511', generic_name: 'Paracetamol Tablets IP 650 mg', unit_size: "15's", mrp: 15.47, group_name: 'X', ckey: 'paracetamol:650mg|tablet', units: 15, unit_price: 1.03 }];
const meta = { ja_loaded_at: 't', ja_list_date: '2026-10-11', kendras_loaded_at: 't' };
const spy = (db) => { const log = []; return [{ ...db, prepare: (q) => { log.push(q); return db.prepare(q); } }, log]; };
const ask = (DB, text) => runAgent({ DB, AI: null }, { text, lang: 'en' });

test('the Jan Aushadhi list is scanned once, then one saved row; checks do not scan it again', async () => {
  const base = fixtureDb({ ja: JA, kendras: [], meta });
  const scans = (log) => log.filter((q) => /FROM ja_products/.test(q) && !/ckey = \?1/.test(q)).length;
  const [first, log1] = spy(base);
  for (const t of ['Dolo 650', 'Paracetamol 650', 'Tramadol 50 mg', 'Nosuchmedicine 5']) await ask(first, t);
  assert.equal(scans(log1), 1);
  const [next, log2] = spy(base); // another Worker, with nothing in memory
  for (const t of ['Dolo 650', 'Paracetamol 650']) await ask(next, t);
  assert.equal(scans(log2), 0, 'the saved row is used');
  assert.equal((await ask(next, 'Paracetamol 650')).jan_aushadhi.product.drug_code, '511');
});

test('a new import is seen: the saved row is used only for the list it was made from', async () => {
  const base = fixtureDb({ ja: JA, kendras: [], meta });
  await jaList(base);
  await base.prepare("UPDATE ja_products SET mrp = 99 WHERE drug_code = '511'").run();
  await base.prepare("UPDATE meta SET value = '2026-12-01' WHERE key = 'ja_list_date'").run();
  resetJaList(base);
  assert.equal((await jaList(base))[0].mrp, 99, 'never an old price');
});

test('when D1 refuses, checks answer from the copy deployed with the app, with its list date', async () => {
  resetMetaCache();
  const refuse = async () => { throw new Error('D1_ERROR: daily read limit'); };
  const stmt = { bind: () => stmt, all: refuse, first: refuse, run: refuse, raw: refuse };
  const dead = { prepare: () => stmt, batch: refuse };
  resetAddedList(dead);
  // Brands are static files (as on the live site), so only D1 is missing.
  const files = buildMedFiles([{ id: 1, name: 'Otherbrand 5 Tablet', manufacturer: 'M', ckey: 'cetirizine:5mg|tablet', price: 10, pack: 10, unit_price: 1, form: 'tablet', rel: null, nti: 0, incomplete: 0 }]);
  files.set('meds/ja.json', JSON.stringify({ meta, rows: JA }));
  resetAssetMeds();
  const ASSETS = { fetch: async (req) => {
    const v = files.get(new URL(req.url).pathname.slice(1));
    return v == null ? new Response('', { status: 404 }) : new Response(v, { headers: { 'content-type': 'application/json' } });
  } };
  const r = await runAgent({ DB: dead, ASSETS, AI: null }, { text: 'Paracetamol Tablets IP 650 mg', lang: 'en', pin: '560001' }).catch((e) => ({ status: String(e) }));
  resetMetaCache();
  assert.equal(r.jan_aushadhi?.product?.drug_code, '511', r.status);
  assert.equal(r.data.ja_list_date, '2026-10-11');
  assert.deepEqual(r.kendras.items, []);
  resetAssetMeds();
  await assert.rejects(runAgent({ DB: { ...dead }, AI: null }, { text: 'Paracetamol Tablets IP 650 mg', lang: 'en' }), 'no copy: the check fails, nothing is made up');
});
