// 24 Nov 2026 (2.0.14): "C Tax 1gm" failed on live with "too many subrequests": a one-letter first word is
// in hundreds of the name files, and one request may read about 50. The next word is used too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMedFiles, fileMeds } from '../worker/src/medstore.js';
import { fixtureDb } from './d1shim.mjs';
import { identifyMedicine } from '../worker/src/tools.js';

const ROWS = [];
let id = 1;
const add = (name, ckey, form) => ROWS.push({ id: id++, name, manufacturer: 'M', ckey, price: 10, pack: 10, unit_price: 1, form, rel: null, nti: 0, incomplete: 0 });
for (let i = 0; i < 26; i++) for (let k = 0; k < 8; k++) add(`C${String.fromCharCode(97 + i)}${k}medi 5mg Tablet`, 'cetirizine:5mg|tablet', 'tablet');
add('C Tax 1gm Injection', 'cefotaxime:1000mg|injection', 'injection');
add('O2 Tablet', 'ofloxacin:200mg+ornidazole:500mg|tablet', 'tablet');
add('K-Cor 5 Tablet', 'amlodipine:5mg|tablet', 'tablet');

test('a one-letter first word reads few files and finds the same brand, however it is typed', async () => {
  const files = buildMedFiles(ROWS);
  const meta = JSON.parse(files.get('meds/meta.json'));
  for (const [text, name] of [['C Tax 1gm', 'C Tax 1gm Injection'], ['C-Tax 1gm', 'C Tax 1gm Injection'], ['c tax 1 gm injection', 'C Tax 1gm Injection'], ['O2', 'O2 Tablet'], ['K Cor 5', 'K-Cor 5 Tablet']]) {
    let reads = 0;
    const meds = fileMeds(async (p) => { reads++; return files.get(p) ?? null; }, meta);
    const r = await identifyMedicine({ db: fixtureDb({ ja: [], kendras: [], meta: {} }), meds }, { brand: text });
    assert.equal(r.medicine?.name, name, text);
    assert.ok(reads < 30, `${text}: ${reads} files`);
  }
});
