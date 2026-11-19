// Abuse protection. Two guards, both off when their binding/var is missing (tests, local dev):
// 1. Per-address request limits (Cloudflare Rate Limiting bindings in wrangler.toml). The IP address
//    is used only as an in-memory counter key at Cloudflare; it is never written to our database.
// 2. A daily cap on photo reads (DAILY_PHOTO_LIMIT), so a flood of photos cannot use up the free
//    Workers AI allocation and stop photo reading for everyone. Past the cap, patients are asked to
//    type the name (the app's existing "photo reading not available" message).

/** Which limiter guards which kind of request. */
export const LIMITER = { check: 'LIMIT_CHECK', login: 'LIMIT_LOGIN' };

/** true when this address has gone over the limit for `kind` ('check' or 'login'). */
export async function overLimit(env, request, kind) {
  const rl = env[LIMITER[kind]];
  if (!rl || typeof rl.limit !== 'function') return false;
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown';
  try {
    const { success } = await rl.limit({ key: `${kind}:${ip}` });
    return !success;
  } catch {
    return false; // the limiter itself failing must never block patients
  }
}

/** Count one prescription read towards today's cap (prescription reads are not lookups). */
export async function countPrescriptionRead(env, day) {
  try {
    await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('rx_reads_' || ?1, '1') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1").bind(day).run();
  } catch {}
}

/** true when today's photo reads (IST day, test traffic included) have reached DAILY_PHOTO_LIMIT. */
export async function photoCapReached(env, day) {
  const cap = Number.parseInt(env.DAILY_PHOTO_LIMIT || '', 10);
  if (!Number.isFinite(cap) || cap <= 0) return false;
  try {
    const r = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM lookups WHERE day = ?1 AND input LIKE 'photo%') + COALESCE((SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'rx_reads_' || ?1), 0) AS n").bind(day).first();
    return (r?.n || 0) >= cap;
  } catch {
    return false;
  }
}
