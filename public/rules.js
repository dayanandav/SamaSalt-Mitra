// Safety rules for what the web app shows, kept apart from the page code so they are tested
// (test/rules.test.mjs). Shared by the browser (app.js) and Node tests; no DOM here.

/** The entry for the pharmacist list. A never-switch medicine gets NO Jan Aushadhi code. */
export function pharmacistEntry(r) {
  const m = r.medicine;
  const ja = r.jan_aushadhi || {};
  const nti = !!m.nti || !!ja.nti;
  return {
    ckey: m.ckey,
    name: m.name,
    composition: String(m.composition || '').split(' · ')[0],
    form: m.form || '',
    nti,
    // The Jan Aushadhi product with the same composition (from the PMBI list: name, code, pack
    // size, MRP). Owner's decision 22 Nov 2026: also for a never-switch medicine, as information
    // for the pharmacist with the never-switch warning: then no MRP (no prices for NTI), never ordered.
    ja: ja.available && ja.product
      ? { name: ja.product.generic_name, code: ja.product.drug_code, unit_size: ja.product.unit_size || '', mrp: nti ? null : Number(ja.product.mrp) || null }
      : null,
    // The PMBI list was checked and has no product of this exact composition (strength, form, release).
    noJa: ja.available === false,
    // P1 monthly list: per-tablet prices from our data, for the saving. Never for a never-switch medicine.
    ...(!nti && Number(m.unit_price) > 0 ? { brandUnit: Number(m.unit_price) } : {}),
    ...(!nti && ja.available && Number(ja.product?.units) > 0 ? { jaUnits: Number(ja.product.units) } : {}),
  };
}

// ── P1 My monthly medicines ─────────────────────────────────────────────────
// "Keep this list for next month": the pharmacist list, kept on this phone only (never on our
// server). The patient sets how many Jan Aushadhi packs they buy; we never ask how many to take.

/** A kept list read back from the phone: entries with a composition key only, at most `max`, no age limit. */
export function keptMedList(list, max = 15) {
  if (!Array.isArray(list)) return [];
  return list.filter((x) => x && typeof x === 'object' && typeof x.ckey === 'string' && x.ckey && typeof x.name === 'string').slice(0, max);
}

/**
 * The saving for the packs in the list, per tablet from our data: each counted item is
 * `qty` Jan Aushadhi packs; the same number of tablets at the brand's price. Never-switch
 * medicines, medicines not in our list, and anything without both prices are not counted.
 * Returns { month, year, counted, left } or null when nothing is counted or nothing is saved.
 */
export function monthlySaving(list) {
  let brand = 0, ja = 0, counted = 0, left = 0;
  for (const x of Array.isArray(list) ? list : []) {
    if (!x) continue;
    const mrp = Number(x.ja?.mrp);
    if (x.nti || x.unlisted || !x.ja || !(mrp > 0) || !(Number(x.brandUnit) > 0) || !(Number(x.jaUnits) > 0)) { left++; continue; }
    const q = orderQty(x.qty);
    brand += q * Number(x.jaUnits) * Number(x.brandUnit);
    ja += q * mrp;
    counted++;
  }
  const month = Math.round((brand - ja) * 100) / 100;
  if (!counted || !(month > 0)) return null;
  return { month, year: Math.round(month * 12 * 100) / 100, counted, left };
}

/**
 * A medicine that was not found, added to the pharmacist list by its typed name only, so the
 * pharmacist can check the strip. No composition, no Jan Aushadhi product, never ordered.
 */
export function unlistedEntry(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!n) return null;
  return { ckey: `unlisted:${n.toLowerCase()}`, name: n, composition: '', form: '', nti: false, ja: null, noJa: false, unlisted: true };
}

/** Newest first, one entry per composition key, at most `max`. */
export function mergeMedList(list, entry, max = 15) {
  return [entry, ...(Array.isArray(list) ? list : []).filter((x) => x && x.ckey !== entry.ckey)].slice(0, max);
}

