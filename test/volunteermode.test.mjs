// 2.0.16: "Volunteer mode is on" stayed for ever once a volunteer link was opened, also while volunteers are
// paused. It is for the visit only, and only while volunteers are on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('volunteer mode is never remembered in the browser, and off until /api/health says volunteers are on', () => {
  assert.doesNotMatch(app, /store\.get\('ss_vol/, 'not read from localStorage');
  assert.equal((app.match(/store\.set\('ss_vol(_code)?', null\)/g) || []).length, 2, 'what old builds kept is removed');
  assert.equal((app.match(/store\.set\('ss_vol/g) || []).length, 2, 'nothing new is kept');
  assert.match(app, /let volunteer = false;/);
  assert.match(app, /if \(volAsked && h\.volunteer_registry === 'on'\) \{ volunteer = true; applyStrings\(\); \}/);
  assert.match(app, /\$\('#volBanner'\)\.hidden = !volunteer;/);
  assert.match(app, /mode: volunteer \? 'volunteer' : 'self'/, 'a check is counted as helped only in that mode');
  assert.match(app, /volunteer: \(volunteer && volCode\) \|\| undefined/);
});
