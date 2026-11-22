// SamaSalt-Mitra agent — Cloudflare Worker: JSON API + static web app (public/).
import { runAgent, resetMetaCache, readPrescriptionAgent } from './agent.js';
import { validateProducts, insertStatements } from '../../public/pmbi.js';
import { validateCeilings, ceilingInserts } from '../../public/ceiling.js';
import { assetMeds, d1Meds } from './medstore.js';
import { lookupKendra, staffRegisterKendra, attachContacts, adminListKendras, adminDecideKendra, adminUpdateKendra, adminKendraHistory } from './kendra.js';
import { whoIs, csrfOk, login, logout, listAdmins, createAdmin, updateAdmin, can, permissions } from './admin.js';
import { kendraContactsVisible, orderItems, orderMessage, waLink } from '../../public/rules.js';
import { t, rupees } from '../../public/strings.js';
import { ntiFromKey } from './normalize.js';
import { nearestKendra } from './tools.js';
import { overLimit, photoCapReached, countPrescriptionRead } from './limits.js';
import { botOn, appChatOn, botNumber, handleWebhook, handleMessage } from './whatsapp.js';
import { registerVolunteer, listVolunteers, decideVolunteer, updateVolunteer, volunteerHistory, activeVolunteer, volunteerLinkStatus } from './volunteers.js';

// Not exported: a Worker's main module may only export handlers.
const APP_VERSION = '2.0.6';

const MAX_IMAGE_CHARS = 2_500_000; // ~1.8 MB JPEG as a data URL; the app resizes to ~1 MP first

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });

function isTestRequest(request, body) {
  const url = new URL(request.url);
  if (request.headers.get('x-samasalt-mitra-test') === '1') return true;
  if (body && (body.test === true || body.test === 1 || body.test === '1')) return true;
  if (['localhost', '127.0.0.1'].includes(url.hostname)) return true;
  return false;
}

