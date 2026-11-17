// v1.3 Registered volunteers, staff console tab (/kendra#admin → Volunteers).
//   Registrar: registers a volunteer from their request (phone, email or in person), after seeing an ID.
//   Reviewer : calls them, approves (3 confirmations + note) or rejects; removes; modifies;
//              sends the approved volunteer their personal link on WhatsApp.
// Same layout as Kendra registrations: one line per volunteer on phones, table + side panel on desktop.
// The Worker checks every permission again (worker/src/volunteers.js).
import { showMobile, waLink, volunteerWelcome } from '/rules.js';

const $ = (s) => document.querySelector(s);
const ID = { aadhaar: 'Aadhaar', voter: 'Voter ID', driving: 'Driving licence', pan: 'PAN card', org: 'Organisation ID', other: 'Other photo ID' };
const CH = { phone: 'by phone', email: 'by email', in_person: 'in person' };
const ST = { pending: 'waiting', approved: 'approved', rejected: 'rejected', withdrawn: 'removed' };
const ACT = { register: 'Registered', approve: 'Approved', reject: 'Rejected', withdraw: 'Removed', edit: 'Modified' };
const FIELD = { name: 'name', mobile: 'mobile', district: 'district', pin: 'PIN', organisation: 'organisation', languages: 'languages' };
const ERR = {
  vErrName: 'Enter the full name.', vErrMobile: 'Enter a 10-digit mobile number.', vErrDistrict: 'Enter the district.',
  vErrPin: 'Enter a 6-digit PIN code, or leave it empty.', vErrConsent: 'Confirm that they agreed to the terms.',
};

let x = null; // shared helpers from admin.js
let status = 'pending';
let items = [];
let search = '';
const open = new Set();

const tel = (d) => (d ? `<a href="tel:+91${x.esc(d)}">${x.esc(showMobile(d))}</a>` : '—');
const link = (code) => `${location.origin}/v/${code}`;
const stBadge = (s) => `<span class="st ${x.esc(s)}">${x.esc(ST[s] || s)}</span>`;

export function startVolunteers(helpers) {
  x = helpers;
  $('#vNewBtn').hidden = !x.can('register');
  $('#vHint').textContent = x.can('review')
    ? `People who help patients at camps and Kendras. ${x.pointWord()} a volunteer to call, approve, send their link, modify or remove.`
    : `People who help patients at camps and Kendras. Register them from their request; a Reviewer calls and approves. ${x.pointWord()} a volunteer for details.`;
  if (!startVolunteers.wired) wire();
  startVolunteers.wired = true;
  load();
}

async function load() {
  const m = $('#vListMsg');
  x.msg(m, 'info', 'Loading…');
  try {
    const r = await x.api(`/volunteer/list?status=${status}${search ? `&q=${encodeURIComponent(search)}` : ''}`);
    items = r.items;
    const w = document.querySelector('#vFilters [data-s=pending]');
    w.textContent = `Waiting${r.counts.pending ? ` (${r.counts.pending})` : ''}`;
    const word = `volunteer${items.length === 1 ? '' : 's'}`;
    const kind = status === 'all' ? '' : `${ST[status]} `;
    x.msg(m, 'info', items.length ? `${items.length} ${kind}${word}${search ? ` matching “${r.search}”` : ''}, newest first. ${x.pointWord()} one for details.` : search ? `No ${kind}${word} matching “${r.search}”.` : 'Nothing here.');
    render();
  } catch (e) {
    if (e.message !== 'signed out') x.msg(m, 'err', e.message);
  }
}

