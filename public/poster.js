// v1.1 QR poster (/poster?k=PMBJK00964), printed by a Kendra whose number an admin has approved.
// The QR opens /k/<code>: the app for that Kendra. English plus one more language on the poster.
// While KENDRA_REGISTRY is "pilot", only developer-mode browsers (test traffic) can print it.
import { LANGS, STRINGS, t } from '/strings.js';
import { kendraCode, showMobile } from '/rules.js';

const $ = (s) => document.querySelector(s);
// Developer mode only while the address has ?dev=1 (see app.js).
const isTest = new URLSearchParams(location.search).get('dev') === '1';
const code = kendraCode(new URLSearchParams(location.search).get('k'));
let uiLang = 'en';
try { if (STRINGS[localStorage.getItem('ss_lang')]) uiLang = localStorage.getItem('ss_lang'); } catch {}

// No poster to show: say why (on screen and on paper, never a blank page) and offer the code box.
function nope(key, extra = '') {
  $('#nope').hidden = false;
  $('#nope').textContent = (key ? t(uiLang, key) : '') + (extra ? ` ${extra}` : '');
  $('#pick').hidden = false;
  if (code) $('#pickCode').value = code;
}
$('#pick').onsubmit = (e) => {
  e.preventDefault();
  const c = kendraCode($('#pickCode').value);
  if (!c) return nope('krErrCode');
  location.href = `/poster?k=${c}${isTest ? '&dev=1' : ''}`;
};

function render(k, second) {
  const two = (key, vars) => (second === 'en' ? [t('en', key, vars)] : [t('en', key, vars), t(second, key, vars)]);
  const both = (key) => two(key).map((x) => `<span>${x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>`).join('');
  const [tagEn, tag2] = two('tagline');
  $('#pTag').innerHTML = '';
  $('#pTag').append(document.createTextNode(tagEn));
  if (tag2) { const s = document.createElement('small'); s.textContent = tag2; $('#pTag').append(s); }
  $('#pScan').innerHTML = both('posterScan');
  $('#pContactLbl').textContent = two('posterContact').join(' · ');
  $('#pNum').textContent = showMobile(k.contact.sms || k.contact.whatsapp) + (k.contact.sms && k.contact.sms !== k.contact.whatsapp ? `  ·  WhatsApp ${showMobile(k.contact.whatsapp)}` : '');
  $('#pPickup').innerHTML = both('posterPickup');
  $('#pCode').textContent = `${t('en', 'kendraName')} ${k.code}` + (second !== 'en' ? ` · ${t(second, 'kendraName')}` : '');
  $('#pAddr').textContent = [k.address, k.district, k.state, k.pin].filter(Boolean).join(', ');
  document.documentElement.lang = second;
}

async function main() {
  if (!code) return nope(null, 'Enter the Kendra code to open its poster.');
  let k;
  try {
    const res = await fetch(`/api/kendra/${code}`, { headers: isTest ? { 'x-samasalt-mitra-test': '1' } : {} });
    k = await res.json();
  } catch {
    return nope('krErrNetwork');
  }
  if (!k.found) return nope(k.error || 'krErrNotFound');
  if (k.registry === 'pending') return nope('krPosterNotYet', `(${k.code}: waiting for admin approval on /dev.)`);
  if (k.registry !== 'approved') return nope('krPosterNotYet', `(${k.code}: not registered. Register it at /kendra first.)`);
  // Approved, but numbers are not public yet (live site in pilot mode, developer mode off).
  if (!k.contact) return nope(null, `${k.code} is approved. During the pilot, posters can be printed only in developer mode: open /poster?k=${k.code}&dev=1 (the Poster button in Admin / Review does this).`);

  const link = `${location.origin}/k/${k.code}`;
  const qr = qrcode(0, 'M'); // eslint-disable-line no-undef -- global from /vendor/qrcode.js
  qr.addData(link);
  qr.make();
  $('#pQr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  $('#pUrl').textContent = link.replace(/^https?:\/\//, '');

  // Second language: Kannada for Karnataka Kendras, Hindi elsewhere; changeable.
  const sel = $('#second');
  for (const l of LANGS) {
    const o = document.createElement('option');
    o.value = l.code;
    o.textContent = l.code === 'en' ? 'English only' : l.label;
    sel.appendChild(o);
  }
  sel.value = /karnataka/i.test(k.state || '') || /^5[6-9]/.test(k.pin || '') ? 'kn' : 'hi';
  if (!STRINGS[sel.value]) sel.value = 'en';
  sel.onchange = () => render(k, sel.value);
  render(k, sel.value);
  $('#tools').hidden = false;
  $('#poster').hidden = false;
  $('#printBtn').onclick = () => window.print();
}
main();