function istDay(d = new Date()) {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

// v2.0.7 (roadmap S1.4): how a typed name was chosen. Only these words are ever stored, never text.
const SEARCH_VIA = new Set(['typed', 'suggest', 'didyoumean', 'rx']);
const searchVia = (body) => (body && typeof body.text === 'string' && body.text && !body.image && !body.ocr && SEARCH_VIA.has(body.via) ? body.via : null);

async function logLookup(env, body, result, isTest) {
  const id = crypto.randomUUID();
  const s = result.saving || {};
  const device = typeof body.device === 'string' && /^[a-z0-9]{8,40}$/i.test(body.device) ? body.device : null;
  // v1.3: an approved volunteer's code (from their personal link), never anything about the patient.
  const volunteer = body.mode === 'volunteer' && body.volunteer ? await activeVolunteer(env.DB, body.volunteer).catch(() => null) : null;
  await env.DB.prepare(
    `INSERT INTO lookups (id, ts, day, status, input, medicine, ckey, pack, scanned_unit, cheapest_unit, ja_unit, saving_pack, equivalents, lang, pin3, mode, device, is_test, volunteer, via)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)`
  )
    .bind(
      id,
      new Date().toISOString(),
      istDay(),
      result.status,
      result.source || (body.image ? 'photo' : body.ocr ? 'photo-ocr' : 'text'),
      result.medicine?.name ?? null,
      result.medicine?.ckey ?? null,
      s.pack ?? null,
      s.scanned_unit ?? null,
      result.same_salt?.cheapest_unit ?? null,
      result.jan_aushadhi?.available ? result.jan_aushadhi.product.unit_price : null,
      s.saving_pack ?? null,
      result.same_salt?.count ?? null,
      result.lang,
      result.pin3 ?? null,
      body.mode === 'volunteer' ? 'volunteer' : body.mode === 'whatsapp' ? 'whatsapp' : body.mode === 'chat' ? 'chat' : 'self',
      device,
      isTest ? 1 : 0,
      volunteer,
      searchVia(body)
    )
    .run();
  return id;
}

async function handleAsk(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  if (body.image) {
    if (typeof body.image !== 'string' || !body.image.startsWith('data:image/') || body.image.length > MAX_IMAGE_CHARS) {
      return json({ error: 'image_too_large_or_invalid' }, 413);
    }
  } else if (!body.text && !body.ocr) {
    return json({ error: 'nothing_to_check' }, 400);
  }
  const isTest = isTestRequest(request, body);
  // Abuse protection: past the day's photo cap, ask for the name instead (the app's existing message).
  if (body.image && (await photoCapReached(env, istDay()))) return json({ status: 'vision_unavailable', reason: 'daily_photo_limit' });
  const result = await runAgent(env, body);
  // v1.1: registered Kendra numbers, only where KENDRA_REGISTRY allows (pilot: test traffic only).
  if (result.kendras?.items?.length && kendraContactsVisible(env.KENDRA_REGISTRY, isTest)) {
    try {
      await attachContacts(env.DB, result.kendras.items);
      markOrders(result.kendras.items, env, isTest);
    } catch {} // the registry table may not exist yet on an old database: show the list without it
  }
  if (result.status !== 'vision_unavailable' && !body.nolog) {
    try {
      result.lookup_id = await logLookup(env, body, result, isTest);
    } catch (e) {
      result.log_error = String(e?.message || e).slice(0, 100);
    }
  }
  result.test = isTest;
  return json(result);
}

/** The same address on CANONICAL_HOST, for a GET on the old *.workers.dev host (not /api); else null. */
export function canonicalRedirect(env, url, method = 'GET') {
  const host = String(env.CANONICAL_HOST || '').trim().toLowerCase();
  if (!host || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || url.hostname === host) return null;
  if (!url.hostname.endsWith('.workers.dev') || (method !== 'GET' && method !== 'HEAD') || url.pathname.startsWith('/api/')) return null;
  return `https://${host}${url.pathname}${url.search}`;
}

// Requests that run a check (or record feedback) count towards the per-address limit.
const CHECK_PATHS = new Set(['/api/ask', '/api/feedback', '/api/chat', '/api/wa/simulate', '/api/prescription']);
// Over the limit: a calm "wait a minute" in the patient's language. The app shows it as an answer
// (status "busy"); the chat boxes show it as a bot message.
async function tooMany(request, url) {
  const b = await request.clone().json().catch(() => ({}));
  const lang = ['en', 'kn', 'hi'].includes(b.lang) ? b.lang : 'en';
  const body = url.pathname === '/api/chat' || url.pathname === '/api/wa/simulate'
    ? { replies: [{ kind: 'text', body: t(lang, 'tooMany') }] }
    : { status: 'busy', error: 'too_many' };
  return new Response(JSON.stringify(body), { status: 429, headers: { 'content-type': 'application/json; charset=utf-8', 'retry-after': '60' } });
}

// v2.0.4 Scan a prescription: the names on it, matched to the medicine list. Nothing is stored.
async function handlePrescription(request, env) {
  const b = await request.json().catch(() => null);
  if (!b || typeof b.image !== 'string' || !b.image.startsWith('data:image/') || b.image.length > MAX_IMAGE_CHARS) return json({ error: 'image_too_large_or_invalid' }, 413);
  const day = istDay();
  if (await photoCapReached(env, day)) return json({ status: 'vision_unavailable', reason: 'daily_photo_limit' });
  await countPrescriptionRead(env, day);
  return json(await readPrescriptionAgent(env, { image: b.image }));
}

async function handleFeedback(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  // 'wrong': the person said the medicine read from their photo/scan was not theirs.
  const allowed = ['yes', 'no', 'ask', 'wrong'];
  if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.id) || !allowed.includes(body.switched)) {
    return json({ error: 'bad_request' }, 400);
  }
  const r = await env.DB.prepare('UPDATE lookups SET switched = ?1 WHERE id = ?2').bind(body.switched, body.id).run();
  return json({ ok: true, updated: r.meta?.changes ?? 0 });
}

