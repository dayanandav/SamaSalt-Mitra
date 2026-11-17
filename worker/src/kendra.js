// v1.1 Kendra registry: Jan Aushadhi pharmacists register their Kendra's WhatsApp/SMS number.
// A number is shown to patients only after an admin has called it and approved it, and only
// when KENDRA_REGISTRY allows it ("pilot": test traffic only, until PMBJP agrees; "public").
// The browser form and this file use the same checks (public/rules.js).
import { validateKendraRegistration, kendraCode } from '../../public/rules.js';

const STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'];

function newRef() {
  // Short, readable, no 0/O/1/I: the pharmacist may read it out on the phone.
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(5));
  return 'KR-' + Array.from(b, (x) => abc[x % abc.length]).join('');
}

/** One Kendra from the official list, with its registry status (and its contact when allowed). */
export async function lookupKendra(db, code, { showContact = false } = {}) {
  const c = kendraCode(code);
  if (!c) return { found: false, error: 'krErrCode' };
  const k = await db
    .prepare(
      `SELECT k.code, k.address, k.district, k.state, k.pin, c.status, c.whatsapp, c.sms, c.hours
       FROM kendras k LEFT JOIN kendra_contacts c ON c.code = k.code WHERE k.code = ?1`
    )
    .bind(c)
    .first();
  if (!k) return { found: false, code: c, error: 'krErrNotFound' };
  const approved = k.status === 'approved';
  return {
    found: true,
    code: k.code,
    address: k.address,
    district: k.district,
    state: k.state,
    pin: k.pin,
    // 'none' | 'pending' | 'approved' (rejected and withdrawn read as 'none': free to register again)
    registry: approved ? 'approved' : k.status === 'pending' ? 'pending' : 'none',
    contact: approved && showContact ? { whatsapp: k.whatsapp, sms: k.sms, hours: k.hours } : null,
  };
}

/**
 * Save a registration as pending. Returns { status, body }.
 * An approved Kendra cannot be re-registered from the form (that would let anyone replace a
 * live number); the pharmacist asks the admin to change it.
 */
export async function registerKendra(db, body, now = new Date(), staff = {}) {
  const v = validateKendraRegistration(body);
  if (!v.ok) return { status: 400, body: { error: v.error } };
  const r = v.value;
  const kendra = await db.prepare('SELECT code FROM kendras WHERE code = ?1').bind(r.code).first();
  if (!kendra) return { status: 404, body: { error: 'krErrNotFound' } };
  const cur = await db.prepare('SELECT status FROM kendra_contacts WHERE code = ?1').bind(r.code).first();
  if (cur?.status === 'approved') return { status: 409, body: { error: 'krErrTaken' } };
  const ts = now.toISOString();
  const ref = newRef();
  await db
    .prepare(
      `INSERT OR REPLACE INTO kendra_contacts
         (code, whatsapp, sms, hours, contact_name, role, ref, status, consent_at, created_at, updated_at, verified_at, admin_note,
          registered_by, request_ref, docs_checked, request_channel)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?8, ?8, NULL, NULL, ?9, ?10, ?11, ?12)`
    )
    .bind(r.code, r.whatsapp, r.sms, r.hours, r.contact_name, r.role, ref, ts, staff.registered_by ?? null, staff.request_ref ?? null, staff.docs_checked ?? null, staff.request_channel ?? null)
    .run();
  return { status: 200, body: { ok: true, code: r.code, ref, registry: 'pending' } };
}

// Documents a Kendra's request must include; the registrar ticks each one after checking it.
export const REQUIRED_DOCS = ['allotment', 'licence', 'pharmacist', 'consent'];
// How the request reached us: an email with the documents attached, or in person with originals.
export const REQUEST_CHANNELS = ['email', 'in_person'];

/**
 * Registration by authorised staff (registrar, admin) from a Kendra's request received by email
 * or in person. Needs a reference to the request and every required document checked. Saved as pending, with who
 * entered it; a reviewer approves it after calling the Kendra.
 */
export async function staffRegisterKendra(db, body, who, now = new Date()) {
  const request_channel = REQUEST_CHANNELS.includes(body?.request_channel) ? body.request_channel : 'email';
  const request_ref = String(body?.request_ref ?? '').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (request_ref.length < 5) {
    const detail = request_channel === 'email' ? 'Enter the email request: date received and subject or sender.' : 'Enter the visit: date, who came, and the ID seen.';
    return { status: 400, body: { error: 'request_ref_required', detail } };
  }
  const docs = Object.fromEntries(REQUIRED_DOCS.map((k) => [k, body?.docs?.[k] === true]));
  if (!REQUIRED_DOCS.every((k) => docs[k])) return { status: 400, body: { error: 'docs_required', detail: 'Check every required document in the email and tick it before registering.' } };
  // The Kendra's signed consent (a required document) is the acceptance of the terms.
  const r = await registerKendra(db, { ...body, consent: true }, now, { registered_by: who.username, request_ref, request_channel, docs_checked: JSON.stringify(docs) });
  if (r.status === 200) r.body.registered_by = who.name;
  return r;
}

