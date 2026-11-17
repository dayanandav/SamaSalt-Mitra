// Staff console of /kendra (#admin, "Staff login"). One sign-in (username + password); the
// account's role decides what the person sees, as in most admin consoles:
//   Registrar : New registration (from a Kendra's request by email or in person) + the list.
//   Reviewer  : the list, with approve / reject / withdraw / modify.
//   Admin     : all of that + Staff accounts (adds Reviewers and Registrars).
//   System owner (setup key = ADMIN_TOKEN): everything, incl. adding Admins.
// The Worker checks every permission again; this page only hides what a role cannot use.
// The session is an HttpOnly cookie set by /api/admin/login; this page never sees it.
import { showMobile, kendraCode } from '/rules.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—');
// For the one-line list: "17 Nov" (time is in the details).
const whenShort = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: '2-digit' }) });
};
const KROLE = { pharmacist: 'Pharmacist', owner: 'Owner', staff: 'Staff' };
const ROLE = { admin: 'Admin', reviewer: 'Reviewer', registrar: 'Registrar', owner: 'System owner' };
const CAN_TEXT = {
  registrar: 'You register Kendras from their requests (email or in person). A Reviewer approves them.',
  reviewer: 'You call Kendras, then approve, reject, withdraw or modify their registrations.',
  admin: 'You manage Reviewer and Registrar accounts, and can register, review and modify.',
  owner: 'Setup key: everything, including Admin accounts.',
};
const ACT = { approve: 'Approved', reject: 'Rejected', withdraw: 'Withdrew', edit: 'Modified' };
const FIELD = { whatsapp: 'WhatsApp', sms: 'SMS / calls', contact_name: 'contact', role: 'role', hours: 'hours' };
let me = null;
let status = 'pending';
const can = (p) => !!me?.can?.includes(p);

function msg(el, kind, text) {
  el.hidden = !text;
  el.className = `amsg ${kind}`;
  el.textContent = text || '';
}