/**
 * "Will you buy a lower-priced option?" Only on a found medicine that is not never-switch, and
 * whenever an option is listed: the Jan Aushadhi generic or another brand with the same composition.
 */
export function asksToSwitch(r) {
  if (r?.status !== 'ok' || !r.medicine) return false;
  if (r.needs_confirmation && !r.confirmed) return false;
  const m = r.medicine;
  if (m.nti || r.jan_aushadhi?.nti) return false;
  const items = r.same_salt?.items || [];
  return !!(r.jan_aushadhi?.available || (r.saving?.saving_pack > 0) || items.some((x) => x.name.toLowerCase() !== m.name.toLowerCase()));
}

/** "Show to the pharmacist" and the list: only for a found (and, for photos, confirmed) medicine. */
export function canShowPharmacist(r) {
  return r?.status === 'ok' && !!r.medicine && !(r.needs_confirmation && !r.confirmed);
}

/**
 * Add to the pharmacist list only on a NEW lookup, once. Re-showing the same result (after a
 * language change, or the confirm step) must never bring back a medicine the person removed.
 */
export function shouldAddToList(r) {
  return canShowPharmacist(r) && r.fresh !== false && !r.addedToList;
}

/** Listen reads the answer only in the language it is written in, and only if that is the chosen one. */
export function listenAllowed(answerLang, uiLang, voices) {
  if (answerLang !== uiLang) return false;
  return !!pickVoice(answerLang, voices);
}

const VOICE = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' };
/** A voice for the language; Android names them "kn_IN". Never a voice of another language. */
export function pickVoice(lang, voices) {
  const want = (VOICE[lang] || 'en-IN').toLowerCase();
  const norm = (v) => String(v?.lang || '').replace('_', '-').toLowerCase();
  const list = voices || [];
  return list.find((v) => norm(v) === want) || list.find((v) => norm(v).startsWith(lang + '-')) || null;
}

/**
 * Is this a phone or tablet browser (where a phone camera app exists)? On a computer the
 * "phone camera" options are hidden and "Take a photo" uses the camera inside the page.
 * `nav` is navigator (passed in so this can be tested).
 */
export function isPhoneBrowser(nav) {
  if (!nav) return false;
  if (typeof nav.userAgentData?.mobile === 'boolean' && nav.userAgentData.mobile) return true;
  const ua = String(nav.userAgent || '');
  if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua)) return true;
  // iPadOS reports itself as a Mac; a Mac with a touch screen is an iPad.
  return /Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1;
}

/** How long a medicine stays on the pharmacist list after it was checked. */
export const LIST_MAX_AGE_MS = 60 * 60 * 1000;
/**
 * Only medicines checked in the last hour (entries without a time are old ones: dropped).
 * Android keeps tabs open, and restores them, for days, so "this visit" alone was not enough.
 */
export function freshMedList(list, now = Date.now(), maxAge = LIST_MAX_AGE_MS) {
  if (!Array.isArray(list)) return [];
  return list.filter((x) => x && typeof x.at === 'number' && x.at <= now + 60_000 && now - x.at < maxAge);
}

// ── v1.1 Kendra registry ─────────────────────────────────────────────────────
// Shared by the registration page, the Worker (which re-checks everything) and the tests.

