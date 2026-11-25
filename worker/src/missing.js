// v2.0.7 missing-medicines list (roadmap S1.2).
//   Patients: a typed name that is not found is counted in missing_names (real traffic only), and
//             only if it looks like a medicine name: never a phone number, PIN, email or sentence.
//   Registrar: adds the brand with its salts and strengths read from the strip (pending).
//   Reviewer : approves after comparing with the strip or pack, or rejects; removes; ignores junk.
// Approved brands are found by name like any brand (identifyMedicine in tools.js); no price is kept.
// Every action is logged in added_medicine_reviews.
import { parseSaltComposition, buildCanonicalKey, describeKey, isNti } from './normalize.js';
import { cleanComposition, janAushadhiMatch, ctxOf, resetAddedList } from './tools.js';

const FORMS = ['tablet', 'capsule', 'liquid', 'drops', 'injection', 'topical', 'inhaler', 'respule', 'powder', 'spray', 'suppository', 'patch', 'mouthwash', 'lozenge', 'chewable', 'effervescent', 'dry_syrup'];
const RELEASES = ['SR', 'XR', 'CR', 'MR', 'DR', 'LA', 'XL'];
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Typed text worth counting as a missing medicine name, or null. Latin letters and numbers only,
 * 3-60 characters, at most 6 words, starting with letters, no run of 6+ digits (phone, PIN), no
 * "@" (email). Lowercased key + the text as typed.
 */
export function missingName(text) {
  // Checked as typed (only spaces tidied): any other character means it is not a medicine name.
  const shown = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (shown.length < 3 || shown.length > 60) return null;
  if (!/^[A-Za-z][A-Za-z0-9 .\-+/%()]*$/.test(shown)) return null;
  if (/\d{6,}/.test(shown.replace(/[\s.\-]/g, ''))) return null;
  if (shown.split(' ').length > 6) return null;
  return { key: shown.toLowerCase(), shown };
}

/** Count a not-found typed name (call only for real, not test, traffic). */
export async function recordMissing(db, text, day) {
  const m = missingName(text);
  if (!m) return false;
  await db.prepare(`INSERT INTO missing_names (name_key, shown, searches, first_day, last_day, status) VALUES (?1, ?2, 1, ?3, ?3, 'open')
                    ON CONFLICT(name_key) DO UPDATE SET searches = searches + 1, last_day = ?3`).bind(m.key, m.shown, day).run();
  return true;
}

/** Brand name, salts as printed, form and release -> the canonical key, or an error for the form. */
export function keyForAdded(body) {
  const name = clean(body?.name, 80);
  const composition = clean(body?.composition, 300);
  const form = FORMS.includes(body?.form) ? body.form : null;
  const rel = RELEASES.includes(body?.rel) ? body.rel : null;
  if (name.length < 2) return { error: 'name_required', detail: 'Enter the brand name as printed on the strip.' };
  if (!form) return { error: 'form_required', detail: 'Choose the form (tablet, capsule, syrup…).' };
  const salts = parseSaltComposition(cleanComposition(composition));
  if (!salts.length) return { error: 'composition_required', detail: 'Enter the salts and strengths as printed, e.g. "Paracetamol 650 mg" or "Amoxicillin 500 mg + Clavulanic acid 125 mg".' };
  if (salts.some(([, st]) => !st)) return { error: 'strength_required', detail: 'Every salt needs its strength (e.g. 500 mg, 5 mg/5 ml).' };
  const ckey = buildCanonicalKey(salts, form, rel);
  return { name, manufacturer: clean(body?.manufacturer, 80) || null, composition, form, rel, ckey, nti: isNti(salts) };
}

/** What the app will read: composition label, Jan Aushadhi product and how many brands share the key. */
export async function previewAdded(ctx, body) {
  const k = keyForAdded(body);
  if (k.error) return { status: 400, body: k };
  const { meds } = ctxOf(ctx);
  const ja = await janAushadhiMatch(ctx, k.ckey).catch(() => ({ available: false }));
  const same = await meds.sameSalt(k.ckey, 3).catch(() => ({ count: 0 }));
  return {
    status: 200,
    body: { ok: true, ckey: k.ckey, label: describeKey(k.ckey), nti: k.nti, same_brands: same.count || 0, ja: ja.available ? { code: ja.product.drug_code, name: ja.product.generic_name } : null },
  };
}