async function handleImpact(env, url) {
  const q = (sql) => env.DB.prepare(sql).all().then((r) => r.results || []);
  // v2.0.5 monthly report: ?month=YYYY-MM limits every figure to that month (IST days).
  const mp = url?.searchParams.get('month') || '';
  const month = /^20\d{2}-(0[1-9]|1[0-2])$/.test(mp) ? mp : null;
  const real = month ? `is_test = 0 AND day LIKE '${month}-%'` : 'is_test = 0';
  // Lookups whose photo/scan the person said was the wrong medicine never count as a saving.
  const right = "(switched IS NULL OR switched != 'wrong')";
  const [totals] = await q(`SELECT
      COUNT(*) AS lookups,
      SUM(status = 'ok') AS matched,
      SUM(status = 'not_found') AS not_found,
      SUM(status = 'ok' AND saving_pack > 0 AND ${right}) AS with_cheaper_option,
      COUNT(DISTINCT device) AS devices,
      ROUND(SUM(CASE WHEN status = 'ok' AND saving_pack > 0 AND ${right} THEN saving_pack ELSE 0 END), 2) AS potential_saving,
      SUM(switched = 'wrong') AS wrong_reads,
      SUM(switched = 'yes') AS switched_yes,
      SUM(switched = 'ask') AS will_ask_doctor,
      SUM(switched = 'no') AS switched_no,
      ROUND(SUM(CASE WHEN switched = 'yes' AND saving_pack > 0 THEN saving_pack ELSE 0 END), 2) AS reported_saving,
      SUM(mode = 'volunteer') AS volunteer_lookups,
      SUM(mode = 'whatsapp') AS whatsapp_lookups,
      SUM(mode = 'chat') AS chat_lookups,
      SUM(volunteer IS NOT NULL) AS registered_volunteer_lookups,
      COUNT(DISTINCT volunteer) AS active_volunteers,
      SUM(input LIKE 'photo%') AS photo_lookups,
      MIN(ts) AS first_ts,
      MAX(ts) AS last_ts
    FROM lookups WHERE ${real}`);
  // v2.0.7 search quality (roadmap S1.4): found / not found by way in, by how a typed name was
  // chosen, and by language. "Found" = a medicine was identified (status ok).
  const found = "SUM(status = 'ok') AS found, SUM(status = 'not_found') AS not_found, SUM(status = 'unreadable') AS unreadable";
  const [byInput, byVia, byLangFound] = await Promise.all([
    q(`SELECT CASE WHEN mode IN ('chat', 'whatsapp') THEN mode WHEN input LIKE 'photo%' THEN 'photo' WHEN input = 'text-scan' THEN 'text-scan' ELSE 'typed' END AS way, COUNT(*) AS n, ${found} FROM lookups WHERE ${real} GROUP BY way ORDER BY n DESC`),
    q(`SELECT via, COUNT(*) AS n, ${found} FROM lookups WHERE ${real} AND via IS NOT NULL GROUP BY via ORDER BY n DESC`),
    q(`SELECT lang, COUNT(*) AS n, ${found} FROM lookups WHERE ${real} GROUP BY lang ORDER BY n DESC`),
  ]);
  const [byLang, byDay, byPin, topMeds, testCount] = await Promise.all([
    q(`SELECT lang, COUNT(*) AS n FROM lookups WHERE ${real} GROUP BY lang ORDER BY n DESC`),
    q(`SELECT day, COUNT(*) AS n, ROUND(SUM(CASE WHEN saving_pack > 0 THEN saving_pack ELSE 0 END), 2) AS saving FROM lookups WHERE ${real}${month ? '' : " AND day >= date('now', '-60 day')"} GROUP BY day ORDER BY day`),
    q(`SELECT pin3, COUNT(*) AS n FROM lookups WHERE ${real} AND pin3 IS NOT NULL GROUP BY pin3 ORDER BY n DESC LIMIT 12`),
    q(`SELECT medicine, COUNT(*) AS n, ROUND(AVG(saving_pack), 2) AS avg_saving FROM lookups WHERE ${real} AND status = 'ok' AND ${right} GROUP BY medicine ORDER BY n DESC LIMIT 10`),
    q(`SELECT COUNT(*) AS n FROM lookups WHERE is_test = 1`),
  ]);
  return json({
    generated_at: new Date().toISOString(),
    month,
    note: 'Real usage only: test traffic (evals, demo recordings, developer checks) is flagged is_test=1 and excluded from every figure.',
    totals,
    by_language: byLang,
    by_day: byDay,
    by_pin_prefix: byPin,
    top_medicines: topMeds,
    search: { by_way: byInput, by_via: byVia, by_language: byLangFound },
    excluded_test_lookups: testCount[0]?.n ?? 0,
  }, 200, { 'cache-control': 'public, max-age=30' });
}

