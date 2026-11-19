// A WhatsApp-style chat box for the bot's conversation, shared by the patient app's Chat (floating
// chat button, /api/chat) and the team's simulator (/wa-sim, /api/wa/simulate). The bot's replies are
// templated text from the Worker; here they are only shown (*bold*, _italic_, links) with their reply
// buttons and the time. With `keep`, the conversation is kept for this visit (sessionStorage) so it is
// still there after the patient looks at something else in the app.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (s) => esc(s)
  .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
  .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<b>$2</b>')
  .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<i>$2</i>');

export const newChatId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
const hhmm = (d = new Date()) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const KEEP_MAX = 60; // messages kept for the visit (photos are never kept)

/**
 * opts: { log (message list element), endpoint, headers, body() → extra fields sent with every message,
 *   onButton(id) → called before a reply button is sent, onMissing() → the endpoint answered 404,
 *   texts() → { typing, error }, keep → sessionStorage key for this visit's messages }
 * Returns { send(payload, echoText), photo(file, side, quality), clear(), busy, size }.
 */
export function createChat(opts) {
  const box = opts.log;
  const texts = () => ({ typing: 'typing…', error: 'Could not reach the bot.', ...(opts.texts?.() || {}) });
  let items = [];
  const save = () => {
    if (!opts.keep) return;
    try { sessionStorage.setItem(opts.keep, JSON.stringify(items.slice(-KEEP_MAX))); } catch {}
  };
  const scroll = () => { box.scrollTop = box.scrollHeight; };

  function draw(it, live) {
    const d = document.createElement('div');
    if (it.k === 'btns') {
      d.className = 'btns';
      d.innerHTML = it.buttons.map((b) => `<button type="button" data-id="${esc(b.id)}">${esc(b.title)}</button>`).join('');
      // Only the newest set of buttons can still be tapped.
      if (!live) for (const x of d.querySelectorAll('button')) x.disabled = true;
      d.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled || busy) return;
        for (const x of d.querySelectorAll('button')) x.disabled = true;
        opts.onButton?.(b.dataset.id);
        send({ button: b.dataset.id }, b.textContent);
      });
    } else {
      d.className = `msg ${it.k}`;
      d.innerHTML = `${it.html}<span class="time">${esc(it.t)}</span>`;
    }
    box.appendChild(d);
    return d;
  }
  function add(it) {
    for (const x of box.querySelectorAll('.btns button')) x.disabled = true;
    items.push(it);
    draw(it, true);
    if (!it.photo) save();
    scroll();
  }
  // This visit's earlier messages (after the patient went back to the app, or reloaded).
  if (opts.keep) {
    try { items = JSON.parse(sessionStorage.getItem(opts.keep) || '[]'); } catch { items = []; }
    items.forEach((it, i) => draw(it, i === items.length - 1));
    requestAnimationFrame(scroll);
  }

  let busy = false;
  async function send(payload, echo, echoHtml) {
    if (busy) return;
    busy = true;
    if (echo != null || echoHtml) add({ k: 'out', html: echoHtml || esc(echo), t: hhmm(), photo: !!echoHtml });
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.textContent = texts().typing;
    box.appendChild(typing);
    scroll();
    try {
      const res = await fetch(opts.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, body: JSON.stringify({ ...(opts.body?.() || {}), ...payload }) });
      if (res.status === 404) { typing.remove(); opts.onMissing?.(); return; }
      const r = await res.json();
      if (!r.replies) throw new Error(r.error || 'no_replies');
      typing.remove();
      for (const m of r.replies) {
        add({ k: 'in', html: fmt(m.body), t: hhmm() });
        if (m.kind === 'buttons') add({ k: 'btns', buttons: m.buttons });
      }
    } catch {
      typing.textContent = texts().error;
      typing.classList.add('err');
    } finally {
      busy = false;
    }
  }
  // A photo, made smaller first (as WhatsApp does), then sent as the bot would download it.
  async function photo(file, side = 1280, quality = 0.85) {
    const img = await createImageBitmap(file);
    const k = Math.min(1, side / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', quality);
    return send({ image: url }, null, `<img src="${url}" alt="">`);
  }
  function clear() {
    items = [];
    box.innerHTML = '';
    save();
  }
  return { send, photo, clear, get busy() { return busy; }, get size() { return items.length; } };
}
