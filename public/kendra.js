// /kendra: two parts on one page.
//  - Register a Kendra (default, public, en/kn/hi): partner-style page. The online form saves
//    nothing; "Submit" prepares the standard request email (with the details filled in) and an
//    email button. The Kendra sends it with the documents; a Registrar enters it; a Reviewer
//    calls and approves. A "Print QR poster" box at the top serves Kendras already registered.
//  - Staff console (#admin, "Staff login"): one sign-in, role-based (public/admin.js, on demand).
import { LANGS, STRINGS, t } from '/strings.js';
import { kendraCode, registrationEmail, validateKendraRegistration, showMobile, mobile10 } from '/rules.js';

const $ = (s) => document.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const params = new URLSearchParams(location.search);
if (params.has('lang') && STRINGS[params.get('lang')]) store.set('ss_lang', params.get('lang'));
let lang = STRINGS[store.get('ss_lang')] ? store.get('ss_lang') : 'en';
// Developer mode only while the address has ?dev=1 (see app.js).
const isTest = params.get('dev') === '1';
const headers = isTest ? { 'x-samasalt-mitra-test': '1' } : {};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let found = null; // the Kendra confirmed by "Find"
let errKey = null;
let statusKey = null;
let posterErrKey = null;
let regEmail = null; // where requests go (REGISTRATION_EMAIL), from /api/health
let prepared = null; // the details sent to step 2

function applyStrings() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(lang, el.dataset.t);
  showErr(errKey);
  showStatus(statusKey);
  showPosterErr(posterErrKey);
  if (found) showFound(found);
  if (prepared) renderSend();
}
function renderLangs() {
  const box = $('#langs');
  for (const l of LANGS) {
    const o = document.createElement('option');
    o.value = l.code;
    o.textContent = l.label;
    box.appendChild(o);
  }
  box.value = lang;
  box.onchange = () => { lang = box.value; store.set('ss_lang', lang); applyStrings(); };
}
function showErr(key) {
  errKey = key;
  $('#err').hidden = !key;
  $('#err').textContent = key ? t(lang, key) : '';
}
function showStatus(key) {
  statusKey = key;
  $('#statusNote').hidden = !key;
  $('#statusNote').textContent = key ? t(lang, key) : '';
}
function showPosterErr(key) {
  posterErrKey = key;
  $('#posterErr').hidden = !key;
  $('#posterErr').textContent = key ? t(lang, key) : '';
}
function showFound(k) {
  $('#found').hidden = false;
  $('#found').innerHTML = `<b>${esc(t(lang, 'krFound'))}</b>${esc(k.code)} · ${esc([k.address, k.district, k.state].filter(Boolean).join(', '))} · PIN ${esc(k.pin)}`;
}

// ── Print QR poster (registered Kendras) ──
$('#posterForm').onsubmit = (e) => {
  e.preventDefault();
  const code = kendraCode($('#posterCode').value);
  if (!code) return showPosterErr('krErrCode');
  showPosterErr(null);
  location.href = `/poster?k=${code}${isTest ? '&dev=1' : ''}`;
};
$('#ctaPoster').onclick = (e) => {
  e.preventDefault();
  $('#poster').scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => $('#posterCode').focus({ preventScroll: true }), 350);
};

