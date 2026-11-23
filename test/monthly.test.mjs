// P1 My monthly medicines (owner's decision 23 Nov 2026, lighter version): one switch on the
// pharmacist list keeps it on the phone for next month (off by default). The saving is for the
// Jan Aushadhi packs in the list, per tablet, prices only from our data; never-switch medicines
// are never counted. The server only counts lists kept / opened again (numbers, no list, no test traffic).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';
import { pharmacistEntry, monthlySaving, keptMedList } from '../public/rules.js';
import { t } from '../public/strings.js';

// Real rows from the data (23 Nov 2026): Glycomet 500 strip of 10 ₹18.70 → JA code 145, 10's ₹6.81;
// Telma 40 pack of 30 ₹245.95 → JA code 300, 10's ₹12.38; Thyronorm 50 (never-switch) → JA code 1221.
const answer = (name, ckey, unit, ja, nti = false) => ({
  status: 'ok',
  medicine: { name, ckey, composition: ckey, form: 'tablet', unit_price: unit, nti },
  jan_aushadhi: { available: true, nti, product: { generic_name: ja.name, drug_code: ja.code, unit_size: "10's", mrp: ja.mrp, units: ja.units } },
});
const gly = pharmacistEntry(answer('Glycomet Tablet', 'metformin:500mg|tablet', 1.87, { name: 'Metformin 500', code: '145', mrp: 6.81, units: 10 }));
const telma = pharmacistEntry(answer('Telma 40 Tablet', 'telmisartan:40mg|tablet', 8.1983, { name: 'Telmisartan 40', code: '300', mrp: 12.38, units: 10 }));
const thyro = pharmacistEntry(answer('Thyronorm 50mcg Tablet', 'thyroxine:0.05mg|tablet', 1.2187, { name: 'Thyroxine 50', code: '1221', mrp: 55.65, units: 100 }, true));

test('the saving is for the Jan Aushadhi packs in the list, per tablet; never-switch is never counted', () => {
  assert.equal(thyro.brandUnit, undefined, 'no prices kept for a never-switch medicine');
  assert.equal(thyro.jaUnits, undefined);
  assert.equal(thyro.ja.mrp, null);
  // 6 strips of Metformin, 3 strips of Telmisartan (= the 30 tablets of one Telma pack).
  const s = monthlySaving([{ ...gly, qty: 6 }, { ...telma, qty: 3 }, { ...thyro, qty: 1 }]);
  assert.equal(s.counted, 2);
  assert.equal(s.left, 1, 'the never-switch medicine is left out');
  assert.ok(Math.abs(s.month - 280.15) < 0.02, String(s.month)); // 112.20 + 245.95 − 40.86 − 37.14
  assert.equal(s.year, Math.round(s.month * 12 * 100) / 100);
  // Packs are 1..10 like an order; nothing counted → no saving shown.
  assert.equal(monthlySaving([{ ...gly, qty: 99 }]).month, monthlySaving([{ ...gly, qty: 10 }]).month);
  assert.equal(monthlySaving([{ ...thyro, qty: 2 }]), null);
  assert.equal(monthlySaving([{ ...gly, ja: { ...gly.ja, mrp: null } }]), null, 'no Jan Aushadhi price → not counted');
  assert.equal(monthlySaving([{ ...gly, brandUnit: undefined }]), null, 'no brand price → not counted');
  assert.equal(monthlySaving([{ ...gly, brandUnit: 0.5 }]), null, 'never a negative "saving"');
  assert.equal(monthlySaving('junk'), null);
});

test('a kept list read back from the phone keeps only real entries, at most 15', () => {
  assert.deepEqual(keptMedList('junk'), []);
  assert.deepEqual(keptMedList([null, 5, { ckey: '' }, { ckey: 'a' }, { ckey: 'b', name: 'B' }]).map((x) => x.ckey), ['b']);
  assert.equal(keptMedList(Array.from({ length: 30 }, (_, i) => ({ ckey: `k${i}`, name: 'x' }))).length, 15);
  // Unlike the visit list, a kept list has no age limit (it is for next month).
  assert.equal(keptMedList([{ ckey: 'old', name: 'Old', at: 0 }]).length, 1);
});

test('the server only counts lists kept / opened again: numbers per month, never test traffic', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb({ ja: [], kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
  const env = { DB: db, AI: null };
  const call = (path, init) => worker.fetch(new Request(`https://samasalt.example${path}`, init), env, { waitUntil() {} });
  const post = (body, headers = {}) => call('/api/monthly', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await (await post({ event: 'kept' })).json()).counted, true);
  await post({ event: 'kept' });
  await post({ event: 'opened' });
  assert.equal((await (await post({ event: 'kept', test: true })).json()).counted, false);
  await post({ event: 'kept' }, { 'x-samasalt-mitra-test': '1' });
  assert.equal((await post({ event: 'list', items: ['Glycomet'] })).status, 400, 'only the two fixed words');
  const imp = await (await call('/api/impact')).json();
  assert.deepEqual(imp.monthly_lists, { kept: 2, opened: 1 });
  const rows = (await db.prepare("SELECT key, value FROM meta WHERE key LIKE 'monthly_%'").all()).results;
  for (const r of rows) assert.match(r.key, /^monthly_(kept|opened)_\d{4}-\d{2}$/, 'a counter only');
  const health = await (await call('/api/health')).json();
  assert.ok(!Object.keys(health.meta || {}).some((k) => k.startsWith('monthly_')), 'counters are not data-status entries');
});

test('the switch is off by default, the texts exist in every language, the list never goes to the server', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /const kept = \(\) => store\.get\(KEEP\) != null/, 'kept only after the patient turns it on');
  assert.match(app, /JSON\.stringify\(\{ event \}\)/, 'only the event word is sent');
  assert.match(readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'), /id="keepSwitch"/);
  for (const l of ['en', 'kn', 'hi']) {
    for (const k of ['keepList', 'keepOff', 'keepOn', 'monthlyPacks', 'monthlyLeft', 'monthlyNote', 'toastKept', 'toastUnkept']) assert.ok(t(l, k), `${l}.${k}`);
    assert.match(t(l, 'monthlyBtn', { n: 3 }), /3/);
    const s = t(l, 'monthlySave', { month: '₹280', year: '₹3,362' });
    assert.ok(s.includes('₹280') && s.includes('₹3,362'), `${l}.monthlySave`);
  }
});
