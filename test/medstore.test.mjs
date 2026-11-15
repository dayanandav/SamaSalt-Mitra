// The static-file medicine store (production) must answer exactly like the D1 table (the
// original queries). Built from the same 7,930-row fixture, both stores are compared on every
// name token, every composition key, and whole agent runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';
import { d1Meds, fileMeds, buildMedFiles, resetAssetMeds, ROW_FIELDS } from '../worker/src/medstore.js';
import { tokens } from '../worker/src/tools.js';
import { runAgent } from '../worker/src/agent.js';

const raw = JSON.parse(readFileSync(new URL('./fixtures/med_subset.json', import.meta.url), 'utf8'));
// Fixture columns: id, name, manufacturer, salt, ckey, price, pack, unit_price, form, rel, nti, incomplete
const rows = raw.map(([id, name, manufacturer, , ckey, price, pack, unit_price, form, rel, nti, incomplete]) => ({ id, name, manufacturer, ckey, price, pack, unit_price, form, rel, nti, incomplete }));
const db = fixtureDb({ ja: [{ drug_code: 'TEST-1', generic_name: 'Paracetamol Tablets IP 650 mg', unit_size: '10 tablets', mrp: 10, ckey: 'paracetamol:650mg|tablet', units: 10, unit_price: 1.0 }], kendras: [{ code: 'K1', name: 'Test Kendra', pin: '580001' }], meta: { ja_loaded_at: 'test', kendras_loaded_at: 'test', ja_list_date: 'test' } });
const d1 = d1Meds(db);

const storeFrom = (files) => {
  const get = async (p) => files.get(p) ?? null;
  return fileMeds(get, JSON.parse(files.get('meds/meta.json')));
};
const fakeAssets = (files) => ({
  async fetch(req) {
    const p = new URL(req.url).pathname.slice(1);
    return files.has(p) ? new Response(files.get(p), { headers: { 'content-type': 'application/json' } }) : new Response('<h1>Not found</h1>', { status: 404, headers: { 'content-type': 'text/html' } });
  },
});

const allTokens = [...new Set(rows.map((r) => tokens(r.name)[0]).filter(Boolean))];
const allKeys = [...new Set(rows.map((r) => r.ckey).filter(Boolean))];
// Compare what the API would send: node:sqlite rows have a null prototype, file rows do not.
const plain = (x) => JSON.parse(JSON.stringify(x));
const ids = (rs) => rs.map((r) => r.id).sort((a, b) => a - b);

for (const [label, maxShardBytes] of [['normal shards', 100_000], ['tiny shards (forces splitting)', 1_500]]) {
  const files = buildMedFiles(rows, { datasetDate: 'November 2022', maxShardBytes });
  const store = storeFrom(files);

  test(`medstore (${label}): name search returns the same medicines as name LIKE 'token%'`, async () => {
    if (maxShardBytes < 10_000) assert.ok([...files.values()].some((t) => t.includes('"split"')), 'splitting was exercised');
    for (const t of [...allTokens, 'd', 'do', 'p', 'pa', 'a', '1', 'zzzz']) {
      const a = await d1.byNamePrefix(t);
      const b = await store.byNamePrefix(t);
      assert.deepEqual(ids(b), ids(a), t);
      for (const r of b) for (const f of ROW_FIELDS) assert.ok(f in r, f);
    }
  });

  test(`medstore (${label}): same-salt summaries and key lookups match the D1 queries`, async () => {
    for (const k of allKeys) {
      assert.deepEqual(plain(await store.sameSalt(k, 8)), plain(await d1.sameSalt(k, 8)), k);
      assert.equal(await store.hasKey(k), true, k);
    }
    assert.equal(await store.hasKey('nosuchsalt:1mg|tablet'), false);
    assert.equal((await store.sameSalt('nosuchsalt:1mg|tablet')).count, 0);
    assert.equal(await store.count(), rows.length);
    assert.equal(await store.loaded(), true);
    assert.deepEqual(JSON.parse(await store.keysJson()).sort(), [...allKeys].sort());
  });

  test(`medstore (${label}): whole agent runs give the same answer from files as from D1`, async () => {
    for (const input of [{ text: 'Dolo 650 580001' }, { text: 'Augmentin 625 Duo' }, { text: 'pan 40' }, { text: 'Telma 40' }, { text: 'amoxicillin clavulanic acid 500 125 tablet' }]) {
      resetAssetMeds();
      const fromD1 = await runAgent({ DB: db, AI: null }, { ...input, lang: 'en' });
      resetAssetMeds();
      const fromFiles = await runAgent({ DB: db, AI: null, ASSETS: fakeAssets(files) }, { ...input, lang: 'en' });
      const strip = ({ trace, ...r }) => ({ ...r, trace: trace.map(({ ms, ...s }) => s) });
      const a = strip(fromD1);
      const b = strip(fromFiles);
      if (a.data) a.data.brand_prices = b.data.brand_prices; // the files carry the dataset date; D1 here has none
      assert.equal(b.status, a.status, input.text);
      assert.deepEqual(plain(b), plain(a), input.text);
    }
    resetAssetMeds();
  });
}

test('medstore: without deployed files the Worker falls back to the D1 table', async () => {
  resetAssetMeds();
  const r = await runAgent({ DB: db, AI: null, ASSETS: fakeAssets(new Map()) }, { text: 'Dolo 650', lang: 'en' });
  assert.equal(r.status, 'ok');
  assert.equal(r.medicine.name, 'Dolo 650 Tablet');
  resetAssetMeds();
});