const log = (db, medId, action, who, note, ts) =>
  db.prepare('INSERT INTO added_medicine_reviews (med_id, action, admin_username, admin_name, note, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(medId, action, who.username, who.name, note || null, ts);

/** Registrar (or Admin) adds a brand from the strip: pending until a Reviewer approves. */
export async function addMedicine(db, body, who, now = new Date()) {
  const k = keyForAdded(body);
  if (k.error) return { status: 400, body: k };
  if (body?.checked !== true) return { status: 400, body: { error: 'check_required', detail: 'Confirm that you read the name, salts, strengths and form from the strip or pack.' } };
  const dup = await db.prepare("SELECT id, status FROM added_medicines WHERE lower(name) = lower(?1) AND status IN ('pending', 'approved')").bind(k.name).first();
  if (dup) return { status: 409, body: { error: 'taken', detail: `This brand is already ${dup.status === 'approved' ? 'added' : 'waiting for review'}.` } };
  const ts = now.toISOString();
  const source = clean(body?.source_name, 60).toLowerCase() || null;
  const r = await db.prepare(`INSERT INTO added_medicines (name, manufacturer, composition, ckey, form, rel, nti, status, source_name, created_at, created_by)
                              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?9, ?10)`)
    .bind(k.name, k.manufacturer, k.composition, k.ckey, k.form, k.rel, k.nti ? 1 : 0, source, ts, who.username).run();
  const id = r.meta?.last_row_id ?? (await db.prepare('SELECT max(id) AS id FROM added_medicines').first()).id;
  await log(db, id, 'add', who, clean(body?.note, 200), ts).run();
  return { status: 200, body: { ok: true, id, status: 'pending', label: describeKey(k.ckey) } };
}

/** Reviewer: approve (after comparing with the strip, with a note), reject, or remove an approved one. */
export async function decideMedicine(db, body, who, now = new Date()) {
  const id = Number(body?.id);
  const action = ['approve', 'reject', 'remove'].includes(body?.action) ? body.action : null;
  if (!id || !action) return { status: 400, body: { error: 'bad_request' } };
  const cur = await db.prepare('SELECT * FROM added_medicines WHERE id = ?1').bind(id).first();
  if (!cur) return { status: 404, body: { error: 'not_found' } };
  const note = clean(body?.note, 200);
  if (action === 'approve') {
    if (cur.status !== 'pending') return { status: 409, body: { error: 'not_pending', detail: 'Only a waiting brand can be approved.' } };
    if (body?.compared !== true) return { status: 400, body: { error: 'compare_required', detail: 'Confirm that you compared the name, salts, strengths, form and release with the strip or pack.' } };
    if (note.length < 3) return { status: 400, body: { error: 'note_required', detail: 'Add a short note (how you checked it).' } };
    if (cur.created_by === who.username && who.role !== 'owner') return { status: 403, body: { error: 'same_person', detail: 'Another person must approve what you added.' } };
  }
  if (action === 'reject' && cur.status !== 'pending') return { status: 409, body: { error: 'not_pending' } };
  if (action === 'remove' && cur.status !== 'approved') return { status: 409, body: { error: 'not_approved' } };
  const to = { approve: 'approved', reject: 'rejected', remove: 'removed' }[action];
  const ts = now.toISOString();
  const stmts = [
    db.prepare('UPDATE added_medicines SET status = ?1, decided_at = ?2, decided_by = ?3 WHERE id = ?4').bind(to, ts, who.username, id),
    log(db, id, action, who, note, ts),
  ];
  if (cur.source_name) stmts.push(db.prepare('UPDATE missing_names SET status = ?1 WHERE name_key = ?2').bind(to === 'approved' ? 'added' : 'open', cur.source_name));
  await db.batch(stmts);
  resetAddedList(db);
  return { status: 200, body: { ok: true, id, status: to } };
}

/** Reviewer: a counted name that is not a medicine (or cannot be added) leaves the list. */
export async function ignoreMissing(db, body) {
  const key = clean(body?.name_key, 60).toLowerCase();
  if (!key) return { status: 400, body: { error: 'bad_request' } };
  await db.prepare("UPDATE missing_names SET status = 'ignored' WHERE name_key = ?1").bind(key).run();
  return { status: 200, body: { ok: true } };
}

/** Staff list: most-searched open names, and added brands by status. */
export async function listMissing(db) {
  const names = (await db.prepare("SELECT name_key, shown, searches, first_day, last_day FROM missing_names WHERE status = 'open' ORDER BY searches DESC, last_day DESC LIMIT 60").all()).results || [];
  const added = (await db.prepare(`SELECT id, name, manufacturer, composition, ckey, form, rel, nti, status, source_name, created_at, created_by, decided_at, decided_by
                                   FROM added_medicines ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, id DESC LIMIT 100`).all()).results || [];
  return { names, added: added.map((a) => ({ ...a, label: describeKey(a.ckey) })) };
}
