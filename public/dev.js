// Developer data import page (/dev). Parses and previews the PMBI file here in the browser
// (public/pmbi.js, the same code the tests check against build_ja.py), then sends the parsed
// products to /api/admin/pmbi/apply with the admin token.
import { Vocab, readTable, buildProducts, diffProducts, summarize } from '/pmbi.js';
import { buildCeilings, diffCeilings } from '/ceiling.js';

const $ = (s) => document.querySelector(s);
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};
// Developer mode is never remembered in the browser (only ?dev=1 in an address turns it on);
// this page is protected by the admin token instead. Clear what older builds stored.
try { localStorage.removeItem('ss_devmode'); localStorage.removeItem('ss_test'); } catch {}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (v) => (v == null ? '' : `₹${Number(v).toFixed(2)}`);
const n = (v) => Number(v || 0).toLocaleString('en-IN');

$('#token').value = ss.get('ss_admin_token') || '';
$('#token').addEventListener('change', () => ss.set('ss_admin_token', $('#token').value.trim()));
$('#listDate').value = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10); // today in IST

function msg(el, kind, text) {
  el.hidden = !text;
  el.className = `msg ${kind}`;
  el.textContent = text || '';
}

async function api(path, body) {
  const token = $('#token').value.trim();
  if (!token) throw new Error('Enter the admin token first.');
  ss.set('ss_admin_token', token);
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw Object.assign(new Error(data.detail || data.error || `HTTP ${res.status}`), { status: res.status, data });
  return data;
}

// ── Current data ─────────────────────────────────────────────────────────────
async function loadStatus() {
  msg($('#statusMsg'), 'info', '');
  try {
    const s = await api('/api/admin/status');
    const m = s.meta || {};
    const stats = m.ja_stats ? JSON.parse(m.ja_stats) : null;
    $('#status').innerHTML = [
      ['Jan Aushadhi products', n(s.counts.ja_products)],
      ['PMBI list date', m.ja_list_date || 'not loaded'],
      ['Last imported', m.ja_imported_at ? new Date(m.ja_imported_at).toLocaleString('en-IN') : '—'],
      ['Last import', stats ? `${n(stats.ok)} matched · ${n(stats.no_equivalent)} no brand equivalent · ${n(stats.unparsed)} left out` : '—'],
      ['Brand medicines', n(s.counts.medicines)],
      ['Kendras', `${n(s.counts.kendras)}${m.kendra_list_date ? ` (list ${m.kendra_list_date})` : ''}`],
    ].map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    $('#status').hidden = false;
    if (!s.counts.medicines) msg($('#statusMsg'), 'info', 'The brand database is empty, so imported products cannot be checked against branded equivalents yet. They are still loaded with their canonical keys.');
  } catch (e) {
    $('#status').hidden = true;
    msg($('#statusMsg'), 'err', e.status === 401 ? 'Wrong admin token.' : e.message);
  }
}
$('#statusBtn').onclick = loadStatus;
if ($('#token').value) loadStatus();

// ── Preview ──────────────────────────────────────────────────────────────────
let previewed = null; // { items, stats, list_date } from the last successful preview

function table(title, open, cols, rows, total) {
  if (!rows.length) return '';
  const head = cols.map((c) => `<th>${esc(c[0])}</th>`).join('');
  const body = rows.map((r) => `<tr>${cols.map((c) => `<td class="${c[2] || ''}">${c[1](r)}</td>`).join('')}</tr>`).join('');
  const more = total > rows.length ? ` (first ${n(rows.length)} of ${n(total)})` : ` (${n(rows.length)})`;
  return `<details class="tbl"${open ? ' open' : ''}><summary>${esc(title)}${more}</summary><div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></details>`;
}