async function api(path, body) {
  const res = await fetch(`/api/admin${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-samasalt-admin': '1', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (res.status === 401 && path !== '/login') { showSignin('Your session has ended. Sign in again.'); throw new Error('signed out'); }
  if (!res.ok) throw Object.assign(new Error(data.detail || data.error || `HTTP ${res.status}`), { data });
  return data;
}

// ── Sign in / out ────────────────────────────────────────────────────────────
function showSignin(note, kind = 'err') {
  me = null;
  $('#app').hidden = true;
  $('#signin').hidden = false;
  msg($('#loginMsg'), kind, note || '');
}

function showApp(who) {
  me = who;
  $('#signin').hidden = true;
  $('#app').hidden = false;
  $('#whoName').textContent = who.name;
  $('#whoRole').textContent = ROLE[who.role] || who.role;
  $('#whoRole').className = `badge ${who.role}`;
  $('#whoUser').textContent = who.username === 'owner' ? '' : who.username;
  $('#whoCan').textContent = CAN_TEXT[who.role] || '';
  // Tabs this role can use.
  const tabBtn = (id) => document.querySelector(`.tabs [data-tab=${id}]`);
  tabBtn('newTab').hidden = !can('register');
  tabBtn('staffTab').hidden = !can('staff');
  // Adding an Admin: system owner only. (Removed, not hidden: <option hidden> is ignored by some phones.)
  // Rebuilt on every sign-in: an Admin and the system owner may use the same page one after the other.
  $('#uRoleAdmin')?.remove();
  if (can('admins')) $('#uRole').insertAdjacentHTML('beforeend', '<option value="admin" id="uRoleAdmin">Admin</option>');
  showRoleHelp();
  $('#staffHint').textContent = can('admins')
    ? `Add Admins, Reviewers and Registrars. ${pointWord()} an account to reset its password or remove it; removing signs it out at once.`
    : `Add Reviewers and Registrars. ${pointWord()} an account to reset its password or remove it; removing signs it out at once. Only the system owner manages Admin accounts.`;
  showTab(who.role === 'registrar' ? 'newTab' : 'regsTab');
  loadRegs();
  if (can('staff')) loadUsers();
}

function showTab(id) {
  for (const b of document.querySelectorAll('.tabs [data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === id));
  for (const t of document.querySelectorAll('.tab')) t.hidden = t.id !== id;
}
for (const b of document.querySelectorAll('.tabs [data-tab]')) b.onclick = () => showTab(b.dataset.tab);

async function signIn(body, btn) {
  msg($('#loginMsg'), 'err', '');
  btn.disabled = true;
  try {
    await api('/login', body);
    $('#lPass').value = '';
    $('#lToken').value = '';
    showApp(await api('/me'));
  } catch (err) {
    if (err.message !== 'signed out') msg($('#loginMsg'), 'err', err.message);
  } finally {
    btn.disabled = false;
  }
}
$('#loginForm').onsubmit = (e) => {
  e.preventDefault();
  signIn({ username: $('#lUser').value.trim(), password: $('#lPass').value }, $('#loginBtn'));
};
$('#keyForm').onsubmit = (e) => {
  e.preventDefault();
  signIn({ token: $('#lToken').value.trim() }, $('#keyBtn'));
};

$('#logoutBtn').onclick = async () => {
  try { await api('/logout', {}); } catch {}
  showSignin('Signed out.', 'info');
};

// ── Registrations ────────────────────────────────────────────────────────────
for (const b of document.querySelectorAll('#filters button')) {
  b.onclick = () => {
    status = b.dataset.s;
    for (const x of document.querySelectorAll('#filters button')) x.setAttribute('aria-pressed', String(x === b));
    open.clear(); // a new tab starts with every Kendra closed, one line each
    loadRegs();
  };
}

const tel = (d) => (d ? `<a href="tel:+91${esc(d)}">${esc(showMobile(d))}</a>` : '—');
const regsByCode = new Map();

function editHtml(k) {
  const opt = (v, l) => `<option value="${v}"${k.role === v ? ' selected' : ''}>${l}</option>`;
  return `<div class="edit-box" hidden>
    <form class="af edit" data-code="${esc(k.code)}" novalidate>
      <label>Kendra's WhatsApp number<input type="text" name="whatsapp" inputmode="tel" maxlength="16" value="${esc(showMobile(k.whatsapp))}"></label>
      <label>Number for SMS and calls (if different)<input type="text" name="sms" inputmode="tel" maxlength="16" value="${esc(k.sms ? showMobile(k.sms) : '')}"></label>
      <label>Person to call<input type="text" name="contact_name" maxlength="60" value="${esc(k.contact_name)}"></label>
      <label>Their role<select name="role">${opt('pharmacist', 'Pharmacist')}${opt('owner', 'Owner')}${opt('staff', 'Staff')}</select></label>
      <label>Opening hours<input type="text" name="hours" maxlength="80" value="${esc(k.hours || '')}"></label>
      <label>Reason for the change (kept in the history)<textarea name="note" maxlength="200" placeholder="e.g. Kendra emailed a new WhatsApp number on 17 Nov"></textarea></label>
      ${k.status === 'approved' ? '<p class="amsg warn" style="margin:0">A new WhatsApp or SMS number sends this Kendra back to Waiting: the new number must be called and approved again before patients see it.</p>' : ''}
      <div class="btns">
        <button class="primary" type="submit" name="act" value="save">Save changes</button>
        <button class="secondary" type="button" data-do="cancel-edit">Cancel</button>
      </div>
    </form>
  </div>`;
}

function regHtml(k, n) {
  const canReview = can('review');
  let docs = null;
  try { docs = k.docs_checked ? JSON.parse(k.docs_checked) : null; } catch {}
  const docsOk = docs && Object.values(docs).every(Boolean);
  const how = k.request_channel === 'in_person' ? 'in person' : 'from the email request';
  const entered = k.registered_by
    ? `<p class="muted-sm" style="margin:0">Registered by ${esc(k.registered_by)} ${how}: ${esc(k.request_ref || '—')} · ${docsOk ? 'all required documents checked' : 'documents not all checked'}</p>`
    : '<p class="muted-sm" style="margin:0">Self-registered on the old public form (before registration by staff).</p>';
  const editable = canReview && ['pending', 'approved'].includes(k.status);
  const modifyBtn = editable ? '<button class="secondary" type="button" data-do="edit">Modify details</button>' : '';
  const poster = k.status === 'approved' ? `<a class="secondary" href="/poster?k=${esc(k.code)}&dev=1" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;width:auto;min-height:44px;padding:10px 18px;font-size:15px">Poster</a>` : '';
  const review = !canReview
    ? (k.status === 'pending' ? '<p class="amsg info" style="margin:0">Waiting for a Reviewer to call the Kendra and approve.</p>' : '')
    : k.status === 'pending' ? `
    <form class="af review" data-code="${esc(k.code)}">
      <fieldset class="checks">
        <legend>Before approving, confirm:</legend>
        <label><input type="checkbox" name="called"> I called ${esc(showMobile(k.sms || k.whatsapp))} and spoke to ${esc(k.contact_name)}.</label>
        <label><input type="checkbox" name="details"> They confirmed the Kendra code and the address match the official Kendra list shown here.</label>
        <label><input type="checkbox" name="terms"> They understood the terms: pickup at the counter only, no delivery, and this number is shown to patients.</label>
      </fieldset>
      <label>Note (how you checked it, or why you reject)<textarea name="note" maxlength="200" placeholder="e.g. Called 17 Nov 11:20, spoke to the pharmacist, code and address confirmed"></textarea></label>
      <div class="btns">
        <button class="primary" type="submit" name="act" value="approve" disabled>Approve</button>
        <button class="secondary" type="submit" name="act" value="reject">Reject</button>
        ${modifyBtn}
      </div>
    </form>` : k.status === 'approved' ? `
    <form class="af review" data-code="${esc(k.code)}">
      <label>Reason to withdraw (if the Kendra asks, or the number is wrong)<textarea name="note" maxlength="200"></textarea></label>
      <div class="btns">
        <button class="secondary" type="submit" name="act" value="withdraw">Withdraw</button>
        ${modifyBtn}
        ${poster}
      </div>
    </form>` : '';
  const body = `<div class="body">
    <p class="muted-sm" style="margin:0">Ref ${esc(k.ref)} · registered ${esc(when(k.created_at))}${k.updated_at && k.updated_at !== k.created_at ? ` · last change ${esc(when(k.updated_at))}` : ''}</p>
    <div class="cmp">
      <div><span class="cap2">Official Kendra list</span>${esc([k.address, k.district, k.state].filter(Boolean).join(', ') || 'not in the list')}<br>PIN ${esc(k.pin || '—')}</div>
      <div><span class="cap2">Given by the Kendra</span>WhatsApp ${tel(k.whatsapp)}${k.sms ? `<br>SMS / calls ${tel(k.sms)}` : ''}<br>${esc(k.contact_name)} (${esc(KROLE[k.role] || k.role)})${k.hours ? `<br>Open: ${esc(k.hours)}` : ''}</div>
    </div>
    ${k.status === 'approved' ? `<p class="muted-sm" style="margin:0">Approved by ${esc(k.verified_by || '—')} on ${esc(when(k.verified_at))}${k.admin_note ? ` · ${esc(k.admin_note)}` : ''}</p>` : k.admin_note ? `<p class="muted-sm" style="margin:0">Note: ${esc(k.admin_note)}</p>` : ''}
    ${entered}
    ${review}
    ${editable ? editHtml(k) : ''}
    <div class="hist"><p class="cap2">Review history</p><ol><li>Loading…</li></ol></div>
    </div>`;
  // Desktop: the details go in the side panel (see renderRegs).
  if (wide.matches) return body;
  // Phone: one numbered line per Kendra; tap it for the full details, actions and history.
  return `<details class="reg" data-code="${esc(k.code)}"${open.has(k.code) ? ' open' : ''}>
    <summary class="line"><span class="sn">${n}.</span><b>${esc(k.code)}</b><span class="st ${esc(k.status)}">${esc(k.status)}</span><span class="meta">${esc(k.ref)} · ${esc(whenShort(k.created_at))}</span></summary>
    ${body}
  </details>`;
}

// Desktop (wide screens): a table of registrations, and the chosen one's details in a side panel.
// Phones keep the one-line list that opens in place. The same delegated handlers serve both:
// the panel is a ".reg" with a ".body", like an open row.
const wide = matchMedia('(min-width: 1000px)');
const pointWord = () => (wide.matches ? 'Click' : 'Tap');

// Rows open now (kept open across a reload of the list, e.g. after an action). On desktop: the one in the panel.
const open = new Set();
let searchText = '';
let regItems = [];

function renderRegs() {
  const box = $('#regs');
  if (!wide.matches) {
    box.className = '';
    box.innerHTML = regItems.map((k, i) => regHtml(k, i + 1)).join('');
    for (const d of box.querySelectorAll('details.reg[open]')) loadHistory(d);
    return;
  }
  // One selected Kendra at most.
  const sel = regItems.find((k) => open.has(k.code));
  open.clear();
  if (sel) open.add(sel.code);
  box.className = 'split';
  if (!regItems.length) { box.innerHTML = ''; return; }
  const rows = regItems.map((k, i) => `<tr class="trow${sel?.code === k.code ? ' sel' : ''}" data-code="${esc(k.code)}" tabindex="0" aria-selected="${sel?.code === k.code}">
      <td class="num">${i + 1}</td><td><b>${esc(k.code)}</b></td><td><span class="st ${esc(k.status)}">${esc(k.status)}</span></td>
      <td>${esc(k.ref)}</td><td>${esc(k.district || '—')}</td><td>${esc(whenShort(k.created_at))}</td><td>${esc(k.registered_by || '—')}</td></tr>`).join('');
  const panel = sel
    ? `<div class="reg panel" data-code="${esc(sel.code)}"><div class="panel-head"><b>${esc(sel.code)}</b><span class="st ${esc(sel.status)}">${esc(sel.status)}</span><button class="link" type="button" data-do="close-panel" aria-label="Close details">Close ✕</button></div>${regHtml(sel)}</div>`
    : '<div class="panel empty"><p class="muted-sm" style="margin:0">Click a Kendra in the table to see its details, review it and see its history.</p></div>';
  box.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="num">#</th><th>Kendra code</th><th>Status</th><th>Ref</th><th>District</th><th>Received</th><th>Registered by</th></tr></thead><tbody>${rows}</tbody></table></div>${panel}`;
  const p = box.querySelector('.reg.panel');
  if (p) loadHistory(p);
}

// Desktop: choose a row (click or Enter), close the panel.
$('#regs').addEventListener('click', (e) => {
  const row = e.target.closest('tr.trow');
  if (row) { open.clear(); open.add(row.dataset.code); renderRegs(); return; }
  if (e.target.closest('[data-do=close-panel]')) { open.clear(); renderRegs(); }
});
$('#regs').addEventListener('keydown', (e) => {
  const row = e.target.closest('tr.trow');
  if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open.clear(); open.add(row.dataset.code); renderRegs(); $(`#regs tr.trow[data-code="${row.dataset.code}"]`)?.focus(); }
});
wide.addEventListener('change', () => { renderRegs(); renderUsers(); });

