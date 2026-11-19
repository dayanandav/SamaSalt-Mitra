// NPPA ceiling prices (DPCO 2013 scheduled formulations): the legal maximum price per tablet,
// capsule or ml, before GST. Shared by the developer import page (parses and previews in the
// browser) and the Worker (validates and writes). Each NPPA row ("Paracetamol" + "Tablet 650 mg",
// unit "1 Tablet", ceiling price) is turned into the same composition key as the brands and the
// Jan Aushadhi list, with the PMBI name parser (pmbi.js), so all three meet on one key.
import { parseGeneric, unitsIn, sqlLit } from './pmbi.js';

export const MAX_CEILINGS = 6000;

function pick(row, ...names) {
  const norm = {};
  for (const [k, v] of Object.entries(row || {})) norm[String(k).toLowerCase().replace(/[^a-z]/g, '')] = v;
  for (const n of names) {
    const v = norm[n.toLowerCase().replace(/[^a-z]/g, '')];
    if (v != null && String(v).trim() !== '') return String(v).replace(/\s+/g, ' ').trim();
  }
  return '';
}

/** "12-03-2026", "12.03.2026", "12/03/2026" or "2026-03-12" → "2026-03-12"; anything else → null. */
export function isoDate(s) {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/**
 * Rows of the NPPA list → ceiling prices keyed by composition, plus what was left out and why.
 * Columns (any of these names): Medicine / Name of the Scheduled Formulation; Dosage form and
 * strength; Unit; Ceiling price (Rs.); S.O. No.; S.O. Date. The name and the form/strength may
 * also be in one column ("Paracetamol Tablet 650 mg").
 */
export function buildCeilings(rows, vocab) {
  const byKey = new Map();
  const unparsed = [];
  const stats = { rows: rows.length, ok: 0, no_equivalent: 0, unparsed: 0, skipped: 0 };
  for (const r of rows) {
    const med = pick(r, 'medicine', 'Medicine Name', 'Name of the Scheduled Formulation', 'Scheduled Formulation', 'Formulation', 'Name of the Formulation', 'name');
    const fs = pick(r, 'Dosage form and strength', 'Dosage Form & Strength', 'Dosage form/strength', 'strength', 'form');
    const unit = pick(r, 'unit', 'Unit');
    const price = parseFloat(pick(r, 'Ceiling Price', 'Ceiling Price (Rs.)', 'Ceiling price (in Rs.)', 'Ceiling Price Rs', 'price').replace(/[^\d.]/g, ''));
    const notification = pick(r, 'S.O. No.', 'SO No', 'S.O. No', 'Notification No', 'notification');
    const notified_on = isoDate(pick(r, 'S.O. Date', 'SO Date', 'Notification Date', 'Date', 'notified_on'));
    const name = [med, fs].filter(Boolean).join(' ');
    if (!name || !Number.isFinite(price) || price <= 0) { stats.skipped++; continue; }
    const { key, reason } = parseGeneric(name, vocab);
    // Per one tablet / capsule / ml: "1 Tablet" → 1, "10 ml" → 10; no number ("Each") → 1.
    const units = unitsIn(unit) || 1;
    if (!key) { stats.unparsed++; unparsed.push({ name, unit, price, reason }); continue; }
    stats[reason === 'ok' ? 'ok' : 'no_equivalent']++;
    const item = { ckey: key, name, unit: unit || null, price, unit_price: Math.round((price / units) * 1e4) / 1e4, notification: notification || null, notified_on, matched: reason === 'ok' };
    // The same formulation notified more than once: the latest notification wins.
    const old = byKey.get(key);
    if (!old || (item.notified_on || '') >= (old.notified_on || '')) byKey.set(key, item);
  }
  return { items: [...byKey.values()], unparsed, stats };
}

/** What applying `items` would change in the current ceiling_prices table. */
export function diffCeilings(current, items) {
  const before = new Map(current.map((r) => [r.ckey, r]));
  const after = new Map(items.map((r) => [r.ckey, r]));
  const added = [];
  const changed = [];
  let unchanged = 0;
  for (const [k, n] of after) {
    const o = before.get(k);
    if (!o) added.push(n);
    else if (Math.abs((o.unit_price ?? 0) - n.unit_price) > 0.00005) changed.push({ ...n, old_unit_price: o.unit_price });
    else unchanged++;
  }
  const removed = [...before.values()].filter((o) => !after.has(o.ckey));
  return { added, changed, removed, unchanged };
}

const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

/** The Worker's check of an import before writing (the browser could send anything). */
export function validateCeilings(items) {
  if (!Array.isArray(items) || !items.length) return 'No ceiling prices to import.';
  if (items.length > MAX_CEILINGS) return `Too many rows (${items.length}).`;
  const keys = new Set();
  for (const [i, p] of items.entries()) {
    const where = `Row ${i + 1}`;
    if (!p || typeof p !== 'object') return `${where}: not an object.`;
    if (!str(p.ckey, 500) || !/^[^|]+\|[a-z_]+(\|[A-Z]{2})?$/.test(p.ckey)) return `${where}: bad composition key.`;
    if (keys.has(p.ckey)) return `${where}: duplicate composition ${p.ckey}.`;
    keys.add(p.ckey);
    if (!str(p.name, 500)) return `${where}: bad name.`;
    for (const f of ['price', 'unit_price']) if (!(typeof p[f] === 'number' && Number.isFinite(p[f]) && p[f] > 0 && p[f] < 1e6)) return `${where}: bad ${f}.`;
    if (!(p.unit == null || (typeof p.unit === 'string' && p.unit.length <= 100))) return `${where}: bad unit.`;
    if (!(p.notification == null || (typeof p.notification === 'string' && p.notification.length <= 200))) return `${where}: bad notification.`;
    if (!(p.notified_on == null || /^\d{4}-\d{2}-\d{2}$/.test(p.notified_on))) return `${where}: bad notification date.`;
  }
  return null;
}

/** Multi-row INSERTs (literals; D1 allows 100 bound parameters per statement), for one atomic batch. */
export function ceilingInserts(items, rowsPerStatement = 200) {
  const out = [];
  for (let i = 0; i < items.length; i += rowsPerStatement) {
    const vals = items.slice(i, i + rowsPerStatement).map((p) => `(${[p.ckey, p.name, p.unit, p.price, p.unit_price, p.notification, p.notified_on].map(sqlLit).join(',')})`);
    out.push(`INSERT OR REPLACE INTO ceiling_prices (ckey, name, unit, price, unit_price, notification, notified_on) VALUES ${vals.join(',')}`);
  }
  return out;
}
