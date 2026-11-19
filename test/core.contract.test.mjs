// CORE CONTRACT: the design rules SamaSalt-Mitra must never break, in one place.
// These tests guard behaviour across files; they are not about one feature. If one fails, the change
// broke a core rule. Change a test here only when the requirement itself changes, and only with the
// owner's approval (tools/approve-tests.mjs, see docs/TESTING.md "Test lock").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';
import { STRINGS, LANGS, composeAnswer, rupees, t } from '../public/strings.js';
import { keyFor as keyForObj, ntiFromKey, NTI_STEMS } from '../worker/src/normalize.js';
import { runAgent } from '../worker/src/agent.js';
import { asksToSwitch, pharmacistEntry, orderItems, shareText } from '../public/rules.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const LANG_CODES = Object.keys(STRINGS);
const placeholders = (v) => [...new Set(JSON.stringify(v).match(/\{[a-zA-Z_0-9]+\}/g) || [])].sort();

// ---------------------------------------------------------------------------------------------
// 1. Languages: every text exists in English, Kannada and Hindi, with the same {slots}.
// ---------------------------------------------------------------------------------------------

test('core: the app speaks English, Kannada and Hindi', () => {
  assert.deepEqual(LANG_CODES.sort(), ['en', 'hi', 'kn']);
  assert.deepEqual(LANGS.map((l) => l.code ?? l).sort(), ['en', 'hi', 'kn']);
});

test('core: every text exists in every language, of the same kind (no English fallback shown to a Kannada or Hindi user)', () => {
  const en = STRINGS.en;
  for (const l of LANG_CODES) {
    const missing = Object.keys(en).filter((k) => !(k in STRINGS[l]));
    const extra = Object.keys(STRINGS[l]).filter((k) => !(k in en));
    assert.deepEqual(missing, [], `${l}: texts missing`);
    assert.deepEqual(extra, [], `${l}: texts not in English`);
    for (const k of Object.keys(en)) {
      assert.equal(typeof STRINGS[l][k], typeof en[k], `${l}.${k}: different kind of value`);
      if (typeof en[k] === 'string') assert.ok(STRINGS[l][k].trim().length > 0, `${l}.${k}: empty`);
    }
  }
});