function bodyHtml(v) {
  const review = x.can('review');
  const editable = review && ['pending', 'approved'].includes(v.status);
  const modify = editable ? '<button class="secondary" type="button" data-do="edit">Modify details</button>' : '';
  let actions = '';
  if (!review) actions = v.status === 'pending' ? '<p class="amsg info" style="margin:0">Waiting for a Reviewer to call them and approve.</p>' : '';
  else if (v.status === 'pending') actions = `
    <form class="af vreview" data-code="${x.esc(v.code)}">
      <fieldset class="checks">
        <legend>Before approving, confirm:</legend>
        <label><input type="checkbox" name="called"> I called ${x.esc(showMobile(v.mobile))} and spoke to ${x.esc(v.name)}.</label>
        <label><input type="checkbox" name="id"> The registrar saw their ID (${x.esc(ID[v.id_seen] || v.id_seen || '—')}), and the name matches.</label>
        <label><input type="checkbox" name="terms"> They understood the terms: no dose advice, no switch for "same brand only", no patient data, no money.</label>
      </fieldset>
      <label>Note (how you checked, or why you reject)<textarea name="note" maxlength="200" placeholder="e.g. Called 17 Nov 11:20, details and terms confirmed"></textarea></label>
      <div class="btns">
        <button class="primary" type="submit" name="act" value="approve" disabled>Approve</button>
        <button class="secondary" type="submit" name="act" value="reject">Reject</button>
        ${modify}
      </div>
    </form>`;
  else if (v.status === 'approved') {
    const wa = waLink(v.mobile, volunteerWelcome(v, location.origin));
    actions = `
    <div class="btns">
      ${wa ? `<a class="primary" href="${x.esc(wa)}" target="_blank" rel="noopener">Send link on WhatsApp</a>` : ''}
      <button class="secondary" type="button" data-do="copy">Copy link</button>
      ${modify}
      <button class="secondary danger" type="button" data-do="remove">Remove volunteer</button>
    </div>
    <form class="af vreview vremove" data-code="${x.esc(v.code)}" hidden>
      <label>Reason to remove (kept in the history)<textarea name="note" maxlength="200" placeholder="e.g. Asked to stop on 20 Nov"></textarea></label>
      <p class="amsg warn" style="margin:0">Their link stops counting at once. Past checks stay counted.</p>
      <div class="btns"><button class="primary danger-fill" type="submit" name="act" value="withdraw">Yes, remove</button><button class="secondary" type="button" data-do="remove-cancel">Cancel</button></div>
    </form>`;
  }
  const edit = editable ? `<div class="edit-box" hidden>
    <form class="af vedit" data-code="${x.esc(v.code)}" novalidate>
      <label>Full name<input type="text" name="name" maxlength="60" value="${x.esc(v.name)}"></label>
      <label>Mobile number<input type="text" name="mobile" inputmode="tel" maxlength="16" value="${x.esc(showMobile(v.mobile))}"></label>
      <label>District<input type="text" name="district" maxlength="40" value="${x.esc(v.district)}"></label>
      <label>PIN code<input type="text" name="pin" inputmode="numeric" maxlength="6" value="${x.esc(v.pin || '')}"></label>
      <label>Organisation<input type="text" name="organisation" maxlength="80" value="${x.esc(v.organisation || '')}"></label>
      <label>Languages<input type="text" name="languages" maxlength="60" value="${x.esc(v.languages || '')}"></label>
      <label>Reason for the change (kept in the history)<textarea name="note" maxlength="200"></textarea></label>
      ${v.status === 'approved' ? '<p class="amsg warn" style="margin:0">A new mobile number sends this volunteer back to Waiting: call the new number and approve again.</p>' : ''}
      <div class="btns"><button class="primary" type="submit">Save changes</button><button class="secondary" type="button" data-do="cancel-edit">Cancel</button></div>
    </form></div>` : '';
  return `<div class="body">
    <p class="muted-sm" style="margin:0">${x.esc(v.code)} · registered ${x.esc(x.when(v.created_at))} by ${x.esc(v.registered_by || '—')} ${x.esc(CH[v.request_channel] || '')}: ${x.esc(v.request_ref || '—')}</p>
    <div class="cmp">
      <div><span class="cap2">Volunteer</span>${x.esc(v.name)}<br>Mobile ${tel(v.mobile)}<br>${x.esc(v.district)}${v.pin ? `, PIN ${x.esc(v.pin)}` : ''}${v.organisation ? `<br>${x.esc(v.organisation)}` : ''}${v.languages ? `<br>Languages: ${x.esc(v.languages)}` : ''}</div>
      <div><span class="cap2">Checks and help</span>ID seen: ${x.esc(ID[v.id_seen] || v.id_seen || '—')}<br>Checks helped: <span class="help-n">${Number(v.helped) || 0}</span>${v.last_help ? `<br>Last: ${x.esc(x.when(v.last_help))}` : ''}${v.status === 'approved' ? `<br>Link: <span style="overflow-wrap:anywhere">${x.esc(link(v.code))}</span>` : ''}</div>
    </div>
    ${v.status === 'approved' ? `<p class="muted-sm" style="margin:0">Approved by ${x.esc(v.verified_by || '—')} on ${x.esc(x.when(v.verified_at))}${v.admin_note ? ` · ${x.esc(v.admin_note)}` : ''}</p>` : v.admin_note ? `<p class="muted-sm" style="margin:0">Note: ${x.esc(v.admin_note)}</p>` : ''}
    ${actions}
    ${edit}
    <div class="hist"><p class="cap2">History</p><ol><li>Loading…</li></ol></div>
  </div>`;
}