// ── Step 1: the online form ──
async function find() {
  showErr(null);
  showStatus(null);
  found = null;
  $('#found').hidden = true;
  const code = kendraCode($('#code').value);
  if (!code) { showErr('krErrCode'); return false; }
  $('#code').value = code;
  try {
    const res = await fetch(`/api/kendra/${code}`, { headers });
    const k = await res.json();
    if (!k.found) { showErr(k.error || 'krErrNotFound'); return false; }
    found = k;
    showFound(k);
    if (!$('#posterCode').value) $('#posterCode').value = code;
    if (k.registry === 'approved') showStatus('krErrTaken');
    else if (k.registry === 'pending') showStatus('krAlreadyWaiting');
    return true;
  } catch {
    showErr('krErrNetwork');
    return false;
  }
}
$('#findBtn').onclick = find;
$('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } });
$('#code').addEventListener('input', () => { if (found && kendraCode($('#code').value) !== found.code) { found = null; $('#found').hidden = true; showStatus(null); } });
$('#termsLink').onclick = (e) => {
  e.preventDefault();
  $('#terms').open = true;
  $('#terms').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const formValues = () => ({
  code: $('#code').value,
  contact_name: $('#contact_name').value,
  role: $('#role').value,
  whatsapp: $('#whatsapp').value,
  sms: $('#sms').value,
  hours: $('#hours').value,
  pharmacist_name: $('#pharmacist_name').value,
  pharmacist_reg: $('#pharmacist_reg').value,
  consent: $('#consent').checked,
});
const FIELD = { krErrCode: '#code', krErrWhatsapp: '#whatsapp', krErrSms: '#sms', krErrName: '#contact_name', krErrRole: '#role', krErrConsent: '#consent' };

$('#applyForm').onsubmit = async (e) => {
  e.preventDefault();
  showErr(null);
  const d = formValues();
  // Same checks as the staff form and the Worker (rules.js).
  const v = validateKendraRegistration(d);
  if (!v.ok) { showErr(v.error); $(FIELD[v.error] || '#code')?.focus(); return; }
  if (!found || found.code !== v.value.code) {
    $('#submitBtn').disabled = true;
    const ok = await find();
    $('#submitBtn').disabled = false;
    if (!ok) { $('#code').focus(); return; }
  }
  if (found.registry === 'approved') { showErr('krErrTaken'); return; }
  prepared = { ...d, ...v.value, date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) };
  renderSend();
  $('#formCard').hidden = true;
  $('#sendCard').hidden = false;
  $('#sendCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#sendCard').focus({ preventScroll: true });
};

// ── Step 2: send the prepared email ──
function renderSend() {
  const d = prepared;
  const e = registrationEmail(found, d);
  const role = t(lang, { owner: 'krRoleOwner', pharmacist: 'krRolePharmacist', staff: 'krRoleStaff' }[d.role]);
  const rows = [
    [t(lang, 'krSumKendra'), `${found.code} · ${[found.address, found.district, found.pin].filter(Boolean).join(', ')}`],
    [t(lang, 'krSumContact'), `${d.contact_name} (${role})`],
    ['WhatsApp', showMobile(d.whatsapp)],
    ...(d.sms ? [['SMS', showMobile(mobile10(d.sms))]] : []),
    ...(d.hours ? [[t(lang, 'krSumHours'), d.hours]] : []),
  ];
  $('#summary').innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  $('#emailText').textContent = `${regEmail ? `To: ${regEmail}\n` : ''}Subject: ${e.subject}\n\n${e.body}`;
  $('#emailTo').textContent = regEmail ? t(lang, 'krEmailTo', { email: regEmail }) : t(lang, 'krEmailNotSet');
  $('#emailTo').className = regEmail ? 'email-to' : 'email-to kmsg info';
  const send = $('#emailSend');
  send.hidden = !regEmail;
  if (regEmail) send.href = `mailto:${encodeURIComponent(regEmail)}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`;
}
$('#emailCopy').onclick = async () => {
  const text = $('#emailText').textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older phones: open the email and select it so it can be copied by hand.
    $('#sendCard details.see').open = true;
    const r = document.createRange();
    r.selectNodeContents($('#emailText'));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  }
  $('#copied').hidden = false;
  $('#copied').textContent = t(lang, 'krEmailCopied');
  setTimeout(() => { $('#copied').hidden = true; }, 4000);
};
$('#editBtn').onclick = () => {
  $('#sendCard').hidden = true;
  $('#formCard').hidden = false;
  $('#formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

fetch('/api/health').then((r) => r.json()).then((h) => { regEmail = h.registration_email || null; if (prepared) renderSend(); }).catch(() => {});

// ── Public page (default) · Staff console (#admin, from "Staff login") ──
async function setMode(admin, push = true) {
  $('#regView').hidden = admin;
  $('#adminView').hidden = !admin;
  $('#staffLink').hidden = admin;
  $('footer.foot').hidden = admin;
  document.body.classList.toggle('console', admin); // wide layout on desktops (kendra.html)
  document.title = (admin ? 'Staff console · SamaSalt-Mitra' : 'Register your Jan Aushadhi Kendra · SamaSalt-Mitra').replace(/^/, document.title.startsWith('[TEST] ') ? '[TEST] ' : '');
  if (push && (location.hash === '#admin') !== admin) history.pushState(null, '', admin ? '#admin' : location.pathname + location.search);
  scrollTo(0, 0);
  if (admin) (await import('/admin.js')).startAdmin();
}
$('#staffLink').onclick = (e) => { e.preventDefault(); setMode(true); };
$('#backLink').onclick = (e) => { e.preventDefault(); setMode(false); };
$('#backLink').href = location.pathname + location.search;
// Back/forward between the two parts. (In-page links like #apply also change the hash: ignored.)
const follow = () => { if ((location.hash === '#admin') !== $('#regView').hidden) setMode(location.hash === '#admin', false); };
addEventListener('popstate', follow);
addEventListener('hashchange', follow);

renderLangs();
applyStrings();
const pre = kendraCode(params.get('k'));
if (pre) { $('#code').value = pre; $('#posterCode').value = pre; find(); }
if (location.hash === '#admin') setMode(true, false);