// ── Developer data import (/dev page) ─────────────────────────────────────────
// Every /api/admin/* call needs `Authorization: Bearer <ADMIN_TOKEN>`, a Worker secret
// (npx wrangler secret put ADMIN_TOKEN). Developer mode in the browser only shows the page;
// the token is what protects the database. With no secret set, the admin API is off.
// The browser parses and previews the PMBI file (public/pmbi.js); the Worker only checks
// and writes, which keeps each request inside the free plan's CPU limit.

const MAX_IMPORT_CHARS = 8_000_000;

// /api/admin/*: sign-in (worker/src/admin.js), then what each role may do.
//   reviewer: me, logout, Kendra registrations (list, history, decide)
//   owner (ADMIN_TOKEN, or an owner account): all of that, plus accounts and the PMBI data import
const withCookie = (res, cookie) => { if (cookie) res.headers.append('set-cookie', cookie); return res; };

async function handleAdmin(request, env, url) {
  const path = url.pathname.slice('/api/admin'.length);
  const readJson = () => request.json().catch(() => null);
  if (path === '/login' && request.method === 'POST') {
    const r = await login(env, await readJson());
    return withCookie(json(r.body, r.status), r.cookie);
  }
  if (path === '/logout' && request.method === 'POST') {
    const r = await logout(request, env);
    return withCookie(json(r.body, r.status), r.cookie);
  }
  const who = await whoIs(request, env);
  if (!who) {
    const bearer = /^Bearer\s+\S/i.test(request.headers.get('authorization') || '');
    if (bearer && !env.ADMIN_TOKEN) return json({ error: 'admin_disabled', detail: 'Set the ADMIN_TOKEN secret to enable the admin API.' }, 503);
    return json({ error: 'unauthorized', detail: 'Sign in again.' }, 401);
  }
  if (!csrfOk(request, who)) return json({ error: 'forbidden' }, 403);
  const post = request.method === 'POST';

  if (path === '/me') return json({ ...who, can: permissions(who) });
  if (path === '/kendra/list') return json(await adminListKendras(env.DB, url.searchParams.get('status') || 'pending', url.searchParams.get('q') || ''));
  if (path === '/kendra/history') return json({ items: await adminKendraHistory(env.DB, url.searchParams.get('code')) });
  // Registrar (or Admin) enters a Kendra's request received by email or in person.
  if (path === '/kendra/register' && post) {
    if (!can(who, 'register')) return json({ error: 'forbidden', detail: 'Only a Registrar or Admin can register Kendras.' }, 403);
    const r = await staffRegisterKendra(env.DB, await readJson(), who);
    return json(r.body, r.status);
  }
  // Reviewer (or Admin) calls the Kendra and approves, rejects, withdraws or modifies.
  if (path === '/kendra/decide' && post) {
    if (!can(who, 'review')) return json({ error: 'forbidden', detail: 'Only a Reviewer or Admin can approve, reject or withdraw.' }, 403);
    const r = await adminDecideKendra(env.DB, await readJson(), who);
    return json(r.body, r.status);
  }
  if (path === '/kendra/update' && post) {
    if (!can(who, 'review')) return json({ error: 'forbidden', detail: 'Only a Reviewer or Admin can modify a registration.' }, 403);
    const r = await adminUpdateKendra(env.DB, await readJson(), who);
    return json(r.body, r.status);
  }

  // v1.3 Registered volunteers: Registrar registers; Reviewer approves, rejects, removes, modifies.
  // Parked (VOLUNTEER_REGISTRY not "on"): the volunteer API is closed; the data stays.
  if (path.startsWith('/volunteer/') && env.VOLUNTEER_REGISTRY !== 'on') return json({ error: 'volunteers_parked', detail: 'Registered volunteers are paused for now.' }, 403);
  if (path === '/volunteer/list') return json(await listVolunteers(env.DB, url.searchParams.get('status') || 'pending', url.searchParams.get('q') || ''));
  if (path === '/volunteer/history') return json({ items: await volunteerHistory(env.DB, url.searchParams.get('code')) });
  if (path === '/volunteer/register' && post) {
    if (!can(who, 'register')) return json({ error: 'forbidden', detail: 'Only a Registrar or Admin can register volunteers.' }, 403);
    const r = await registerVolunteer(env.DB, await readJson(), who);
    return json(r.body, r.status);
  }
  if ((path === '/volunteer/decide' || path === '/volunteer/update') && post) {
    if (!can(who, 'review')) return json({ error: 'forbidden', detail: 'Only a Reviewer or Admin can approve, remove or modify volunteers.' }, 403);
    const r = path === '/volunteer/decide' ? await decideVolunteer(env.DB, await readJson(), who) : await updateVolunteer(env.DB, await readJson(), who);
    return json(r.body, r.status);
  }

  // Staff accounts: Admin manages Reviewers and Registrars; only the system owner manages Admins.
  if (path.startsWith('/users')) {
    if (!can(who, 'staff')) return json({ error: 'forbidden', detail: 'Only an Admin can manage staff accounts.' }, 403);
    if (path === '/users') return json({ items: await listAdmins(env) });
    if (path === '/users/create' && post) {
      const r = await createAdmin(env, await readJson(), who);
      return json(r.body, r.status);
    }
    if (path === '/users/update' && post) {
      const r = await updateAdmin(env, await readJson(), who);
      return json(r.body, r.status);
    }
    return json({ error: 'not_found' }, 404);
  }

  if (!can(who, 'data')) return json({ error: 'forbidden', detail: 'Only the system owner can do this.' }, 403);
  if (path === '/status') return await handleAdminStatus(env);
  if (path === '/pmbi/context') return await handlePmbiContext(env);
  if (path === '/pmbi/apply' && post) return await handlePmbiApply(request, env);
  if (path === '/ceiling/current') return json({ current: (await env.DB.prepare('SELECT ckey, name, unit, price, unit_price, notification, notified_on FROM ceiling_prices').all().catch(() => ({ results: [] }))).results || [] });
  if (path === '/ceiling/apply' && post) return await handleCeilingApply(request, env);
  return json({ error: 'not_found' }, 404);
}

