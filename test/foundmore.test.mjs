// 2.0.17: the searches that were missed or only asked (owner's go-ahead 25 Nov 2026). Everything found is an
// exact fit or a choice with its salts; nothing is guessed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { buildMedFiles, fileMeds } from '../worker/src/medstore.js';
import { fitsTyped, saltChoices, soundsLikeChoices, suggestNames } from '../worker/src/tools.js';
import { transliterate, spokenWords, soundGroup } from '../public/indic.js';

const row = (name, ckey, form = 'tablet') => ({ name, ckey, form });

test('V, W and G in a name are not units: another combination never fits', () => {
  assert.equal(fitsTyped('Nebicard 5', row('Nebicard-V Tablet', 'nebivolol:5mg+valsartan:80mg|tablet')), false);
  assert.equal(fitsTyped('Nebicard 5', row('Nebicard 5 Tablet', 'nebivolol:5mg|tablet')), true);
  assert.equal(fitsTyped('Tryptomer 10', row('Tryptomer G 100 mg/10 mg Tablet', 'amitriptyline:10mg+gabapentin:100mg|tablet')), false);
  assert.equal(fitsTyped('Povidone 5% w/v', row('Povidone 5% w/v Solution', 'povidone iodine:5% w/v|liquid', 'liquid')), true, 'w/v is still a unit');
  assert.equal(fitsTyped('Xcream 30 g', row('Xcream 30gm Cream', 'x:1% w/w|topical', 'topical')), true, 'grams still are');
});

test('a flavour is not another medicine; DT is a tablet only when a tablet was typed', () => {
  const ibu = row('Ibugesic Plus Oral Suspension Orange', 'ibuprofen:100mg+paracetamol:162.5mg|liquid', 'liquid');
  assert.equal(fitsTyped('Ibugesic Plus suspension', ibu), true);
  assert.equal(fitsTyped('Ibugesic suspension', ibu), false, 'Plus still counts');
  assert.equal(fitsTyped('Orange', row('Mango Orange Syrup', 'x:1mg|liquid', 'liquid')), false);
  const zifi = row('Zifi 100 DT Tablet', 'cefixime:100mg|tablet');
  assert.equal(fitsTyped('Zifi 100 tablet', zifi), true);
  assert.equal(fitsTyped('Zifi 100', zifi), false, 'no tablet typed: asked');
  assert.equal(fitsTyped('Zifi 100 tablet', row('Zifi-O 100 DT Tablet', 'cefixime:100mg+ofloxacin:100mg|tablet')), false);
});

// TEST FIXTURES ONLY: made-up codes and prices.
const JA = [
  ['T1', 'Amoxycillin 500mg and Potassium Clavulanate 125mg Tablets IP', 'amoxicillin:500mg+clavulanic acid:125mg|tablet'],
  ['T2', 'Amoxycillin 250mg and Potassium Clavulanate 125mg Tablets IP', 'amoxicillin:250mg+clavulanic acid:125mg|tablet'],
  ['T3', 'Ranitidine Oral Solution IP 75mg per 5ml', 'ranitidine:75mg/5ml|liquid'],
  ['T4', 'Ranitidine Tablets IP 150mg', 'ranitidine:150mg|tablet'],
].map(([drug_code, generic_name, ckey]) => ({ drug_code, generic_name, ckey, unit_size: "10's", mrp: 10, units: 10, unit_price: 1 }));
const db = () => fixtureDb({ ja: JA, kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
const names = async (text) => (await saltChoices(db(), text)).map((c) => c.composition);

test('several salts with strengths, and a salt with a form only: the Jan Aushadhi products as choices', async () => {
  assert.deepEqual(await names('Amoxicillin 500 Clavulanic acid 125'), ['Amoxicillin 500 mg + Clavulanic Acid 125 mg · tablet']);
  assert.deepEqual(await names('Amoxicillin 500 Clavulanic acid 125 syrup'), [], 'another form is never offered as this one');
  assert.deepEqual(await names('Amoxicillin 500 Clavulanic acid 200'), [], 'another strength');
  assert.deepEqual(await names('Amoxicillin 500 Paracetamol 125'), [], 'another salt');
  assert.deepEqual(await names('Ranitidine syrup'), ['Ranitidine 75mg/5 ml · liquid']);
  assert.deepEqual(await names('Ranitidine'), [], 'nothing but the salt: not here');
});

const ROWS = [['Glycomet 500 SR Tablet', 'metformin:500mg|tablet|SR'], ['Glycomet 500 Tablet', 'metformin:500mg|tablet'], ['Amlokind 5 Tablet', 'amlodipine:5mg|tablet'], ['Augmentin 625 Duo Tablet', 'amoxicillin:500mg+clavulanic acid:125mg|tablet'], ['Allegra 120mg Tablet', 'fexofenadine:120mg|tablet'], ['PAN 40 Tablet', 'pantoprazole:40mg|tablet']]
  .map(([name, ckey], i) => ({ id: i + 1, name, manufacturer: 'M', ckey, price: 10, pack: 10, unit_price: 1, form: 'tablet', rel: ckey.split('|')[2] || null, nti: 0, incomplete: 0 }));
function ctx() {
  const files = buildMedFiles(ROWS);
  let reads = 0;
  const meds = fileMeds(async (p) => { reads++; return files.get(p) ?? null; }, JSON.parse(files.get('meds/meta.json')));
  return { db: db(), meds, reads: () => reads };
}

test('Kannada and Hindi names are found through the sounds-like index, with few files read', async () => {
  assert.equal(soundGroup('glycomet'), soundGroup(transliterate('ग्लाइकोमेट')));
  assert.equal(spokenWords(transliterate('ग्लाइकोमेट 500 एसआर')).split(' ').at(-1), 'sr');
  assert.equal(spokenWords(transliterate('पैन 40 टैबलेट')).split(' ').at(-1), 'tablet');
  for (const [text, name] of [['ग्लाइकोमेट 500 एसआर', 'Glycomet 500 SR Tablet'], ['ಗ್ಲೈಕೋಮೆಟ್ 500 ಎಸ್ಆರ್', 'Glycomet 500 SR Tablet'], ['एमलोकाइंड 5', 'Amlokind 5 Tablet'], ['ಆಮ್ಲೋಕೈಂಡ್ 5', 'Amlokind 5 Tablet'], ['ऑगमेंटिन 625', 'Augmentin 625 Duo Tablet']]) {
    const c = ctx();
    const r = await soundsLikeChoices(c, spokenWords(transliterate(text)));
    assert.ok(r.some((x) => x.name === name), `${text}: ${r.map((x) => x.name)}`);
    assert.ok(c.reads() < 45, `${text}: ${c.reads()} files`);
  }
  const sr = await soundsLikeChoices(ctx(), spokenWords(transliterate('ग्लाइकोमेट 500 एसआर')));
  assert.ok(!sr.some((x) => x.name === 'Glycomet 500 Tablet'), 'the typed release is kept');
});

test('a doubled letter near the start is only suggested, never answered', async () => {
  assert.ok((await suggestNames(ctx(), 'Alegra 120')).includes('Allegra 120mg Tablet'));
  assert.equal(fitsTyped('Alegra 120', row('Allegra 120mg Tablet', 'fexofenadine:120mg|tablet')), false);
});

test('"पैन 40" offers PAN 40 itself, not only names that sound near', async () => {
  for (const text of ['पैन 40', 'पैन 40 टैबलेट']) {
    const r = await soundsLikeChoices(ctx(), spokenWords(transliterate(text)));
    assert.equal(r[0]?.name, 'PAN 40 Tablet', text);
  }
});
