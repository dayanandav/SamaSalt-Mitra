// Admin sign-in for /admin (Kendra registration review) and the developer pages.
//
// One sign-in (username + password); the account's role decides what the person can do:
//  - admin     : adds, switches off and resets Reviewer and Registrar accounts; reviews; registers.
//  - reviewer  : approves, rejects, withdraws and modifies registrations.
//  - registrar : registers Kendras from a request received by email or in person.
// The ADMIN_TOKEN secret ("setup key") signs in the system owner: everything, incl. adding
// Admins and data import. It is also accepted as a Bearer header (scripts, /dev).
// A session is a random cookie (HttpOnly, Secure, SameSite=Strict, Path=/api/admin, 8 hours);
// only its SHA-256 is stored. Cookie-authenticated writes must also send the header
// "x-samasalt-admin: 1", which another site cannot add (no CORS), as a second CSRF guard.

const enc = new TextEncoder();
const SESSION_HOURS = 8;
const PBKDF2_ITERATIONS = 100_000; // the Workers runtime's maximum
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
export const COOKIE = 'ss_admin';

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const sha256hex = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

function sameBytes(a, b) {
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(await pbkdf2(password, salt, PBKDF2_ITERATIONS))}`;
}

export async function verifyPassword(password, stored) {
  const [kind, it, salt, hash] = String(stored || '').split('$');
  if (kind !== 'pbkdf2' || !it || !salt || !hash) return false;
  return sameBytes(await pbkdf2(password, unb64(salt), +it), unb64(hash));
}

async function tokenMatches(got, secret) {
  if (!got || !secret) return false;
  const [a, b] = await Promise.all([got, secret].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  return sameBytes(a, b);
}

function cookieValue(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

export const normUsername = (s) => String(s ?? '').trim().toLowerCase();
const validUsername = (u) => /^[a-z0-9._-]{3,32}$/.test(u) && u !== 'owner';

export const ROLES = ['admin', 'reviewer', 'registrar'];
// What each role may do. 'owner' is the setup-key holder.
const PERMS = {
  register: ['registrar', 'admin', 'owner'], // enter a Kendra's request
  review: ['reviewer', 'admin', 'owner'], // approve, reject, withdraw, modify
  staff: ['admin', 'owner'], // add / switch off / reset Reviewer and Registrar accounts
  admins: ['owner'], // add / manage Admin accounts
  data: ['owner'], // data import, status
};
export const can = (who, what) => !!who && (PERMS[what] || []).includes(who.role);
export const permissions = (who) => Object.keys(PERMS).filter((p) => can(who, p));
// Accounts made with the old 'owner' role are Admins.
const roleOf = (username, role) => (role === 'owner' && username !== 'owner' ? 'admin' : role);

/**
 * Who is calling: { username, name, role, via } or null.
 * Bearer ADMIN_TOKEN → owner. Session cookie → that session's admin (if still active).
 */
export async function whoIs(request, env, now = new Date()) {
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (bearer && (await tokenMatches(bearer, env.ADMIN_TOKEN))) return { username: 'owner', name: 'System owner', role: 'owner', via: 'token' };
  const cookie = cookieValue(request, COOKIE);
  if (!cookie || !/^[0-9a-f]{64}$/.test(cookie)) return null;
  const s = await env.DB.prepare(
    `SELECT s.username, s.name, s.role, a.active FROM admin_sessions s LEFT JOIN admins a ON a.username = s.username
     WHERE s.token_hash = ?1 AND s.expires_at > ?2`
  ).bind(await sha256hex(cookie), now.toISOString()).first();
  if (!s) return null;
  if (s.username !== 'owner' && s.active !== 1) return null; // account switched off: sessions stop at once
  return { username: s.username, name: s.name, role: roleOf(s.username, s.role), via: 'session' };
}

/** A cookie-authenticated write must carry x-samasalt-admin: 1 (CSRF guard). */
export function csrfOk(request, who) {
  if (who.via === 'token' || ['GET', 'HEAD'].includes(request.method)) return true;
  return request.headers.get('x-samasalt-admin') === '1';
}

function sessionCookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

async function startSession(env, who, now) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(now.getTime() + SESSION_HOURS * 3600_000).toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?1').bind(now.toISOString()),
    env.DB.prepare('INSERT INTO admin_sessions (token_hash, username, role, name, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(await sha256hex(token), who.username, who.role, who.name, now.toISOString(), expires),
  ]);
  return { cookie: sessionCookie(token, SESSION_HOURS * 3600), expires };
}

/**
 * Sign in with { username, password } (reviewer/owner account) or { token } (ADMIN_TOKEN).
 * Returns { status, body, cookie? }. Wrong passwords count; 5 in a row lock the account 15 min.
 */
export async function login(env, body, now = new Date()) {
  const fail = { status: 401, body: { error: 'bad_login', detail: 'Wrong username or password.' } };
  if (body?.token) {
    if (!env.ADMIN_TOKEN) return { status: 503, body: { error: 'admin_disabled', detail: 'The ADMIN_TOKEN secret is not set.' } };
    if (!(await tokenMatches(String(body.token), env.ADMIN_TOKEN))) return { status: 401, body: { error: 'bad_login', detail: 'Wrong setup key.' } };
    const who = { username: 'owner', name: 'System owner', role: 'owner' };
    const s = await startSession(env, who, now);
    return { status: 200, body: { ok: true, ...who, expires: s.expires }, cookie: s.cookie };
  }
  const username = normUsername(body?.username);
  const password = String(body?.password ?? '');
  if (!validUsername(username) || !password) return fail;
  const a = await env.DB.prepare('SELECT * FROM admins WHERE username = ?1').bind(username).first();
  if (!a || a.active !== 1) {
    await verifyPassword(password, 'pbkdf2$1000$AAAAAAAAAAAAAAAAAAAAAA==$AAAA'); // similar time for unknown users
    return fail;
  }
  if (a.locked_until && a.locked_until > now.toISOString()) {
    return { status: 429, body: { error: 'locked', detail: `Too many wrong passwords. Try again after ${new Date(a.locked_until).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}.` } };
  }
  if (!(await verifyPassword(password, a.pw_hash))) {
    const fails = (a.failed_count || 0) + 1;
    const lock = fails >= MAX_FAILS ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() : null;
    await env.DB.prepare('UPDATE admins SET failed_count = ?2, locked_until = ?3 WHERE username = ?1').bind(username, lock ? 0 : fails, lock).run();
    return fail;
  }
  await env.DB.prepare('UPDATE admins SET failed_count = 0, locked_until = NULL, last_login_at = ?2 WHERE username = ?1').bind(username, now.toISOString()).run();
  const who = { username, name: a.name, role: roleOf(username, a.role) };
  const s = await startSession(env, who, now);
  return { status: 200, body: { ok: true, ...who, expires: s.expires }, cookie: s.cookie };
}

export async function logout(request, env) {
  const cookie = cookieValue(request, COOKIE);
  if (cookie && /^[0-9a-f]{64}$/.test(cookie)) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?1').bind(await sha256hex(cookie)).run();
  return { status: 200, body: { ok: true }, cookie: sessionCookie('', 0) };
}

// ── Staff accounts (Admin: Reviewers and Registrars; system owner: also Admins) ──

export async function listAdmins(env) {
  const r = await env.DB.prepare('SELECT username, name, role, active, created_at, created_by, last_login_at, locked_until FROM admins ORDER BY created_at').all();
  return (r.results || []).map((a) => ({ ...a, role: roleOf(a.username, a.role) }));
}

const noAdmins = { status: 403, body: { error: 'forbidden', detail: 'Only the system owner (setup key) can add or change Admin accounts.' } };

export async function createAdmin(env, body, by, now = new Date()) {
  const username = normUsername(body?.username);
  const name = String(body?.name ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 60);
  const role = ROLES.includes(body?.role) ? body.role : 'reviewer';
  if (role === 'admin' && !can(by, 'admins')) return noAdmins;
  const password = String(body?.password ?? '');
  if (!validUsername(username)) return { status: 400, body: { error: 'bad_username', detail: 'Username: 3 to 32 characters, letters, digits, dot, dash or underscore.' } };
  if (name.length < 2) return { status: 400, body: { error: 'bad_name', detail: 'Enter the person’s name.' } };
  if (password.length < 10) return { status: 400, body: { error: 'weak_password', detail: 'Password: at least 10 characters.' } };
  const exists = await env.DB.prepare('SELECT 1 AS x FROM admins WHERE username = ?1').bind(username).first();
  if (exists) return { status: 409, body: { error: 'exists', detail: 'That username is taken.' } };
  await env.DB.prepare('INSERT INTO admins (username, name, role, pw_hash, active, created_at, created_by) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)')
    .bind(username, name, role, await hashPassword(password), now.toISOString(), by.username)
    .run();
  return { status: 200, body: { ok: true, username, name, role } };
}

/** Switch an account on/off, or set a new password. Switching off ends its sessions. */
export async function updateAdmin(env, body, by = { role: 'owner' }) {
  const username = normUsername(body?.username);
  const a = await env.DB.prepare('SELECT username, role FROM admins WHERE username = ?1').bind(username).first();
  if (!a) return { status: 404, body: { error: 'not_found' } };
  if (roleOf(a.username, a.role) === 'admin' && !can(by, 'admins')) return noAdmins;
  const stmts = [];
  if (typeof body.active === 'boolean') {
    stmts.push(env.DB.prepare('UPDATE admins SET active = ?2 WHERE username = ?1').bind(username, body.active ? 1 : 0));
    if (!body.active) stmts.push(env.DB.prepare('DELETE FROM admin_sessions WHERE username = ?1').bind(username));
  }
  if (body.password != null) {
    if (String(body.password).length < 10) return { status: 400, body: { error: 'weak_password', detail: 'Password: at least 10 characters.' } };
    stmts.push(env.DB.prepare('UPDATE admins SET pw_hash = ?2, failed_count = 0, locked_until = NULL WHERE username = ?1').bind(username, await hashPassword(String(body.password))));
    stmts.push(env.DB.prepare('DELETE FROM admin_sessions WHERE username = ?1').bind(username));
  }
  if (!stmts.length) return { status: 400, body: { error: 'nothing_to_change' } };
  await env.DB.batch(stmts);
  return { status: 200, body: { ok: true, username } };
}
