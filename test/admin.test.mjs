// /admin sign-in and Kendra review: roles, sessions, CSRF guard, lockout, review log.
// Runs the real Worker over node:sqlite. Kendra rows are TEST FIXTURES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { hashPassword, verifyPassword } from '../worker/src/admin.js';
import { registerKendra } from '../worker/src/kendra.js';

const { default: worker } = await import('../worker/src/index.js');
const HOST = 'https://samasalt.example';
const TOKEN = 'owner-secret-token-for-tests';
const ALL = { called: true, details: true, terms: true };

function setup() {
  const env = {
    DB: fixtureDb({ kendras: [{ code: 'PMBJK00964', name: 'x', address: 'Test Road 1', district: 'Dharwad', state: 'Karnataka', pin: '580001' }] }),
    ADMIN_TOKEN: TOKEN,
    KENDRA_REGISTRY: 'pilot',
  };
  // A tiny browser: keeps the session cookie, sends the CSRF header unless told not to.
  const browser = () => {
    let cookie = '';
    return async (path, { body, csrf = true, method } = {}) => {
      const headers = { ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-samasalt-admin': '1' } : {}), ...(body ? { 'content-type': 'application/json' } : {}) };
      const res = await worker.fetch(new Request(HOST + path, { method: method || (body ? 'POST' : 'GET'), headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
      return { status: res.status, body: await res.json(), setCookie: set };
    };
  };
  // A registration already entered (as a registrar would), for the review tests.
  const register = (code = 'PMBJK00964') => registerKendra(env.DB, { code, whatsapp: '9876543210', contact_name: 'Test Pharmacist', role: 'pharmacist', consent: true });
  return { env, browser, register };
}

const DOCS = { allotment: true, licence: true, pharmacist: true, consent: true };
const REQUEST = { code: 'PMBJK00964', whatsapp: '98765 43210', contact_name: 'Test Pharmacist', role: 'pharmacist', hours: '9-9', request_ref: '17 Nov 2026 · Kendra registration request - PMBJK00964', docs: DOCS };

test('registration by staff: registrar enters (documents + email reference required), reviewer approves; roles are kept apart', async () => {
  const { browser } = setup();
  const owner = browser();
  await owner('/api/admin/login', { body: { token: TOKEN } });
  await owner('/api/admin/users/create', { body: { username: 'reg.one', name: 'Registrar One', password: 'a-good-password', role: 'registrar' } });
  await owner('/api/admin/users/create', { body: { username: 'rev.one', name: 'Reviewer One', password: 'a-good-password', role: 'reviewer' } });
  const reg = browser();
  const rev = browser();
  assert.equal((await reg('/api/admin/login', { body: { username: 'reg.one', password: 'a-good-password' } })).body.role, 'registrar');
  await rev('/api/admin/login', { body: { username: 'rev.one', password: 'a-good-password' } });

  // The registrar must give the email reference and tick every document.
  assert.equal((await reg('/api/admin/kendra/register', { body: { ...REQUEST, request_ref: '' } })).body.error, 'request_ref_required');
  assert.equal((await reg('/api/admin/kendra/register', { body: { ...REQUEST, docs: { ...DOCS, licence: false } } })).body.error, 'docs_required');
  const ok = await reg('/api/admin/kendra/register', { body: REQUEST });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.registered_by, 'Registrar One');
  const item = (await reg('/api/admin/kendra/list?status=pending')).body.items[0];
  assert.equal(item.registered_by, 'reg.one');
  assert.match(item.request_ref, /PMBJK00964/);
  assert.deepEqual(JSON.parse(item.docs_checked), DOCS);

  // Registrar cannot approve; reviewer cannot register.
  assert.equal((await reg('/api/admin/kendra/decide', { body: { code: 'PMBJK00964', action: 'approve', note: 'Called, ok', checks: ALL } })).status, 403);
  assert.equal((await rev('/api/admin/kendra/register', { body: REQUEST })).status, 403);
  assert.equal((await rev('/api/admin/kendra/decide', { body: { code: 'PMBJK00964', action: 'approve', note: 'Called, ok', checks: ALL } })).status, 200);
  // Owner can do both; registering over an approved Kendra is refused.
  assert.equal((await owner('/api/admin/kendra/register', { body: REQUEST })).body.error, 'krErrTaken');
});

test('passwords: PBKDF2, salted, verified; wrong password fails', async () => {
  const h = await hashPassword('correct horse battery');
  assert.match(h, /^pbkdf2\$100000\$/);
  assert.notEqual(h, await hashPassword('correct horse battery'), 'a new salt each time');
  assert.equal(await verifyPassword('correct horse battery', h), true);
  assert.equal(await verifyPassword('correct horse batterz', h), false);
  assert.equal(await verifyPassword('x', 'garbage'), false);
});

test('owner signs in with the token: HttpOnly Secure SameSite=Strict cookie scoped to /api/admin', async () => {
  const { browser } = setup();
  const owner = browser();
  assert.equal((await owner('/api/admin/me')).status, 401);
  assert.equal((await owner('/api/admin/login', { body: { token: 'wrong' } })).status, 401);
  const r = await owner('/api/admin/login', { body: { token: TOKEN } });
  assert.equal(r.status, 200);
  assert.match(r.setCookie, /HttpOnly/);
  assert.match(r.setCookie, /Secure/);
  assert.match(r.setCookie, /SameSite=Strict/);
  assert.match(r.setCookie, /Path=\/api\/admin/);
  const me = await owner('/api/admin/me');
  assert.equal(me.body.role, 'owner');
  // Sign out ends the session.
  await owner('/api/admin/logout', { body: {} });
  assert.equal((await owner('/api/admin/me')).status, 401);
});

test('owner creates a reviewer; reviewer signs in, reviews, and cannot manage accounts or import data', async () => {
  const { browser, register } = setup();
  const owner = browser();
  await owner('/api/admin/login', { body: { token: TOKEN } });
  assert.equal((await owner('/api/admin/users/create', { body: { username: 'ab', name: 'X', password: 'longenough1' } })).status, 400, 'username too short');
  assert.equal((await owner('/api/admin/users/create', { body: { username: 'ravi.k', name: 'Ravi K', password: 'short' } })).status, 400, 'weak password');
  assert.equal((await owner('/api/admin/users/create', { body: { username: 'Ravi.K', name: 'Ravi K', password: 'a-good-password' } })).status, 200);
  assert.equal((await owner('/api/admin/users/create', { body: { username: 'ravi.k', name: 'Ravi', password: 'a-good-password' } })).status, 409, 'taken');
  const users = (await owner('/api/admin/users')).body.items;
  assert.equal(users.length, 1);
  assert.equal(users[0].pw_hash, undefined, 'password hashes are never sent to the page');

  const rev = browser();
  assert.equal((await rev('/api/admin/login', { body: { username: 'ravi.k', password: 'wrong-password' } })).status, 401);
  const ok = await rev('/api/admin/login', { body: { username: 'RAVI.K', password: 'a-good-password' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.role, 'reviewer');

  await register();
  const list = await rev('/api/admin/kendra/list?status=pending');
  assert.equal(list.body.items.length, 1);
  // Approving needs all three confirmations and a note.
  assert.equal((await rev('/api/admin/kendra/decide', { body: { code: 'PMBJK00964', action: 'approve', note: 'Called, confirmed', checks: { called: true, details: true } } })).body.error, 'checks_required');
  const appr = await rev('/api/admin/kendra/decide', { body: { code: 'PMBJK00964', action: 'approve', note: 'Called, confirmed', checks: ALL } });
  assert.equal(appr.status, 200);
  assert.equal(appr.body.by, 'Ravi K');
  assert.equal((await rev('/api/admin/kendra/decide', { body: { code: 'PMBJK00964', action: 'approve', note: 'again', checks: ALL } })).status, 409, 'no double approval');
  const approved = (await rev('/api/admin/kendra/list?status=approved')).body.items[0];
  assert.equal(approved.verified_by, 'Ravi K');
  // The review log says who did what.
  await rev('/api/admin/kendra/decide', { body: { code: 'PMBJK00964', action: 'withdraw', note: 'Kendra asked' } });
  const hist = (await rev('/api/admin/kendra/history?code=PMBJK00964')).body.items;
  assert.deepEqual(hist.map((h) => [h.action, h.admin_username]), [['withdraw', 'ravi.k'], ['approve', 'ravi.k']]);
  assert.deepEqual(hist[1].checks, ALL);
  assert.equal(hist[1].whatsapp, '9876543210');

  // Owner-only things are refused.
  for (const p of ['/api/admin/users', '/api/admin/status', '/api/admin/pmbi/context']) assert.equal((await rev(p)).status, 403, p);
  assert.equal((await rev('/api/admin/users/create', { body: { username: 'x.y.z', name: 'X', password: 'a-good-password' } })).status, 403);
});

test('CSRF guard: a cookie-signed write without the x-samasalt-admin header is refused', async () => {
  const { browser, register } = setup();
  const owner = browser();
  await owner('/api/admin/login', { body: { token: TOKEN } });
  await register();
  const r = await owner('/api/admin/kendra/decide', { body: { code: 'PMBJK00964', action: 'reject', note: 'test' }, csrf: false });
  assert.equal(r.status, 403);
  assert.equal((await owner('/api/admin/kendra/list?status=pending')).body.items[0].status, 'pending', 'nothing changed');
});

test('five wrong passwords lock the account; switching it off signs it out at once', async () => {
  const { browser } = setup();
  const owner = browser();
  await owner('/api/admin/login', { body: { token: TOKEN } });
  await owner('/api/admin/users/create', { body: { username: 'asha', name: 'Asha', password: 'a-good-password' } });
  const rev = browser();
  for (let i = 0; i < 5; i++) await rev('/api/admin/login', { body: { username: 'asha', password: 'nope-nope-nope' } });
  const locked = await rev('/api/admin/login', { body: { username: 'asha', password: 'a-good-password' } });
  assert.equal(locked.status, 429, 'even the right password waits out the lock');
  // The owner sets a new password: lock cleared, old sessions ended.
  await owner('/api/admin/users/update', { body: { username: 'asha', password: 'another-good-pass' } });
  assert.equal((await rev('/api/admin/login', { body: { username: 'asha', password: 'another-good-pass' } })).status, 200);
  assert.equal((await rev('/api/admin/me')).status, 200);
  await owner('/api/admin/users/update', { body: { username: 'asha', active: false } });
  assert.equal((await rev('/api/admin/me')).status, 401, 'switched off: signed out at once');
  assert.equal((await rev('/api/admin/login', { body: { username: 'asha', password: 'another-good-pass' } })).status, 401);
});

test('the admin token still works as a Bearer header (developer page, scripts)', async () => {
  const { env } = setup();
  const res = await worker.fetch(new Request(`${HOST}/api/admin/me`, { headers: { authorization: `Bearer ${TOKEN}` } }), env, {});
  assert.equal((await res.json()).role, 'owner');
  const bad = await worker.fetch(new Request(`${HOST}/api/admin/me`, { headers: { authorization: 'Bearer nope' } }), env, {});
  assert.equal(bad.status, 401);
});

test('roles: system owner adds Admins; Admin adds Reviewers and Registrars only; Admin reviews and registers', async () => {
  const { browser, env } = setup();
  const owner = browser();
  await owner('/api/admin/login', { body: { token: TOKEN } });
  assert.deepEqual((await owner('/api/admin/me')).body.can, ['register', 'review', 'staff', 'admins', 'data']);
  assert.equal((await owner('/api/admin/users/create', { body: { username: 'adm.one', name: 'Admin One', password: 'a-good-password', role: 'admin' } })).status, 200);
  assert.equal((await owner('/api/admin/users/create', { body: { username: 'adm.two', name: 'Admin Two', password: 'a-good-password', role: 'admin' } })).status, 200);
  const adm = browser();
  assert.equal((await adm('/api/admin/login', { body: { username: 'adm.one', password: 'a-good-password' } })).body.role, 'admin');
  assert.deepEqual((await adm('/api/admin/me')).body.can, ['register', 'review', 'staff']);
  // Admin: adds a Registrar and a Reviewer, but not another Admin, and cannot touch an Admin account.
  assert.equal((await adm('/api/admin/users/create', { body: { username: 'reg.two', name: 'Registrar Two', password: 'a-good-password', role: 'registrar' } })).status, 200);
  assert.equal((await adm('/api/admin/users/create', { body: { username: 'rev.two', name: 'Reviewer Two', password: 'a-good-password', role: 'reviewer' } })).status, 200);
  assert.equal((await adm('/api/admin/users/create', { body: { username: 'adm.three', name: 'X', password: 'a-good-password', role: 'admin' } })).status, 403);
  assert.equal((await adm('/api/admin/users/update', { body: { username: 'adm.two', active: false } })).status, 403);
  assert.equal((await adm('/api/admin/users/update', { body: { username: 'reg.two', password: 'another-good-pass' } })).status, 200);
  for (const p of ['/api/admin/status', '/api/admin/pmbi/context']) assert.equal((await adm(p)).status, 403, p);
  // Admin can register and approve.
  assert.equal((await adm('/api/admin/kendra/register', { body: REQUEST })).status, 200);
  assert.equal((await adm('/api/admin/kendra/decide', { body: { code: 'PMBJK00964', action: 'approve', note: 'Called, ok', checks: ALL } })).status, 200);
  // Registrar and Reviewer cannot manage accounts.
  const reg = browser();
  await reg('/api/admin/login', { body: { username: 'reg.two', password: 'another-good-pass' } });
  assert.deepEqual((await reg('/api/admin/me')).body.can, ['register']);
  assert.equal((await reg('/api/admin/users')).status, 403);
  // An account made with the old 'owner' role signs in as an Admin.
  await env.DB.prepare("UPDATE admins SET role = 'owner' WHERE username = 'adm.two'").run();
  const old = browser();
  assert.equal((await old('/api/admin/login', { body: { username: 'adm.two', password: 'a-good-password' } })).body.role, 'admin');
});

test('modify a registration: Reviewer/Admin only, reason required, logged; a new number on an approved Kendra goes back to waiting', async () => {
  const { browser } = setup();
  const owner = browser();
  await owner('/api/admin/login', { body: { token: TOKEN } });
  await owner('/api/admin/users/create', { body: { username: 'reg.one', name: 'Registrar One', password: 'a-good-password', role: 'registrar' } });
  await owner('/api/admin/users/create', { body: { username: 'rev.one', name: 'Reviewer One', password: 'a-good-password', role: 'reviewer' } });
  const reg = browser();
  const rev = browser();
  await reg('/api/admin/login', { body: { username: 'reg.one', password: 'a-good-password' } });
  await rev('/api/admin/login', { body: { username: 'rev.one', password: 'a-good-password' } });
  // Registered in person: the channel is kept.
  const inPerson = await reg('/api/admin/kendra/register', { body: { ...REQUEST, request_channel: 'in_person', request_ref: '17 Nov 2026 · owner came, Aadhaar seen' } });
  assert.equal(inPerson.status, 200);
  assert.equal((await rev('/api/admin/kendra/list?status=pending')).body.items[0].request_channel, 'in_person');

  const edit = (who, body) => who('/api/admin/kendra/update', { body: { code: 'PMBJK00964', ...body } });
  assert.equal((await edit(reg, { hours: '8-8', note: 'Kendra asked' })).status, 403, 'a Registrar cannot modify');
  assert.equal((await edit(rev, { hours: '8-8', note: '' })).body.error, 'note_required');
  assert.equal((await edit(rev, { whatsapp: '12345', note: 'typo' })).body.error, 'krErrWhatsapp');
  const e1 = await edit(rev, { hours: '8 am to 8 pm', note: 'Kendra emailed new hours' });
  assert.equal(e1.status, 200);
  assert.deepEqual(e1.body.changed, ['hours']);
  assert.equal(e1.body.status, 'pending');
  assert.equal((await edit(rev, { hours: '8 am to 8 pm', note: 'again' })).status, 409, 'nothing changed');

  await rev('/api/admin/kendra/decide', { body: { code: 'PMBJK00964', action: 'approve', note: 'Called, ok', checks: ALL } });
  // Approved: an hours change keeps it approved; a new number sends it back to waiting.
  assert.equal((await edit(rev, { hours: '9 am to 9 pm', note: 'New hours' })).body.status, 'approved');
  const e2 = await edit(rev, { whatsapp: '91234 56789', note: 'Kendra emailed a new number' });
  assert.equal(e2.body.status, 'pending');
  const item = (await rev('/api/admin/kendra/list?status=pending')).body.items[0];
  assert.equal(item.whatsapp, '9123456789');
  assert.equal(item.verified_by, null, 'the old approval no longer counts');
  const hist = (await rev('/api/admin/kendra/history?code=PMBJK00964')).body.items;
  assert.equal(hist[0].action, 'edit');
  assert.deepEqual(hist[0].changes, { whatsapp: ['9876543210', '9123456789'] });
  assert.equal(hist[0].to_status, 'pending');
  // Rejected registrations are not modified (the registrar enters a new one).
  await rev('/api/admin/kendra/decide', { body: { code: 'PMBJK00964', action: 'reject', note: 'No answer' } });
  assert.equal((await edit(rev, { hours: '10-6', note: 'x y z' })).body.error, 'not_editable');
});