/** Mark the Kendras in a nearest-Kendra list that have an approved number, with that number. */
export async function attachContacts(db, items) {
  const codes = (items || []).map((x) => x.code).filter((c) => kendraCode(c));
  if (!codes.length) return items;
  const res = await db
    .prepare(`SELECT code, whatsapp, sms, hours FROM kendra_contacts WHERE status = 'approved' AND code IN (${codes.map((_, i) => `?${i + 1}`).join(',')})`)
    .bind(...codes)
    .all();
  const by = new Map((res.results || []).map((c) => [c.code, c]));
  for (const x of items) {
    const c = by.get(x.code);
    if (c) {
      x.registered = true;
      x.contact = { whatsapp: c.whatsapp, sms: c.sms, hours: c.hours };
    }
  }
  return items;
}

// ── Admin (developer page; the caller has already checked the admin token) ───

/**
 * Kendra search text: "PMBJK99003", "pmbjk 99003", "99003" or "9900" → the part to look for in
 * the code ("PMBJK99003", "99003", "9900"). Letters other than PMBJK, or nothing, → ''.
 */
export function kendraSearch(q) {
  const s = String(q ?? '').toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^(?:P(?:M(?:B(?:J(?:K)?)?)?)?)?(\d{0,5})$/);
  if (!m || !s) return '';
  return m[1] && s.length > m[1].length ? s : m[1] || s;
}

/** Registrations by status (or 'all'), optionally matching a Kendra code search; in code order. */
export async function adminListKendras(db, status = 'pending', q = '') {
  const conds = [];
  const args = [];
  if (STATUSES.includes(status)) { args.push(status); conds.push(`c.status = ?${args.length}`); }
  const search = kendraSearch(q);
  if (search) { args.push(`%${search}%`); conds.push(`c.code LIKE ?${args.length}`); }
  const stmt = db.prepare(
    `SELECT c.code, c.whatsapp, c.sms, c.hours, c.contact_name, c.role, c.ref, c.status, c.consent_at,
            c.created_at, c.updated_at, c.verified_at, c.verified_by, c.admin_note, c.registered_by, c.request_ref, c.docs_checked, c.request_channel,
            k.address, k.district, k.state, k.pin
     FROM kendra_contacts c LEFT JOIN kendras k ON k.code = c.code ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}
     ORDER BY c.code LIMIT 500`
  );
  const [rows, counts] = await Promise.all([
    (args.length ? stmt.bind(...args) : stmt).all(),
    db.prepare('SELECT status, COUNT(*) AS n FROM kendra_contacts GROUP BY status').all(),
  ]);
  return {
    items: rows.results || [],
    search,
    counts: Object.fromEntries(STATUSES.map((s) => [s, (counts.results || []).find((c) => c.status === s)?.n ?? 0])),
  };
}

const ACTIONS = { approve: 'approved', reject: 'rejected', withdraw: 'withdrawn' };

// What a reviewer must confirm before approving (shown as tick boxes on /admin).
export const APPROVAL_CHECKS = ['called', 'details', 'terms'];

/**
 * Approve, reject or withdraw a registration, as `who` (the signed-in admin).
 * Approving needs all APPROVAL_CHECKS ticked and a note on how it was checked. Every action
 * is written to kendra_reviews with who did it.
 */
