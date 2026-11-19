// v2.0 WhatsApp bot over the Meta WhatsApp Cloud API. Patients message the bot first, so every
// reply falls inside WhatsApp's 24-hour service window: free-form text and reply buttons, no
// pre-approved templates needed (templates are only for messages we start; we start none).
//
// Flow: Meta → POST /api/wa/webhook (signature checked) → 200 at once → the message is handled in
// the background: text → agent → templated answer; photo → read → "Is this your medicine?" →
// "Yes" → full answer; 6-digit PIN → nearest Kendras; language buttons; DELETE erases the chat.
//
// Privacy: the number is never stored (chat key = HMAC); a chat remembers language, PIN and one
// pending medicine name for at most 24 hours; the impact log gets mode 'whatsapp' with no device.
// Switch: WHATSAPP_BOT = "on" (else the webhook and the simulator answer 404).
// Secrets: WA_TOKEN (access token), WA_PHONE_ID (phone number id), WA_APP_SECRET (signature),
// WA_VERIFY_TOKEN (webhook setup), WA_HASH_KEY (chat key; falls back to WA_APP_SECRET).
import { runAgent } from './agent.js';
import { attachContacts } from './kendra.js';
import { nearestKendra } from './tools.js';
import { kendraContactsVisible } from '../../public/rules.js';
import { t } from '../../public/strings.js';
import { answerText, kendraLines, readText } from './watext.js';
import { photoCapReached } from './limits.js';

const GRAPH = 'https://graph.facebook.com/v21.0';
const DAY_MS = 24 * 3600_000;
const LANG_WORDS = { en: ['english', 'eng'], kn: ['kannada', 'ಕನ್ನಡ'], hi: ['hindi', 'हिन्दी', 'हिंदी'] };
const HELLO = /^(hi+|hello|hey|namaste|namaskara?|start|help|menu|ನಮಸ್ಕಾರ|नमस्ते)[\s!.]*$/i;
const DELETE = /^(delete|stop|erase|ಅಳಿಸಿ|मिटाएँ|मिटाओ)[\s!.]*$/i;
const LANG_CMD = /^(language|lang|bhasha|ಭಾಷೆ|भाषा)[\s!.]*$/i;

export const botOn = (env) => env.WHATSAPP_BOT === 'on';
// v2.0.1: the same conversation inside the patient app (Chat on the home screen); needs no Meta account.
export const appChatOn = (env) => env.APP_CHAT === 'on';
// The bot's WhatsApp number for the home screen's "Ask on WhatsApp" button (digits, with country code).
export const botNumber = (env) => (botOn(env) && /^\d{10,15}$/.test(String(env.WA_BOT_NUMBER || '')) ? String(env.WA_BOT_NUMBER) : null);

// ── Helpers ─────────────────────────────────────────────────────────────────
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, typeof data === 'string' ? new TextEncoder().encode(data) : data));
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Meta signs each webhook body: X-Hub-Signature-256: sha256=<HMAC(app secret, raw body)>. */
export async function signatureOk(raw, header, secret) {
  if (!secret || !header?.startsWith('sha256=')) return false;
  return safeEqual(header.slice(7), await hmac(secret, raw));
}

/** The one-way chat key for a WhatsApp number. */
export const chatKey = (env, from) => hmac(env.WA_HASH_KEY || env.WA_APP_SECRET || 'samasalt-mitra-sim', `wa:${String(from).replace(/\D/g, '')}`).then((h) => h.slice(0, 40));

/** Incoming messages from a webhook body, in a simple shape. Status updates are ignored. */
export function parseInbound(body) {
  const out = [];
  for (const e of body?.entry || []) {
    for (const c of e.changes || []) {
      for (const m of c.value?.messages || []) {
        const base = { id: m.id, from: m.from };
        if (m.type === 'text') out.push({ ...base, kind: 'text', text: String(m.text?.body || '') });
        else if (m.type === 'image') out.push({ ...base, kind: 'image', mediaId: m.image?.id, mime: m.image?.mime_type });
        else if (m.type === 'interactive' && m.interactive?.button_reply) out.push({ ...base, kind: 'button', button: m.interactive.button_reply.id });
        else if (m.type === 'button') out.push({ ...base, kind: 'text', text: String(m.button?.text || '') });
        else out.push({ ...base, kind: 'other' });
      }
    }
  }
  return out;
}

