// S3.11 (owner's go-ahead 23 Nov 2026): a salt and strength typed in English letters that no brand
// or Jan Aushadhi name fits ("Tramadol 50 mg", "Pramipexole 0.25 mg") gets the real medicines with
// that salt and strength as choices: never an answer, never another strength; form and release are
// never guessed (each variant is offered); Jan Aushadhi products first, also those with no brand in
// our list; every choice's name checks exactly the composition shown when tapped.
// S3.10: the photo tip says what to photograph, right under "Take a photo"; after a second photo not
// read in a visit, typing the name is offered first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDb } from './d1shim.mjs';
import { runAgent } from '../worker/src/agent.js';
import { t } from '../public/strings.js';

// A Jan Aushadhi product whose salt name has an extra word and no brand in the list (as on PMBI's list).
const JA = [
  { drug_code: '2190', generic_name: 'Pramipexole Dihydrochloride Tablets 0.25mg', unit_size: "10's", mrp: 20.5, group_name: 'CNS', ckey: 'pramipexole dihydrochloride:0.25mg|tablet', units: 10, unit_price: 2.05 },
  // Two products whose names differ only by "Tablets" / "capsules" (PMBI codes 291 and 1707).
  { drug_code: '291', generic_name: 'Metoprolol Extended release Tablets IP 50mg', unit_size: "10's", mrp: 15.2, group_name: 'CVS', ckey: 'metoprolol:50mg|tablet|XR', units: 10, unit_price: 1.52 },
  { drug_code: '1707', generic_name: 'Metoprolol Succinate extended release capsules IP 50mg', unit_size: "10's", mrp: 18.9, group_name: 'CVS', ckey: 'metoprolol succinate:50mg|capsule|XR', units: 10, unit_price: 1.89 },
];
const db = () => fixtureDb({ ja: JA, kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
const ask = (DB, text) => runAgent({ DB, AI: null }, { text, lang: 'en' });

test('a typed salt + strength gets every real form as a choice, never an answer, never another strength', async () => {
  const DB = db();
  const r = await ask(DB, 'Piroxicam 20 mg');
  assert.equal(r.status, 'not_found', 'never answered by itself');
  const comps = r.choices.map((c) => c.composition);
  assert.deepEqual(comps, ['Piroxicam 20 mg · tablet', 'Piroxicam 20 mg · capsule', 'Piroxicam 20 mg · injection'], 'every form, tablets and capsules first');
  // Each choice, tapped, checks exactly the composition shown.
  for (const c of r.choices) {
    const tapped = await ask(DB, c.name);
    assert.equal(tapped.status, 'ok', c.name);
    assert.equal(tapped.medicine.composition, c.composition, c.name);
  }
  // A strength nobody makes is never replaced by another one.
  const odd = await ask(DB, 'Piroxicam 25 mg');
  assert.notEqual(odd.status, 'ok');
  assert.ok(!odd.choices || odd.choices.every((c) => c.composition.startsWith('Piroxicam 25 mg')));
  // A typed form keeps only that form.
  assert.deepEqual((await ask(DB, 'Piroxicam 20 mg capsule')).choices.map((c) => c.composition), ['Piroxicam 20 mg · capsule']);
});

test('release is never guessed: plain and extended release are both offered; a typed release narrows it', async () => {
  const DB = db();
  const all = (await ask(DB, 'Aceclofenac 200 mg')).choices.map((c) => c.composition);
  assert.ok(all.includes('Aceclofenac 200 mg · tablet') && all.includes('Aceclofenac 200 mg · tablet · SR'), all.join(' | '));
  assert.ok(all.indexOf('Aceclofenac 200 mg · tablet') < all.indexOf('Aceclofenac 200 mg · tablet · SR'), 'plain first');
  const sr = (await ask(DB, 'Aceclofenac 200 SR')).choices.map((c) => c.composition);
  assert.deepEqual([...new Set(sr)], ['Aceclofenac 200 mg · tablet · SR']);
});

test('Jan Aushadhi products with no brand in our list are offered first, and tapping one answers it', async () => {
  const DB = db();
  const r = await ask(DB, 'Pramipexole 0.25 mg');
  assert.equal(r.status, 'not_found');
  assert.equal(r.choices[0].name, 'Pramipexole Dihydrochloride Tablets 0.25mg');
  const tapped = await ask(DB, r.choices[0].name);
  assert.equal(tapped.status, 'ok');
  assert.equal(tapped.jan_aushadhi.product.drug_code, '2190');
  // Names that differ only by "Tablets" / "capsules": the typed form decides; each choice answers itself.
  const met = await ask(DB, 'Metoprolol 50 XR');
  for (const name of ['Metoprolol Extended release Tablets IP 50mg', 'Metoprolol Succinate extended release capsules IP 50mg']) {
    const c = met.choices.find((x) => x.name === name);
    assert.ok(c, `${name} offered`);
    assert.equal((await ask(DB, name)).medicine.composition, c.composition, name);
  }
  // mcg typed: the key's mg (0.1 mg = 100 mcg), still the typed strength only.
  const mcg = await ask(DB, 'Thyroxine 100 mcg');
  assert.ok(mcg.status === 'ok' || mcg.choices?.length, 'found or offered');
  if (mcg.choices) assert.ok(mcg.choices.every((c) => /Thyroxine 100 mcg/.test(c.composition)), mcg.choices.map((c) => c.composition).join(' | '));
});

test('brand names and junk are unchanged by salt choices', async () => {
  const DB = db();
  assert.equal((await ask(DB, 'Dolo 650')).medicine.name, 'Dolo 650 Tablet');
  const junk = await ask(DB, 'Xyzabc 500');
  assert.equal(junk.choices, undefined);
  assert.notEqual(junk.status, 'ok');
});

test('photo tip: what to photograph, under the button; after two photos not read, typing comes first', () => {
  for (const l of ['en', 'kn', 'hi']) {
    for (const k of ['scanHint', 'camTitle', 'readNoComposition']) assert.match(t(l, k), /Each tablet contains/, `${l}.${k}`);
    assert.ok(t(l, 'photoTypeTip'), `${l}.photoTypeTip`);
  }
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<span data-t="takePhoto">Take a photo<\/span>\s*<\/button>\s*<!--[^>]*-->\s*<p class="hint scan-tip" data-t="scanHint">/, 'the tip sits right under Take a photo');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /unreadTwice\(\)\s*\/\/[^\n]*\n\s*\? `<p class="read-why">\$\{esc\(t\(lang, 'photoTypeTip'\)\)\}<\/p><div class="crop-actions" style="margin-top:14px"><button class="primary" id="typeBtn"/);
  assert.match(readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8'), /\.home \.hint:not\(\.scan-tip\)/, 'kept on small screens');
});
