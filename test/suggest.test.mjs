// Suggestions while typing (roadmap S1.1): brand names from the static name index, read in the
// phone. Names only (tapping one runs the normal check); a typed strength is never changed; the
// typed text is not sent anywhere (only a name-prefix index file is fetched); the app works offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMedFiles } from '../worker/src/medstore.js';
import { suggestWhileTyping, suggestable, rankNames, words } from '../public/suggest.js';

// The test fixture's brands as the static index (as data/build_meds.mjs writes public/meds/).
const subset = JSON.parse(readFileSync(new URL('./fixtures/med_subset.json', import.meta.url), 'utf8'));
const rows = subset.map(([id, name, manufacturer, , ckey, price, pack, unit_price, form, rel, nti, incomplete]) => ({ id, name, manufacturer, ckey, price, pack, unit_price, form, rel, nti, incomplete }));
const files = new Map(buildMedFiles(rows, { builtAt: 'test', maxShardBytes: 4000 })); // small shards: split levels are used
const fetched = [];
const getJson = async (path) => {
  fetched.push(path);
  const text = files.get(path.replace(/^\//, ''));
  return text == null ? null : JSON.parse(text);
};
const suggest = (q) => suggestWhileTyping(q, { getJson });

test('suggestions: names that start like the typed text, the closest first', async () => {
  const dolo = await suggest('dolo');
  assert.ok(dolo.length > 0 && dolo.length <= 6);
  for (const n of dolo) assert.match(n.toLowerCase(), /^dolo/, n);
  assert.equal((await suggest('Dolo 650'))[0], 'Dolo 650 Tablet');
  assert.equal((await suggest('crocin adv'))[0], 'Crocin Advance Tablet');
  assert.equal((await suggest('augmentin 625'))[0], 'Augmentin 625 Duo Tablet');
});

test('suggestions: a typed strength is never changed; a number being typed may grow', async () => {
  for (const n of await suggest('dolo 650')) assert.ok(words(n).includes('650'), n);
  for (const n of await suggest('dolo 65')) assert.ok(words(n).some((w) => w.startsWith('65')), n);
  // Once the number is followed by more text it is whole: "65 " never offers 650.
  assert.deepEqual(rankNames([[1, 'Dolo 650 Tablet']], 'dolo 65 tab'), []);
  assert.deepEqual(rankNames([[1, 'Dolo 650 Tablet']], 'dolo 650 tab'), ['Dolo 650 Tablet']);
  assert.deepEqual(rankNames([[1, 'Dolo 500 Tablet']], 'dolo 650'), []);
});

test('suggestions: only Latin text of 3+ letters; Kannada/Hindi script and short text ask for nothing', async () => {
  fetched.length = 0;
  for (const q of ['do', 'ಡೋಲೋ 650', 'डोलो', '650', '  ', '<script>']) assert.deepEqual(await suggest(q), [], q);
  assert.equal(fetched.length, 0, 'no index file read');
  assert.equal(suggestable('Dolo 650'), 'dolo 650');
});

test('suggestions: only name-prefix index files are read (the typed text goes nowhere else)', async () => {
  fetched.length = 0;
  await suggest('pantop 40');
  assert.ok(fetched.length > 0 && fetched.length <= 12);
  for (const p of fetched) assert.match(p, /^\/meds\/n\/[0-9a-f]+\.json$/, p);
});

test('suggestions: the app loads the module from the offline shell, and suggestions are names, never prices', () => {
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /'\/suggest\.js'/, 'suggest.js is kept on the phone (the app imports it)');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /from '\/suggest\.js'/);
  const src = readFileSync(new URL('../public/suggest.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /price|mrp|₹/i, 'no price in suggestions');
});