// ── Chat memory (24 hours, no number) ───────────────────────────────────────
async function loadChat(db, chat, now) {
  await db.prepare('DELETE FROM wa_chats WHERE updated_at < ?1').bind(new Date(now - DAY_MS).toISOString()).run();
  return (await db.prepare('SELECT lang, pin, pending FROM wa_chats WHERE chat = ?1').bind(chat).first()) || { lang: null, pin: null, pending: null, fresh: true };
}
function saveChat(db, chat, s, now) {
  return db.prepare(`INSERT INTO wa_chats (chat, lang, pin, pending, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
                     ON CONFLICT(chat) DO UPDATE SET lang = ?2, pin = ?3, pending = ?4, updated_at = ?5`)
    .bind(chat, s.lang || null, s.pin || null, s.pending || null, new Date(now).toISOString()).run();
}

/** True the first time a message id is seen (Meta can deliver a message twice). */
async function firstTime(db, id, now) {
  if (!id) return true;
  await db.prepare('DELETE FROM wa_seen WHERE at < ?1').bind(new Date(now - DAY_MS).toISOString()).run();
  const r = await db.prepare('INSERT OR IGNORE INTO wa_seen (id, at) VALUES (?1, ?2)').bind(id, new Date(now).toISOString()).run();
  return (r.meta?.changes ?? 1) > 0;
}

const langButtons = (lang) => ({ kind: 'buttons', body: t(lang, 'waChooseLang'), buttons: [{ id: 'lang:en', title: 'English' }, { id: 'lang:kn', title: 'ಕನ್ನಡ' }, { id: 'lang:hi', title: 'हिन्दी' }] });
const text = (body) => ({ kind: 'text', body });

function langFromWord(s) {
  const w = s.trim().toLowerCase();
  for (const [code, words] of Object.entries(LANG_WORDS)) if (words.includes(w)) return code;
  return null;
}

// ── One message → replies ───────────────────────────────────────────────────
/**
 * Handle one incoming message; returns the replies (not yet sent).
 * deps: { log(body, result) } to write the anonymous impact row; { image(msg) } to fetch a photo as a data URL;
 * in the app's chat also { lang } (the app's language wins), { pin } (the app's PIN if the chat has none),
 * { mode: 'chat' } for the impact log.
 */
export async function handleMessage(env, msg, deps = {}, now = Date.now()) {
  const db = env.DB;
  const chat = await chatKey(env, msg.from);
  const s = await loadChat(db, chat, now);
  if (['en', 'kn', 'hi'].includes(deps.lang)) s.lang = deps.lang;
  if (!s.pin && /^\d{6}$/.test(String(deps.pin || ''))) s.pin = String(deps.pin);
  const lang = s.lang || 'en';
  const out = [];
  const isTest = !!deps.isTest;

  const check = async (input) => {
    const r = await runAgent(env, { ...input, lang, pin: s.pin || undefined });
    if (r.kendras?.items?.length && kendraContactsVisible(env.KENDRA_REGISTRY, isTest)) {
      try {
        await attachContacts(db, r.kendras.items);
        const orders = kendraContactsVisible(env.ORDER_REQUESTS, isTest);
        for (const k of r.kendras.items) if (k.contact) k.contact.orders = orders;
      } catch {}
    }
    if (r.status !== 'vision_unavailable') await deps.log?.({ ...input, image: input.image ? 'photo' : undefined, mode: deps.mode === 'chat' ? 'chat' : 'whatsapp' }, r).catch?.(() => {});
    return r;
  };
  const answerOrWhy = (r) => {
    if (r.status === 'ok') return text(answerText(lang, r, s.pin, deps.origin));
    if (r.status === 'not_found') return text(t(lang, 'notFound'));
    if (r.status === 'unreadable') return text(`${t(lang, 'photoUnreadable')} ${t(lang, 'waRetype')}`);
    if (r.status === 'vision_unavailable') return text(t(lang, 'visionDown'));
    return text(t(lang, 'waSlow'));
  };

  try {
    if (msg.kind === 'button') {
      const b = String(msg.button || '');
      if (b.startsWith('lang:') && ['en', 'kn', 'hi'].includes(b.slice(5))) {
        s.lang = b.slice(5);
        out.push(text(t(s.lang, 'waLangSet')));
      } else if (b === 'confirm:yes') {
        if (!s.pending) out.push(text(t(lang, 'waNothingPending')));
        else {
          const name = s.pending;
          s.pending = null;
          // Confirmed by the patient: check it by name (the typed-name path: no second confirmation).
          out.push(answerOrWhy(await check({ text: name })));
        }
      } else if (b === 'confirm:no') {
        s.pending = null;
        out.push(text(t(lang, 'waRetype')));
      } else out.push(text(t(lang, 'waUnsupported')));
    } else if (msg.kind === 'text') {
      const body = msg.text.trim().slice(0, 300);
      const pinOnly = body.replace(/\s/g, '').match(/^(\d{6})$/);
      const word = langFromWord(body);
      if (DELETE.test(body)) {
        await db.prepare('DELETE FROM wa_chats WHERE chat = ?1').bind(chat).run();
        return [text(t(lang, 'waDeleted'))];
      } else if (HELLO.test(body) || (s.fresh && !body)) {
        out.push(text(t(lang, 'waWelcome')), langButtons(lang));
      } else if (LANG_CMD.test(body)) {
        out.push(langButtons(lang));
      } else if (word) {
        s.lang = word;
        out.push(text(t(word, 'waLangSet')));
      } else if (pinOnly) {
        s.pin = pinOnly[1];
        const k = await nearestKendra(db, { pin: s.pin });
        if (k.items?.length && kendraContactsVisible(env.KENDRA_REGISTRY, isTest)) { try { await attachContacts(db, k.items); } catch {} }
        out.push(text([t(lang, 'waPinSaved', { pin: s.pin }), '', ...kendraLines(lang, k, s.pin)].join('\n')));
      } else if (body) {
        s.pending = null;
        if (s.fresh) out.push(text(t(lang, 'waWelcome')));
        out.push(answerOrWhy(await check({ text: body })));
      } else out.push(text(t(lang, 'waUnsupported')));
    } else if (msg.kind === 'image') {
      const image = await deps.image?.(msg);
      if (!image) out.push(text(t(lang, 'waSlow')));
      else {
        const r = await check({ image });
        if (r.status === 'ok' && r.needs_confirmation) {
          // A photo is never acted on until the patient confirms the medicine.
          s.pending = r.medicine.name;
          out.push({ kind: 'buttons', body: t(lang, 'waConfirm', { text: readText(r) }), buttons: [{ id: 'confirm:yes', title: t(lang, 'waYes') }, { id: 'confirm:no', title: t(lang, 'waNo') }] });
        } else out.push(answerOrWhy(r));
      }
    } else out.push(text(t(lang, 'waUnsupported')));
  } catch (e) {
    out.push(text(t(lang, 'waSlow')));
    deps.onError?.(e);
  }
  await saveChat(db, chat, s, now);
  return out;
}