// v1.2 order requests: a registered Kendra's contact gets orders: true where ORDER_REQUESTS allows
// it ("pilot": test traffic only, until PMBI confirms reserve-and-collect; "public"; "off").
// The order itself is a WhatsApp/SMS message the patient sends from their own phone: nothing is stored.
function markOrders(items, env, isTest) {
  const on = kendraContactsVisible(env.ORDER_REQUESTS, isTest);
  for (const x of items || []) if (x.contact) x.contact.orders = on;
}

// Brand medicines: the static files when deployed (see medstore.js), else the D1 table.
async function medsFor(env) {
  return (env.ASSETS && (await assetMeds(env.ASSETS))) || d1Meds(env.DB);
}

async function handleAdminStatus(env) {
  const one = (sql) => env.DB.prepare(sql).first();
  const meds = await medsFor(env);
  const [meta, ja, medCount, medMeta, kendras] = await Promise.all([
    env.DB.prepare('SELECT key, value FROM meta').all(),
    one('SELECT COUNT(*) AS n FROM ja_products'),
    meds.count(),
    meds.meta(),
    one('SELECT COUNT(*) AS n FROM kendras'),
  ]);
  return json({
    meta: Object.fromEntries((meta.results || []).map((x) => [x.key, x.value])),
    counts: { ja_products: ja?.n ?? 0, medicines: medCount, kendras: kendras?.n ?? 0 },
    medicines: { store: meds.kind, dataset_date: medMeta?.dataset_date ?? null, built_at: medMeta?.built_at ?? null },
  });
}

