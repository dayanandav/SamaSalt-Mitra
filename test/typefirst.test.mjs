// 2.0.20 (owner, 28 Nov 2026): typing the name comes first on the home screen; a photo is the last option.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STRINGS } from '../public/strings.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const home = html.slice(html.indexOf('<section id="home"'), html.indexOf('</section>', html.indexOf('<section id="home"')));
const at = (s) => { const i = home.indexOf(s); assert.ok(i >= 0, s); return i; };

test('the name box comes before every photo button, and the photo buttons are not the main button', () => {
  const name = at('id="nameInput"');
  for (const id of ['scanBtn', 'homeGallery', 'homeInApp', 'rxBtn']) assert.ok(at(`id="${id}"`) > name, id);
  assert.ok(at('data-t="orPhoto"') > name && at('data-t="orPhoto"') < at('id="scanBtn"'));
  assert.doesNotMatch(home, /class="primary" id="scanBtn"/);
});

test('the texts say it in that order, in every language', () => {
  for (const l of Object.keys(STRINGS)) {
    for (const k of ['typeTitle', 'orPhoto']) assert.ok(STRINGS[l][k], `${l}.${k}`);
  }
  assert.match(STRINGS.en.intro, /^Type the name/);
  assert.match(STRINGS.en.scanTextTip, /name box above/);
});