// ── Meta Cloud API ──────────────────────────────────────────────────────────
/** The Cloud API request body for one reply. Button titles are cut to WhatsApp's 20 characters. */
export function graphPayload(to, m) {
  if (m.kind === 'buttons') {
    return {
      messaging_product: 'whatsapp', to, type: 'interactive',
      interactive: { type: 'button', body: { text: m.body.slice(0, 1024) }, action: { buttons: m.buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) } },
    };
  }
  return { messaging_product: 'whatsapp', to, type: 'text', text: { body: m.body, preview_url: false } };
}

export async function sendReplies(env, to, replies) {
  for (const m of replies) {
    const res = await fetch(`${GRAPH}/${env.WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.WA_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(graphPayload(to, m)),
    });
    if (!res.ok) throw new Error(`send ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

/** A photo sent to the bot, as a data URL for the vision step (kept in memory only). */
export async function fetchImage(env, msg, maxBytes = 1_800_000) {
  const meta = await (await fetch(`${GRAPH}/${msg.mediaId}`, { headers: { authorization: `Bearer ${env.WA_TOKEN}` } })).json();
  if (!meta?.url || (meta.file_size && meta.file_size > maxBytes)) return null;
  const res = await fetch(meta.url, { headers: { authorization: `Bearer ${env.WA_TOKEN}` } });
  if (!res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > maxBytes) return null;
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${meta.mime_type || msg.mime || 'image/jpeg'};base64,${btoa(bin)}`;
}

/** Webhook: GET = Meta's one-time verification; POST = messages (answered in the background). */
export async function handleWebhook(request, env, ctx, log) {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && env.WA_VERIFY_TOKEN && url.searchParams.get('hub.verify_token') === env.WA_VERIFY_TOKEN;
    return ok ? new Response(url.searchParams.get('hub.challenge') || '', { status: 200 }) : new Response('forbidden', { status: 403 });
  }
  const raw = await request.arrayBuffer();
  if (!(await signatureOk(raw, request.headers.get('x-hub-signature-256'), env.WA_APP_SECRET))) return new Response('bad signature', { status: 401 });
  let body;
  try { body = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response('bad json', { status: 400 }); }
  const work = (async () => {
    for (const msg of parseInbound(body)) {
      if (!(await firstTime(env.DB, msg.id, Date.now()))) continue;
      // Past the day's photo cap (limits.js) a photo is not read; the bot asks to try again / type the name.
      const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
      const replies = await handleMessage(env, msg, { log, origin: url.origin, image: async (m) => ((await photoCapReached(env, day)) ? null : fetchImage(env, m)) });
      await sendReplies(env, msg.from, replies).catch(() => {});
    }
  })();
  ctx.waitUntil(work.catch(() => {}));
  return new Response('ok', { status: 200 }); // Meta wants a quick 200, else it retries
}
