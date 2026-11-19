// v2.0.4: share the answer, scan a prescription, Kendras by distance (the AI model is a stand-in).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';
import { shareText } from '../public/rules.js';
import { STRINGS, t, rupees } from '../public/strings.js';

const JA = [{ drug_code: '511', generic_name: 'Paracetamol Tablets IP 650 mg', unit_size: "15's", mrp: 15.47, ckey: 'paracetamol:650mg|tablet', units: 15, unit_price: 1.03 }];
const KENDRAS = [{ code: 'PMBJK00964', name: 'x', address: 'Test Road 1', district: 'Dharwad', state: 'Karnataka', pin: '580001' }];
const meta = { ja_loaded_at: 'test', kendras_loaded_at: 'test', ja_list_date: 'test' };

async function setup(env = {}) {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb({ ja: JA, kendras: KENDRAS, meta });
  const post = (path, body) => worker.fetch(new Request(`https://samasalt.example${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { DB: db, ...env }, { waitUntil() {} });
  return { db, post };
}

test('share: the templated answer, the Jan Aushadhi generic and the link; an NTI medicine shares its warning only', async () => {
  const { post } = await setup();
  const r = await (await post('/api/ask', { text: 'Dolo 650', test: true })).json();
  const tr = (k, v) => t('en', k, v);
  const s = shareText(r, tr, rupees, 'per tablet', 'https://samasalt.example');
  assert.match(s, /^Dolo 650 Tablet \(Paracetamol/);
  assert.ok(s.includes(r.answer.trim()));
  assert.match(s, /Jan Aushadhi generic: Paracetamol Tablets IP 650 mg · 15's · MRP ₹15\.47 \(PMBJP 511\)/);
  assert.match(s, /Ask your doctor or pharmacist before switching\. https:\/\/samasalt\.example$/);
  const nti = await (await post('/api/ask', { text: 'Thyronorm 100mcg', test: true })).json();
  const ns = shareText(nti, tr, rupees, 'per tablet', 'https://samasalt.example');
  assert.doesNotMatch(ns, /Jan Aushadhi generic|MRP/);
  assert.equal(shareText({ status: 'not_found' }, tr, rupees, '', ''), '');
});

test('prescription: names only (matched to the list, nothing priced); unclear names kept as "not in our list"; counted towards the photo cap', async () => {
  const seen = [];
  const AI = { run: async (model, req) => { seen.push(req.messages[0].content); return { response: JSON.stringify({ medicines: [{ name: 'Dolo 650', form: 'tablet' }, { name: 'Thyronorm', strength: '100mcg' }, { name: 'Xyzzyl 5' }, { name: 'Dolo 650' }], readable: true }) }; } };
  const { db, post } = await setup({ AI, DAILY_PHOTO_LIMIT: '2' });
  const img = 'data:image/jpeg;base64,AAAA';
  const r = await (await post('/api/prescription', { image: img })).json();
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.items.map((x) => [x.found, x.name || x.read, !!x.nti]), [[true, 'Dolo 650 Tablet', false], [true, 'Thyronorm 100mcg Tablet', true], [false, 'Xyzzyl 5', false]], 'duplicates dropped');
  assert.ok(!('jan_aushadhi' in r) && !JSON.stringify(r).includes('mrp'), 'nothing priced before the patient picks');
  assert.match(seen[0], /Do not copy the patient's name/);
  await post('/api/prescription', { image: img });
  const capped = await (await post('/api/prescription', { image: img })).json();
  assert.deepEqual(capped, { status: 'vision_unavailable', reason: 'daily_photo_limit' }, 'prescription reads count towards DAILY_PHOTO_LIMIT');
  assert.equal((await post('/api/prescription', { image: 'not an image' })).status, 413);
  const none = { AI: { run: async () => ({ response: '{"medicines": [], "readable": false}' }) } };
  assert.equal((await (await (await setup(none)).post('/api/prescription', { image: img })).json()).status, 'unreadable');
  void db;
});

test('new texts in every language; the privacy page mentions prescriptions', () => {
  const keys = ['share', 'shareJa', 'shareFooter', 'shareCopied', 'installTitle', 'installBody', 'installBtn', 'installLater', 'rxBtn', 'rxReading', 'rxTitle', 'rxNote', 'rxNotFound', 'rxNone', 'rxBack'];
  for (const l of Object.keys(STRINGS)) for (const k of keys) assert.ok(STRINGS[l][k], `${l}.${k}`);
  const p = readFileSync(new URL('../public/privacy.html', import.meta.url), 'utf8');
  assert.match(p, /prescriptions/);
  assert.doesNotMatch(p, /speech service|Not in stock here/);
});

test('Kendras by distance: PIN centre = median of its post offices (outliers dropped); a PIN code or "Use my location" sorts by km', async () => {
  const { pinPoints, pinSql } = await import('../data/build_pins.mjs');
  const pts = pinPoints([
    { Pincode: '580001', Latitude: '15.45', Longitude: '75.00' },
    { Pincode: '580001', Latitude: '15.46', Longitude: '75.01' },
    { Pincode: '580001', Latitude: '15.44', Longitude: '75.02' },
    { Pincode: '580001', Latitude: '28.60', Longitude: '77.20' }, // a misplaced office (Delhi): dropped
    { Pincode: '580001', Latitude: 'NA', Longitude: 'NA' },
    { Pincode: '999999', Latitude: '0', Longitude: '0' }, // outside India: no point
  ]);
  assert.deepEqual(pts.get('580001'), [15.45, 75.01]);
  assert.equal(pts.has('999999'), false);
  assert.match(pinSql(pts), /UPDATE kendras SET lat = \(SELECT lat FROM pin_locations/);

  const kendras = [
    { code: 'PMBJK00001', name: 'a', address: 'Far', district: 'D', state: 'K', pin: '580020' },
    { code: 'PMBJK00002', name: 'b', address: 'Near', district: 'D', state: 'K', pin: '580009' },
  ];
  const db = fixtureDb({ ja: JA, kendras, meta });
  await db.prepare("INSERT INTO pin_locations (pin, lat, lng) VALUES ('580001', 15.45, 75.01), ('580009', 15.46, 75.02), ('580020', 15.60, 75.30)").run();
  await db.prepare('UPDATE kendras SET lat = (SELECT lat FROM pin_locations WHERE pin = kendras.pin), lng = (SELECT lng FROM pin_locations WHERE pin = kendras.pin)').run();
  const { nearestKendra } = await import('../worker/src/tools.js');
  const byPin = await nearestKendra(db, { pin: '580001' });
  assert.equal(byPin.by, 'nearby-pin');
  assert.deepEqual(byPin.items.map((k) => k.code), ['PMBJK00002', 'PMBJK00001'], 'by distance, not by PIN number (580009 is nearer than 580020 here, as numbers too; the km decide)');
  assert.ok(byPin.items[0].km < 2 && byPin.items[0].approx);
  const { default: worker } = await import('../worker/src/index.js');
  const r = await (await worker.fetch(new Request('https://samasalt.example/api/kendras?lat=15.6012345&lng=75.2998765'), { DB: db }, { waitUntil() {} })).json();
  assert.equal(r.by, 'location');
  assert.equal(r.items[0].code, 'PMBJK00001');
  const bad = await (await worker.fetch(new Request('https://samasalt.example/api/kendras?lat=51.5&lng=-0.1'), { DB: db }, { waitUntil() {} })).json();
  assert.equal(bad.items.length, 0, 'outside India: ignored');
  for (const l of Object.keys(STRINGS)) for (const k of ['useLocation', 'locating', 'locationDenied', 'kmAbout', 'kmUnder1', 'kmApprox']) assert.ok(STRINGS[l][k], `${l}.${k}`);
});
