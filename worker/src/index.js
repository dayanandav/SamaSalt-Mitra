// SamaSalt-Mitra agent — Cloudflare Worker: JSON API + static web app (public/).
import { runAgent, resetMetaCache } from './agent.js';
import { validateProducts, insertStatements } from '../../public/pmbi.js';
import { assetMeds, d1Meds } from './medstore.js';

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

async function logLookup(env, body, result, isTest) {
  const id = crypto.randomUUID();
  const s = result.saving || {};
  const device = typeof body.device === 'string' && /^[a-z0-9]{8,40}$/i.test(body.device) ? body.device : null;
  await env.DB.prepare(
    `INSERT INTO lookups (id, ts, day, status, input, medicine, ckey, pack, scanned_unit, cheapest_unit, ja_unit, saving_pack, equivalents, lang, pin3, mode, device, is_test)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`
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
      body.mode === 'volunteer' ? 'volunteer' : 'self',
      device,
      isTest ? 1 : 0
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
  const result = await runAgent(env, body);
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

async function handleImpact(env) {
  const q = (sql) => env.DB.prepare(sql).all().then((r) => r.results || []);
  const real = 'is_test = 0';
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
      SUM(input LIKE 'photo%') AS photo_lookups,
      MIN(ts) AS first_ts,
      MAX(ts) AS last_ts
    FROM lookups WHERE ${real}`);
  const [byLang, byDay, byPin, topMeds, testCount] = await Promise.all([
    q(`SELECT lang, COUNT(*) AS n FROM lookups WHERE ${real} GROUP BY lang ORDER BY n DESC`),
    q(`SELECT day, COUNT(*) AS n, ROUND(SUM(CASE WHEN saving_pack > 0 THEN saving_pack ELSE 0 END), 2) AS saving FROM lookups WHERE ${real} AND day >= date('now', '-60 day') GROUP BY day ORDER BY day`),
    q(`SELECT pin3, COUNT(*) AS n FROM lookups WHERE ${real} AND pin3 IS NOT NULL GROUP BY pin3 ORDER BY n DESC LIMIT 12`),
    q(`SELECT medicine, COUNT(*) AS n, ROUND(AVG(saving_pack), 2) AS avg_saving FROM lookups WHERE ${real} AND status = 'ok' AND ${right} GROUP BY medicine ORDER BY n DESC LIMIT 10`),
    q(`SELECT COUNT(*) AS n FROM lookups WHERE is_test = 1`),
  ]);
  return json({
    generated_at: new Date().toISOString(),
    note: 'Real usage only: test traffic (evals, demo recordings, developer checks) is flagged is_test=1 and excluded from every figure.',
    totals,
    by_language: byLang,
    by_day: byDay,
    by_pin_prefix: byPin,
    top_medicines: topMeds,
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

async function adminDenied(request, env) {
  if (!env.ADMIN_TOKEN) return json({ error: 'admin_disabled', detail: 'Set the ADMIN_TOKEN secret to enable data import.' }, 503);
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([got, env.ADMIN_TOKEN].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  const same = crypto.subtle.timingSafeEqual ? crypto.subtle.timingSafeEqual(a, b) : x.every((v, i) => v === y[i]);
  return same ? null : json({ error: 'unauthorized' }, 401);
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/admin/')) {
        const denied = await adminDenied(request, env);
        if (denied) return denied;
        if (url.pathname === '/api/admin/status') return await handleAdminStatus(env);
        if (url.pathname === '/api/admin/pmbi/context') return await handlePmbiContext(env);
        if (url.pathname === '/api/admin/pmbi/apply' && request.method === 'POST') return await handlePmbiApply(request, env);
        return json({ error: 'not_found' }, 404);
      }
      if (url.pathname === '/api/ask' && request.method === 'POST') return await handleAsk(request, env, ctx);
      if (url.pathname === '/api/feedback' && request.method === 'POST') return await handleFeedback(request, env);
      if (url.pathname === '/api/impact') return await handleImpact(env);
      if (url.pathname === '/api/health') {
        const r = await env.DB.prepare('SELECT key, value FROM meta').all();
        return json({ ok: true, meta: Object.fromEntries((r.results || []).map((x) => [x.key, x.value])) });
      }
      if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: 'server_error', detail: String(e?.message || e).slice(0, 200) }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};