async function loadRegs() {
  msg($('#listMsg'), 'info', 'Loading…');
  try {
    const q = searchText.trim();
    const r = await api(`/kendra/list?status=${encodeURIComponent(status)}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
    const c = r.counts || {};
    const wait = document.querySelector('#filters [data-s=pending]');
    wait.textContent = `Waiting${c.pending ? ` (${c.pending})` : ''}`;
    if (q && !r.search) {
      msg($('#listMsg'), 'err', 'Search by Kendra code: PMBJK and digits, or just the digits (for example 99003).');
      regItems = [];
      $('#regs').innerHTML = '';
      return;
    }
    const word = (n) => `registration${n === 1 ? '' : 's'}`;
    const kind = status === 'all' ? '' : `${({ pending: 'waiting', approved: 'approved', rejected: 'rejected', withdrawn: 'withdrawn' })[status]} `;
    const scope = `${kind}${word(r.items.length)}`;
    msg($('#listMsg'), 'info', r.items.length ? `${r.items.length} ${scope}${q ? ` matching “${r.search}”` : ''}, in Kendra code order. ${pointWord()} one for details.` : q ? `No ${scope} matching “${r.search}”. Try the All tab.` : 'Nothing here.');
    regsByCode.clear();
    for (const k of r.items) regsByCode.set(k.code, k);
    regItems = r.items;
    renderRegs();
  } catch (e) {
    if (e.message !== 'signed out') msg($('#listMsg'), 'err', e.message);
  }
}

// Search as you type (short pause), or on Enter.
let searchTimer = null;
$('#regSearch').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { searchText = $('#regSearch').value; open.clear(); loadRegs(); }, 350);
});
$('#regSearchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(searchTimer);
  searchText = $('#regSearch').value; open.clear();
  loadRegs();
});

// Approve is possible only with all three boxes ticked and a note.
$('#regs').addEventListener('input', (e) => {
  const f = e.target.closest('form.review');
  if (!f) return;
  const ap = f.querySelector('button[value=approve]');
  if (ap) ap.disabled = !([...f.querySelectorAll('.checks input')].every((x) => x.checked) && f.note.value.trim().length >= 5);
});

// Modify details: open / close the edit box.
$('#regs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-do]');
  if (!b) return;
  const item = b.closest('.reg');
  const box = item.querySelector('.edit-box');
  if (!box) return;
  if (b.dataset.do === 'edit') { box.hidden = false; box.querySelector('input').focus(); }
  if (b.dataset.do === 'cancel-edit') { box.hidden = true; box.querySelector('form').reset(); }
});

function resultBox(item) {
  let out = item.querySelector(':scope > .body > .amsg.result');
  if (!out) { out = document.createElement('p'); item.querySelector('.body').appendChild(out); }
  return (kind, text) => { msg(out, kind, text); out.classList.add('result'); };
}

const KR_ERR = { krErrWhatsapp: 'Enter a 10-digit mobile number for WhatsApp.', krErrSms: 'Enter a 10-digit mobile number for SMS, or leave it empty.', krErrName: 'Enter the name of the person to call.', krErrRole: 'Choose their role.', krErrTaken: 'This Kendra is already approved. Withdraw it first, or modify its details.', krErrNotFound: 'This code is not in the official Kendra list.', krErrCode: 'Check the Kendra code.' };

$('#regs').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const item = f.closest('.reg');
  const show = resultBox(item);
  const buttons = () => f.querySelectorAll('button');
  // Save changes (modify details)
  if (f.matches('form.edit')) {
    const note = f.note.value.trim();
    if (note.length < 3) { show('err', 'Write the reason for the change first.'); f.note.focus(); return; }
    for (const b of buttons()) b.disabled = true;
    try {
      const el = f.elements; // (not f.role: that is the element's ARIA role)
      const r = await api('/kendra/update', { code: f.dataset.code, whatsapp: el.whatsapp.value, sms: el.sms.value, contact_name: el.contact_name.value, role: el.role.value, hours: el.hours.value, note });
      const back = r.previous === 'approved' && r.status === 'pending' ? ' It is back in Waiting: call the new number and approve again.' : '';
      show('ok', `${r.code}: changed ${r.changed.map((x) => FIELD[x] || x).join(', ')}, by ${r.by}.${back}`);
      setTimeout(loadRegs, 1500);
    } catch (err) {
      if (err.message === 'signed out') return;
      show('err', KR_ERR[err.data?.error] || err.message);
      for (const b of buttons()) b.disabled = false;
    }
    return;
  }
  // Approve / reject / withdraw
  const act = e.submitter?.value;
  if (!act) return;
  const checks = Object.fromEntries([...f.querySelectorAll('.checks input')].map((x) => [x.name, x.checked]));
  const note = f.note.value.trim();
  if (act !== 'approve' && note.length < 3) { show('err', 'Write a short reason first.'); f.note.focus(); return; }
  for (const b of buttons()) b.disabled = true;
  try {
    const r = await api('/kendra/decide', { code: f.dataset.code, action: act, note, checks });
    show('ok', `${r.code}: ${r.previous} → ${r.status}, by ${r.by}.`);
    setTimeout(loadRegs, 1200);
  } catch (err) {
    if (err.message === 'signed out') return;
    show('err', err.message);
    for (const b of buttons()) b.disabled = false;
    f.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

// Opening a row loads its review history.
const fmtChange = (f, [a, b]) => {
  const v = (x) => (x == null || x === '' ? '—' : f === 'whatsapp' || f === 'sms' ? showMobile(x) : f === 'role' ? KROLE[x] || x : x);
  return `${FIELD[f] || f} ${v(a)} → ${v(b)}`;
};
async function loadHistory(d) {
  const ol = d.querySelector('.hist ol');
  try {
    const r = await api(`/kendra/history?code=${encodeURIComponent(d.dataset.code)}`);
    ol.innerHTML = r.items.length
      ? r.items.map((h) => {
          const changes = h.changes ? ` · ${esc(Object.entries(h.changes).map(([f, ab]) => fmtChange(f, ab)).join('; '))}` : '';
          const back = h.action === 'edit' && h.from_status !== h.to_status ? ` · back to ${esc(h.to_status)}` : '';
          return `<li>${esc(when(h.at))}: <b>${esc(ACT[h.action] || h.action)}</b> by ${esc(h.admin_name)} (${esc(h.admin_username)})${h.checks ? ' · all checks confirmed' : ''}${changes}${back}${h.note ? ` · “${esc(h.note)}”` : ''}${h.whatsapp && h.action !== 'edit' ? ` · number ${esc(showMobile(h.whatsapp))}` : ''}</li>`;
        }).join('')
      : '<li>No review yet.</li>';
  } catch (err) {
    if (err.message !== 'signed out') ol.innerHTML = `<li>${esc(err.message)}</li>`;
  }
}
$('#regs').addEventListener('toggle', (e) => {
  const d = e.target;
  if (!d.matches?.('details.reg')) return;
  if (d.open) { open.add(d.dataset.code); loadHistory(d); } else open.delete(d.dataset.code);
}, true);

// ── New Kendra registration (Registrar, Admin) ──────────────────────────────
let nrKendra = null;
let nrChannel = 'email';
const CHANNEL = {
  email: { ref: 'Email request (date received, and subject or sender)', ph: 'e.g. 17 Nov 2026 · Kendra registration request - PMBJK00964 · kendra964@…', docs: 'Documents checked in the email:' },
  in_person: { ref: 'Visit (date, who came, and the ID you saw)', ph: 'e.g. 17 Nov 2026 · R. Kumar, Kendra owner · Aadhaar seen', docs: 'Original documents seen (keep a signed copy of the consent):' },
};
for (const b of document.querySelectorAll('#nrChannel button')) {
  b.onclick = () => {
    nrChannel = b.dataset.c;
    for (const x of document.querySelectorAll('#nrChannel button')) x.setAttribute('aria-pressed', String(x === b));
    $('#nrRefLabel').textContent = CHANNEL[nrChannel].ref;
    $('#nrRef').placeholder = CHANNEL[nrChannel].ph;
    $('#nrDocsLegend').textContent = CHANNEL[nrChannel].docs;
  };
}
function nrReady() {
  const docsOk = [...document.querySelectorAll('#nrForm .checks input')].every((x) => x.checked);
  $('#nrSubmit').disabled = !(nrKendra && nrKendra.registry !== 'approved' && docsOk && $('#nrRef').value.trim().length >= 5 && $('#nrWa').value.trim() && $('#nrName').value.trim());
}
$('#nrForm').addEventListener('input', nrReady);
$('#nrCode').addEventListener('input', () => { nrKendra = null; $('#nrFound').hidden = true; nrReady(); });
async function nrFind() {
  nrKendra = null;
  const code = kendraCode($('#nrCode').value);
  if (!code) { msg($('#nrFound'), 'err', 'Enter the Kendra code as PMBJK followed by 5 digits.'); return nrReady(); }
  $('#nrCode').value = code;
  try {
    const res = await fetch(`/api/kendra/${code}`);
    const k = await res.json();
    if (!k.found) msg($('#nrFound'), 'err', `${code} is not in the official Kendra list. Check the code in the request.`);
    else {
      nrKendra = k;
      const st = k.registry === 'approved' ? ' · ALREADY APPROVED: a Reviewer can modify its details or withdraw it' : k.registry === 'pending' ? ' · already waiting for review: registering again replaces it' : '';
      msg($('#nrFound'), k.registry === 'approved' ? 'err' : 'info', `Official list: ${[k.address, k.district, k.state].filter(Boolean).join(', ')} · PIN ${k.pin}${st}. Check this matches the documents.`);
    }
  } catch { msg($('#nrFound'), 'err', 'Could not reach the server.'); }
  nrReady();
}
$('#nrFind').onclick = nrFind;
$('#nrCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nrFind(); } });
$('#nrForm').onsubmit = async (e) => {
  e.preventDefault();
  if ($('#nrSubmit').disabled) return;
  const docs = Object.fromEntries([...document.querySelectorAll('#nrForm .checks input')].map((x) => [x.name, x.checked]));
  $('#nrSubmit').disabled = true;
  try {
    const r = await api('/kendra/register', {
      code: nrKendra.code, whatsapp: $('#nrWa').value, sms: $('#nrSms').value, contact_name: $('#nrName').value,
      role: $('#nrRole').value, hours: $('#nrHours').value, request_ref: $('#nrRef').value, request_channel: nrChannel, docs,
    });
    const tell = nrChannel === 'email' ? "Reply to the Kendra's email with this reference." : 'Give the Kendra this reference.';
    msg($('#nrMsg'), 'ok', `${r.code} registered (ref ${r.ref}), waiting for a Reviewer. ${tell}`);
    $('#nrForm').reset();
    nrKendra = null;
    $('#nrFound').hidden = true;
    open.clear();
    loadRegs();
  } catch (err) {
    if (err.message === 'signed out') return;
    msg($('#nrMsg'), 'err', KR_ERR[err.data?.error] || err.message);
  } finally {
    nrReady();
  }
};

// ── Staff accounts (Admin; system owner also manages Admins) ────────────────
// One numbered line per account; tap it for the details and actions (Reset password, Remove account).
// "Remove account" switches the account off and signs it out at once; the username stays reserved
// so the review history keeps pointing at the right person. A removed account can be restored.
const openUsers = new Set();
let userItems = [];
async function loadUsers() {
  try {
    userItems = (await api('/users')).items;
    renderUsers();
  } catch (e) {
    if (e.message !== 'signed out') msg($('#userMsg'), 'err', e.message);
  }
}

const userLocked = (u) => u.locked_until && u.locked_until > new Date().toISOString();
const userState = (u) => (!u.active ? '<span class="st rejected">removed</span>' : userLocked(u) ? '<span class="st pending">locked</span>' : '<span class="st approved">active</span>');

function renderUsers() {
  const box = $('#users');
  if (!userItems.length) { box.className = 'users'; box.innerHTML = '<p class="muted-sm" style="margin:0">No accounts yet. Add one below.</p>'; return; }
  if (!wide.matches) {
    box.className = 'users';
    box.innerHTML = userItems.map((u, i) => userHtml(u, i + 1)).join('');
    return;
  }
  // Desktop: table + the chosen account in a side panel.
  const sel = userItems.find((u) => openUsers.has(u.username));
  openUsers.clear();
  if (sel) openUsers.add(sel.username);
  box.className = 'users split';
  const rows = userItems.map((u, i) => `<tr class="trow${sel?.username === u.username ? ' sel' : ''}" data-u="${esc(u.username)}" tabindex="0" aria-selected="${sel?.username === u.username}">
      <td class="num">${i + 1}</td><td><b>${esc(u.name)}</b></td><td><span class="badge ${esc(u.role)}">${esc(ROLE[u.role] || u.role)}</span></td>
      <td>${esc(u.username)}</td><td>${userState(u)}</td><td>${u.last_login_at ? esc(whenShort(u.last_login_at)) : 'never'}</td></tr>`).join('');
  const panel = sel
    ? `<div class="reg user-row panel" data-u="${esc(sel.username)}"><div class="panel-head"><b>${esc(sel.name)}</b><span class="badge ${esc(sel.role)}">${esc(ROLE[sel.role] || sel.role)}</span><button class="link" type="button" data-do="close-panel" aria-label="Close details">Close ✕</button></div>${userHtml(sel)}</div>`
    : '<div class="panel empty"><p class="muted-sm" style="margin:0">Click an account to see its details, reset its password or remove it.</p></div>';
  box.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="num">#</th><th>Name</th><th>Role</th><th>Username</th><th>Status</th><th>Last sign-in</th></tr></thead><tbody>${rows}</tbody></table></div>${panel}`;
}

$('#users').addEventListener('click', (e) => {
  const row = e.target.closest('tr.trow');
  if (row) { openUsers.clear(); openUsers.add(row.dataset.u); renderUsers(); return; }
  if (e.target.closest('[data-do=close-panel]')) { openUsers.clear(); renderUsers(); }
});
$('#users').addEventListener('keydown', (e) => {
  const row = e.target.closest('tr.trow');
  if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openUsers.clear(); openUsers.add(row.dataset.u); renderUsers(); $(`#users tr.trow[data-u="${row.dataset.u}"]`)?.focus(); }
});

function userHtml(u, n) {
          const manage = u.role !== 'admin' || can('admins');
          const locked = userLocked(u);
          const state = !u.active ? '<span class="st rejected">removed</span>' : locked ? '<span class="st pending">locked</span>' : '';
          const actions = !manage
            ? '<p class="muted-sm" style="margin:0">Only the system owner can change Admin accounts.</p>'
            : u.active
              ? `<div class="btns">
                  <button class="secondary" type="button" data-do="pw">Reset password</button>
                  <button class="secondary danger" type="button" data-do="off">Remove account</button>
                </div>
                <form class="af pwbox" hidden autocomplete="off">
                  <label>New temporary password (at least 10 characters; share it privately)<input type="text" name="pw" maxlength="200" autocomplete="new-password"></label>
                  <div class="btns"><button class="primary" type="submit">Save new password</button><button class="secondary" type="button" data-do="pwcancel">Cancel</button></div>
                </form>
                <div class="confirm" hidden>
                  <p class="amsg warn" style="margin:0">Remove ${esc(u.name)}? They are signed out at once and cannot sign in again. Their past actions stay in the history.</p>
                  <div class="btns" style="margin-top:8px"><button class="primary danger-fill" type="button" data-do="offyes">Yes, remove account</button><button class="secondary" type="button" data-do="offno">Cancel</button></div>
                </div>`
              : '<div class="btns"><button class="secondary" type="button" data-do="on">Restore account</button></div>';
          const body = `<div class="body">
              <div class="cmp">
                <div><span class="cap2">Account</span>Username ${esc(u.username)}<br>Role ${esc(ROLE[u.role] || u.role)}<br>Status ${!u.active ? 'removed' : locked ? `locked until ${esc(when(u.locked_until))}` : 'active'}</div>
                <div><span class="cap2">Activity</span>Added ${esc(when(u.created_at))}${u.created_by ? ` by ${esc(u.created_by)}` : ''}<br>${u.last_login_at ? `Last sign-in ${esc(when(u.last_login_at))}` : 'Never signed in'}</div>
              </div>
              ${actions}
            </div>`;
  if (wide.matches) return body;
  return `<details class="reg user-row" data-u="${esc(u.username)}"${openUsers.has(u.username) ? ' open' : ''}>
            <summary class="line"><span class="sn">${n}.</span><b>${esc(u.name)}</b><span class="badge ${esc(u.role)}">${esc(ROLE[u.role] || u.role)}</span>${state}<span class="meta">${esc(u.username)}</span></summary>
            ${body}
          </details>`;
}

$('#users').addEventListener('toggle', (e) => {
  const d = e.target;
  if (!d.matches?.('details.user-row')) return;
  if (d.open) openUsers.add(d.dataset.u); else openUsers.delete(d.dataset.u);
}, true);

async function updateUser(body, done) {
  try {
    await api('/users/update', body);
    msg($('#userMsg'), 'ok', done);
    loadUsers();
  } catch (err) {
    if (err.message !== 'signed out') msg($('#userMsg'), 'err', err.message);
  }
}

$('#users').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-do]');
  if (!b) return;
  const row = b.closest('.user-row');
  const username = row.dataset.u;
  const pwbox = row.querySelector('.pwbox');
  const confirm = row.querySelector('.confirm');
  switch (b.dataset.do) {
    case 'pw': if (confirm) confirm.hidden = true; pwbox.hidden = false; pwbox.pw.focus(); break;
    case 'pwcancel': pwbox.hidden = true; pwbox.reset(); break;
    case 'off': pwbox.hidden = true; confirm.hidden = false; break;
    case 'offno': confirm.hidden = true; break;
    case 'offyes': updateUser({ username, active: false }, `${username} removed and signed out.`); break;
    case 'on': updateUser({ username, active: true }, `${username} restored. They can sign in again with their password (or reset it).`); break;
  }
});
$('#users').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const username = f.closest('.user-row').dataset.u;
  updateUser({ username, password: f.pw.value }, `Password reset for ${username}; share it privately. Their other sessions were signed out.`);
});

