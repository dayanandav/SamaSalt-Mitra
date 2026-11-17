// v1.3 Registered volunteers: validation, register → approve (two people), modify, remove,
// the personal link, lookups counted by volunteer code only, and who may do what.
// All people and numbers are TEST FIXTURES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVolunteer, volunteerCode, volunteerRequest, volunteerWelcome } from '../public/rules.js';
import { fixtureDb } from './d1shim.mjs';
import { registerVolunteer, listVolunteers, decideVolunteer, updateVolunteer, volunteerHistory, activeVolunteer, volunteerLinkStatus } from '../worker/src/volunteers.js';

const registrar = { username: 'reg.one', name: 'Reg One', role: 'registrar' };
const reviewer = { username: 'rev.one', name: 'Rev One', role: 'reviewer' };
const person = { name: 'Test Volunteer', mobile: '98450 12345', district: 'Dharwad', pin: '580001', organisation: 'Test NGO', languages: 'Kannada, Hindi', consent: true };
const req = { ...person, request_channel: 'phone', request_ref: '17 Nov 2026, phone call', id_seen: 'voter' };
const allChecks = { called: true, id: true, terms: true };

test('volunteer details: required name, mobile, district, consent; optional PIN, organisation, languages', () => {
  const v = validateVolunteer(person);
  assert.equal(v.ok, true);
  assert.deepEqual(v.value, { name: 'Test Volunteer', mobile: '9845012345', district: 'Dharwad', pin: '580001', organisation: 'Test NGO', languages: 'Kannada, Hindi' });
  assert.equal(validateVolunteer({ ...person, name: 'A' }).error, 'vErrName');
  assert.equal(validateVolunteer({ ...person, mobile: '12345' }).error, 'vErrMobile');
  assert.equal(validateVolunteer({ ...person, district: '' }).error, 'vErrDistrict');
  assert.equal(validateVolunteer({ ...person, pin: '12' }).error, 'vErrPin');
  assert.equal(validateVolunteer({ ...person, consent: false }).error, 'vErrConsent');
  assert.equal(validateVolunteer({ ...person, pin: '', organisation: '', languages: '' }).value.pin, null);
  assert.equal(validateVolunteer({ ...person, name: '<b>X</b> Y' }).value.name, 'b X /b Y');
});

test('volunteer code: SV- and 5 characters without 0/O/1/I', () => {
  assert.equal(volunteerCode('sv-ab2cd'), 'SV-AB2CD');
  assert.equal(volunteerCode('SVAB2CD'), 'SV-AB2CD');
  assert.equal(volunteerCode('SV-AB0CD'), null);
  assert.equal(volunteerCode('PMBJK00964'), null);
});

test('request and welcome messages: no ID numbers asked; welcome has the link and the safety rules', () => {
  const r = volunteerRequest({ ...person, mobile: '9845012345' });
  assert.match(r.subject, /Volunteer registration request - Dharwad/);
  assert.match(r.body, /Mobile: 98450 12345/);
  assert.doesNotMatch(r.body, /Aadhaar number|ID number/i);
  const w = volunteerWelcome({ name: 'Test Volunteer', code: 'SV-AB2CD' }, 'https://x.example');
  assert.match(w, /https:\/\/x\.example\/v\/SV-AB2CD/);
  assert.match(w, /never advise on doses/);
  assert.match(w, /same brand only/);
});

test('register → approve by a second person; history logs both; the link becomes active', async () => {
  const db = fixtureDb();
  const r = await registerVolunteer(db, req, registrar);
  assert.equal(r.status, 200);
  const code = r.body.code;
  assert.ok(volunteerCode(code));
  assert.equal(await activeVolunteer(db, code), null, 'waiting: not active');
  assert.deepEqual(await volunteerLinkStatus(db, code), { code, active: false });

  assert.equal((await decideVolunteer(db, { code, action: 'approve', checks: { called: true, id: true }, note: 'Called, ID seen' }, reviewer)).status, 400, 'all three checks');
  assert.equal((await decideVolunteer(db, { code, action: 'approve', checks: allChecks, note: 'ok' }, reviewer)).status, 400, 'a note');
  const a = await decideVolunteer(db, { code, action: 'approve', checks: allChecks, note: 'Called 17 Nov, voter ID seen' }, reviewer);
  assert.equal(a.status, 200);
  assert.equal(await activeVolunteer(db, code.toLowerCase()), code);
  const st = await volunteerLinkStatus(db, code);
  assert.deepEqual(st, { code, active: true });
  assert.equal(Object.keys(st).length, 2, 'the public link check shows no personal details');

  const h = await volunteerHistory(db, code);
  assert.deepEqual(h.map((x) => [x.action, x.admin_username]), [['approve', 'rev.one'], ['register', 'reg.one']]);
  assert.deepEqual(h[0].checks, allChecks);
  const list = await listVolunteers(db, 'approved');
  assert.equal(list.items[0].verified_by, 'Rev One');
  assert.equal(list.items[0].id_seen, 'voter');
  assert.equal(list.counts.approved, 1);
});