function renderSummary(r) {
  const st = r.stats;
  const tiles = [
    ['Rows in file', st.rows],
    ['Matched a brand', st.ok],
    ['No brand equivalent', st.no_equivalent],
    ['Left out (unclear)', st.unparsed, 'warn'],
    ['New products', r.added],
    ['Removed', r.removed, r.removed ? 'warn' : ''],
    ['MRP up', r.mrp_up, 'up'],
    ['MRP down', r.mrp_down, 'down'],
    ['Unchanged', r.unchanged],
  ];
  $('#tiles').innerHTML = tiles.map(([k, v, cls]) => `<div class="tile ${cls || ''}"><b>${n(v)}</b><span>${esc(k)}</span></div>`).join('');
  const pct = (c) => (c.old_mrp ? ((c.new_mrp - c.old_mrp) / c.old_mrp) * 100 : 0);
  $('#tables').innerHTML = [
    table('MRP and name changes', true, [
      ['Code', (c) => esc(c.drug_code)],
      ['Generic name', (c) => esc(c.generic_name) + (c.ckey_changed ? ' <span class="tag grey">match changed</span>' : '')],
      ['Pack', (c) => esc(c.unit_size)],
      ['Old MRP', (c) => inr(c.old_mrp), 'num'],
      ['New MRP', (c) => inr(c.new_mrp), 'num'],
      ['Change', (c) => { const p = pct(c); return p ? `<span class="${p > 0 ? 'up' : 'down'}">${p > 0 ? '+' : ''}${p.toFixed(1)}%</span>` : '—'; }, 'num'],
    ], r.samples.changed, r.changed),
    table('New products', false, [
      ['Code', (c) => esc(c.drug_code)], ['Generic name', (c) => esc(c.generic_name) + (c.matched ? '' : ' <span class="tag grey">no brand equivalent</span>')],
      ['Pack', (c) => esc(c.unit_size)], ['MRP', (c) => inr(c.mrp), 'num'],
    ], r.samples.added, r.added),
    table('Removed from the PMBI list', false, [
      ['Code', (c) => esc(c.drug_code)], ['Generic name', (c) => esc(c.generic_name)], ['Pack', (c) => esc(c.unit_size)], ['Last MRP', (c) => inr(c.mrp), 'num'],
    ], r.samples.removed, r.removed),
    table('Left out: name could not be parsed with confidence', false, [
      ['Code', (c) => esc(c.drug_code)], ['Generic name', (c) => esc(c.generic_name)], ['Reason', (c) => esc(c.reason)], ['MRP', (c) => inr(c.mrp), 'num'],
    ], r.samples.unparsed, st.unparsed),
  ].join('');
  $('#preview').hidden = false;
}

$('#file').onchange = () => { previewed = null; $('#applyBtn').disabled = true; };
$('#listDate').onchange = () => { previewed = null; $('#applyBtn').disabled = true; };

$('#previewBtn').onclick = async () => {
  msg($('#applyMsg'), 'ok', '');
  const f = $('#file').files[0];
  if (!f) return msg($('#previewMsg'), 'err', 'Choose the product list file first.');
  const list_date = $('#listDate').value;
  if (!list_date) return msg($('#previewMsg'), 'err', 'Set the list date.');
  if (/\.(xlsx?|pdf)$/i.test(f.name)) return msg($('#previewMsg'), 'err', 'Use the CSV export from the PMBI page (Excel and PDF are not read here).');
  msg($('#previewMsg'), 'info', `Reading ${f.name} and the current database…`);
  $('#previewBtn').disabled = true;
  try {
    const [text, ctx] = await Promise.all([f.text(), api('/api/admin/pmbi/context')]);
    let rows;
    try {
      rows = readTable(text);
    } catch (e) {
      throw new Error(`Could not read the file: ${e.message}`);
    }
    const vocab = new Vocab(ctx.brand_keys);
    const built = buildProducts(rows, vocab);
    if (!built.items.length) throw new Error('No products found. Is this the PMBI product MRP list (columns Drug Code, Generic Name, Unit Size, MRP)?');
    const r = summarize(built, diffProducts(ctx.current, built.items), ctx.current.length, vocab.keys.size);
    renderSummary(r);
    previewed = { items: built.items.map(({ matched, ...p }) => p), stats: built.stats, list_date };
    $('#applyBtn').disabled = false;
    msg($('#previewMsg'), 'ok', `${n(r.new_count)} products ready (list date ${list_date}). ${n(r.changed)} changed, ${n(r.added)} new, ${n(r.removed)} removed. Nothing is saved until you apply.`);
  } catch (e) {
    $('#preview').hidden = true;
    msg($('#previewMsg'), 'err', e.status === 401 ? 'Wrong admin token.' : e.message);
  } finally {
    $('#previewBtn').disabled = false;
  }
};

// ── Apply ────────────────────────────────────────────────────────────────────
$('#applyBtn').onclick = async () => {
  if (!previewed) return;
  if (!confirm(`Replace the live Jan Aushadhi product list with this file (list date ${previewed.list_date})?`)) return;
  $('#applyBtn').disabled = true;
  msg($('#applyMsg'), 'info', 'Applying…');
  try {
    const r = await api('/api/admin/pmbi/apply', { ...previewed, force: $('#force').checked || undefined });
    msg($('#applyMsg'), 'ok', `Done. ${n(r.new_count)} Jan Aushadhi products are live, list date ${previewed.list_date}.`);
    $('#forceWrap').hidden = true;
    previewed = null;
    loadStatus();
  } catch (e) {
    if (e.data?.error === 'too_few_rows') $('#forceWrap').hidden = false;
    msg($('#applyMsg'), 'err', e.message);
    $('#applyBtn').disabled = false;
  }
};


