// 2.0.21 (owner, 28 Nov 2026): on a phone the home screen fits about one screen; typing stays first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('phones: the intro and the long tips are left out, the photo buttons are a 2x2 grid after the name box', () => {
  const phone = css.slice(css.indexOf('@media (max-width: 480px) {\n  .home .lede'));
  assert.ok(phone.length > 0, 'the phone rules exist');
  assert.match(phone, /\.home \.lede, \.home \.scan-text-tip, \.home \[data-t="pinHint"\], \.home \.photo-area \.scan-title \{ display: none; \}/);
  assert.match(phone, /\.photo-area \{ display: grid; grid-template-columns: 1fr 1fr;/);
  const area = html.indexOf('<div class="photo-area">');
  assert.ok(area > html.indexOf('id="nameInput"'), 'the photo area comes after the name box');
  for (const id of ['scanBtn', 'homeGallery', 'homeInApp', 'rxBtn']) assert.ok(html.indexOf(`id="${id}"`) > area, id);
});
