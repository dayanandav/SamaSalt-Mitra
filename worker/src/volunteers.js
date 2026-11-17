// v1.3 Registered volunteers: entered by a Registrar from the volunteer's request, approved by a
// Reviewer after a call and an ID check (two people, as for Kendras). Every action is logged in
// volunteer_reviews. Volunteer details are for staff only. A lookup made through an approved
// volunteer's link records only the volunteer's code: no patient data, ever.
import { validateVolunteer, volunteerCode, VOLUNTEER_IDS, VOLUNTEER_CHANNELS } from '../../public/rules.js';

const STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'];
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const cleanNote = (s, max = 200) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(5));
  return 'SV-' + Array.from(b, (x) => ABC[x % ABC.length]).join('');
}

const log = (db, code, action, from, to, who, { checks = null, note = null, changes = null } = {}, ts) =>
  db.prepare(`INSERT INTO volunteer_reviews (code, action, from_status, to_status, admin_username, admin_name, checks, note, changes, at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
    .bind(code, action, from, to, who.username, who.name, checks && JSON.stringify(checks), note, changes && JSON.stringify(changes), ts);

/** Registrar (or Admin) enters a volunteer's request. Saved as pending, with a new SV- code. */
export async function registerVolunteer(db, body, who, now = new Date()) {
  const request_channel = VOLUNTEER_CHANNELS.includes(body?.request_channel) ? body.request_channel : 'phone';
  const request_ref = cleanNote(body?.request_ref, 160);
  if (request_ref.length < 5) return { status: 400, body: { error: 'request_ref_required', detail: 'Enter the request: date, and how it came (call, email, visit).' } };
  const id_seen = VOLUNTEER_IDS.includes(body?.id_seen) ? body.id_seen : null;
  if (!id_seen) return { status: 400, body: { error: 'id_required', detail: 'Choose the type of ID you saw (never write its number).' } };
  // The registrar read the terms to the volunteer and they agreed.
  const v = validateVolunteer({ ...body, consent: body?.consent === true });
  if (!v.ok) return { status: 400, body: { error: v.error } };
  const x = v.value;
  const dup = await db.prepare("SELECT code, status FROM volunteers WHERE mobile = ?1 AND status IN ('pending', 'approved')").bind(x.mobile).first();
  if (dup) return { status: 409, body: { error: 'vErrTaken', detail: `This mobile number is already registered (${dup.code}, ${dup.status}).`, code: dup.code } };
  const ts = now.toISOString();
  let code = newCode();
  for (let i = 0; i < 5 && (await db.prepare('SELECT 1 FROM volunteers WHERE code = ?1').bind(code).first()); i++) code = newCode();
  await db.batch([
    db.prepare(`INSERT INTO volunteers (code, name, mobile, district, pin, organisation, languages, status, consent_at, created_at, updated_at,
                  registered_by, request_channel, request_ref, id_seen)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?8, ?8, ?9, ?10, ?11, ?12)`)
      .bind(code, x.name, x.mobile, x.district, x.pin, x.organisation, x.languages, ts, who.username, request_channel, request_ref, id_seen),
    log(db, code, 'register', null, 'pending', who, { note: request_ref }, ts),
  ]);
  return { status: 200, body: { ok: true, code, status: 'pending', registered_by: who.name } };
}

/** Staff list, with how many (real, non-test) checks each volunteer helped with. */
export async function listVolunteers(db, status = 'pending', q = '') {
  const conds = [];
  const args = [];
  if (STATUSES.includes(status)) { args.push(status); conds.push(`v.status = ?${args.length}`); }
  const s = cleanNote(q, 40);
  if (s) {
    const digits = s.replace(/\D/g, '');
    args.push(`%${s}%`);
    const n = args.length;
    const parts = [`v.name LIKE ?${n}`, `v.code LIKE ?${n}`, `v.district LIKE ?${n}`, `v.organisation LIKE ?${n}`];
    if (digits.length >= 4) { args.push(`%${digits}%`); parts.push(`v.mobile LIKE ?${args.length}`); }
    conds.push(`(${parts.join(' OR ')})`);
  }
  const stmt = db.prepare(
    `SELECT v.*, COALESCE(h.n, 0) AS helped, h.last AS last_help
     FROM volunteers v LEFT JOIN (SELECT volunteer, COUNT(*) AS n, MAX(ts) AS last FROM lookups WHERE volunteer IS NOT NULL AND is_test = 0 GROUP BY volunteer) h
       ON h.volunteer = v.code
     ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''} ORDER BY v.created_at DESC LIMIT 500`
  );
  const [rows, counts] = await Promise.all([
    (args.length ? stmt.bind(...args) : stmt).all(),
    db.prepare('SELECT status, COUNT(*) AS n FROM volunteers GROUP BY status').all(),
  ]);
  return {
    items: rows.results || [],
    search: s,
    counts: Object.fromEntries(STATUSES.map((x) => [x, (counts.results || []).find((c) => c.status === x)?.n ?? 0])),
  };
}

const ACTIONS = { approve: 'approved', reject: 'rejected', withdraw: 'withdrawn' };
export const VOLUNTEER_CHECKS = ['called', 'id', 'terms'];

/** Reviewer (or Admin): approve (3 checks + note), reject, or remove (withdraw). */
export async function decideVolunteer(db, body, who, now = new Date()) {
  const code = volunteerCode(body?.code);
  const to = ACTIONS[body?.action];
  const note = cleanNote(body?.note);
  if (!code || !to) return { status: 400, body: { error: 'bad_request', detail: 'Give a volunteer code and an action (approve, reject or withdraw).' } };
  const checks = Object.fromEntries(VOLUNTEER_CHECKS.map((k) => [k, body?.checks?.[k] === true]));
  if (to === 'approved' && !VOLUNTEER_CHECKS.every((k) => checks[k])) return { status: 400, body: { error: 'checks_required', detail: 'Tick all three confirmations before approving.' } };
  if (to === 'approved' && note.length < 5) return { status: 400, body: { error: 'note_required', detail: 'Say how you checked (for example: "Called 17 Nov, ID seen at the camp").' } };
  if (to !== 'approved' && note.length < 3) return { status: 400, body: { error: 'note_required', detail: 'Give a short reason.' } };
  const cur = await db.prepare('SELECT status, mobile FROM volunteers WHERE code = ?1').bind(code).first();
  if (!cur) return { status: 404, body: { error: 'not_found' } };
  if (cur.status === to) return { status: 409, body: { error: 'unchanged', detail: `Already ${to === 'withdrawn' ? 'removed' : to}.` } };
  if (to === 'approved' && cur.status !== 'pending') return { status: 409, body: { error: 'not_pending', detail: 'Only a waiting registration can be approved. The registrar enters a new one.' } };
  if (to === 'approved') {
    const dup = await db.prepare("SELECT code FROM volunteers WHERE mobile = ?1 AND status = 'approved' AND code <> ?2").bind(cur.mobile, code).first();
    if (dup) return { status: 409, body: { error: 'vErrTaken', detail: `This mobile number already belongs to approved volunteer ${dup.code}.` } };
  }
  const ts = now.toISOString();
  await db.batch([
    db.prepare(`UPDATE volunteers SET status = ?2, admin_note = ?3, updated_at = ?4,
                  verified_at = CASE WHEN ?2 = 'approved' THEN ?4 ELSE verified_at END,
                  verified_by = CASE WHEN ?2 = 'approved' THEN ?5 ELSE verified_by END WHERE code = ?1`)
      .bind(code, to, note || null, ts, who.name),
    log(db, code, body.action, cur.status, to, who, { checks: to === 'approved' ? checks : null, note: note || null }, ts),
  ]);
  return { status: 200, body: { ok: true, code, status: to, previous: cur.status, by: who.name } };
}

const EDIT_FIELDS = ['name', 'mobile', 'district', 'pin', 'organisation', 'languages'];

/** Reviewer (or Admin): modify a waiting or approved volunteer. A new mobile sends an approved one back to waiting. */
export async function updateVolunteer(db, body, who, now = new Date()) {
  const code = volunteerCode(body?.code);
  if (!code) return { status: 400, body: { error: 'bad_request', detail: 'Give a volunteer code.' } };
  const note = cleanNote(body?.note);
  if (note.length < 3) return { status: 400, body: { error: 'note_required', detail: 'Say why the details are changed.' } };
  const cur = await db.prepare('SELECT * FROM volunteers WHERE code = ?1').bind(code).first();
  if (!cur) return { status: 404, body: { error: 'not_found' } };
  if (!['pending', 'approved'].includes(cur.status)) return { status: 409, body: { error: 'not_editable', detail: 'Only a waiting or approved volunteer can be modified.' } };
  const next = { ...cur };
  for (const f of EDIT_FIELDS) if (body?.[f] !== undefined) next[f] = body[f];
  const v = validateVolunteer({ ...next, consent: true });
  if (!v.ok) return { status: 400, body: { error: v.error } };
  const changes = {};
  for (const f of EDIT_FIELDS) if ((cur[f] ?? null) !== (v.value[f] ?? null)) changes[f] = [cur[f] ?? null, v.value[f] ?? null];
  if (!Object.keys(changes).length) return { status: 409, body: { error: 'unchanged', detail: 'Nothing was changed.' } };
  if (changes.mobile) {
    const dup = await db.prepare("SELECT code FROM volunteers WHERE mobile = ?1 AND status IN ('pending', 'approved') AND code <> ?2").bind(v.value.mobile, code).first();
    if (dup) return { status: 409, body: { error: 'vErrTaken', detail: `This mobile number is already registered (${dup.code}).` } };
  }
  const to = cur.status === 'approved' && changes.mobile ? 'pending' : cur.status;
  const ts = now.toISOString();
  const x = v.value;
  await db.batch([
    db.prepare(`UPDATE volunteers SET name = ?2, mobile = ?3, district = ?4, pin = ?5, organisation = ?6, languages = ?7, status = ?8, updated_at = ?9,
                  verified_at = CASE WHEN ?8 = 'approved' THEN verified_at ELSE NULL END,
                  verified_by = CASE WHEN ?8 = 'approved' THEN verified_by ELSE NULL END WHERE code = ?1`)
      .bind(code, x.name, x.mobile, x.district, x.pin, x.organisation, x.languages, to, ts),
    log(db, code, 'edit', cur.status, to, who, { note, changes }, ts),
  ]);
  return { status: 200, body: { ok: true, code, status: to, previous: cur.status, changed: Object.keys(changes), by: who.name } };
}

export async function volunteerHistory(db, code) {
  const c = volunteerCode(code);
  if (!c) return [];
  const r = await db.prepare('SELECT action, from_status, to_status, admin_name, admin_username, checks, note, changes, at FROM volunteer_reviews WHERE code = ?1 ORDER BY id DESC LIMIT 50').bind(c).all();
  return (r.results || []).map((x) => ({ ...x, checks: x.checks ? JSON.parse(x.checks) : null, changes: x.changes ? JSON.parse(x.changes) : null }));
}

/** The code if it belongs to an approved volunteer, else null (used when logging a lookup). */
export async function activeVolunteer(db, code) {
  const c = volunteerCode(code);
  if (!c) return null;
  const r = await db.prepare("SELECT code FROM volunteers WHERE code = ?1 AND status = 'approved'").bind(c).first();
  return r ? c : null;
}

/** Public: is this volunteer link active? Only the code and yes/no; never the person's details. */
export async function volunteerLinkStatus(db, code) {
  const c = volunteerCode(code);
  if (!c) return { code: null, active: false };
  return { code: c, active: !!(await activeVolunteer(db, c)) };
}
