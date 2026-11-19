// WhatsApp bot simulator (/wa-sim, team only): sends what a patient would send to
// /api/wa/simulate (test traffic) and shows the bot's replies, buttons included.
import { createChat, newChatId } from '/chat.js';

const $ = (s) => document.querySelector(s);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
let from = store.get('wa_sim_from') || newChatId();
store.set('wa_sim_from', from);

const chat = createChat({
  log: $('#chat'),
  endpoint: '/api/wa/simulate',
  headers: { 'x-samasalt-mitra-test': '1' },
  body: () => ({ from }),
  onMissing: () => { $('#off').hidden = false; $('#phone').hidden = true; $('#hints').hidden = true; },
});

$('#bar').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#text').value.trim();
  if (!text) return;
  $('#text').value = '';
  chat.send({ text }, text);
});
for (const b of document.querySelectorAll('#hints button')) b.onclick = () => chat.send({ text: b.textContent }, b.textContent);
$('#newChat').onclick = () => { from = newChatId(); store.set('wa_sim_from', from); chat.clear(); chat.send({ text: 'Hi' }, 'Hi'); };
$('#photo').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (file) chat.photo(file);
});

chat.send({ text: 'Hi' }, 'Hi');