function render() {
  const box = $('#vols');
  if (!x.wide.matches) {
    box.className = '';
    box.innerHTML = items.map((v, i) => `<details class="reg vol" data-code="${x.esc(v.code)}"${open.has(v.code) ? ' open' : ''}>
      <summary class="line"><span class="sn">${i + 1}.</span><b>${x.esc(v.name)}</b>${stBadge(v.status)}<span class="meta">${x.esc(v.code)} · ${x.esc(v.district)} · ${Number(v.helped) || 0} helped</span></summary>
      ${bodyHtml(v)}</details>`).join('');
    for (const d of box.querySelectorAll('details.vol[open]')) history(d);
    return;
  }
  const sel = items.find((v) => open.has(v.code));
  open.clear();
  if (sel) open.add(sel.code);
  box.className = 'split';
  if (!items.length) { box.innerHTML = ''; return; }
  const rows = items.map((v, i) => `<tr class="trow${sel?.code === v.code ? ' sel' : ''}" data-code="${x.esc(v.code)}" tabindex="0" aria-selected="${sel?.code === v.code}">
    <td class="num">${i + 1}</td><td><b>${x.esc(v.name)}</b></td><td>${stBadge(v.status)}</td><td>${x.esc(v.code)}</td><td>${x.esc(v.district)}</td>
    <td class="num">${Number(v.helped) || 0}</td><td>${x.esc(x.whenShort(v.created_at))}</td></tr>`).join('');
  const panel = sel
    ? `<div class="reg vol panel" data-code="${x.esc(sel.code)}"><div class="panel-head"><b>${x.esc(sel.name)}</b>${stBadge(sel.status)}<button class="link" type="button" data-do="close-panel">Close ✕</button></div>${bodyHtml(sel)}</div>`
    : '<div class="panel empty"><p class="muted-sm" style="margin:0">Click a volunteer to see their details, review them and see the history.</p></div>';
  box.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="num">#</th><th>Name</th><th>Status</th><th>Code</th><th>District</th><th class="num">Helped</th><th>Registered</th></tr></thead><tbody>${rows}</tbody></table></div>${panel}`;
  const p = box.querySelector('.vol.panel');
  if (p) history(p);
}

