// v2.0.7 missing medicines, staff console tab (/kendra#admin → Missing medicines). Roadmap S1.2.
//   Everyone : sees the names patients searched but did not find (counted, no personal data).
//   Registrar: adds the brand with every salt and strength read from the strip; "Check how the app
//              reads it" shows the composition, the Jan Aushadhi product and how many brands share it.
//   Reviewer : approves (another person; compared with the strip; a note), rejects, removes, ignores.
// The Worker checks every permission again (worker/src/missing.js).

const $ = (s) => document.querySelector(s);
const ST = { pending: 'waiting', approved: 'added', rejected: 'rejected', removed: 'removed' };
const FORM = { liquid: 'syrup / suspension', topical: 'cream / ointment / gel', dry_syrup: 'dry syrup' };

let x = null; // shared helpers from admin.js
let source = null; // missing_names.name_key the form answers
let data = { names: [], added: [] };

export function startMissing(helpers) {
  x = helpers;
  $('#mHint').textContent = x.can('review')
    ? 'Names patients typed that were not in our list, most searched first. A Registrar adds the brand from the strip; you approve it after comparing with the strip or pack. Ignore names that are not medicines.'
    : x.can('register')
      ? 'Names patients typed that were not in our list, most searched first. Add the brand with every salt and strength from the strip; a Reviewer approves it.'
      : 'Names patients typed that were not in our list, most searched first.';
  if (!startMissing.wired) wire();
  startMissing.wired = true;
  load();
}

async function load() {
  try {
    data = await x.api('/missing/list');
    render();
  } catch (e) {
    x.msg($('#mMsg'), 'err', e.message);
  }
}

const table = (head, rows) => (rows.length ? `<table class="mtable"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>` : '<p class="muted-sm">Nothing here yet.</p>');

function render() {
  const reg = x.can('register');
  const rev = x.can('review');
  $('#mNames').innerHTML = table(['Name typed', 'Searches', 'Last', ''], data.names.map((n) => `<tr>
      <td><b>${x.esc(n.shown)}</b></td><td>${n.searches}</td><td>${x.esc(n.last_day)}</td>
      <td class="mbtns">${reg ? `<button class="secondary" type="button" data-add="${x.esc(n.name_key)}" data-shown="${x.esc(n.shown)}">Add</button>` : ''}${rev ? `<button class="link" type="button" data-ignore="${x.esc(n.name_key)}">Not a medicine</button>` : ''}</td></tr>`));
  $('#mAdded').innerHTML = table(['Brand', 'Reads as', 'Status', ''], data.added.map((a) => `<tr>
      <td><b>${x.esc(a.name)}</b>${a.manufacturer ? `<br><span class="muted-sm">${x.esc(a.manufacturer)}</span>` : ''}<br><span class="muted-sm">As printed: ${x.esc(a.composition)}</span></td>
      <td>${x.esc(a.label)}${a.nti ? '<br><b>Never-switch medicine</b>' : ''}</td>
      <td><span class="st ${x.esc(a.status)}">${x.esc(ST[a.status] || a.status)}</span><br><span class="muted-sm">by ${x.esc(a.created_by)}${a.decided_by ? ` · ${x.esc(a.decided_by)}` : ''}</span></td>
      <td class="mbtns">${rev && a.status === 'pending' ? `<button class="primary" type="button" data-approve="${a.id}">Approve</button><button class="secondary" type="button" data-reject="${a.id}">Reject</button>` : ''}${rev && a.status === 'approved' ? `<button class="secondary" type="button" data-remove="${a.id}">Remove</button>` : ''}</td></tr>
      <tr class="mconfirm" id="mConfirm${a.id}" hidden><td colspan="4">
        <label><input type="checkbox" data-compared="${a.id}"> I compared the name, salts, strengths, form and release with the strip or pack.</label>
        <label>Note (how you checked)<input type="text" data-note="${a.id}" maxlength="200" placeholder="e.g. Checked against the strip photo from the Kendra"></label>
        <button class="primary" type="button" data-confirm="${a.id}">Approve this brand</button>
      </td></tr>`));
}

function body() {
  return { name: $('#mName').value, manufacturer: $('#mMaker').value, composition: $('#mComp').value, form: $('#mFormSel').value, rel: $('#mRel').value, source_name: source };
}

function wire() {
  $('#mNames').addEventListener('click', async (e) => {
    const add = e.target.closest('[data-add]');
    const ign = e.target.closest('[data-ignore]');
    if (add) {
      source = add.dataset.add;
      $('#mForm').hidden = false;
      $('#mName').value = add.dataset.shown;
      for (const id of ['#mMaker', '#mComp']) $(id).value = '';
      $('#mFormSel').value = '';
      $('#mRel').value = '';
      $('#mChecked').checked = false;
      $('#mSubmit').disabled = true;
      $('#mPreview').hidden = true;
      $('#mForm').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    if (ign) {
      try { await x.api('/missing/ignore', { name_key: ign.dataset.ignore }); load(); } catch (err) { x.msg($('#mMsg'), 'err', err.message); }
    }
  });
  $('#mChecked').onchange = () => { $('#mSubmit').disabled = !$('#mChecked').checked; };
  $('#mCancel').onclick = () => { $('#mForm').hidden = true; source = null; };
  $('#mPreviewBtn').onclick = async () => {
    const box = $('#mPreview');
    try {
      const r = await x.api('/missing/preview', body());
      box.className = 'amsg ok';
      box.innerHTML = `The app will read it as: <b>${x.esc(r.label)}</b>${FORM[body().form] ? '' : ''}.<br>
        ${r.ja ? `Jan Aushadhi: ${x.esc(r.ja.name)} · Code ${x.esc(r.ja.code)}.` : 'No Jan Aushadhi product with exactly this composition.'}
        ${r.same_brands ? ` ${r.same_brands} other brands have exactly this composition.` : ' No other brand in our list has exactly this composition.'}
        ${r.nti ? '<br><b>Never-switch medicine:</b> patients will see the warning only.' : ''}
        <br>If any salt, strength, form or release is wrong, correct it before adding.`;
    } catch (err) {
      box.className = 'amsg err';
      box.textContent = err.message;
    }
    box.hidden = false;
  };
  $('#mForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await x.api('/missing/add', { ...body(), checked: $('#mChecked').checked });
      x.msg($('#mMsg'), 'ok', `Added for review: ${r.label}. A Reviewer approves it before patients see it.`);
      $('#mForm').hidden = true;
      source = null;
      load();
    } catch (err) {
      x.msg($('#mMsg'), 'err', err.message);
    }
  };
  $('#mAdded').addEventListener('click', async (e) => {
    const t = e.target;
    const decide = async (id, action, extra = {}) => {
      try { await x.api('/missing/decide', { id: Number(id), action, ...extra }); x.msg($('#mMsg'), 'ok', `Done: ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'removed'}.`); load(); } catch (err) { x.msg($('#mMsg'), 'err', err.message); }
    };
    if (t.dataset.approve) $(`#mConfirm${t.dataset.approve}`).hidden = false;
    if (t.dataset.reject) decide(t.dataset.reject, 'reject');
    if (t.dataset.remove && confirm('Remove this brand? Patients will no longer find it.')) decide(t.dataset.remove, 'remove');
    if (t.dataset.confirm) {
      const id = t.dataset.confirm;
      decide(id, 'approve', { compared: document.querySelector(`[data-compared="${id}"]`).checked, note: document.querySelector(`[data-note="${id}"]`).value });
    }
  });
}
