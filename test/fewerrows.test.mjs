// 2.0.15 (roadmap C6): fewer D1 rows. The figures stay right; only how often they are made changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fixtureDb } from './d1shim.mjs';
import { nearestKendra, setAssets } from '../worker/src/tools.js';

const meta = { ja_loaded_at: 't', kendras_loaded_at: 't', kendra_list_date: '2026-10-12' };
const spy = (db) => { const log = []; return [{ ...db, prepare: (q) => { log.push(q); return db.prepare(q); } }, log]; };

test('impact: with IMPACT_CACHE_MIN the lookups are read once, then the kept row; without it, every time', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const base = fixtureDb({ ja: [], kendras: [], meta });
  let n = 0;
  const add = () => base.prepare("INSERT INTO lookups (id, ts, day, status, input, lang, mode, is_test) VALUES (?1, '2026-11-02T10:00:00Z', '2026-11-02', 'ok', 'text', 'en', 'self', 0)").bind(`i${n++}`).run();
  await add();
  const [db, log] = spy(base);
  const get = async (q, env) => (await worker.fetch(new Request(`https://samasalt.example/api/impact${q}`), { DB: db, ...env }, { waitUntil() {} })).json();
  const on = { IMPACT_CACHE_MIN: '60' };
  assert.equal((await get('', on)).totals.lookups, 1);
  await add();
  log.length = 0;
  const kept = await get('', on);
  assert.equal(kept.totals.lookups, 1, 'kept for an hour');
  assert.ok(kept.generated_at, 'says when it was made');
  assert.ok(!log.some((q) => /FROM lookups/.test(q)), 'no lookup is read');
  assert.equal((await get('')).totals.lookups, 2, 'without the setting: every time');
  await base.prepare('UPDATE impact_summary SET at = at - 3600001').run();
  assert.equal((await get('', on)).totals.lookups, 2, 'made again after an hour');
  for (const q of ['?month=2001-01', '?month=2099-12', "?month=x' OR 1=1"]) assert.equal((await get(q, on)).month, null, q);
  const rows = (await base.prepare('SELECT key, data FROM impact_summary').all()).results;
  assert.deepEqual(rows.map((r) => r.key), ['all'], 'only real months are kept');
  assert.ok(!/device"|"i0"/.test(rows[0].data), 'counts only');
});

test('the photo count and the volunteer report use small indexes; a check without a volunteer is not in them', () => {
  const raw = new DatabaseSync(':memory:');
  for (const f of ['0001_init.sql', '0006_volunteers.sql', '0015_fewer_rows.sql']) raw.exec(readFileSync(new URL(`../worker/migrations/${f}`, import.meta.url), 'utf8'));
  const plan = raw.prepare("EXPLAIN QUERY PLAN SELECT COUNT(*) FROM lookups WHERE day = '2026-11-25' AND input LIKE 'photo%'").all().map((x) => x.detail).join();
  assert.match(plan, /idx_lookups_photo/);
  const sql = raw.prepare("SELECT sql FROM sqlite_master WHERE name = 'idx_lookups_volunteer'").get().sql;
  assert.match(sql, /WHERE volunteer IS NOT NULL/);
});

test('nearest Kendras: from the file of the PIN, only when made from the loaded list; otherwise D1 as before', async () => {
  const K = [{ code: 'PMBJK1', name: 'x', address: 'A', district: 'D', state: 'S', pin: '580001', lat: 15.45, lng: 75.01 }];
  const base = fixtureDb({ ja: [], kendras: K, meta });
  await base.prepare("INSERT INTO pin_locations (pin, lat, lng) VALUES ('580001', 15.45, 75.01)").run();
  const file = (list_date) => ({ list_date, kendras: { FILE1: { name: 'y', address: 'B', district: 'D', state: 'S', pin: '580001', lat: 15.45, lng: 75.01, phone: null } }, pins: { 580001: [['FILE1', 0]] } });
  const withFile = (date) => {
    const [db, log] = spy(base);
    setAssets(db, { fetch: async (req) => (new URL(req.url).pathname === '/meds/kp/580.json' ? new Response(JSON.stringify(file(date)), { headers: { 'content-type': 'application/json' } }) : new Response('', { status: 404 })) });
    return [db, log];
  };
  const [db, log] = withFile('2026-10-12');
  const r = await nearestKendra(db, { pin: '580001' });
  assert.deepEqual(r, { by: 'pin', items: [{ code: 'FILE1', name: 'y', address: 'B', district: 'D', state: 'S', pin: '580001', lat: 15.45, lng: 75.01, phone: null, km: 0, approx: true }] });
  assert.ok(!log.some((q) => /FROM kendras|pin_locations/.test(q)), 'no Kendra rows read');
  const [old] = withFile('2025-01-01');
  assert.equal((await nearestKendra(old, { pin: '580001' })).items[0].code, 'PMBJK1', 'files of another list are never used');
  const [none] = spy(base);
  assert.equal((await nearestKendra(none, { pin: '580001' })).items[0].code, 'PMBJK1', 'no files: D1');
});