async function history(el) {
  const ol = el.querySelector('.hist ol');
  try {
    const r = await x.api(`/volunteer/history?code=${encodeURIComponent(el.dataset.code)}`);
    ol.innerHTML = r.items.length ? r.items.map((h) => {
      const ch = h.changes ? ` · ${x.esc(Object.entries(h.changes).map(([f, [a, b]]) => `${FIELD[f] || f} ${f === 'mobile' ? showMobile(a) : a ?? '—'} → ${f === 'mobile' ? showMobile(b) : b ?? '—'}`).join('; '))}` : '';
      const back = h.action === 'edit' && h.from_status !== h.to_status ? ` · back to ${x.esc(ST[h.to_status] || h.to_status)}` : '';
      return `<li>${x.esc(x.when(h.at))}: <b>${x.esc(ACT[h.action] || h.action)}</b> by ${x.esc(h.admin_name)} (${x.esc(h.admin_username)})${h.checks ? ' · all checks confirmed' : ''}${ch}${back}${h.note ? ` · “${x.esc(h.note)}”` : ''}</li>`;
    }).join('') : '<li>No history yet.</li>';
  } catch (e) {
    if (e.message !== 'signed out') ol.innerHTML = `<li>${x.esc(e.message)}</li>`;
  }
}

function result(item) {
  let out = item.querySelector(':scope > .body > .amsg.result, :scope .body > .amsg.result');
  if (!out) { out = document.createElement('p'); item.querySelector('.body').appendChild(out); }
  return (kind, text) => { x.msg(out, kind, text); out.classList.add('result'); };
}