// What each role is responsible for, shown under the Role menu when adding an account.
const ROLE_HELP = {
  registrar: {
    does: [
      'Receives Kendra registration requests, by email or in person.',
      'Checks the 4 documents: PMBI allotment letter, drug licence, pharmacist certificate, owner’s signed consent.',
      'Checks the Kendra code and address against the official PMBI list.',
      'Registers the Kendra and gives the Kendra its reference (KR-…).',
    ],
    cant: 'Cannot approve, modify or manage accounts. A Reviewer approves, so every Kendra is checked by two people.',
  },
  reviewer: {
    does: [
      'Calls the Kendra’s number and confirms the code, the address and the terms.',
      'Approves or rejects waiting registrations, with a note on how it was checked.',
      'Modifies details (numbers, contact, hours) and withdraws a Kendra when needed.',
    ],
    cant: 'Cannot register Kendras or manage accounts.',
  },
  admin: {
    does: [
      'Adds Reviewers and Registrars, resets their passwords, removes their accounts.',
      'Can register, approve, modify and withdraw Kendras.',
    ],
    cant: 'Cannot add or change Admin accounts (only the system owner can).',
  },
};
function showRoleHelp() {
  const h = ROLE_HELP[$('#uRole').value];
  $('#uRoleHelp').innerHTML = h ? `<b>Responsibilities</b><ul>${h.does.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="cant">${esc(h.cant)}</p>` : '';
}
$('#uRole').addEventListener('change', showRoleHelp);

$('#userForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const r = await api('/users/create', { username: $('#uUser').value, name: $('#uName').value, password: $('#uPass').value, role: $('#uRole').value });
    msg($('#userMsg'), 'ok', `${ROLE[r.role]} account ${r.username} added. Share the username and temporary password privately; they sign in with "Staff login" on the Kendra page.`);
    $('#userForm').reset();
    showRoleHelp();
    loadUsers();
  } catch (err) {
    if (err.message !== 'signed out') msg($('#userMsg'), 'err', err.message);
  }
};

// ── Start (when the staff console is first opened): already signed in? ──
let started = false;
export async function startAdmin() {
  if (started) return;
  started = true;
  try {
    const res = await fetch('/api/admin/me', { headers: { 'x-samasalt-admin': '1' }, credentials: 'same-origin' });
    if (res.ok) return showApp(await res.json());
  } catch {}
  showSignin();
}