/** A PMBJK Kendra code in its official form ("PMBJK00964"), or null. */
export function kendraCode(s) {
  const c = String(s ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return /^PMBJK\d{5}$/.test(c) ? c : null;
}

/**
 * An Indian mobile number as 10 digits, or null. Accepts "+91 98765 43210", "098765-43210",
 * "919876543210". Landlines and short numbers are refused: the number must take WhatsApp/SMS.
 */
export function mobile10(s) {
  let d = String(s ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** "98765 43210", for showing a number on screen and on the poster. */
export function showMobile(d) {
  return d && d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : String(d ?? '');
}

export const KENDRA_ROLES = ['pharmacist', 'owner', 'staff'];
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Check a registration form. Returns { ok: true, value } or { ok: false, error } where error
 * is a strings.js key naming what to fix. The terms must be accepted (consent === true).
 */
export function validateKendraRegistration(b) {
  b = b && typeof b === 'object' ? b : {};
  const code = kendraCode(b.code);
  if (!code) return { ok: false, error: 'krErrCode' };
  const whatsapp = mobile10(b.whatsapp);
  if (!whatsapp) return { ok: false, error: 'krErrWhatsapp' };
  let sms = null;
  if (String(b.sms ?? '').trim()) {
    sms = mobile10(b.sms);
    if (!sms) return { ok: false, error: 'krErrSms' };
    if (sms === whatsapp) sms = null;
  }
  const contact_name = clean(b.contact_name, 60);
  if (contact_name.length < 2) return { ok: false, error: 'krErrName' };
  const role = KENDRA_ROLES.includes(b.role) ? b.role : null;
  if (!role) return { ok: false, error: 'krErrRole' };
  const hours = clean(b.hours, 80) || null;
  if (b.consent !== true) return { ok: false, error: 'krErrConsent' };
  return { ok: true, value: { code, whatsapp, sms, hours, contact_name, role } };
}

/**
 * Who may see a registered Kendra's number. Until PMBJP agrees (KENDRA_REGISTRY = "public"),
 * only test traffic (developer mode, the pilot team) sees it: mode "pilot". "off" hides it.
 */
export function kendraContactsVisible(mode, isTest) {
  if (mode === 'public') return true;
  if (mode === 'pilot') return !!isTest;
  return false;
}

/**
 * The standard Kendra registration request (English, for the SamaSalt-Mitra team), filled in
 * with the Kendra code and official address when known. Returns { subject, body }.
 */
export function registrationEmail(k = {}, d = {}) {
  const code = kendraCode(k.code) || 'PMBJK_____';
  const addr = [k.address, k.district, k.state, k.pin].filter(Boolean).join(', ') || '____________________';
  const blank = '__________';
  const v = (x) => clean(x, 80) || blank;
  const num = (x) => (mobile10(x) ? showMobile(mobile10(x)) : blank);
  const roleWord = { owner: 'owner', pharmacist: 'pharmacist', staff: 'staff' }[d.role] || 'owner / pharmacist / staff';
  const smsLine = String(d.sms ?? '').trim() ? num(d.sms) : d.whatsapp ? 'same as WhatsApp' : blank;
  const subject = `Kendra registration request - ${code}`;
  const body = [
    'To the SamaSalt-Mitra team,',
    '',
    'Please register our Jan Aushadhi Kendra on SamaSalt-Mitra.',
    '',
    `Kendra code: ${code}`,
    `Kendra address (as in PMBI records): ${addr}`,
    `Kendra's WhatsApp number: ${num(d.whatsapp)}`,
    `Number for SMS and calls (if different): ${smsLine}`,
    `Opening hours: ${v(d.hours)}`,
    `Registered pharmacist: name ${v(d.pharmacist_name)}, Pharmacy Council registration no. ${v(d.pharmacist_reg)}`,
    `Person to call for confirmation: name ${v(d.contact_name)}, role ${roleWord}`,
    '',
    'Attached:',
    '1. PMBI allotment or agreement letter for this Kendra',
    '2. Valid retail drug licence of the Kendra',
    "3. Registration certificate of the Kendra's pharmacist (State Pharmacy Council)",
    '4. Signed consent of the Kendra owner to the terms below',
    '',
    'We agree that:',
    '- patients collect their medicines at the Kendra counter; there is no online sale, online payment or home delivery;',
    '- prescription medicines are given only against a valid prescription;',
    '- this number may be shown to patients who look up or scan our Kendra in SamaSalt-Mitra;',
    '- you will call this number to confirm before it is shown, and we can ask you to remove it at any time;',
    '- we will tell you if our number or opening hours change.',
    '',
    `Name of the Kendra owner: ${d.role === 'owner' ? v(d.contact_name) : blank}`,
    `Signature / seal: ${blank}`,
    `Date: ${d.date || blank}`,
  ].join('\n');
  return { subject, body };
}

// ── v1.2 Order requests (pickup only) ────────────────────────────────────────
// The patient sends a list of Jan Aushadhi medicines, in packs, to a registered Kendra by WhatsApp
// or SMS from their own phone. Nothing is stored on our server. Quantities are packs to collect,
// never doses (no dosage advice). Never-switch (NTI) medicines and medicines without a Jan Aushadhi
// equivalent are left out, with the reason shown.

export const ORDER_MAX_PACKS = 10;

/** Packs for one item: a whole number from 1 to ORDER_MAX_PACKS (anything else → 1). */
export function orderQty(n) {
  const q = Math.floor(Number(n));
  return Number.isFinite(q) && q >= 1 ? Math.min(q, ORDER_MAX_PACKS) : 1;
}

/**
 * Split the medicine list into what can be ordered from a Jan Aushadhi Kendra and what cannot.
 * Returns { items: [{ ckey, name, code, unit_size, mrp, qty, line }], excluded: [{ ckey, name, reason: 'nti' | 'noja' }], total }.
 */
export function orderItems(list) {
  const items = [];
  const excluded = [];
  for (const x of Array.isArray(list) ? list : []) {
    if (!x) continue;
    if (x.nti) excluded.push({ ckey: x.ckey, name: x.name, reason: 'nti' });
    else if (!x.ja) excluded.push({ ckey: x.ckey, name: x.name, reason: 'noja' });
    else {
      const qty = orderQty(x.qty);
      const mrp = Number.isFinite(x.ja.mrp) && x.ja.mrp > 0 ? x.ja.mrp : null;
      items.push({ ckey: x.ckey, name: x.ja.name, code: x.ja.code, unit_size: x.ja.unit_size || '', mrp, qty, line: mrp != null ? Math.round(mrp * qty * 100) / 100 : null });
    }
  }
  // A total only when every item has an MRP (otherwise it would understate the bill).
  const total = items.length && items.every((i) => i.line != null) ? Math.round(items.reduce((a, i) => a + i.line, 0) * 100) / 100 : null;
  return { items, excluded, total };
}

const msgClean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * The message the patient sends. `tr(key, vars)` gives the text in the patient's language and
 * `en(key, vars)` in English; medicine names are the official PMBI (English) names. When the
 * patient's language is not English, the instructions are given in both.
 * Keys: msgHead, msgKendra, msgPacks, msgTotal, msgPickup, msgReply.
 */
export function orderMessage(kendra, order, tr, en = null, money = (v) => `Rs ${v}`) {
  const lines = (f) => [
    f('msgHead'),
    f('msgKendra', { code: kendraCode(kendra?.code) || '' }),
    '',
    ...order.items.map((i, n) => `${n + 1}. ${msgClean(i.name)} (PMBJP ${msgClean(i.code)})${i.unit_size ? ` - ${msgClean(i.unit_size)}` : ''} - ${f('msgPacks', { n: i.qty })}`),
    '',
    ...(order.total != null ? [f('msgTotal', { amount: money(order.total) }), ''] : []),
    f('msgPickup'),
    f('msgReply'),
  ];
  const main = lines(tr);
  if (!en) return main.join('\n');
  // English for the pharmacist, without repeating the list.
  return [...main, '', '---', en('msgHead'), en('msgPickup'), en('msgReply')].join('\n');
}

/** WhatsApp and SMS links that open the patient's own app with the message ready to send. */
export function waLink(mobile, text) {
  const m = mobile10(mobile);
  return m ? `https://wa.me/91${m}?text=${encodeURIComponent(text)}` : null;
}
export function smsLink(mobile, text) {
  const m = mobile10(mobile);
  return m ? `sms:+91${m}?body=${encodeURIComponent(text)}` : null;
}

// ── v1.3 weak-network mode ──────────────────────────────────────────────────
// Photo upload size: smaller on a slow connection or when the phone asks to save data, but never
// so small that the print on a strip cannot be read (the vision check rejects blurry reads anyway).
export const PHOTO_SEND = { side: 1280, quality: 0.85 };
export const PHOTO_SEND_LIGHT = { side: 1024, quality: 0.72 };
export function photoSendSize(conn) {
  if (!conn) return PHOTO_SEND;
  if (conn.saveData) return PHOTO_SEND_LIGHT;
  return ['slow-2g', '2g', '3g'].includes(conn.effectiveType) ? PHOTO_SEND_LIGHT : PHOTO_SEND;
}

// How long to wait for an answer before saying the connection is too slow (photos take longer).
export function askTimeoutMs(hasImage, conn) {
  const slow = conn && (conn.saveData || ['slow-2g', '2g'].includes(conn.effectiveType));
  return (hasImage ? 45_000 : 25_000) * (slow ? 2 : 1);
}

// The last answer, kept for this visit only (sessionStorage) so it can be seen again without
// internet. Only a finished answer is kept; never a photo, never a pending confirmation.
export function savableAnswer(r) {
  if (!r || r.status !== 'ok' || !r.medicine) return null;
  if (r.needs_confirmation && !r.confirmed) return null;
  const { image, trace, ...rest } = r; // eslint-disable-line no-unused-vars
  return { ...rest, fresh: false, savedAt: Date.now() };
}

// v2.0.19 (roadmap C6): this visit's answers are kept on the phone, so the same medicine (or the same photo)
// checked again is shown at once, with no request: no database row, no AI. Same language and PIN only.
// Only finished answers; never one waiting for "yes", an error, or a limit message.
const CACHE_STATUSES = new Set(['ok', 'not_found', 'incomplete', 'unreadable']);
export const ANSWER_CACHE_MAX = 15;
/** The key of a check: the typed name (case and spaces aside) or the photo's fingerprint, with language and PIN. */
export function answerKey({ text, image, imageHash, lang, pin }) {
  const where = `${lang || 'en'}|${/^\d{6}$/.test(String(pin || '')) ? pin : ''}`;
  if (image) return imageHash ? `p|${imageHash}|${where}` : null;
  const t = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return t ? `t|${t}|${where}` : null;
}
/** What is kept of an answer: the server's answer as it came, nothing the screen added. */
export function cacheableAnswer(r) {
  if (!r || !CACHE_STATUSES.has(r.status)) return null;
  const { image, confirmed, addedToList, fresh, unreadCounted, typed, savedAt, ...rest } = r; // eslint-disable-line no-unused-vars
  return rest;
}
/** The kept answers with this one added (newest last, at most ANSWER_CACHE_MAX). */
export function rememberAnswer(list, key, r) {
  const keep = cacheableAnswer(r);
  if (!key || !keep) return list || [];
  return [...(list || []).filter(([k]) => k !== key), [key, keep]].slice(-ANSWER_CACHE_MAX);
}

// ── v1.3 Registered volunteers ──────────────────────────────────────────────
// A volunteer's code (SV- and 5 letters/digits, no 0/O/1/I), as in the personal link /v/SV-XXXXX.
export function volunteerCode(s) {
  const m = String(s ?? '').trim().toUpperCase().match(/^SV-?([A-HJ-NP-Z2-9]{5})$/);
  return m ? `SV-${m[1]}` : null;
}
export const VOLUNTEER_IDS = ['aadhaar', 'voter', 'driving', 'pan', 'org', 'other'];
export const VOLUNTEER_CHANNELS = ['phone', 'email', 'in_person'];

/** Check a volunteer's details. { ok, value } or { ok: false, error } (error: a vErr* key). */
export function validateVolunteer(b) {
  b = b && typeof b === 'object' ? b : {};
  const name = clean(b.name, 60);
  if (name.length < 2) return { ok: false, error: 'vErrName' };
  const mobile = mobile10(b.mobile);
  if (!mobile) return { ok: false, error: 'vErrMobile' };
  const district = clean(b.district, 40);
  if (district.length < 2) return { ok: false, error: 'vErrDistrict' };
  let pin = null;
  if (String(b.pin ?? '').trim()) {
    pin = String(b.pin).replace(/\D/g, '');
    if (!/^[1-9]\d{5}$/.test(pin)) return { ok: false, error: 'vErrPin' };
  }
  const organisation = clean(b.organisation, 80) || null;
  const languages = clean(b.languages, 60) || null;
  if (b.consent !== true) return { ok: false, error: 'vErrConsent' };
  return { ok: true, value: { name, mobile, district, pin, organisation, languages } };
}

/** The request a person sends to become a volunteer (prepared on /volunteer; nothing is saved). */
export function volunteerRequest(v, d = new Date()) {
  const line = (k, x) => (x ? `${k}: ${String(x).replace(/[<>]/g, ' ')}\n` : '');
  return {
    subject: `Volunteer registration request - ${v.district || ''}`.trim(),
    body:
      'Dear SamaSalt-Mitra team,\n\nI would like to register as a SamaSalt-Mitra volunteer.\n\n' +
      line('Name', v.name) + line('Mobile', v.mobile ? showMobile(v.mobile) : '') + line('District', v.district) +
      line('PIN code', v.pin) + line('Organisation', v.organisation) + line('Languages', v.languages) +
      '\nI have read and agree to the volunteer terms on the SamaSalt-Mitra volunteer page. ' +
      'I will show an ID (Aadhaar, voter ID or other) when the registrar asks.\n\n' +
      `Date: ${d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}\n`,
  };
}

/** The message a reviewer sends a newly approved volunteer, with their personal link. */
export function volunteerWelcome(v, origin) {
  return `Hello ${v.name}, you are now a registered SamaSalt-Mitra volunteer (${v.code}).\n\n` +
    `Open your personal link on the phone you use with patients: ${origin}/v/${v.code}\n\n` +
    'It turns on volunteer mode and counts the checks you help with (never any patient details). ' +
    'Remember: never advise on doses, never suggest switching a medicine marked "same brand only", ' +
    'and always ask the patient to check with their doctor or pharmacist before switching. Thank you!';
}

/**
 * v2.0.4 Share the answer (to family, on WhatsApp or any app). Only the templated answer and
 * official prices: the same facts as on screen. A never-switch (NTI) medicine shares its warning
 * only (no generic, no price). Keys: shareJa, waCeiling, shareFooter.
 */
// v2.0.9 P3 "Show this to your doctor": the medicines in the pharmacist list as salt + strength +
// form (+ release), from our data, for the doctor to write by salt name. No prices, no dosage.
// A never-switch medicine is left out (no request to change it), and so is one without salts.
export function doctorNote(list) {
  const items = [], left = [];
  for (const x of Array.isArray(list) ? list : []) {
    if (!x || typeof x.name !== 'string') continue;
    const [, form = '', rel = ''] = String(x.ckey || '').split('|');
    if (x.nti || x.unlisted || !x.composition || !form) { left.push(x.name); continue; }
    const line = [x.composition, form, rel].filter(Boolean).join(' · ');
    if (!items.includes(line)) items.push(line);
  }
  return { items, left };
}

export function shareText(r, tr, money, per, link) {
  const m = r?.medicine;
  if (!m || r.status !== 'ok') return '';
  const L = [`${msgClean(m.name)} (${msgClean(m.composition)})`, '', String(r.answer || '').trim()];
  if (!m.nti) {
    const p = r.jan_aushadhi?.available && r.jan_aushadhi.product;
    if (p) L.push('', tr('shareJa', { name: msgClean(p.generic_name), code: msgClean(p.drug_code), size: p.unit_size ? ` · ${msgClean(p.unit_size)}` : '', mrp: money(p.mrp) }));
    if (r.ceiling?.available) L.push(tr('waCeiling', { price: money(r.ceiling.unit_price), per }));
  }
  L.push('', tr('shareFooter', { link }));
  return L.join('\n');
}