test('core: every {slot} (numbers, prices, names) is kept in every language, so no price or count goes missing', () => {
  for (const l of LANG_CODES) {
    for (const k of Object.keys(STRINGS.en)) {
      assert.deepEqual(placeholders(STRINGS[l][k]), placeholders(STRINGS.en[k]), `${l}.${k}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// 2. No dose advice, anywhere in the texts.
// ---------------------------------------------------------------------------------------------

test('core: no text tells anyone what dose to take', () => {
  const dose = /\b(take|give|have)\s+(\d|one|two|three|half)\b|\b(once|twice|thrice|three times|four times) (a|per|every) day\b|\bmg\s*(per|\/)\s*kg\b|\bdose of \d|\bevery \d+\s*hours?\b/i;
  for (const l of LANG_CODES) {
    for (const [k, v] of Object.entries(STRINGS[l])) assert.doesNotMatch(JSON.stringify(v), dose, `${l}.${k}`);
  }
  for (const p of readdirSync(new URL('../.codenow/agent-studio/prompts/', import.meta.url)).filter((f) => f.endsWith('.md'))) {
    const s = read(`.codenow/agent-studio/prompts/${p}`);
    assert.doesNotMatch(s, /\b(recommend|suggest)\w* (a |the )?dose/i, `prompt ${p}`);
  }
});

// ---------------------------------------------------------------------------------------------
// 3. Prices come from the data only (templated answer, never a model).
// ---------------------------------------------------------------------------------------------

const FACTS = {
  brand: 'Dolo 650 Tablet', composition: 'Paracetamol 650 mg', count: 35, cheapBrand: 'Alice 650mg Tablet',
  cheapUnit: 0.33, yourUnit: 2.2847, jaName: 'Paracetamol Tablets IP 650 mg', jaUnit: 1.031, saving: 29.31, pack: 15, form: 'tablet', nti: false,
};

test('core: every rupee amount in the answer is one of the given prices, in every language', () => {
  const allowed = new Set([FACTS.cheapUnit, FACTS.yourUnit, FACTS.jaUnit, FACTS.saving].map((x) => rupees(x)));
  for (const l of LANG_CODES) {
    const a = composeAnswer(l, FACTS);
    const shown = a.match(/₹[\d,]+(\.\d+)?/g) || [];
    assert.ok(shown.length >= 4, `${l}: all four prices shown`);
    for (const p of shown) assert.ok(allowed.has(p), `${l}: ${p} is not from the data`);
  }
});

test('core: every answer ends by sending the patient to their doctor or pharmacist (same line with or without prices)', () => {
  for (const l of LANG_CODES) {
    const last = (s) => s.trim().split(/(?<=[.।])\s+/).pop();
    const a = composeAnswer(l, FACTS);
    const b = composeAnswer(l, { ...FACTS, cheapBrand: null, jaUnit: null, saving: 0, count: 1 });
    assert.equal(last(a), last(b), l);
  }
});

// ---------------------------------------------------------------------------------------------
// 4. Same salt + same strength + same form + same release only.
// ---------------------------------------------------------------------------------------------

test('core: two medicines match only when salt, strength, form and release are all the same', () => {
  const keyFor = (c, o) => keyForObj(c, o).key;
  const base = keyFor('Paracetamol 650 mg', { form: 'tablet' });
  assert.equal(keyFor('Paracetamol 0.65 g', { form: 'tablet' }), base, 'same strength in another unit');
  assert.notEqual(keyFor('Paracetamol 500 mg', { form: 'tablet' }), base, 'strength');
  assert.notEqual(keyFor('Paracetamol 650 mg', { form: 'syrup' }), base, 'form');
  assert.notEqual(keyFor('Ibuprofen 650 mg', { form: 'tablet' }), base, 'salt');
  assert.notEqual(keyFor('Metformin 500 mg', { name: 'Glycomet 500 SR', form: 'tablet' }), keyFor('Metformin 500 mg', { form: 'tablet' }), 'release');
  assert.notEqual(keyFor('Paracetamol 325 mg + Ibuprofen 400 mg', { form: 'tablet' }), keyFor('Paracetamol 325 mg', { form: 'tablet' }), 'a combination is not its part');
});

// ---------------------------------------------------------------------------------------------
// 5. Never-switch (narrow-therapeutic-index) medicines: no switch, no cheaper brand, no generic.
// ---------------------------------------------------------------------------------------------

// Removing a medicine from this list is a safety decision: it needs a doctor's or pharmacist's
// review AND the owner's approval of this test change. Adding to NTI_STEMS is always allowed.
const NEVER_SWITCH = [
  'warfarin', 'acenocoumarol', 'phenytoin', 'fosphenytoin', 'lithium', 'levothyroxine', 'thyroxine',
  'liothyronine', 'cyclosporine', 'ciclosporin', 'digoxin', 'carbamazepine', 'valproic acid', 'valproate',
  'divalproex', 'theophylline', 'aminophylline', 'tacrolimus', 'sirolimus', 'everolimus', 'mycophenolate',
  'clonidine', 'procainamide', 'disopyramide', 'quinidine', 'brivaracetam', 'levetiracetam', 'lamotrigine',
  'lacosamide', 'clobazam', 'clonazepam', 'topiramate', 'oxcarbazepine', 'eslicarbazepine', 'zonisamide',
  'perampanel', 'phenobarbit', 'primidone', 'ethosuximide', 'vigabatrin', 'rufinamide',
];

test('core: the never-switch list only grows', () => {
  for (const s of NEVER_SWITCH) {
    assert.ok(NTI_STEMS.includes(s), `${s} was removed from NTI_STEMS`);
    assert.equal(ntiFromKey(`${s}:10mg|tablet`), true, s);
  }
});

test('core: a never-switch medicine gets the warning only, in every language and on every surface', async () => {
  for (const l of LANG_CODES) {
    const a = composeAnswer(l, { ...FACTS, nti: true });
    assert.doesNotMatch(a, /₹/, `${l}: no price in an NTI answer`);
    assert.ok(a.includes(t(l, 'nti')), `${l}: the NTI warning`);
  }
  const r = await runAgent({ DB: fixtureDb({ ja: [], kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } }), AI: null }, { text: 'Warf 5', lang: 'en' });
  assert.equal(r.medicine.nti, true);
  assert.equal(r.same_salt.items.length, 0, 'no brand list');
  assert.ok(!r.jan_aushadhi?.available || r.jan_aushadhi?.info_only, 'no Jan Aushadhi suggestion');
  assert.equal(asksToSwitch(r), false, 'never asked "did you switch?"');
  assert.equal(pharmacistEntry(r).ja, null, 'the pharmacist list carries no Jan Aushadhi generic');
  assert.equal(orderItems([{ ...r, nti: true, ja: { code: 'X', name: 'X', mrp: 1 } }]).items.length, 0, 'never ordered');
  const share = shareText(r, (k, v) => t('en', k, v), rupees, 'tablet', 'https://x');
  assert.doesNotMatch(share, /₹|MRP/, 'shares the warning only');
});

// ---------------------------------------------------------------------------------------------
// 6. The impact log holds no personal data.
// ---------------------------------------------------------------------------------------------

const PERSONAL = /\b(name|phone|mobile|email|ip|address|lat|lng|latitude|longitude|image|photo_data|text|query|pin|age|gender|aadhaar|whatsapp)\b/i;

test('core: the impact log (lookups) has no column that could hold personal data', () => {
  const create = read('worker/migrations/0001_init.sql').match(/CREATE TABLE IF NOT EXISTS lookups \(([\s\S]*?)\n\);/)[1];
  const cols = create.split('\n').map((x) => x.trim().split(/\s+/)[0]).filter((c) => /^[a-z_0-9]+$/.test(c));
  for (const f of readdirSync(new URL('../worker/migrations/', import.meta.url))) {
    for (const m of read(`worker/migrations/${f}`).matchAll(/ALTER TABLE lookups ADD COLUMN (\w+)/g)) cols.push(m[1]);
  }
  const insert = read('worker/src/index.js').match(/INSERT INTO lookups \(([^)]*)\)/)[1].split(',').map((c) => c.trim());
  for (const c of [...cols, ...insert]) assert.doesNotMatch(c, PERSONAL, `lookups.${c}`);
  assert.ok(cols.includes('pin3') && !cols.includes('pin'), 'only the first 3 PIN digits');
  for (const c of insert) assert.ok(cols.includes(c), `inserted column ${c} is in the schema`);
});

// ---------------------------------------------------------------------------------------------
// 7. Live switches: features that need an outside agreement stay off on the live site.
// ---------------------------------------------------------------------------------------------

test('core: on live, Kendra numbers and orders are pilot-only, the WhatsApp bot and volunteers are off', () => {
  const live = read('worker/wrangler.toml').split(/^\[env\./m)[0];
  const v = (k) => (live.match(new RegExp(`^${k}\\s*=\\s*"([^"]*)"`, 'm')) || [])[1];
  assert.notEqual(v('KENDRA_REGISTRY'), 'public', 'public only after PMBJP agrees');
  assert.notEqual(v('ORDER_REQUESTS'), 'public', 'public only after PMBJP agrees');
  assert.equal(v('WHATSAPP_BOT'), 'off', 'needs the Meta business account');
  assert.equal(v('VOLUNTEER_REGISTRY'), 'off', 'parked');
  assert.ok(Number(v('DAILY_PHOTO_LIMIT')) > 0, 'a daily photo cap is set');
});