test('registration needs the request, an ID type (never its number) and the volunteer\'s agreement; one active registration per mobile', async () => {
  const db = fixtureDb();
  assert.equal((await registerVolunteer(db, { ...req, request_ref: '' }, registrar)).body.error, 'request_ref_required');
  assert.equal((await registerVolunteer(db, { ...req, id_seen: '1234 5678 9012' }, registrar)).body.error, 'id_required');
  assert.equal((await registerVolunteer(db, { ...req, consent: false }, registrar)).body.error, 'vErrConsent');
  assert.equal((await registerVolunteer(db, req, registrar)).status, 200);
  const again = await registerVolunteer(db, { ...req, mobile: '+91 9845012345' }, registrar);
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'vErrTaken');
});

test('modify: logged with before/after; a new mobile sends an approved volunteer back to waiting; remove and search', async () => {
  const db = fixtureDb();
  const { code } = (await registerVolunteer(db, req, registrar)).body;
  await decideVolunteer(db, { code, action: 'approve', checks: allChecks, note: 'Called, ID seen' }, reviewer);
  assert.equal((await updateVolunteer(db, { code, district: 'Hubballi' }, reviewer)).body.error, 'note_required');
  const u = await updateVolunteer(db, { code, district: 'Hubballi', note: 'Moved' }, reviewer);
  assert.deepEqual(u.body.changed, ['district']);
  assert.equal(u.body.status, 'approved');
  assert.equal((await updateVolunteer(db, { code, district: 'Hubballi', note: 'Again' }, reviewer)).body.error, 'unchanged');
  const m = await updateVolunteer(db, { code, mobile: '9845099999', note: 'New phone' }, reviewer);
  assert.equal(m.body.status, 'pending');
  assert.equal(await activeVolunteer(db, code), null, 'new number: call again before the link counts');
  assert.equal((await listVolunteers(db, 'all', 'hubb')).items.length, 1);
  assert.equal((await listVolunteers(db, 'all', '99999')).items.length, 1, 'search by mobile digits');
  assert.equal((await listVolunteers(db, 'all', 'nobody')).items.length, 0);
  const rm = await decideVolunteer(db, { code, action: 'withdraw', note: 'Asked to leave' }, reviewer);
  assert.equal(rm.body.status, 'withdrawn');
  assert.equal((await updateVolunteer(db, { code, district: 'X', note: 'Late' }, reviewer)).body.error, 'not_editable');
  assert.equal((await decideVolunteer(db, { code, action: 'approve', checks: allChecks, note: 'Called again' }, reviewer)).body.error, 'not_pending');
  const h = await volunteerHistory(db, code);
  assert.deepEqual(h.find((x) => x.action === 'edit' && x.changes.mobile).changes.mobile, ['9845012345', '9845099999']);
});

test('Worker: /v/ link, link status, lookups counted only for approved volunteers, roles enforced', async () => {
  const { default: worker } = await import('../worker/src/index.js');
  const db = fixtureDb();
  const env = { DB: db, ADMIN_TOKEN: 'tok', ASSETS: { fetch: () => new Response('asset') } };
  const ctx = { waitUntil() {} };
  const go = (path, init = {}) => worker.fetch(new Request(`https://samasalt.example${path}`, { redirect: 'manual', ...init }), env, ctx);

  // The static-asset layer must hand /v/* to the Worker (else the link is a 404 page).
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../worker/wrangler.toml', import.meta.url), 'utf8'), /run_worker_first = \[[^\]]*"\/v\/\*"/);
  const red = await go('/v/sv-ab2cd');
  assert.equal(red.status, 302);
  assert.equal(red.headers.get('location'), 'https://samasalt.example/?volunteer=SV-AB2CD');

  const { code } = (await registerVolunteer(db, req, registrar)).body;
  await decideVolunteer(db, { code, action: 'approve', checks: allChecks, note: 'Called, ID seen' }, reviewer);
  assert.deepEqual(await (await go(`/api/volunteer/${code}`)).json(), { code, active: true });

  // Staff API: a signed-in registrar can register but not approve.
  const { createAdmin } = await import('../worker/src/admin.js');
  await createAdmin(env, { username: 'reg.two', name: 'Reg Two', password: 'Registrar-pass-1', role: 'registrar' }, { username: 'owner', name: 'System owner', role: 'owner' });
  const login = await go('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'reg.two', password: 'Registrar-pass-1' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const staff = (path, body) => go(`/api/admin${path}`, { method: body ? 'POST' : 'GET', headers: { cookie, 'x-samasalt-admin': '1', 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const reg = await staff('/volunteer/register', { ...req, mobile: '9845077777' });
  assert.equal(reg.status, 200);
  const dec = await staff('/volunteer/decide', { code: (await reg.json()).code, action: 'approve', checks: allChecks, note: 'Self approve' });
  assert.equal(dec.status, 403, 'two people: the registrar cannot approve');
  assert.equal((await (await staff('/volunteer/list?status=all')).json()).items.length, 2);
});