function wire() {
  // Filters and search
  for (const b of document.querySelectorAll('#vFilters button')) {
    b.onclick = () => {
      status = b.dataset.s;
      for (const y of document.querySelectorAll('#vFilters button')) y.setAttribute('aria-pressed', String(y === b));
      open.clear();
      load();
    };
  }
  let t = null;
  $('#vSearch').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { search = $('#vSearch').value.trim(); open.clear(); load(); }, 350); });
  $('#vSearchForm').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(t); search = $('#vSearch').value.trim(); open.clear(); load(); });
  x.wide.addEventListener('change', render);

  const box = $('#vols');
  box.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.matches?.('details.vol')) return;
    if (d.open) { open.add(d.dataset.code); history(d); } else open.delete(d.dataset.code);
  }, true);
  box.addEventListener('keydown', (e) => {
    const row = e.target.closest('tr.trow');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open.clear(); open.add(row.dataset.code); render(); }
  });
  box.addEventListener('click', async (e) => {
    const row = e.target.closest('tr.trow');
    if (row) { open.clear(); open.add(row.dataset.code); render(); return; }
    const b = e.target.closest('button[data-do]');
    if (!b) return;
    const item = b.closest('.vol');
    const code = item?.dataset.code;
    switch (b.dataset.do) {
      case 'close-panel': open.clear(); render(); break;
      case 'edit': item.querySelector('.edit-box').hidden = false; item.querySelector('.edit-box input').focus(); break;
      case 'cancel-edit': item.querySelector('.edit-box').hidden = true; item.querySelector('.vedit').reset(); break;
      case 'remove': item.querySelector('.vremove').hidden = false; item.querySelector('.vremove textarea').focus(); break;
      case 'remove-cancel': item.querySelector('.vremove').hidden = true; break;
      case 'copy':
        try { await navigator.clipboard.writeText(link(code)); result(item)('ok', `Link copied: ${link(code)}`); } catch { result(item)('info', link(code)); }
        break;
    }
  });
  // Approve only with all three boxes ticked and a note.
  box.addEventListener('input', (e) => {
    const f = e.target.closest('form.vreview');
    const ap = f?.querySelector('button[value=approve]');
    if (ap) ap.disabled = !([...f.querySelectorAll('.checks input')].every((c) => c.checked) && f.note.value.trim().length >= 5);
  });
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const item = f.closest('.vol');
    const show = result(item);
    const btns = [...f.querySelectorAll('button')];
    const note = f.note.value.trim();
    let call;
    if (f.matches('.vedit')) {
      if (note.length < 3) { show('err', 'Write the reason for the change first.'); f.note.focus(); return; }
      const el = f.elements;
      call = x.api('/volunteer/update', { code: f.dataset.code, name: el.name.value, mobile: el.mobile.value, district: el.district.value, pin: el.pin.value, organisation: el.organisation.value, languages: el.languages.value, note })
        .then((r) => `${r.code}: changed ${r.changed.map((c) => FIELD[c] || c).join(', ')}, by ${r.by}.${r.previous === 'approved' && r.status === 'pending' ? ' Back in Waiting: call the new number and approve again.' : ''}`);
    } else {
      const act = e.submitter?.value;
      if (!act) return;
      if (act !== 'approve' && note.length < 3) { show('err', 'Write a short reason first.'); f.note.focus(); return; }
      const checks = Object.fromEntries([...f.querySelectorAll('.checks input')].map((c) => [c.name, c.checked]));
      call = x.api('/volunteer/decide', { code: f.dataset.code, action: act, note, checks })
        .then((r) => `${r.code}: ${ST[r.previous]} → ${ST[r.status]}, by ${r.by}.${r.status === 'approved' ? ' Open it in Approved and send them their link on WhatsApp.' : ''}`);
    }
    btns.forEach((b) => { b.disabled = true; });
    try {
      show('ok', await call);
      setTimeout(load, 1500);
    } catch (err) {
      if (err.message === 'signed out') return;
      show('err', ERR[err.data?.error] || err.message);
      btns.forEach((b) => { b.disabled = false; });
      f.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Register a volunteer (Registrar, Admin)
  let channel = 'phone';
  const PH = { phone: 'e.g. 17 Nov 2026 · call from the volunteer', email: 'e.g. 17 Nov 2026 · email "Volunteer registration request - Dharwad"', in_person: 'e.g. 17 Nov 2026 · met at the Dharwad health camp' };
  for (const b of document.querySelectorAll('#vChannel button')) {
    b.onclick = () => {
      channel = b.dataset.c;
      for (const y of document.querySelectorAll('#vChannel button')) y.setAttribute('aria-pressed', String(y === b));
      $('#vRef').placeholder = PH[channel];
    };
  }
  const form = $('#vNewForm');
  const ready = () => {
    $('#vSubmit').disabled = !([...form.querySelectorAll('.checks input')].every((c) => c.checked) && $('#vId').value && $('#vRef').value.trim().length >= 5 && $('#vName').value.trim() && $('#vMobile').value.trim() && $('#vDistrict').value.trim());
  };
  form.addEventListener('input', ready);
  form.addEventListener('change', ready);
  $('#vNewBtn').onclick = () => { form.hidden = false; $('#vNewBtn').hidden = true; x.msg($('#vNewMsg'), 'ok', ''); $('#vRef').focus(); };
  $('#vCancel').onclick = () => { form.reset(); form.hidden = true; $('#vNewBtn').hidden = false; ready(); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    if ($('#vSubmit').disabled) return;
    $('#vSubmit').disabled = true;
    try {
      const r = await x.api('/volunteer/register', {
        request_channel: channel, request_ref: $('#vRef').value, name: $('#vName').value, mobile: $('#vMobile').value, district: $('#vDistrict').value,
        pin: $('#vPin').value, organisation: $('#vOrg').value, languages: $('#vLangs').value, id_seen: $('#vId').value, consent: true,
      });
      x.msg($('#vNewMsg'), 'ok', `${$('#vName').value.trim()} registered as ${r.code}, waiting for a Reviewer to call and approve. Tell them their code.`);
      form.reset();
      form.hidden = true;
      $('#vNewBtn').hidden = false;
      status = 'pending';
      for (const y of document.querySelectorAll('#vFilters button')) y.setAttribute('aria-pressed', String(y.dataset.s === 'pending'));
      load();
    } catch (err) {
      if (err.message === 'signed out') return;
      x.msg($('#vNewMsg'), 'err', ERR[err.data?.error] || err.message);
    } finally {
      ready();
    }
  };
}