/** What the developer page needs to parse and diff a PMBI file: brand keys and the current list. */
async function handlePmbiContext(env) {
  const meds = await medsFor(env);
  const [keysJson, current] = await Promise.all([
    meds.keysJson(), // already JSON: passed through without parsing ~15,000 keys
    env.DB.prepare('SELECT drug_code, generic_name, unit_size, mrp, ckey FROM ja_products').all(),
  ]);
  return new Response(`{"brand_keys":${keysJson},"current":${JSON.stringify(current.results || [])}}`, {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function handlePmbiApply(request, env) {
  if (Number(request.headers.get('content-length') || 0) > MAX_IMPORT_CHARS) return json({ error: 'too_large' }, 413);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.list_date || '')) return json({ error: 'bad_import', detail: 'List date must be YYYY-MM-DD.' }, 400);
  const bad = validateProducts(body.items);
  if (bad) return json({ error: 'bad_import', detail: bad }, 400);
  const items = body.items;

  // Guard against a wrong or truncated file wiping most of the list.
  const current = (await env.DB.prepare('SELECT COUNT(*) AS n FROM ja_products').first())?.n ?? 0;
  if (current > 0 && items.length < current * 0.5 && body.force !== true) {
    return json({ error: 'too_few_rows', detail: `The file has ${items.length} usable products, under half of the ${current} loaded now. Check the file, or apply with force.` }, 409);
  }
  const s = body.stats && typeof body.stats === 'object' ? body.stats : {};
  const stats = Object.fromEntries(['rows', 'ok', 'no_equivalent', 'unparsed', 'skipped'].map((k) => [k, Number.isFinite(s[k]) ? s[k] : null]));
  const stmts = [env.DB.prepare('DELETE FROM ja_products'), ...insertStatements(items, 200).map((sql) => env.DB.prepare(sql))];
  const meta = {
    ja_loaded_at: body.list_date,
    ja_list_date: body.list_date,
    ja_stats: JSON.stringify(stats),
    ja_imported_at: new Date().toISOString(),
    ja_source: 'PMBI product MRP list (developer import)',
  };
  for (const [k, v] of Object.entries(meta)) stmts.push(env.DB.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?1, ?2)').bind(k, v));
  await env.DB.batch(stmts); // one transaction: all of it applies, or none of it
  resetMetaCache();
  return json({ ok: true, applied: true, previous_count: current, new_count: items.length, list_date: body.list_date });
}

// NPPA ceiling prices (public/ceiling.js parses in the browser; this only checks and writes).
async function handleCeilingApply(request, env) {
  if (Number(request.headers.get('content-length') || 0) > MAX_IMPORT_CHARS) return json({ error: 'too_large' }, 413);
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'bad_json' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.list_date || '')) return json({ error: 'bad_import', detail: 'List date must be YYYY-MM-DD.' }, 400);
  const bad = validateCeilings(body.items);
  if (bad) return json({ error: 'bad_import', detail: bad }, 400);
  const current = (await env.DB.prepare('SELECT COUNT(*) AS n FROM ceiling_prices').first())?.n ?? 0;
  if (current > 0 && body.items.length < current * 0.5 && body.force !== true) {
    return json({ error: 'too_few_rows', detail: `The file has ${body.items.length} usable rows, under half of the ${current} loaded now. Check the file, or apply with force.` }, 409);
  }
  const stmts = [env.DB.prepare('DELETE FROM ceiling_prices'), ...ceilingInserts(body.items).map((sql) => env.DB.prepare(sql))];
  for (const [k, v] of Object.entries({ ceiling_list_date: body.list_date, ceiling_imported_at: new Date().toISOString(), ceiling_count: String(body.items.length) })) {
    stmts.push(env.DB.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?1, ?2)').bind(k, v));
  }
  await env.DB.batch(stmts); // all or nothing
  resetMetaCache();
  return json({ ok: true, applied: true, previous_count: current, new_count: body.items.length, list_date: body.list_date });
}

