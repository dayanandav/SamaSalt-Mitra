// Kannada and Hindi names without the AI model (roadmap S2.5, public/indic.js): a fixed letter table
// to English letters; an exact fit is answered; otherwise brands that sound alike are offered as
// choices with their salts, never picked; the typed number must still be the name's or the strength.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { transliterate, hasIndic, soundsAlike, namePrefixes, soundKey } from '../public/indic.js';
import { soundsLikeChoices } from '../worker/src/tools.js';
import { runAgent } from '../worker/src/agent.js';

test('transliteration: Kannada and Devanagari letters and digits to English letters', () => {
  assert.equal(transliterate('ಡೋಲೋ 650'), 'dolo 650');
  assert.equal(transliterate('डोलो 650'), 'dolo 650');
  assert.equal(transliterate('ಅಟೋರ್ವಾ ೧೦'), 'atorvaa 10', 'Kannada digits');
  assert.equal(transliterate('एटोर्वा १०'), 'etorvaa 10', 'Devanagari digits');
  assert.equal(transliterate('मेटफॉर्मिन'), 'metphormin', 'Hindi drops the inherent a inside a word');
  assert.equal(transliterate('पैन'), 'pain', 'and at the end of a word');
  assert.equal(transliterate('ಕ್ರೋಸಿನ್'), 'krosin');
  assert.equal(transliterate('Dolo 650'), 'dolo 650');
  assert.equal(hasIndic('ಡೋಲೋ'), true);
  assert.equal(hasIndic('Dolo'), false);
});

test('sounds alike: script spellings meet brand spellings; different names do not', () => {
  for (const [a, b] of [['metphormin', 'Metformin'], ['pairaasitaamol', 'Paracetamol'], ['thaironaarm', 'Thyronorm'], ['glaaikomet', 'Glycomet'], ['sitrijin', 'Cetirizine'], ['etorvaa', 'Atorva'], ['krosin', 'Crocin'], ['amoksiisilin', 'Amoxicillin']]) {
    assert.ok(soundsAlike(a, b), `${a} ~ ${b}`);
  }
  for (const [a, b] of [['pairaasitaamol', 'Pantocid'], ['dolo', 'Calpol'], ['telmaa', 'Atorva'], ['krosin', 'Dolo']]) assert.ok(!soundsAlike(a, b), `${a} !~ ${b}`);
  assert.equal(soundKey('Crocin'), soundKey('krosin'));
  for (const [w, p] of [['telmaa', 'telm'], ['etorvaa', 'ator'], ['sitrijin', 'cet'], ['thaironaarm', 'thy'], ['amoksiisilin', 'amox']]) assert.ok(namePrefixes(w).includes(p), `${w}: reads ${p}`);
});

// Real brand names from the test fixture (test/fixtures/med_subset.json).
const db = () => fixtureDb({ ja: [], kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });

test('an exact fit after transliteration is answered, without the model', async () => {
  for (const q of ['डोलो 650', 'ಡೋಲೋ 650']) {
    const r = await runAgent({ DB: db(), AI: null }, { text: q, lang: 'hi' });
    assert.equal(r.status, 'ok', q);
    assert.equal(r.medicine.name, 'Dolo 650 Tablet', q);
    assert.ok(!r.trace.some((s) => s.tool === 'understand_text'), `${q}: no model`);
  }
});

test('sounds alike: choices with their salts, never an answer; the typed number is kept', async () => {
  const r = await runAgent({ DB: db(), AI: null }, { text: 'थायरोनॉर्म 25', lang: 'hi' });
  assert.equal(r.status, 'not_found');
  assert.equal(r.medicine, undefined, 'never answered from a transliteration');
  assert.deepEqual(r.choices.map((c) => c.name), ['Thyronorm 25mcg Tablet'], 'only the 25 mcg strength');
  assert.equal(r.choices[0].composition, 'Thyroxine 25 mcg · tablet');
  const telma = await soundsLikeChoices(db(), transliterate('टेल्मा 40'));
  assert.equal(telma[0].name, 'Telma 40 Tablet');
  for (const c of telma) assert.match(c.composition, /Telmisartan 40 mg/, c.name);
  const glycomet = await soundsLikeChoices(db(), transliterate('ग्लाइकोमेट 850'));
  assert.ok(glycomet.some((c) => c.name === 'Glycomet 850 Tablet'));
  for (const c of glycomet) assert.match(c.composition, /850 mg/, c.name);
});