// ── NPPA ceiling prices ──────────────────────────────────────────────────────
let ceilPreviewed = null;
$('#ceilDate').value = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
$('#ceilFile').onchange = $('#ceilDate').onchange = () => { ceilPreviewed = null; $('#ceilApplyBtn').disabled = true; };
const perUnit = (v) => (v == null ? '' : `₹${Number(v).toFixed(4).replace(/0{1,2}$/, '')}`);

$('#ceilPreviewBtn').onclick = async () => {
  msg($('#ceilApplyMsg'), 'ok', '');
  const f = $('#ceilFile').files[0];
  if (!f) return msg($('#ceilPreviewMsg'), 'err', 'Choose the NPPA ceiling price file first.');
  const list_date = $('#ceilDate').value;
  if (!list_date) return msg($('#ceilPreviewMsg'), 'err', 'Set the list date.');
  if (/\.(xlsx?|pdf)$/i.test(f.name)) return msg($('#ceilPreviewMsg'), 'err', 'Save the table as CSV first (Excel and PDF are not read here).');
  msg($('#ceilPreviewMsg'), 'info', `Reading ${f.name}…`);
  $('#ceilPreviewBtn').disabled = true;
  try {
    const [text, ctx, cur] = await Promise.all([f.text(), api('/api/admin/pmbi/context'), api('/api/admin/ceiling/current')]);
    const built = buildCeilings(readTable(text), new Vocab(ctx.brand_keys));
    if (!built.items.length) throw new Error('No ceiling prices found. Columns needed: Medicine, Dosage form and strength, Unit, Ceiling Price.');
    const d = diffCeilings(cur.current, built.items);
    const st = built.stats;
    $('#ceilTiles').innerHTML = [
      ['Rows in file', st.rows], ['Matched a brand', st.ok], ['No brand equivalent', st.no_equivalent], ['Left out (unclear)', st.unparsed, 'warn'],
      ['New', d.added.length], ['Price changed', d.changed.length, 'up'], ['Removed', d.removed.length, d.removed.length ? 'warn' : ''], ['Unchanged', d.unchanged],
    ].map(([k, v, cls]) => `<div class="tile ${cls || ''}"><b>${n(v)}</b><span>${esc(k)}</span></div>`).join('');
    const first = (a) => a.slice(0, 300);
    $('#ceilTables').innerHTML = [
      table('Ceiling prices (matched to the medicine database)', true, [
        ['Formulation', (c) => esc(c.name) + (c.matched ? '' : ' <span class="tag grey">no brand equivalent</span>')], ['Unit', (c) => esc(c.unit || '')],
        ['Ceiling', (c) => inr(c.price), 'num'], ['Per unit', (c) => perUnit(c.unit_price), 'num'], ['S.O.', (c) => esc([c.notification, c.notified_on].filter(Boolean).join(' · '))],
      ], first(built.items), built.items.length),
      table('Price changes', false, [['Formulation', (c) => esc(c.name)], ['Old per unit', (c) => perUnit(c.old_unit_price), 'num'], ['New per unit', (c) => perUnit(c.unit_price), 'num']], first(d.changed), d.changed.length),
      table('Left out: name could not be parsed with confidence', false, [['Formulation', (c) => esc(c.name)], ['Reason', (c) => esc(c.reason)], ['Ceiling', (c) => inr(c.price), 'num']], first(built.unparsed), built.unparsed.length),
    ].join('');
    $('#ceilPreview').hidden = false;
    ceilPreviewed = { items: built.items.map(({ matched, ...p }) => p), list_date };
    $('#ceilApplyBtn').disabled = false;
    msg($('#ceilPreviewMsg'), 'ok', `${n(built.items.length)} ceiling prices ready (list date ${list_date}). Nothing is saved until you apply.`);
  } catch (e) {
    $('#ceilPreview').hidden = true;
    msg($('#ceilPreviewMsg'), 'err', e.status === 401 ? 'Wrong admin token.' : e.message);
  } finally {
    $('#ceilPreviewBtn').disabled = false;
  }
};

$('#ceilApplyBtn').onclick = async () => {
  if (!ceilPreviewed) return;
  if (!confirm(`Replace the NPPA ceiling prices with this file (list date ${ceilPreviewed.list_date})?`)) return;
  $('#ceilApplyBtn').disabled = true;
  msg($('#ceilApplyMsg'), 'info', 'Applying…');
  try {
    const r = await api('/api/admin/ceiling/apply', { ...ceilPreviewed, force: $('#ceilForce').checked || undefined });
    msg($('#ceilApplyMsg'), 'ok', `Done. ${n(r.new_count)} NPPA ceiling prices are live, list date ${ceilPreviewed.list_date}.`);
    $('#ceilForceWrap').hidden = true;
    ceilPreviewed = null;
  } catch (e) {
    if (e.data?.error === 'too_few_rows') $('#ceilForceWrap').hidden = false;
    msg($('#ceilApplyMsg'), 'err', e.message);
    $('#ceilApplyBtn').disabled = false;
  }
};