async function orderRedirect(env, code, drugCode, l) {
  if (env.ORDER_REQUESTS !== 'public' || !kendraContactsVisible(env.KENDRA_REGISTRY, false)) return null;
  const lang = ['en', 'kn', 'hi'].includes(l) ? l : 'en';
  const [k, p] = await Promise.all([
    env.DB.prepare("SELECT whatsapp FROM kendra_contacts WHERE code = ?1 AND status = 'approved'").bind(code).first(),
    env.DB.prepare('SELECT drug_code, generic_name, unit_size, mrp, ckey FROM ja_products WHERE drug_code = ?1').bind(drugCode).first(),
  ]);
  if (!k?.whatsapp || !p || ntiFromKey(p.ckey)) return null;
  const order = orderItems([{ ckey: p.ckey, name: p.generic_name, nti: false, qty: 1, ja: { name: p.generic_name, code: p.drug_code, unit_size: p.unit_size, mrp: p.mrp } }]);
  return waLink(k.whatsapp, orderMessage({ code }, order, (key, v) => t(lang, key, v), lang === 'en' ? null : (key, v) => t('en', key, v), rupees));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Own domain: once CANONICAL_HOST is set, links that reach the Worker on the old workers.dev
    // address (QR posters /k/…, volunteer /v/…, order /o/…) move to it. /api is never redirected
    // (old app copies and the WhatsApp webhook keep working). Pages are moved by app.js.
    const canon = canonicalRedirect(env, url, request.method);
    if (canon) return Response.redirect(canon, 301);
    const qr = url.pathname.match(/^\/k\/([A-Za-z0-9]{6,12})\/?$/);
    if (qr) return Response.redirect(`${url.origin}/?k=${encodeURIComponent(qr[1].toUpperCase())}`, 302);
    // v2.0: short order link from the WhatsApp bot (/o/PMBJK00964/511?l=kn) → the patient's WhatsApp
    // with the order message to that Kendra. Only an approved Kendra, only where ORDER_REQUESTS is
    // "public", never a never-switch (NTI) medicine; anything else goes to the app's Kendra page.
    const ol = url.pathname.match(/^\/o\/(PMBJK\d{5})\/([A-Za-z0-9-]{1,20})\/?$/i);
    if (ol) {
      const code = ol[1].toUpperCase();
      try {
        const to = await orderRedirect(env, code, decodeURIComponent(ol[2]), url.searchParams.get('l'));
        if (to) return Response.redirect(to, 302);
      } catch {}
      return Response.redirect(`${url.origin}/?k=${code}`, 302);
    }
    // v1.3: a registered volunteer's personal link turns on volunteer mode with their code.
    const vl = url.pathname.match(/^\/v\/(SV-?[A-Za-z0-9]{5})\/?$/i);
    if (vl) return Response.redirect(`${url.origin}/?volunteer=${encodeURIComponent(vl[1].toUpperCase())}`, 302);
    try {
      // Abuse protection: per-address limits on checks and on staff sign-in (worker/src/limits.js).
      if (request.method === 'POST' && CHECK_PATHS.has(url.pathname) && (await overLimit(env, request, 'check'))) {
        return await tooMany(request, url);
      }
      if (url.pathname === '/api/admin/login' && request.method === 'POST' && (await overLimit(env, request, 'login'))) {
        return json({ error: 'locked', detail: 'Too many sign-in attempts from this connection. Wait a minute and try again.' }, 429);
      }
      if (url.pathname.startsWith('/api/admin/')) return await handleAdmin(request, env, url);
      if (url.pathname === '/api/ask' && request.method === 'POST') return await handleAsk(request, env, ctx);
      if (url.pathname === '/api/feedback' && request.method === 'POST') return await handleFeedback(request, env);
      if (url.pathname === '/api/prescription' && request.method === 'POST') return await handlePrescription(request, env);
      if (url.pathname === '/api/impact') return await handleImpact(env, url);
      if (url.pathname === '/api/health') {
        const r = await env.DB.prepare('SELECT key, value FROM meta').all();
        // v2.0.5 monitoring (.github/workflows/monitor.yml): today's photo reads against the daily cap.
        const day = istDay();
        const reads = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM lookups WHERE day = ?1 AND input LIKE 'photo%') + COALESCE((SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'rx_reads_' || ?1), 0) AS n").bind(day).first().catch(() => null);
        const usage = { day, photo_reads: reads?.n ?? null, photo_cap: Number.parseInt(env.DAILY_PHOTO_LIMIT || '', 10) || null };
        return json({ ok: true, version: APP_VERSION, kendra_registry: env.KENDRA_REGISTRY || 'off', registration_email: env.REGISTRATION_EMAIL || null, order_requests: env.ORDER_REQUESTS || 'off', volunteer_registry: env.VOLUNTEER_REGISTRY === 'on' ? 'on' : 'off', whatsapp_bot: botOn(env) ? 'on' : 'off', canonical_host: String(env.CANONICAL_HOST || '').trim().toLowerCase() || null, usage, wa_bot_number: botNumber(env), app_chat: appChatOn(env) ? 'on' : 'off', meta: Object.fromEntries((r.results || []).filter((x) => !x.key.startsWith('rx_reads_')).map((x) => [x.key, x.value])) });
      }
      // Nearest Kendras for a PIN, for the PIN box in an answer's Kendra card (no lookup is logged).
      if (url.pathname === '/api/kendras') {
        // v2.0.4 "Use my location": rounded to ~1 km here, used once, never stored.
        const la = Number.parseFloat(url.searchParams.get('lat'));
        const lo = Number.parseFloat(url.searchParams.get('lng'));
        const point = Number.isFinite(la) && Number.isFinite(lo) && la > 5 && la < 38 && lo > 67 && lo < 98 ? { lat: Math.round(la * 100) / 100, lng: Math.round(lo * 100) / 100 } : {};
        const r = await nearestKendra(env.DB, { pin: url.searchParams.get('pin') || '', ...point });
        if (r.items?.length && kendraContactsVisible(env.KENDRA_REGISTRY, isTestRequest(request, null))) {
          try { await attachContacts(env.DB, r.items); markOrders(r.items, env, isTestRequest(request, null)); } catch {}
        }
        return json({ ...r, pin: String(url.searchParams.get('pin') || '').replace(/\D/g, '').slice(0, 6) });
      }
      // v1.1 Kendra registry. Self-registration is closed: a Kendra emails its request with the
      // required documents, and a registrar enters it (/api/admin/kendra/register).
      if (url.pathname === '/api/kendra/register') {
        return json({ error: 'krRegisterByEmail', detail: 'Kendras register by email; see /kendra.', email: env.REGISTRATION_EMAIL || null }, 410);
      }
      const km = url.pathname.match(/^\/api\/kendra\/([A-Za-z0-9]{6,12})$/);
      if (km && request.method === 'GET') {
        const r = await lookupKendra(env.DB, km[1], { showContact: kendraContactsVisible(env.KENDRA_REGISTRY, isTestRequest(request, null)) });
        if (r.contact) markOrders([r], env, isTestRequest(request, null));
        return json(r, r.found ? 200 : r.error === 'krErrCode' ? 400 : 404);
      }
      // v2.0 WhatsApp bot (WHATSAPP_BOT = "on"): Meta's webhook, and a simulator for test traffic.
      if (url.pathname === '/api/wa/webhook') {
        if (!botOn(env)) return json({ error: 'not_found' }, 404);
        return await handleWebhook(request, env, ctx, (body, result) => logLookup(env, body, result, false));
      }
      if (url.pathname === '/api/wa/simulate' && request.method === 'POST') {
        if (!botOn(env) || !isTestRequest(request, null)) return json({ error: 'not_found' }, 404);
        const b = await request.json().catch(() => ({}));
        const from = String(b.from || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
        if (!from) return json({ error: 'from_required' }, 400);
        const image = typeof b.image === 'string' && b.image.startsWith('data:image/') && b.image.length <= MAX_IMAGE_CHARS ? b.image : null;
        const msg = b.button ? { kind: 'button', from: `sim-${from}`, button: String(b.button) } : image ? { kind: 'image', from: `sim-${from}` } : { kind: 'text', from: `sim-${from}`, text: String(b.text || '') };
        const replies = await handleMessage(env, msg, { isTest: true, origin: url.origin, image: () => image, log: (body, result) => logLookup(env, body, result, true) });
        return json({ replies });
      }
      // v2.0.1: the bot's conversation inside the patient app (home screen → Chat). Same replies as
      // WhatsApp; the chat id is a random per-visit id from the phone (no number exists here).
      if (url.pathname === '/api/chat' && request.method === 'POST') {
        if (!appChatOn(env)) return json({ error: 'not_found' }, 404);
        const b = await request.json().catch(() => ({}));
        const id = String(b.chat || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
        if (id.length < 12) return json({ error: 'chat_required' }, 400);
        const isTest = isTestRequest(request, b);
        const from = `app-${id}`;
        const image = typeof b.image === 'string' && b.image.startsWith('data:image/') && b.image.length <= MAX_IMAGE_CHARS ? b.image : null;
        if (image && (await photoCapReached(env, istDay()))) return json({ replies: [{ kind: 'text', body: t(['en', 'kn', 'hi'].includes(b.lang) ? b.lang : 'en', 'visionDown') }] });
        const msg = b.button ? { kind: 'button', from, button: String(b.button) } : image ? { kind: 'image', from } : { kind: 'text', from, text: String(b.text || '') };
        const device = typeof b.device === 'string' ? b.device : undefined;
        const replies = await handleMessage(env, msg, {
          isTest, origin: url.origin, mode: 'chat', lang: b.lang, pin: b.pin, image: () => image,
          log: (body, result) => logLookup(env, { ...body, device }, result, isTest),
        });
        return json({ replies });
      }
      const vm = url.pathname.match(/^\/api\/volunteer\/([A-Za-z0-9-]{5,10})$/);
      if (vm && request.method === 'GET') return json(await volunteerLinkStatus(env.DB, vm[1]));
      if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: 'server_error', detail: String(e?.message || e).slice(0, 200) }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};