export async function adminDecideKendra(db, body, who = { username: 'owner', name: 'Owner' }, now = new Date()) {
  const code = kendraCode(body?.code);
  const to = ACTIONS[body?.action];
  const note = String(body?.note ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
  if (!code || !to) return { status: 400, body: { error: 'bad_request', detail: 'Give a Kendra code and an action (approve, reject or withdraw).' } };
  const checks = Object.fromEntries(APPROVAL_CHECKS.map((k) => [k, body?.checks?.[k] === true]));
  if (to === 'approved' && !APPROVAL_CHECKS.every((k) => checks[k])) {
    return { status: 400, body: { error: 'checks_required', detail: 'Tick all three confirmations before approving.' } };
  }
  if (to === 'approved' && note.length < 5) return { status: 400, body: { error: 'note_required', detail: 'Say how the number was checked (for example: "Called 16 Nov, confirmed code and address").' } };
  if (to !== 'approved' && note.length < 3) return { status: 400, body: { error: 'note_required', detail: 'Give a short reason.' } };
  const cur = await db.prepare('SELECT status, whatsapp FROM kendra_contacts WHERE code = ?1').bind(code).first();
  if (!cur) return { status: 404, body: { error: 'not_found' } };
  if (cur.status === to) return { status: 409, body: { error: 'unchanged', detail: `Already ${to}.` } };
  const ts = now.toISOString();
  await db.batch([
    db
      .prepare(`UPDATE kendra_contacts SET status = ?2, admin_note = ?3, updated_at = ?4,
                 verified_at = CASE WHEN ?2 = 'approved' THEN ?4 ELSE verified_at END,
                 verified_by = CASE WHEN ?2 = 'approved' THEN ?5 ELSE verified_by END WHERE code = ?1`)
      .bind(code, to, note || null, ts, who.name),
    db
      .prepare(`INSERT INTO kendra_reviews (code, action, from_status, to_status, admin_username, admin_name, checks, note, whatsapp, at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
      .bind(code, body.action, cur.status, to, who.username, who.name, to === 'approved' ? JSON.stringify(checks) : null, note || null, cur.whatsapp, ts),
  ]);
  return { status: 200, body: { ok: true, code, status: to, previous: cur.status, by: who.name } };
}

const EDIT_FIELDS = ['whatsapp', 'sms', 'contact_name', 'role', 'hours'];

/**
 * Modify a registration's details (reviewer, admin): the Kendra's numbers, contact, hours.
 * Only a waiting or approved registration. A reason is required and every change is logged.
 * A new WhatsApp or SMS number on an approved Kendra sends it back to waiting: the new number
 * must be called before patients see it.
 */
export async function adminUpdateKendra(db, body, who = { username: 'owner', name: 'System owner' }, now = new Date()) {
  const code = kendraCode(body?.code);
  if (!code) return { status: 400, body: { error: 'bad_request', detail: 'Give a Kendra code.' } };
  const note = String(body?.note ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
  if (note.length < 3) return { status: 400, body: { error: 'note_required', detail: 'Say why the details are changed (for example: "Kendra emailed a new number").' } };
  const cur = await db.prepare('SELECT * FROM kendra_contacts WHERE code = ?1').bind(code).first();
  if (!cur) return { status: 404, body: { error: 'not_found' } };
  if (!['pending', 'approved'].includes(cur.status)) return { status: 409, body: { error: 'not_editable', detail: `A ${cur.status} registration cannot be modified. The registrar enters a new one.` } };
  const v = validateKendraRegistration({ ...cur, ...pick(body, EDIT_FIELDS), code, consent: true });
  if (!v.ok) return { status: 400, body: { error: v.error } };
  const changes = {};
  for (const f of EDIT_FIELDS) if ((cur[f] ?? null) !== (v.value[f] ?? null)) changes[f] = [cur[f] ?? null, v.value[f] ?? null];
  if (!Object.keys(changes).length) return { status: 409, body: { error: 'unchanged', detail: 'Nothing was changed.' } };
  const recheck = cur.status === 'approved' && (changes.whatsapp || changes.sms);
  const to = recheck ? 'pending' : cur.status;
  const ts = now.toISOString();
  const x = v.value;
  await db.batch([
    db
      .prepare(`UPDATE kendra_contacts SET whatsapp = ?2, sms = ?3, contact_name = ?4, role = ?5, hours = ?6, status = ?7, updated_at = ?8,
                 verified_at = CASE WHEN ?7 = 'approved' THEN verified_at ELSE NULL END,
                 verified_by = CASE WHEN ?7 = 'approved' THEN verified_by ELSE NULL END WHERE code = ?1`)
      .bind(code, x.whatsapp, x.sms, x.contact_name, x.role, x.hours, to, ts),
    db
      .prepare(`INSERT INTO kendra_reviews (code, action, from_status, to_status, admin_username, admin_name, checks, note, whatsapp, at, changes)
                VALUES (?1, 'edit', ?2, ?3, ?4, ?5, NULL, ?6, ?7, ?8, ?9)`)
      .bind(code, cur.status, to, who.username, who.name, note, x.whatsapp, ts, JSON.stringify(changes)),
  ]);
  return { status: 200, body: { ok: true, code, status: to, previous: cur.status, changed: Object.keys(changes), by: who.name } };
}

function pick(o, keys) {
  const out = {};
  for (const k of keys) if (o && o[k] !== undefined) out[k] = o[k];
  return out;
}

/** The review log of one Kendra, newest first. */
export async function adminKendraHistory(db, code) {
  const c = kendraCode(code);
  if (!c) return [];
  const r = await db.prepare('SELECT action, from_status, to_status, admin_name, admin_username, checks, note, whatsapp, at, changes FROM kendra_reviews WHERE code = ?1 ORDER BY id DESC LIMIT 50').bind(c).all();
  return (r.results || []).map((x) => ({ ...x, checks: x.checks ? JSON.parse(x.checks) : null, changes: x.changes ? JSON.parse(x.changes) : null }));
}
