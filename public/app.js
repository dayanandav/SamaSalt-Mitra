import { LANGS, STRINGS, t, rupees, unitKind } from '/strings.js';
import { createChat, newChatId } from '/chat.js';
import { suggestWhileTyping, suggestable } from '/suggest.js';
import { pharmacistEntry, unlistedEntry, mergeMedList, asksToSwitch, shouldAddToList, listenAllowed, pickVoice, isPhoneBrowser, freshMedList, keptMedList, monthlySaving, kendraCode, showMobile, orderItems, orderQty, orderMessage, waLink, smsLink, ORDER_MAX_PACKS, photoSendSize, askTimeoutMs, savableAnswer, volunteerCode, shareText, doctorNote } from '/rules.js';

const $ = (s) => document.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

// ── State: language, test flag, volunteer mode, developer mode, anonymous device token ─
const params = new URLSearchParams(location.search);
// Developer mode only while the address has ?dev=1 (never remembered): the plain address is
// always the normal patient app. It shows the developer links and steps, and flags lookups as
// test traffic so developer checks never count on /impact. ?test=1 flags test traffic only.
// (Old builds remembered both in this browser: cleared here.)
store.set('ss_devmode', null);
store.set('ss_test', null);
const devMode = params.get('dev') === '1';
$('#devLinks').hidden = !devMode;
// Developer links keep ?dev=1, so the next page is in developer mode too.
if (devMode) {
  for (const a of document.querySelectorAll('#devLinks a[href^="/"]')) {
    const u = new URL(a.getAttribute('href'), location.origin);
    if (u.pathname !== '/') u.searchParams.set('dev', '1');
    a.setAttribute('href', u.pathname + u.search + u.hash);
  }
}
if (params.has('volunteer')) {
  store.set('ss_vol', params.get('volunteer') === '0' ? null : '1');
  // v1.3: a registered volunteer's personal link (/v/SV-XXXXX → ?volunteer=SV-XXXXX) also keeps their code.
  store.set('ss_vol_code', volunteerCode(params.get('volunteer')));
}
if (params.has('lang') && STRINGS[params.get('lang')]) store.set('ss_lang', params.get('lang'));

// English unless the person has picked another language from the menu (top right).
let lang = STRINGS[store.get('ss_lang')] ? store.get('ss_lang') : 'en';
const isTest = devMode || params.get('test') === '1';
const volunteer = store.get('ss_vol') === '1';
const volCode = volunteer ? volunteerCode(store.get('ss_vol_code')) : null;
let volActive = true; // checked once on load (below)
let device = store.get('ss_dev');
if (!device) {
  device = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, '0')).join('');
  store.set('ss_dev', device);
}
let last = null; // last result, re-rendered on language change
let pending = null; // v1.3: a check waiting for the internet (Try again / back online)

// ── Language ───────────────────────────────────────────────────────────────
function renderLangs() {
  // A compact menu in the top-right corner; more languages are just more entries in LANGS.
  const box = $('#langs');
  if (!box.options.length) {
    for (const l of LANGS) {
      const o = document.createElement('option');
      o.value = l.code;
      o.textContent = l.label;
      o.lang = l.code;
      box.appendChild(o);
    }
    box.onchange = () => setLang(box.value);
  }
  box.value = lang;
}
function applyStrings() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(lang, el.dataset.t);
  for (const el of document.querySelectorAll('[data-tp]')) el.placeholder = t(lang, el.dataset.tp);
  for (const el of document.querySelectorAll('[data-ta]')) { el.setAttribute('aria-label', t(lang, el.dataset.ta)); el.title = t(lang, el.dataset.ta); }
  $('#volBanner').hidden = !volunteer;
  if (volCode) $('#volBanner').textContent = `${t(lang, 'volunteerOn')} · ${volCode}${volActive ? '' : ` · ${t(lang, 'volunteerInactive')}`}`;
  const jaDate = last?.data?.ja_list_date;
  const note = t(lang, 'dataNote', { date: jaDate ? fmtDate(jaDate) : '' });
  // The data sources and list dates are stated once, here at the bottom (not on each card).
  const kDate = last?.data?.kendra_list_date;
  $('#dataNote').textContent = (jaDate ? note : note.split(/(?<=[.।;])\s/)[0]) + (kDate ? ` ${t(lang, 'kendraSource', { date: fmtDate(kDate) })}.` : '');
}
function setLang(code) {
  lang = code;
  store.set('ss_lang', code);
  // Stop an answer being read out in the old language; Listen is set up again with the new one.
  try { speechSynthesis.cancel(); } catch {}
  renderLangs();
  applyStrings();
  renderHere();
  renderHomeList();
  if ($('#pharmacist').open) showPharmacist();
  if (last) {
    // Re-ask so the agent's answer is composed in the new language (cheap: no photo is re-sent).
    // Not yet confirmed: only redraw in the new language (re-asking by name would skip the check).
    if (last.needs_confirmation && !last.confirmed) render(last);
    else if (last.medicine) ask({ text: last.medicine.name, relog: false });
  }
}

// ── Larger text (remembered on this phone) ──────────────────────────────────
function renderTextSize() {
  const big = store.get('ss_big') === '1';
  document.documentElement.classList.toggle('big-text', big);
  $('#textSize').setAttribute('aria-pressed', String(big));
}
$('#textSize').onclick = () => { store.set('ss_big', store.get('ss_big') === '1' ? null : '1'); renderTextSize(); };
renderTextSize();

// ── Inputs ─────────────────────────────────────────────────────────────────
const pinInput = $('#pinInput');
pinInput.value = store.get('ss_pin') || '';
pinInput.addEventListener('input', () => {
  pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 6);
  store.set('ss_pin', pinInput.value.length === 6 ? pinInput.value : null);
});
// The official Kendra list has PIN codes but no coordinates, so Kendras are found by PIN.
// (The Worker still accepts lat/lng for a future geocoded list.)
const coords = null;

// ── v1.1: opened from a Kendra's QR poster (/k/PMBJK00964 → /?k=PMBJK00964) ──
// Says which Kendra the patient is at, and uses its PIN so it is in the nearest-Kendra list.
// Kept for this visit only (sessionStorage). v1.2 builds the order request on this.
const sess = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} },
};
let hereKendra = null;
try { hereKendra = JSON.parse(sess.get('ss_kendra') || 'null'); } catch {}
function renderHere() {
  const box = $('#kendraHere');
  box.hidden = !hereKendra;
  if (!hereKendra) return;
  box.querySelector('.kh-title').textContent = t(lang, 'kendraHere', { code: hereKendra.code });
  box.querySelector('.kh-addr').textContent = [hereKendra.address, hereKendra.district].filter(Boolean).join(', ');
  box.querySelector('.kh-close').textContent = t(lang, 'kendraHereClose');
  const hrs = box.querySelector('.kh-hours');
  hrs.hidden = !hereKendra.contact?.hours;
  hrs.textContent = hereKendra.contact?.hours ? t(lang, 'kendraHours', { hours: hereKendra.contact.hours }) : '';
}
// PIN box in the answer's Kendra card: fetch the Kendras for that PIN and redraw only that card.
$('#result').addEventListener('submit', async (e) => {
  if (e.target.id !== 'kPinForm') return;
  e.preventDefault();
  const pin = ($('#kPin').value || '').replace(/\D/g, '').slice(0, 6);
  if (pin.length !== 6 || !last) { $('#kPin').focus(); return; }
  pinInput.value = pin;
  store.set('ss_pin', pin);
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    const res = await fetch(`/api/kendras?pin=${pin}`, { headers: isTest ? { 'x-samasalt-mitra-test': '1' } : {} });
    if (res.ok) {
      last.kendras = await res.json();
      $('#kendraBody').innerHTML = kendraInner(last);
    }
  } catch {} finally { btn.disabled = false; }
});
// v2.0.4 Kendras by distance. Kendra points are the centre of their PIN code, so "≈ X km".
function kmText(x) {
  return x.km < 1 ? t(lang, 'kmUnder1') : t(lang, 'kmAbout', { km: x.km < 10 ? x.km : Math.round(x.km) });
}
const locIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg>';
// "Use my location": asked only when tapped, rounded to ~1 km, used once to find Kendras, never stored.
document.addEventListener('click', (e) => {
  const b = e.target.closest('#kLoc');
  if (!b || !last) return;
  b.disabled = true;
  b.querySelector('span').textContent = t(lang, 'locating');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const la = pos.coords.latitude.toFixed(2);
      const lo = pos.coords.longitude.toFixed(2);
      const res = await fetch(`/api/kendras?lat=${la}&lng=${lo}`, { headers: isTest ? { 'x-samasalt-mitra-test': '1' } : {} });
      if (res.ok) { last.kendras = await res.json(); $('#kendraBody').innerHTML = kendraInner(last); return; }
    } catch {}
    b.disabled = false;
    b.querySelector('span').textContent = t(lang, 'useLocation');
  }, () => {
    b.disabled = false;
    b.querySelector('span').textContent = t(lang, 'useLocation');
    toast('locationDenied');
  }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
});
$('#kendraHere .kh-close').onclick = () => { hereKendra = null; sess.set('ss_kendra', null); renderHere(); };
async function openFromQr(code) {
  try {
    const res = await fetch(`/api/kendra/${code}`, { headers: isTest ? { 'x-samasalt-mitra-test': '1' } : {} });
    const k = await res.json();
    if (!k.found) return;
    hereKendra = { code: k.code, address: k.address, district: k.district, pin: k.pin, registry: k.registry, contact: k.contact };
    sess.set('ss_kendra', JSON.stringify(hereKendra));
    if (k.pin && /^\d{6}$/.test(k.pin)) { pinInput.value = k.pin; store.set('ss_pin', k.pin); }
    renderHere();
  } catch {}
}
{
  const qrCode = kendraCode(params.get('k'));
  if (qrCode) {
    openFromQr(qrCode);
    // Drop ?k= from the address so a reload or a shared link doesn't repeat it.
    params.delete('k');
    history.replaceState(null, '', location.pathname + (params.toString() ? `?${params}` : '') + location.hash);
  }
}

$('#typeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  hideNameSugg();
  const q = $('#nameInput').value.trim();
  if (q) ask({ text: q, via: 'typed' });
});

// ── Suggestions while typing (roadmap S1.1) ─────────────────────────────────
// Brand names that start like the typed text, read in the phone from the static name index
// (public/suggest.js): no Worker request, the typed text is not sent. Tapping one checks it.
let suggTimer = null;
let suggSeq = 0;
function hideNameSugg() {
  clearTimeout(suggTimer);
  suggSeq += 1; // a late answer for older text is dropped
  $('#nameSugg').hidden = true;
  $('#nameSugg').innerHTML = '';
  document.body.classList.remove('suggesting');
}
// The box sits low on the page: bring it to the top while typing, so the list stays above the keyboard.
$('#nameInput').addEventListener('focus', () => setTimeout(() => $('#typeForm').scrollIntoView({ block: 'start', behavior: 'smooth' }), 300));
$('#nameInput').addEventListener('input', () => {
  clearTimeout(suggTimer);
  const typed = $('#nameInput').value;
  if (!suggestable(typed)) return hideNameSugg();
  suggTimer = setTimeout(async () => {
    const seq = ++suggSeq;
    const names = await suggestWhileTyping(typed).catch(() => []);
    if (seq !== suggSeq || $('#nameInput').value !== typed) return;
    const list = $('#nameSugg');
    list.innerHTML = names.map((n) => `<li><button type="button" class="name-sugg-btn" data-name="${esc(n)}">${esc(n)}</button></li>`).join('');
    list.hidden = !names.length;
    document.body.classList.toggle('suggesting', names.length > 0); // the Chat button steps aside
    for (const b of list.querySelectorAll('button')) {
      b.addEventListener('pointerdown', (e) => e.preventDefault()); // keep the keyboard until the tap ends
      b.addEventListener('click', () => {
        $('#nameInput').value = b.dataset.name;
        hideNameSugg();
        ask({ text: b.dataset.name, via: 'suggest' });
      });
    }
  }, 150);
});
$('#nameInput').addEventListener('keydown', (e) => { if (e.key === 'Escape') hideNameSugg(); });
$('#nameInput').addEventListener('blur', () => setTimeout(hideNameSugg, 150));

// ── Photo: take it, choose the area with the name and composition, send only that ──
// Phone photos are 3-12 MB; the server takes up to ~1.8 MB, so nothing is sent full size.
// The photo is kept at up to 2000 px for cropping (small print stays sharp), and the chosen
// area is sent at up to 1280 px.
// v1.3: smaller (1024 px) on a slow connection or when the phone asks to save data.
const conn = () => navigator.connection || null;
const sendSize = () => photoSendSize(conn());
const KEEP_MAX_SIDE = 2000;
const DEFAULT_CROP = { x: 0.08, y: 0.25, w: 0.84, h: 0.5 }; // fractions of the photo
let photo = null; // canvas with the current photo
const crop = { ...DEFAULT_CROP };

// ── Camera inside the page ──────────────────────────────────────────────────
// The phone's separate camera app (<input capture>) makes Android close this tab on many
// phones to free memory: the page reloads and the photo is lost. The in-app camera keeps the
// page open; the phone camera and the gallery remain as fallbacks.
const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} },
};
const camVideo = $('#camVideo');
let camStream = null;

function stopCamera() {
  camStream?.getTracks().forEach((t) => t.stop());
  camStream = null;
  camVideo.srcObject = null;
}

// The in-app camera. Some phones refuse the detailed request (full HD + continuous focus), so it
// falls back to simpler requests; a camera that gives no picture is restarted once. If it still
// cannot open, the person is told exactly why (permission blocked, camera busy, did not start).
const CAM_REQUESTS = [
  { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: 'continuous' }] },
  { facingMode: { ideal: 'environment' } },
  true,
];
let camTry = 0; // increases on every open, so a slow earlier attempt never takes over
async function openCamera(isRestart = false) {
  if (isRestart !== true) openCamera.restarted = false; // a new tap gets its own restart
  const myTry = ++camTry;
  stopCamera();
  $('#camError').hidden = true;
  $('#camRetry').hidden = true;
  $('#camShoot').hidden = false;
  $('#camShoot').textContent = t(lang, 'camShoot');
  show('camera');
  if (!navigator.mediaDevices?.getUserMedia) return cameraUnavailable('NotSupported');
  let stream = null;
  let lastErr = null;
  for (const video of CAM_REQUESTS) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
      break;
    } catch (e) {
      lastErr = e;
      // Blocked by the person or the browser: asking again in another way does not help.
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') break;
    }
  }
  if (myTry !== camTry) { stream?.getTracks().forEach((tr) => tr.stop()); return; }
  if (!stream) return cameraUnavailable(lastErr?.name || 'Error');
  if ($('#camera').hidden) { stream.getTracks().forEach((tr) => tr.stop()); return; } // cancelled meanwhile
  camStream = stream;
  camVideo.srcObject = camStream;
  // No picture after 5 s (seen on some phones; play() may then never finish, so the check is
  // started first): restart once, then explain.
  setTimeout(() => {
    if (myTry !== camTry || $('#camera').hidden || camVideo.videoWidth) return;
    if (!openCamera.restarted) { openCamera.restarted = true; openCamera(true); }
    else cameraUnavailable('NoPicture');
  }, 5000);
  camVideo.play().catch(() => {});
  sizeCamStage();
}

// The in-app camera could not open: say why, offer Try again, the gallery and the phone camera.
function cameraUnavailable(reason) {
  stopCamera();
  const key = reason === 'NotAllowedError' || reason === 'SecurityError' ? 'camBlocked'
    : reason === 'NotReadableError' || reason === 'AbortError' ? 'camInUse'
    : reason === 'NoPicture' ? 'camNoPicture' : 'camDenied';
  const err = $('#camError');
  err.dataset.t = key; // stays right after a language change
  err.textContent = t(lang, key) + (devMode ? ` (developer: ${reason})` : '');
  err.hidden = false;
  $('#camShoot').hidden = true;
  $('#camRetry').hidden = reason === 'NotSupported';
}
$('#camRetry').onclick = () => openCamera();

// The phone camera app: Android may close this page (or the whole home-screen app) meanwhile, so
// remember that we asked, in localStorage: it survives a full restart, sessionStorage does not.
function phoneCamera() {
  store.set('ss_cam_at', String(Date.now()));
  $('#photo').click();
}

// A still photo is often 4:3 while the preview is 16:9: trim it to exactly what the person saw
// (so the guide box and the crop box cover the same area). If it is turned differently from the
// preview, it is not used (null), and the video frame is taken instead.
function matchPreview(c, vw, vh) {
  if (!c || !vw || !vh) return c;
  if ((c.width >= c.height) !== (vw >= vh)) return null;
  const target = vw / vh;
  let w = c.width;
  let h = c.height;
  if (w / h > target) w = Math.round(h * target);
  else h = Math.round(w / target);
  if (w === c.width && h === c.height) return c;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(c, (c.width - w) / 2, (c.height - h) / 2, w, h, 0, 0, w, h);
  return out;
}

function sizeCamStage() {
  const w0 = camVideo.videoWidth;
  const h0 = camVideo.videoHeight;
  if (!w0 || $('#camera').hidden) return;
  const s = Math.min($('#camWrap').clientWidth / w0, Math.max(240, window.innerHeight * 0.6) / h0);
  const w = Math.round(w0 * s);
  const h = Math.round(h0 * s);
  Object.assign(camVideo.style, { width: `${w}px`, height: `${h}px` });
  Object.assign($('#camStage').style, { width: `${w}px`, height: `${h}px` });
}
camVideo.addEventListener('loadedmetadata', sizeCamStage);
window.addEventListener('resize', sizeCamStage);
// The guide box shows the area the crop step starts with.
Object.assign($('#camStage .cam-guide').style, { left: '8%', top: '25%', width: '84%', height: '50%' });

// "Scan a medicine strip" opens the camera INSIDE the page by default (full-resolution still photos,
// with "Choose from gallery" on the same screen). The phone's own camera app makes Android close
// the browser for memory on many phones, and the photo is lost: that happened again with the
// system picker (Nov 2026), so the phone camera is now only used when the person picks it
// ("Use phone camera" on the camera screen) or when this browser has no in-app camera.
// Scan ALWAYS opens the in-app camera when the browser has one. Nothing is remembered: a stored
// "phone camera" choice made Scan open the plain picker, which newer Android shows as the gallery
// only (no camera) - reported Nov 2026. Older stored choices are cleared.
store.set('ss_cam_mode', null);
store.set('ss_cam_choice', null);
const hasInAppCamera = () => !!navigator.mediaDevices?.getUserMedia;
// No in-app camera at all (very old browsers): the phone camera app, opened directly.
// "Take a photo" = the phone's own camera app (sharpest photos; chosen as the default, Nov 2026).
// If Android closes the page meanwhile (low memory), the note on reload offers the in-app camera.
// On a computer there is no phone camera: Take a photo uses the webcam inside the page, and the
// "phone camera" options (home backup button, camera-screen link) are hidden.
const onPhone = isPhoneBrowser(navigator);
$('#scanBtn').onclick = () => (onPhone ? phoneCamera() : openCamera());
$('#homeInApp').hidden = !onPhone; // on a computer, Take a photo already is the in-app camera
$('#camPhone').hidden = !onPhone;
document.querySelector('.scan-row').classList.toggle('single', !onPhone);
$('#homeGallery').onclick = () => $('#gallery').click();
// Backup: the camera inside the app (never leaves the page).
$('#homeInApp').onclick = () => (hasInAppCamera() ? openCamera() : phoneCamera());
$('#camUseApp').onclick = () => {
  $('#camLost').hidden = true;
  $('#camLostActions').hidden = true;
  openCamera();
};
// "Use phone camera": opens the camera app directly (capture attribute), this once only.
$('#camPhone').onclick = () => {
  stopCamera();
  show('home');
  phoneCamera();
};
$('#camShoot').onclick = async () => {
  if (!camStream) return phoneCamera();
  const btn = $('#camShoot');
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    // A real still photo (full resolution, focused) where the browser supports it: small print on
    // foil is much sharper than in a video frame. Otherwise, the current video frame.
    let shot = null;
    const track = camStream.getVideoTracks()[0];
    if ('ImageCapture' in window && track) {
      try {
        const blob = await new ImageCapture(track).takePhoto();
        shot = matchPreview(await photoCanvas(blob, KEEP_MAX_SIDE), camVideo.videoWidth, camVideo.videoHeight);
      } catch {
        shot = null;
      }
    }
    if (!shot) {
      const w = camVideo.videoWidth;
      const h = camVideo.videoHeight;
      if (!w || !h) return;
      const scale = Math.min(1, KEEP_MAX_SIDE / Math.max(w, h));
      shot = document.createElement('canvas');
      shot.width = Math.round(w * scale);
      shot.height = Math.round(h * scale);
      shot.getContext('2d').drawImage(camVideo, 0, 0, shot.width, shot.height);
    }
    stopCamera();
    photo = shot;
    openCrop();
  } finally {
    btn.disabled = false;
  }
};
$('#camGallery').onclick = () => {
  stopCamera();
  show('home');
  $('#gallery').click();
};
$('#camCancel').onclick = () => {
  stopCamera();
  show('home');
};
// Leaving the page (switching apps) releases the camera; coming back reopens it.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCamera();
  else if (!$('#camera').hidden && $('#camError').hidden) openCamera();
});

// The page was reloaded right after opening the phone camera: say so instead of a silent home screen.
let returnedFromCamera = false; // the page was reloaded because Android closed it during the camera
{
  const at = Number(store.get('ss_cam_at') || 0);
  returnedFromCamera = !!at && Date.now() - at < 10 * 60_000;
  store.set('ss_cam_at', null);
  if (at && Date.now() - at < 10 * 60_000) {
    // Android closed the browser for lack of memory while its camera app was open (Chrome shows
    // "Unable to complete previous operation due to low memory"); the photo cannot be recovered.
    // Say what happened and offer the in-app camera, which never leaves the page.
    $('#camLost').hidden = false;
    $('#camLostActions').hidden = false;
  }
}

for (const id of ['#photo', '#gallery']) $(id).addEventListener('change', (e) => handlePhotoFile(e));
// Picker closed without a photo: the page was not closed by the camera, so forget the marker
// (else a later reload would wrongly switch this phone to the in-app camera).
for (const id of ['#photo']) $(id).addEventListener('cancel', () => store.set('ss_cam_at', null));

async function handlePhotoFile(e) {
  store.set('ss_cam_at', null);
  $('#camLost').hidden = true;
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  photo = await photoCanvas(file, KEEP_MAX_SIDE).catch(() => null);
  if (!photo) {
    // This phone could not decode the photo: send it as-is only if it is small enough.
    const raw = file.size <= 1_800_000 ? await readAsDataUrl(file) : null;
    if (raw) return ask({ image: raw });
    last = { status: 'unreadable' };
    return render(last);
  }
  openCrop();
}

// createImageBitmap first, then an <img> decode (wider format support on some phones).
async function decodePhoto(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (bmp) return bmp;
  return await new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}

async function photoCanvas(file, maxSide) {
  const src = await decodePhoto(file);
  if (!src || !src.width) return null;
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function readAsDataUrl(file) {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(file); });
}

/** JPEG of an area of the photo (rect in fractions), at most maxSide pixels on its long side. */
function jpegOf(canvas, rect, maxSide, quality) {
  const sx = Math.round(rect.x * canvas.width);
  const sy = Math.round(rect.y * canvas.height);
  const sw = Math.max(1, Math.round(rect.w * canvas.width));
  const sh = Math.max(1, Math.round(rect.h * canvas.height));
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(sw * scale));
  out.height = Math.max(1, Math.round(sh * scale));
  out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out.toDataURL('image/jpeg', quality);
}

const cropStage = $('#cropStage');
const cropBox = $('#cropBox');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function openCrop() {
  cropStage.querySelector('canvas')?.remove();
  cropStage.prepend(photo);
  Object.assign(crop, DEFAULT_CROP);
  show('crop');
  sizeCropStage();
  layoutCropBox();
}

// Fit the photo on screen: full width, and no taller than ~60% of the screen.
function sizeCropStage() {
  if (!photo || $('#crop').hidden) return;
  const availW = $('#cropWrap').clientWidth;
  const availH = Math.max(220, window.innerHeight * 0.5); // leaves room for the large preview below
  const s = Math.min(availW / photo.width, availH / photo.height);
  const w = Math.round(photo.width * s);
  const h = Math.round(photo.height * s);
  Object.assign(photo.style, { width: `${w}px`, height: `${h}px` });
  Object.assign(cropStage.style, { width: `${w}px`, height: `${h}px` });
}
window.addEventListener('resize', sizeCropStage);

// Large, sharp preview of exactly the selected area: on a phone screen the whole photo is too
// small to read, so the person checks here that the name and strength are complete and clear.
const cropPreview = $('#cropPreview');
let previewQueued = false;
function drawCropPreview() {
  if (previewQueued) return;
  previewQueued = true;
  requestAnimationFrame(() => {
    previewQueued = false;
    if (!photo || $('#crop').hidden) return;
    const sx = crop.x * photo.width;
    const sy = crop.y * photo.height;
    const sw = Math.max(1, crop.w * photo.width);
    const sh = Math.max(1, crop.h * photo.height);
    const s = Math.min($('#cropWrap').clientWidth / sw, Math.max(140, window.innerHeight * 0.28) / sh);
    const w = Math.round(sw * s);
    const h = Math.round(sh * s);
    const dpr = window.devicePixelRatio || 1;
    cropPreview.width = Math.round(w * dpr);
    cropPreview.height = Math.round(h * dpr);
    Object.assign(cropPreview.style, { width: `${w}px`, height: `${h}px` });
    cropPreview.getContext('2d').drawImage(photo, sx, sy, sw, sh, 0, 0, cropPreview.width, cropPreview.height);
  });
}

function layoutCropBox() {
  drawCropPreview();
  Object.assign(cropBox.style, { left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` });
}

// Drag inside the box to move it; drag a corner to resize it.
let cropDrag = null;
cropBox.addEventListener('pointerdown', (e) => {
  const r = cropStage.getBoundingClientRect();
  cropDrag = { mode: e.target.dataset.h || 'move', x0: e.clientX, y0: e.clientY, start: { ...crop }, W: r.width, H: r.height };
  cropBox.setPointerCapture(e.pointerId);
  e.preventDefault();
});
cropBox.addEventListener('pointermove', (e) => {
  if (!cropDrag) return;
  const { mode, start: s, W, H } = cropDrag;
  const dx = (e.clientX - cropDrag.x0) / W;
  const dy = (e.clientY - cropDrag.y0) / H;
  const MIN = 0.08;
  let { x, y, w, h } = s;
  if (mode === 'move') {
    x = clamp(s.x + dx, 0, 1 - s.w);
    y = clamp(s.y + dy, 0, 1 - s.h);
  } else {
    if (mode.includes('l')) { x = clamp(s.x + dx, 0, s.x + s.w - MIN); w = s.x + s.w - x; }
    if (mode.includes('r')) w = clamp(s.w + dx, MIN, 1 - s.x);
    if (mode.includes('t')) { y = clamp(s.y + dy, 0, s.y + s.h - MIN); h = s.y + s.h - y; }
    if (mode.includes('b')) h = clamp(s.h + dy, MIN, 1 - s.y);
  }
  Object.assign(crop, { x, y, w, h });
  layoutCropBox();
});
for (const ev of ['pointerup', 'pointercancel']) cropBox.addEventListener(ev, () => { cropDrag = null; });

$('#cropUse').onclick = () => { const s = sendSize(); ask({ image: jpegOf(photo, crop, s.side, s.quality) }); };
$('#cropFull').onclick = () => { const s = sendSize(); ask({ image: jpegOf(photo, { x: 0, y: 0, w: 1, h: 1 }, s.side, s.quality) }); };
$('#cropRetake').onclick = () => $('#scanBtn').click();
$('#cropCancel').onclick = () => { photo = null; show('home'); };

// ── Agent call ─────────────────────────────────────────────────────────────
function show(section) {
  if (section !== 'camera') stopCamera();
  for (const id of ['home', 'camera', 'crop', 'busy', 'result', 'chatView', 'rx']) $('#' + id).hidden = id !== section;
  renderFab(section);
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

async function ask({ text, image, ocr, via, relog = true }) {
  $('#busyText').textContent = image ? t(lang, 'reading') : t(lang, 'checking');
  const thumb = $('#thumb');
  thumb.hidden = !image;
  if (image) thumb.src = image;
  show('busy');
  const body = {
    text, image, ocr, lang, via,
    pin: pinInput.value.length === 6 ? pinInput.value : undefined,
    lat: coords?.lat, lng: coords?.lng,
    mode: volunteer ? 'volunteer' : 'self',
    volunteer: volCode || undefined,
    device,
    test: isTest ? true : undefined,
    nolog: relog ? undefined : true,
  };
  let r;
  pending = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    // v1.3: no internet: wait for it instead of failing (checked again by itself when it is back).
    if (!navigator.onLine) { r = { status: 'offline' }; break; }
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), askTimeoutMs(!!image, conn()));
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: stop.signal });
      r = await res.json();
    } catch {
      r = { status: stop.signal.aborted ? 'slow' : navigator.onLine ? 'error' : 'offline' };
    } finally {
      clearTimeout(timer);
    }
    if (r.status === 'offline' || r.status === 'slow' || r.status === 'busy') break; // a retry now would only wait again
    if (r.status !== 'error' && !r.error) break;
    await new Promise((ok) => setTimeout(ok, 2000)); // one quiet retry on a network/server hiccup
  }
  if (r.status === 'not_found' && text && !image && !ocr) r.typed = String(text).trim(); // for "Add to the pharmacist list"
  if (r.status === 'offline' || r.status === 'slow' || r.status === 'busy') {
    // A language change on a saved answer: keep showing it; it changes when the internet is back.
    if (!relog && last?.status === 'ok') { render(last); toast('offlineLang'); return; }
    pending = { text, image, ocr, via, relog };
  }
  // Photo reading is down (quota used up or model error). The on-phone OCR fallback was removed:
  // on real strips it read junk and matched wrong medicines. Ask for typing / keyboard scan.
  if (r.status === 'vision_unavailable') r = { status: 'vision_down' };
  if (!relog && last?.lookup_id) r.lookup_id = last.lookup_id; // keep feedback tied to the original lookup
  // A re-ask for a language change is the same lookup: it must not add to the pharmacist list again.
  r.fresh = relog;
  last = r;
  render(r);
  const keep = savableAnswer(r);
  if (keep) { session.set('ss_last', JSON.stringify(keep)); renderHomeList(); }
}


// "Same brand only. Do not substitute. Why?" — tap to read the reason (never-switch medicines).
function whyHtml(cls, lead) {
  return `<details class="why ${cls}"><summary>${lead ? `<span>${esc(lead)}</span> ` : ''}<span class="why-link">${esc(t(lang, 'ntiWhyTitle'))}</span></summary><p>${esc(t(lang, 'ntiWhy'))}</p></details>`;
}

// Short confirmation after an action, so the person sees that it worked.
let toastTimer = 0;
function toast(key) {
  const el = $('#toast');
  // A modal dialog covers the page: show the message inside it when it is open.
  const host = $('#pharmacist').open ? $('#pharmacist') : document.body;
  if (el.parentNode !== host) host.appendChild(el);
  el.textContent = t(lang, key);
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth; // restart the fade
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); el.hidden = true; }, 2600);
}

// ── Medicine list for the pharmacist ────────────────────────────────────────
// Every medicine found (and confirmed, for photos) is added, one entry per composition, so the
// person can check several strips and show them all at once. Kept on this phone only.
const MAX_LIST = 15;
store.set('ss_medlist', null); // the old long-lived list (before Nov 2026) is removed
// Opening the page again starts a new, empty list, except when Android closed the page while the
// camera was open (the person did not choose to leave; keep what they had).
// v1.3: opened again without internet: keep the list and the last answer of this visit.
if (!returnedFromCamera && navigator.onLine) { session.set('ss_medlist', null); session.set('ss_last', null); }
// P1 My monthly medicines: "Keep this list for next month" (off by default) keeps the list in this
// phone's storage instead of for the visit only. Never sent to our server; off deletes it.
const KEEP = 'ss_keep_list';
const kept = () => store.get(KEEP) != null;
function medList() {
  if (kept()) { try { return keptMedList(JSON.parse(store.get(KEEP))); } catch { return []; } }
  try { return freshMedList(JSON.parse(session.get('ss_medlist') || '[]')); } catch { return []; }
}
function saveMedList(list) {
  // A kept list that becomes empty (cleared, or the last one removed) is deleted.
  if (kept()) store.set(KEEP, list.length ? JSON.stringify(list.slice(0, MAX_LIST)) : null);
  else session.set('ss_medlist', list.length ? JSON.stringify(list.slice(0, MAX_LIST)) : null);
  renderHomeList();
}
// Numbers only for the impact page (lists kept, kept lists opened again); no list, no device.
function countMonthly(event) {
  if (isTest) return;
  try { fetch('/api/monthly', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event }), keepalive: true }).catch(() => {}); } catch {}
}
function setKeep(on) {
  const list = medList();
  if (on) {
    store.set(KEEP, JSON.stringify(list.slice(0, MAX_LIST)));
    session.set('ss_medlist', null);
    countMonthly('kept');
  } else {
    store.set(KEEP, null);
    // Still this visit's list: shown until the app is closed, as before.
    const now = Date.now();
    session.set('ss_medlist', list.length ? JSON.stringify(list.map((x) => ({ ...x, at: now }))) : null);
  }
  renderHomeList();
  showPharmacist();
  toast(on ? 'toastKept' : 'toastUnkept');
}
function addToMedList(r) {
  if (!shouldAddToList(r)) return;
  r.addedToList = true;
  const entry = pharmacistEntry(r);
  const before = medList().find((x) => x.ckey === entry.ckey); // checked again: keep the packs chosen
  saveMedList(mergeMedList(medList(), { ...entry, qty: orderQty(before?.qty), at: Date.now() }, MAX_LIST));
  toast('toastAdded');
}
function renderHomeList() {
  // v1.3: the last answer of this visit, to see again (also without internet).
  $('#lastBtn').hidden = !session.get('ss_last');
  const n = medList().length;
  const b = $('#homeListBtn');
  b.hidden = !n;
  b.textContent = kept() ? t(lang, 'monthlyBtn', { n }) : n === 1 ? t(lang, 'pharmacistBtn') : t(lang, 'pharmacistBtnN', { n });
}
const nbspUnits = (s) => s.replace(/(\d) (mg|mcg|ml|IU|%)/g, '$1 $2');
// v2.0.9 P2 "Is the quality the same?" under the Jan Aushadhi card: fixed text, opened on tap.
// Never for a never-switch medicine (it must not read as a reason to change).
function trustHtml() {
  return `<details class="why ja-trust"><summary><span class="why-link">${esc(t(lang, 'jaTrustTitle'))}</span></summary><p>${esc(t(lang, 'jaTrust'))}</p></details>`;
}

// v2.0.9 P3 "Show this to your doctor": the note is in English for the doctor; the lead and the
// buttons are in the patient's language. Nothing is sent or stored.
function showDoctor() {
  const { items, left } = doctorNote(medList());
  if (!items.length) return;
  $('#docHello').textContent = t('en', 'doctorHello');
  $('#docAsk').textContent = t('en', 'doctorAsk');
  $('#docList').innerHTML = items.map((x) => `<li>${esc(nbspUnits(x))}</li>`).join('');
  $('#docFoot').textContent = t('en', 'doctorFoot');
  $('#docLeft').hidden = !left.length;
  $('#docLeft').textContent = left.length ? t(lang, 'doctorLeft', { names: left.join(', ') }) : '';
  if ($('#pharmacist').open) $('#pharmacist').close();
  if (!$('#doctor').open) $('#doctor').showModal();
}
function doctorPlainText() {
  const { items } = doctorNote(medList());
  return [t('en', 'doctorHello'), '', t('en', 'doctorAsk'), '', ...items.map((x, i) => `${i + 1}. ${x}`), '', t('en', 'doctorFoot')].join('\n');
}
$('#phDoctor').onclick = showDoctor;
$('#docPrint').onclick = () => {
  document.body.classList.add('print-doctor');
  window.print();
  setTimeout(() => document.body.classList.remove('print-doctor'), 500);
};
$('#docShare').onclick = async () => {
  const text = doctorPlainText();
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  if (onPhone) { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); return; }
  try { await navigator.clipboard.writeText(text); toast('shareCopied'); } catch {}
};

function showPharmacist() {
  const list = medList();
  if (!list.length) { if ($('#pharmacist').open) $('#pharmacist').close(); return; }
  const keep = kept();
  const anyNti = list.some((x) => x.nti); // never-switch: never "the lowest-priced" for it
  $('#phLead').textContent = t(lang, (list.length > 1 ? 'pharmacistCardMany' : 'pharmacistCard') + (anyNti ? 'Nti' : ''));
  $('#phList').innerHTML = list.map((x, i) => `
    <li>
      <p class="ph-comp">${esc(x.unlisted ? x.name : nbspUnits(x.composition))}</p>
      <p class="ph-sub">${esc(x.unlisted ? t(lang, 'phUnlisted') : [x.form, x.name].filter(Boolean).join(' · '))}</p>
      ${x.nti ? whyHtml('ph-nti', t(lang, 'phNti')) : ''}
      ${x.ja ? `<p class="ph-ja">${esc(t(lang, x.nti ? 'phJaNti' : 'phJa', { name: x.ja.name, code: x.ja.code }))}</p>` : x.noJa ? `<p class="ph-ja ph-noja">${esc(t(lang, 'phNoJa'))}</p>` : ''}
      ${keep && x.ja && !x.nti && !x.unlisted ? `<div class="ph-packs"><span>${esc(t(lang, 'monthlyPacks'))}${x.ja.unit_size ? ` (${esc(x.ja.unit_size)})` : ''}</span>
        <div class="qty" role="group" aria-label="${esc(t(lang, 'orderPacks'))}">
          <button type="button" data-ph-q="-1" data-i="${i}" aria-label="${esc(t(lang, 'orderLess'))}"${orderQty(x.qty) <= 1 ? ' disabled' : ''}>−</button>
          <output aria-live="polite">${orderQty(x.qty)}</output>
          <button type="button" data-ph-q="1" data-i="${i}" aria-label="${esc(t(lang, 'orderMore'))}"${orderQty(x.qty) >= ORDER_MAX_PACKS ? ' disabled' : ''}>+</button>
        </div></div>` : ''}
      <button class="link ph-remove" type="button" data-i="${i}">${esc(t(lang, 'listRemove'))}</button>
    </li>`).join('');
  for (const b of $('#phList').querySelectorAll('[data-ph-q]')) {
    b.onclick = () => {
      const l = medList();
      const x = l[Number(b.dataset.i)];
      if (!x) return;
      x.qty = orderQty(orderQty(x.qty) + Number(b.dataset.phQ));
      saveMedList(l);
      showPharmacist();
    };
  }
  // The switch, and the saving for the packs in the kept list (prices only from our data).
  $('#keepSwitch').checked = keep;
  $('#keepNote').textContent = t(lang, keep ? 'keepOn' : 'keepOff');
  $('#phHint').hidden = keep;
  const sv = keep ? monthlySaving(list) : null;
  $('#keepSave').hidden = !sv;
  $('#keepSave').innerHTML = sv
    ? `${esc(t(lang, 'monthlySave', { month: '@@MONTH@@', year: '@@YEAR@@' })).replace('@@MONTH@@', `<b>${esc(rupees(sv.month))}</b>`).replace('@@YEAR@@', `<b>${esc(rupees(sv.year))}</b>`)}${sv.left ? `<br><span class="field-note">${esc(t(lang, 'monthlyLeft'))}</span>` : ''}<br><span class="field-note">${esc(t(lang, 'monthlyNote'))}</span>`
    : '';
  for (const b of $('#phList').querySelectorAll('.ph-remove')) {
    b.onclick = () => {
      const l = medList();
      l.splice(Number(b.dataset.i), 1);
      saveMedList(l);
      if (l.length) showPharmacist();
      else $('#pharmacist').close();
      updatePhBtn();
      toast('toastRemoved');
    };
  }
  $('#phClear').hidden = false; // always: the whole list can be cleared at any time
  // v1.2: order the list from a registered Kendra (only when one is known and something can be ordered).
  $('#phOrder').hidden = !(orderKendras().length && orderItems(list).items.length);
  $('#phDoctor').hidden = !doctorNote(list).items.length;
  if (!$('#pharmacist').open) $('#pharmacist').showModal();
}
$('#phOrder').onclick = () => { $('#pharmacist').close(); openOrder(orderKendras()[0]?.code); };

// ── v1.2 Order for pickup ───────────────────────────────────────────────────
// Registered Kendras that take order requests (contact.orders is set by the Worker only where
// ORDER_REQUESTS allows it): those in the latest answer, and the Kendra whose QR was scanned.
function orderKendras() {
  const seen = new Set();
  const out = [];
  for (const x of [...(last?.kendras?.items || []), ...(hereKendra ? [hereKendra] : [])]) {
    if (x?.contact?.orders && x.contact.whatsapp && !seen.has(x.code)) { seen.add(x.code); out.push(x); }
  }
  return out;
}
let orderCode = null;
function openOrder(code) {
  const ks = orderKendras();
  const k = ks.find((x) => x.code === code) || ks[0];
  if (!k) return;
  orderCode = k.code;
  renderOrder();
  if (!$('#order').open) $('#order').showModal();
}
function renderOrder() {
  const ks = orderKendras();
  const k = ks.find((x) => x.code === orderCode) || ks[0];
  if (!k) { $('#order').close(); return; }
  const list = medList();
  const order = orderItems(list);
  const addr = esc([k.address, k.district].filter(Boolean).join(', '));
  $('#orderKendra').innerHTML = `<div class="order-k">${ks.length > 1
    ? `<label class="cap" for="orderKSel">${esc(t(lang, 'orderKendra'))}</label><select id="orderKSel">${ks.map((x) => `<option value="${esc(x.code)}"${x.code === k.code ? ' selected' : ''}>${esc(t(lang, 'orderAt', { code: x.code }))}${x.km != null ? ` · ${kmText(x)}` : ''}</option>`).join('')}</select><span>${addr}</span>`
    : `<b>${esc(t(lang, 'orderAt', { code: k.code }))}</b><span>${addr}</span>`}
    ${k.contact.hours ? `<span style="display:block">${esc(t(lang, 'kendraHours', { hours: k.contact.hours }))}</span>` : ''}</div>`;
  $('#orderList').innerHTML = order.items.map((i) => `
    <li data-ckey="${esc(i.ckey)}">
      <div><p class="o-name">${esc(nbspUnits(i.name))}</p>
        <p class="o-sub">PMBJP ${esc(i.code)}${i.unit_size ? ` · ${esc(i.unit_size)}` : ''}${i.mrp != null ? ` · ${esc(t(lang, 'orderEach', { price: rupees(i.mrp) }))}` : ''}</p></div>
      <div class="qty" role="group" aria-label="${esc(t(lang, 'orderPacks'))}">
        <button type="button" data-q="-1" aria-label="${esc(t(lang, 'orderLess'))}"${i.qty <= 1 ? ' disabled' : ''}>−</button>
        <output aria-live="polite">${i.qty}</output>
        <button type="button" data-q="1" aria-label="${esc(t(lang, 'orderMore'))}"${i.qty >= ORDER_MAX_PACKS ? ' disabled' : ''}>+</button>
      </div>
    </li>`).join('');
  $('#orderExcluded').innerHTML = [
    ...order.excluded.map((x) => `<li>${esc(t(lang, x.reason === 'nti' ? 'orderNti' : 'orderNoJa', { name: x.name }))}</li>`),
    ...(order.items.length ? [] : [`<li>${esc(t(lang, list.length ? 'orderNone' : 'orderNoKendra'))}</li>`]),
  ].join('');
  $('#orderTotal').textContent = order.total != null ? t(lang, 'orderTotal', { amount: rupees(order.total) }) : '';
  $('#orderPriceNote').hidden = order.total == null;
  const can = order.items.length > 0;
  $('#orderSend').hidden = !can;
  if (can) {
    const text = orderMessage(k, order, (key, v) => t(lang, key, v), lang !== 'en' ? (key, v) => t('en', key, v) : null, rupees);
    $('#orderWa').href = waLink(k.contact.whatsapp, text);
    const sms = smsLink(k.contact.sms || k.contact.whatsapp, text);
    $('#orderSms').hidden = !sms;
    if (sms) $('#orderSms').href = sms;
  }
}
$('#order').addEventListener('click', (e) => {
  const b = e.target.closest('.qty button');
  if (!b) return;
  const ckey = b.closest('li').dataset.ckey;
  const list = medList();
  const x = list.find((y) => y.ckey === ckey);
  if (!x) return;
  x.qty = orderQty(orderQty(x.qty) + Number(b.dataset.q));
  saveMedList(list);
  renderOrder();
});
$('#order').addEventListener('change', (e) => {
  if (e.target.id === 'orderKSel') { orderCode = e.target.value; renderOrder(); }
});
// Order buttons in the answer's Kendra card.
$('#result').addEventListener('click', (e) => {
  const b = e.target.closest('.k-order');
  if (b) openOrder(b.dataset.code);
});
// Clear list: removes EVERY medicine (nothing is kept, not even the one on screen).
$('#phClear').onclick = () => {
  saveMedList([]);
  $('#pharmacist').close();
  updatePhBtn();
  toast('toastCleared');
};
$('#homeListBtn').onclick = () => {
  // A kept list opened again (counted once per visit, number only).
  if (kept() && !session.get('ss_keep_opened')) { session.set('ss_keep_opened', '1'); countMonthly('opened'); }
  showPharmacist();
};
$('#keepSwitch').onchange = (e) => setKeep(e.target.checked);
function updatePhBtn() {
  const b = $('#phBtn');
  if (!b) return;
  const n = medList().length;
  b.hidden = n === 0; // cleared or removed: nothing to show
  b.textContent = n > 1 ? t(lang, 'pharmacistBtnN', { n }) : t(lang, 'pharmacistBtn');
}

// ── Rendering ──────────────────────────────────────────────────────────────
function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00+05:30');
  if (isNaN(d)) return iso;
  try { return d.toLocaleDateString({ en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' }[lang], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }); } catch { return iso; }
}
// Map "directions" sign (turn arrow in a diamond), in the blue used by map apps.
const dirIcon = '<svg class="dir-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1a73e8" d="M21.71 11.29l-9-9a1 1 0 0 0-1.42 0l-9 9a1 1 0 0 0 0 1.42l9 9a1 1 0 0 0 1.42 0l9-9a1 1 0 0 0 0-1.42z"/><path fill="#fff" d="M14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5z"/></svg>';
const speakerIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const warnIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';

// "Is this the medicine on your strip?" A misread photo must never turn into a switch suggestion,
// so nothing about prices or other brands is shown until the person says yes.
function renderConfirm(r) {
  const m = r.medicine;
  const readText = [r.read?.brand, r.read?.composition].filter(Boolean).join(' · ');
  $('#result').innerHTML = `
    <div class="card">
      <p class="eyebrow">${esc(t(lang, 'confirmTitle'))}</p>
      <p class="med-name">${esc(m.name)}</p>
      <p class="med-comp">${esc(m.composition)}</p>
      ${readText ? `<p class="med-meta">${esc(t(lang, 'readOnStrip', { text: readText }))}</p>` : ''}
      <p class="muted" style="margin:12px 0 0;font-size:15px">${esc(t(lang, 'confirmHint'))}</p>
      ${devMode && r.read_score != null ? `<p class="source">developer: read score=${r.read_score}/100 (pass 70)</p>` : ''}
    </div>
    <div class="crop-actions">
      <button class="primary" id="confYes" type="button">${esc(t(lang, 'confirmYes'))}</button>
      <button class="secondary" id="confRetake" type="button">${esc(t(lang, 'confirmNo'))}</button>
      <p class="crop-links"><button class="link" id="confType" type="button">${esc(t(lang, 'confirmType'))}</button></p>
    </div>`;
  const wrong = () => {
    // Counted (anonymously) so misreads can be measured; the lookup is not used as a saving.
    if (r.lookup_id) fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.lookup_id, switched: 'wrong' }) }).catch(() => {});
  };
  $('#confYes').onclick = () => { r.confirmed = true; render(r); };
  $('#confRetake').onclick = () => { wrong(); $('#scanBtn').click(); };
  $('#confType').onclick = () => { wrong(); show('home'); $('#nameInput').focus(); };
  show('result');
}


// The Kendra card of an answer. Has its own PIN box, so a PIN typed after the medicine was
// checked (or a photo scanned) updates this list in place.
function kendraInner(r) {
  const k = r.kendras || {};
  const kQuery = (x) => `Jan Aushadhi Kendra ${[x.address, x.district, x.pin].filter(Boolean).join(' ')}`;
  const list = k.items?.length
    ? `${k.by === 'nearby-pin' ? `<p class="med-meta" style="margin:0 0 4px">${esc(t(lang, 'kendraNearby'))}</p>` : ''}
      <ul class="list">${k.items.map((x) => `
        <li><div><div class="n">${esc(t(lang, 'kendraName'))}<span class="tag grey">${esc(x.code)}</span>${x.registered ? `<span class="tag">${esc(t(lang, 'kendraRegistered'))}</span>` : ''}</div>
        <div class="m">${esc([x.address, x.district].filter(Boolean).join(', '))}</div>
        ${x.contact?.hours ? `<div class="m">${esc(t(lang, 'kendraHours', { hours: x.contact.hours }))}</div>` : ''}
        ${x.contact ? `<div class="k-actions"><a href="tel:+91${esc(x.contact.sms || x.contact.whatsapp)}">${esc(t(lang, 'call'))} ${esc(showMobile(x.contact.sms || x.contact.whatsapp))}</a>${x.contact.orders && x.contact.whatsapp && orderItems(medList()).items.length ? `<button class="k-order" type="button" data-code="${esc(x.code)}">${esc(t(lang, 'orderBtn'))}</button>` : ''}</div>` : x.phone ? `<div class="k-actions"><a href="tel:${esc(x.phone)}">${esc(t(lang, 'call'))}</a></div>` : ''}</div>
        <div class="p">${x.km != null ? `<b>${esc(kmText(x))}</b><span>${esc(x.pin)}</span>` : `<b>${esc(x.pin)}</b><span>PIN</span>`}
          <a class="dir-btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(x.lat && x.lng ? `${x.lat},${x.lng}` : kQuery(x))}">${dirIcon}<span>${esc(t(lang, 'directions'))}</span></a></div></li>`).join('')}</ul>`
    : `<p class="muted" style="margin:0">${esc(t(lang, k.pending ? 'kendraPending' : pinInput.value.length === 6 ? 'kendraNone' : 'kendraNeedPin'))}</p>`;
  const pinNow = (k.pin || pinInput.value || '').slice(0, 6);
  return `${list}
      <form class="k-pin" id="kPinForm" autocomplete="off">
        <label class="cap" for="kPin">${esc(t(lang, 'pinShort'))}</label>
        <input id="kPin" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="580020" value="${esc(pinNow)}" autocomplete="postal-code">
        <button class="secondary" type="submit">${esc(t(lang, 'kendraPinShow'))}</button>
      </form>
      ${'geolocation' in navigator ? `<button class="link k-loc" id="kLoc" type="button">${locIcon}<span>${esc(t(lang, 'useLocation'))}</span></button>` : ''}
      ${k.by === 'location' || k.items?.some((x) => x.km != null) ? `<p class="med-meta k-approx">${esc(t(lang, 'kmApprox'))}</p>` : ''}`;
}

// "Not found": close names to tap, then what the person can still do (photograph the salts, type
// them, or show the typed name to the pharmacist).
function notFoundHelp(r) {
  const sugg = (r.suggestions || []).slice(0, 5);
  // "Ask, don't guess": brands that only partly fit what was typed, each with its salts.
  const choices = (r.choices || []).slice(0, 5);
  return `
      ${choices.length ? `<ul class="rx-list nf-choices">${choices.map((c) => `<li><button type="button" class="nf-sugg" data-name="${esc(c.name)}"><b>${esc(c.name)}</b><span>${esc(c.composition)}</span></button></li>`).join('')}</ul>
      <p class="med-meta">${esc(t(lang, 'chooseCheck'))}</p>` : ''}
      ${sugg.length ? `<p class="nf-title">${esc(t(lang, 'didYouMean'))}</p><div class="nf-suggs">${sugg.map((n) => `<button class="secondary nf-sugg" type="button" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
      <p class="nf-title">${esc(t(lang, 'nfHow'))}</p>
      <div class="crop-actions"><button class="primary" id="nfScan" type="button">${esc(t(lang, 'nfScanBack'))}</button></div>
      <p class="med-meta">${esc(t(lang, 'nfScanBackWhy'))}</p>
      <p class="med-meta">${esc(t(lang, 'nfTypeSalts'))}</p>
      ${r.typed ? `<div class="crop-actions"><button class="secondary" id="nfAdd" type="button">${esc(t(lang, 'nfAddPh'))}</button></div>` : ''}`;
}

// S3.10: photos not read in this visit (each answer counted once; kept for the visit only).
function unreadTwice() { return Number(session.get('ss_unread') || 0) >= 2; }
function countUnread(r) {
  if (r.status !== 'unreadable' || r.unreadCounted) return;
  r.unreadCounted = true;
  session.set('ss_unread', String(Number(session.get('ss_unread') || 0) + 1));
}

function render(r) {
  const out = $('#result');
  applyStrings();
  countUnread(r);
  if (r.status !== 'ok') {
    // Say what actually went wrong: not in the database, photo unreadable, or the check failed.
    const why = r.status === 'not_found' ? (r.choices?.length ? 'chooseOne' : 'notFound') : r.status === 'unreadable' ? 'photoUnreadable' : r.status === 'vision_down' ? 'visionDown' : r.status === 'offline' ? 'offlineWait' : r.status === 'slow' ? 'slowNet' : r.status === 'busy' ? 'tooMany' : 'checkFailed';
    // Read check failed: say why, show what was read, and offer a retake or typing.
    const whyRead = { no_composition: 'readNoComposition', brand_mismatch: 'readMismatch', low_confidence: 'readBlurry' }[r.reason];
    const readText = [r.read?.brand, r.read?.composition].filter(Boolean).join(' · ');
    out.innerHTML = `
      <div class="card"><p class="med-name" style="font-size:22px;line-height:1.35">${esc(t(lang, why))}</p>
      ${r.status === 'unreadable' && r.choices?.length ? `<p class="read-why">${esc(t(lang, 'photoChoose', { brand: r.read?.brand || '' }))}</p>
      <ul class="rx-list nf-choices">${r.choices.slice(0, 5).map((c) => `<li><button type="button" class="nf-sugg" data-via="photochoice" data-name="${esc(c.name)}"><b>${esc(c.name)}</b><span>${esc(c.composition)}</span></button></li>`).join('')}</ul>
      <p class="med-meta">${esc(t(lang, 'chooseCheck'))}</p>` : ''}
      ${r.status === 'unreadable' && whyRead && !r.choices?.length ? `<p class="read-why">${esc(t(lang, whyRead))}</p>` : ''}
      ${readText ? `<p class="med-meta">${esc(t(lang, 'readOnStrip', { text: readText }))}</p>` : ''}
      ${r.status === 'not_found' ? notFoundHelp(r) : ''}
      ${(r.status === 'offline' || r.status === 'slow' || r.status === 'busy') && pending ? `<div class="crop-actions" style="margin-top:14px"><button class="primary" id="retryBtn" type="button">${esc(t(lang, 'tryAgain'))}</button></div>${r.status === 'offline' ? `<p class="med-meta">${esc(t(lang, 'offlineAuto'))}</p>` : ''}` : ''}
      ${r.status === 'unreadable' ? (unreadTwice()
        // S3.10: a second photo not read in this visit: typing the name is offered first.
        ? `<p class="read-why">${esc(t(lang, 'photoTypeTip'))}</p><div class="crop-actions" style="margin-top:14px"><button class="primary" id="typeBtn" type="button">${esc(t(lang, 'confirmType'))}</button><button class="secondary" id="retakeBtn" type="button">${esc(t(lang, 'retakePhoto'))}</button></div>`
        : `<div class="crop-actions" style="margin-top:14px"><button class="primary" id="retakeBtn" type="button">${esc(t(lang, 'retakePhoto'))}</button><button class="secondary" id="typeBtn" type="button">${esc(t(lang, 'confirmType'))}</button></div>`) : ''}
      ${devMode ? `<p class="source">developer: status=${esc(r.status || '-')}${r.read_score != null ? ` · read score=${r.read_score}/100 (pass 70)${r.reason ? ` · ${esc(r.reason)}` : ''}` : ''}${r.error ? ` · error=${esc(r.error)}` : ''}${r.detail ? ` · ${esc(r.detail)}` : ''}${r.trace?.length ? ` · steps=${esc(r.trace.map((s) => s.tool + (s.error ? '!' : '') + (s.output?.failed ? `(${[].concat(s.output.failed).join('; ')})` : '')).join(' > '))}` : ''}</p>` : ''}</div>
      <button class="secondary" id="againBtn">${esc(t(lang, 'another'))}</button>`;
    $('#againBtn').onclick = () => { show('home'); $('#nameInput').focus(); };
    if ($('#retakeBtn')) $('#retakeBtn').onclick = () => $('#scanBtn').click();
    if ($('#typeBtn')) $('#typeBtn').onclick = () => { show('home'); $('#nameInput').focus(); };
    if ($('#retryBtn')) $('#retryBtn').onclick = () => pending && ask(pending);
    for (const b of out.querySelectorAll('.nf-sugg')) b.onclick = () => {
      $('#nameInput').value = b.dataset.name;
      if (b.dataset.via === 'photochoice') ask({ text: b.dataset.name, via: 'photochoice' }); // a brand read from a photo
      else ask({ text: b.dataset.name, via: 'didyoumean' });
    };
    if ($('#nfScan')) $('#nfScan').onclick = () => $('#scanBtn').click();
    if ($('#nfAdd')) $('#nfAdd').onclick = () => {
      const e = unlistedEntry(r.typed);
      if (!e) return;
      saveMedList(mergeMedList(medList(), { ...e, qty: orderQty(), at: Date.now() }, MAX_LIST));
      updatePhBtn();
      toast('toastAdded');
      $('#nfAdd').disabled = true;
    };
    show('result');
    return;
  }
  // Read from a photo or scan: the person confirms the medicine before any price or alternative.
  if (r.needs_confirmation && !r.confirmed) return renderConfirm(r);
  const m = r.medicine;
  const unit = unitKind(m.form);
  const per = t(lang, 'perUnit')[unit];
  const s = r.saving || {};
  const items = r.same_salt.items || [];
  const yoursInList = items.some((x) => x.name.toLowerCase() === m.name.toLowerCase());

  const listHtml = items.slice(0, 6).map((x) => `
    <li class="${x.name.toLowerCase() === m.name.toLowerCase() ? 'yours' : ''}">
      <div><div class="n">${esc(x.name)}${x.name.toLowerCase() === m.name.toLowerCase() ? `<span class="tag">${esc(t(lang, 'yours'))}</span>` : ''}</div><div class="m">${esc(x.manufacturer || '')}</div></div>
      <div class="p"><b>${rupees(x.unit_price)}</b><span>${esc(per)}</span><span>${esc(t(lang, 'packOf', { n: Math.round(x.pack), price: rupees(x.price) }))}</span></div>
    </li>`).join('');
  const yoursRow = !yoursInList && m.unit_price ? `
    <li class="yours"><div><div class="n">${esc(m.name)}<span class="tag">${esc(t(lang, 'yours'))}</span></div><div class="m">${esc(m.manufacturer || '')}</div></div>
    <div class="p"><b>${rupees(m.unit_price)}</b><span>${esc(per)}</span></div></li>` : '';

  const ja = r.jan_aushadhi || {};
  const jaDate = r.data?.ja_list_date;
  const jaHtml = ja.available ? `
      <p class="ja-name">${esc(ja.product.generic_name)}</p>
      <p class="ja-price">${rupees(ja.product.mrp)}<small>${esc(ja.product.unit_size || '')}</small></p>
      <p class="med-meta">${esc(t(lang, 'jaMrp'))}${ja.product.unit_price ? ` · ${rupees(ja.product.unit_price)} ${esc(per)}` : ''} · PMBJP ${esc(ja.product.drug_code)}</p>
      ${!m.nti ? trustHtml() : ''}
`
    : `<p class="muted" style="margin:0">${esc(t(lang, ja.pending ? 'jaPending' : 'jaNone'))}</p>`;

  // The official list's "name" is often the licensee's personal name, so a Kendra is shown by
  // its PMBJK code and address only.
  const k = r.kendras || {};
  const kDate = r.data?.kendra_list_date;
  addToMedList(r); // before the Kendra card: its "Order for pickup" button depends on the list
  const kHtml = kendraInner(r);

  // The brand name as read from the strip, when the match was made by composition alone.
  const readName = (r.read?.brand || '').trim();
  // "Will you buy a lower-priced option?" whenever an option is listed: the Jan Aushadhi generic
  // or another brand with the same composition. Never for a never-switch medicine.
  const hasOption = asksToSwitch(r);

  const steps = (r.trace || []).map((st) => `<li><code>${esc(st.tool)}</code> ${esc(summarizeStep(st))} <span class="muted">· ${st.ms} ms</span></li>`).join('');

  out.innerHTML = `
    <div class="card">
      <p class="eyebrow">${esc(t(lang, 'youHave'))}</p>
      <p class="med-name">${esc(m.name)}</p>
      <p class="med-comp">${esc(m.name === m.composition.split(' · ')[0] ? m.composition.split(' · ').slice(1).join(' · ') : m.composition)}</p>
      ${readName && readName.toLowerCase().replace(/[^a-z0-9]/g, '') !== m.name.toLowerCase().replace(/[^a-z0-9]/g, '') ? `<p class="med-meta">${esc(t(lang, 'readOnStrip', { text: readName }))}</p>` : ''}
      ${m.price ? `<p class="med-meta">${esc(t(lang, 'packOf', { n: Math.round(m.pack), price: rupees(m.price) }))} · ${rupees(m.unit_price)} ${esc(per)}${m.manufacturer ? ` · ${esc(m.manufacturer)}` : ''}</p>` : ''}
    </div>

    ${!m.nti && s.saving_pack > 0 ? `<div class="saving"><p class="big">${esc(t(lang, 'saveUpTo', { amount: rupees(s.saving_pack) }))}</p><p class="small">${rupees(s.scanned_unit)} → ${rupees(s.best_unit)} ${esc(per)}<span class="pct">−${s.pct}%</span></p></div>` : ''}

    <div class="answer${m.nti ? ' nti-answer' : ''}" lang="${lang}"><div id="answerText">${esc(r.answer)}</div>
      <div class="row"><button class="pill" id="listenBtn" hidden>${speakerIcon}${esc(t(lang, 'listen'))}</button></div>
      ${m.nti ? whyHtml('why-inline', '') : ''}</div>

    ${!m.nti ? `<div class="card">
      <p class="eyebrow">${esc(t(lang, 'sameSaltTitle'))}</p>
      ${r.same_salt.count ? `<p class="count">${esc(t(lang, 'brandsCount', { n: r.same_salt.count.toLocaleString('en-IN') }))}</p>
      <ul class="list">${listHtml}${yoursRow}</ul>` : `<p class="muted" style="margin:0">${esc(t(lang, r.data?.brands_loaded === false ? 'brandsPending' : 'sameSaltNone'))}</p>`}
    </div>` : ''}

    <div class="card">
      <p class="eyebrow">${esc(t(lang, 'jaTitle'))}</p>
      ${jaHtml}
    </div>

    ${!m.nti && r.ceiling?.available ? `<div class="card ceiling">
      <p class="eyebrow">${esc(t(lang, 'ceilingTitle'))}</p>
      <p class="ceil-price">${esc(t(lang, 'ceilingPrice', { price: rupees(r.ceiling.unit_price), per }))}</p>
      <p class="med-meta">${esc(t(lang, 'ceilingNote'))}</p>
      <p class="med-meta">${esc(t(lang, 'ceilingSource', { so: r.ceiling.notification ? ` ${r.ceiling.notification}` : '', date: r.ceiling.notified_on ? ` · ${fmtDate(r.ceiling.notified_on)}` : '' }))}</p>
    </div>` : ''}

    <div class="card" id="kendraCard">
      <p class="eyebrow">${esc(t(lang, 'kendraTitle'))}</p>
      <div id="kendraBody">${kHtml}</div>
    </div>

    <div class="safety">${warnIcon}<div>${esc(t(lang, 'safety'))}</div></div>

    <div class="actions">
      <button class="primary" id="phBtn">${esc(t(lang, 'pharmacistBtn'))}</button>
      <button class="secondary share-btn" id="shareBtn" type="button">${esc(t(lang, 'share'))}</button>
      ${rxList ? `<button class="secondary share-btn" id="rxBackBtn" type="button">${esc(t(lang, 'rxBack'))}</button>` : ''}
    </div>

    ${hasOption ? `<div class="card feedback" id="fb">
      <p>${esc(t(lang, 'switchQ'))}</p>
      <div class="chips">
        <button class="chip" data-v="yes">${esc(t(lang, 'switchYes'))}</button>
        <button class="chip" data-v="ask">${esc(t(lang, 'switchAsk'))}</button>
        <button class="chip" data-v="no">${esc(t(lang, 'switchNo'))}</button>
      </div>
    </div>` : ''}

    ${devMode ? `<details class="steps"><summary>${esc(t(lang, 'stepsTitle'))}</summary><ol>${steps}</ol></details>` : ''}

    <button class="secondary" id="againBtn">${esc(t(lang, 'another'))}</button>
  `;

  // Shows the list as it is: after "Clear list" nothing is put back (the button is hidden until
  // the next medicine is checked).
  $('#phBtn').onclick = showPharmacist;
  $('#shareBtn').onclick = () => shareAnswer(r);
  if ($('#rxBackBtn')) $('#rxBackBtn').onclick = renderRx;
  updatePhBtn();
  for (const b of out.querySelectorAll('.chip')) {
    b.onclick = async () => {
      $('#fb').innerHTML = `<p style="margin:0">${esc(t(lang, 'thanks'))}</p>`;
      if (r.lookup_id) {
        fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.lookup_id, switched: b.dataset.v }) }).catch(() => {});
      }
    };
  }
  $('#againBtn').onclick = () => { rxList = null; show('home'); };
  setupListen(r.answer, r.lang || lang);
  show('result');
}

function summarizeStep(st) {
  const o = st.output || {};
  if (st.error) return `error: ${st.error}`;
  switch (st.tool) {
    case 'read_strip': return o.failed ? 'vision unavailable' : `${o.model?.split('/').pop()} read "${[o.brand, o.composition].filter(Boolean).join(' · ')}"`;
    case 'identify_medicine': return o.found === false ? 'not found' : `${o.name} (${o.via})`;
    case 'understand_text': return o.failed ? 'no medicine found' : `"${o.brand}"`;
    case 'find_same_salt': return `${o.count} brands with key ${st.input?.ckey}`;
    case 'ceiling_price': return o.available === false ? 'no NPPA ceiling price for this key' : `₹${o.unit_price}/unit · ${o.notified_on || ''}`;
    case 'jan_aushadhi_match': return o.skipped ? o.skipped : o.available === false ? 'no PMBJP product with this key' : `${o.name} · ₹${o.mrp}`;
    case 'nearest_kendra': return o.skipped ? o.skipped : `${o.found} found (${o.by})`;
    case 'parse_ocr_text': return `text read on the phone → ${(o.brand_candidates || []).slice(0, 3).join(', ')}${o.composition ? ` · ${o.composition}` : ''}`;
    case 'compose_answer': return `${lang}`;
    default: return '';
  }
}

// Read the answer aloud in the language it is written in (the answer's own language, not the menu's,
// so a Kannada answer is never read by an English voice). Android lists voices as "kn_IN".
function setupListen(text, textLang) {
  const btn = $('#listenBtn');
  if (!btn || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel(); // nothing from an earlier result keeps playing
  const want = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' }[textLang] || 'en-IN';
  const pick = () => pickVoice(textLang, speechSynthesis.getVoices());
  // Only offered when the phone has a voice for this language (else it would read in the wrong one).
  const enable = () => { btn.hidden = !listenAllowed(textLang, lang, speechSynthesis.getVoices()); };
  enable();
  speechSynthesis.onvoiceschanged = enable;
  btn.onclick = () => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = pick();
    u.lang = want;
    u.rate = 0.95;
    speechSynthesis.speak(u);
  };
}

// ── v1.3 weak-network mode ─────────────────────────────────────────────────
function renderNet() {
  $('#offlineBar').hidden = navigator.onLine;
}
window.addEventListener('offline', renderNet);
window.addEventListener('online', () => {
  renderNet();
  // Back online with a check still waiting on screen: do it now.
  if (pending && !$('#result').hidden && (last?.status === 'offline' || last?.status === 'slow')) ask(pending);
});
$('#lastBtn').onclick = () => {
  try {
    const r = JSON.parse(session.get('ss_last') || 'null');
    if (r) { last = r; render(r); }
  } catch {}
};
// The app's files are kept on the phone so it opens without internet (public/sw.js).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
}

// ── v2.0.1 Chat: the WhatsApp bot's conversation, in the app or in the patient's WhatsApp ──
// As chat apps do it: a floating chat button on the home screen and answers, suggestion chips, message
// times, and the conversation kept while the patient moves around the app (this visit only). Shown only
// when switched on (/api/health: app_chat, wa_bot_number). The chat id is random and per visit; the
// Worker remembers language, PIN and one pending medicine for 24 hours at most.
let chatId = sess.get('ss_chat');
let chat = null;
var chatOn = false; // var: show() may run before this line (renderFab reads it)
var waHref = null;
let chatFrom = 'home';
function renderFab(section) {
  $('#chatFab').hidden = !(chatOn || waHref) || !['home', 'result'].includes(section);
  document.documentElement.classList.toggle('has-fab', !$('#chatFab').hidden);
}
function chatBox() {
  if (!chatId) { chatId = newChatId() + newChatId(); sess.set('ss_chat', chatId); }
  if (!chat) {
    chat = createChat({
      log: $('#chatLog'),
      endpoint: '/api/chat',
      keep: 'ss_chat_log',
      headers: isTest ? { 'x-samasalt-mitra-test': '1' } : {},
      body: () => ({ chat: chatId, lang, pin: pinInput.value.length === 6 ? pinInput.value : undefined, device, test: isTest ? true : undefined }),
      // The chat's language buttons change the whole app's language.
      onButton: (id) => { if (id.startsWith('lang:') && STRINGS[id.slice(5)] && id.slice(5) !== lang) setLang(id.slice(5)); },
      onMissing: () => { chatOn = false; show('home'); },
      texts: () => ({ typing: t(lang, 'chatTyping'), error: t(lang, 'chatError') }),
    });
  }
  return chat;
}
function openChat() {
  chatFrom = $('#result').hidden ? 'home' : 'result';
  show('chatView');
  if (!chatBox().size) chat.send({ text: 'Hi' });
}
$('#chatFab').onclick = (e) => {
  if (chatOn) { e.preventDefault(); openChat(); }
  // Only WhatsApp is on: the link itself opens WhatsApp.
};
// Same words as the bot's DELETE command (worker/src/whatsapp.js).
const CHAT_DELETE = /^(delete|stop|erase|ಅಳಿಸಿ|मिटाएँ|मिटाओ)[\s!.]*$/i;
// Clear chat / DELETE: the chat sends the app's PIN with every message, so it is forgotten as well.
function forgetPin() {
  pinInput.value = '';
  store.set('ss_pin', null);
}
$('#chatBack').onclick = () => show(chatFrom === 'result' && last ? 'result' : 'home');
$('#chatNew').onclick = () => { chatId = newChatId() + newChatId(); sess.set('ss_chat', chatId); chatBox().clear(); chat.send({ text: 'Hi' }); };
const chatText = $('#chatText');
const resetChatInput = () => { chatText.inputMode = 'text'; chatText.placeholder = t(lang, 'chatPlaceholder'); };
$('#chatBar').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatText.value.trim();
  if (!text || chatBox().busy) return;
  chatText.value = '';
  resetChatInput();
  // A PIN typed in the chat is also the app's PIN (same as the PIN box on the home screen).
  if (/^\d{6}$/.test(text)) { pinInput.value = text; store.set('ss_pin', text); }
  // DELETE (as on WhatsApp) erases the chat's memory; the app's saved PIN goes too, or the next
  // message would hand it straight back to the bot.
  if (CHAT_DELETE.test(text)) forgetPin();
  chat.send({ text }, text);
});
$('#chatPhoto').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  const s = sendSize();
  if (file && !chatBox().busy) chat.photo(file, s.side, s.quality);
});
$('#chatChips').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || chatBox().busy) return;
  const c = b.dataset.chip;
  if (c === 'scan') $('#chatPhoto').click();
  else if (c === 'lang') chat.send({ text: 'language' }, b.textContent.trim());
  else if (c === 'clear') {
    // As in chat apps: erase what the bot remembers (DELETE), empty the screen, start a fresh chat.
    forgetPin();
    chat.send({ text: 'DELETE' }).then(() => {
      chatId = newChatId() + newChatId();
      sess.set('ss_chat', chatId);
      chat.clear();
      toast('chatCleared');
      chat.send({ text: 'Hi' });
    });
  }
  else if (c === 'kendra') {
    // With a PIN already in the app: ask for its Kendras; otherwise ask the patient to type it.
    if (pinInput.value.length === 6) chat.send({ text: pinInput.value }, pinInput.value);
    else { chatText.inputMode = 'numeric'; chatText.placeholder = t(lang, 'chatPinAsk'); chatText.focus(); }
  }
});
fetch('/api/health').then((r) => r.json()).then((h) => {
  // Own domain: on the old workers.dev address, move to it (same page, same ?k= / ?volunteer= etc.).
  if (h.canonical_host && location.hostname !== h.canonical_host && location.hostname.endsWith('.workers.dev')) {
    location.replace(`https://${h.canonical_host}${location.pathname}${location.search}${location.hash}`);
    return;
  }
  chatOn = h.app_chat === 'on';
  // WhatsApp: the bot's number once it is set; on the test site, developer mode opens the simulator.
  waHref = h.wa_bot_number ? `https://wa.me/${h.wa_bot_number}?text=${encodeURIComponent('Hi')}` : devMode && h.whatsapp_bot === 'on' ? '/wa-sim?dev=1' : null;
  $('#chatWa').hidden = !waHref;
  if (waHref) $('#chatWa').href = waHref;
  const fab = $('#chatFab');
  fab.classList.toggle('wa-only', !chatOn && !!waHref);
  if (!chatOn && waHref) { fab.href = waHref; fab.target = '_blank'; fab.rel = 'noopener'; fab.querySelector('span').dataset.t = 'askWhatsapp'; applyStrings(); }
  renderFab([...['home', 'result']].find((id) => !$('#' + id).hidden) || 'none');
}).catch(() => {});

// ── v2.0.4 Share the answer ─────────────────────────────────────────────────
// The phone's share sheet (WhatsApp, SMS, any app); where there is none, WhatsApp; else copy.
async function shareAnswer(r) {
  const text = shareText(r, (k, v) => t(lang, k, v), rupees, t(lang, 'perUnit')[unitKind(r.medicine?.form)], location.origin);
  if (!text) return;
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  if (onPhone) { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); return; }
  try { await navigator.clipboard.writeText(text); toast('shareCopied'); } catch {}
}

// ── v2.0.4 Add to home screen (Android Chrome offers it; "Not now" is remembered) ─
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvt = e;
  if (store.get('ss_install_no') !== '1') $('#installBar').hidden = false;
});
window.addEventListener('appinstalled', () => { $('#installBar').hidden = true; installEvt = null; });
$('#installBtn').onclick = async () => {
  $('#installBar').hidden = true;
  if (!installEvt) return;
  installEvt.prompt();
  try { await installEvt.userChoice; } catch {}
  installEvt = null;
};
$('#installNo').onclick = () => { $('#installBar').hidden = true; store.set('ss_install_no', '1'); };

// ── v2.0.4 Scan a prescription ──────────────────────────────────────────────
// The names on it (no patient or doctor details, no doses); each is checked only when tapped.
var rxList = null; // var: render() may run before this line
$('#rxBtn').onclick = () => $('#rxPhoto').click();
$('#rxPhoto').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  let image;
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(img.width, img.height)); // a prescription needs more detail than a strip
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    image = c.toDataURL('image/jpeg', 0.85);
  } catch { return; }
  $('#busyText').textContent = t(lang, 'rxReading');
  $('#thumb').hidden = false;
  $('#thumb').src = image;
  show('busy');
  let r;
  try {
    const res = await fetch('/api/prescription', { method: 'POST', headers: { 'content-type': 'application/json', ...(isTest ? { 'x-samasalt-mitra-test': '1' } : {}) }, body: JSON.stringify({ image, lang, test: isTest ? true : undefined }) });
    r = await res.json();
  } catch {
    r = { status: navigator.onLine ? 'error' : 'offline' };
  }
  if (r.status === 'ok') { rxList = r.items; renderRx(); return; }
  rxList = null;
  const key = r.status === 'unreadable' ? 'rxNone' : r.status === 'vision_unavailable' ? 'visionDown' : r.status === 'busy' ? 'tooMany' : r.status === 'offline' ? 'offlineWait' : 'checkFailed';
  last = { status: 'rx_failed' };
  $('#result').innerHTML = `<div class="card"><p class="med-name" style="font-size:22px;line-height:1.35">${esc(t(lang, key))}</p></div><button class="secondary" id="againBtn">${esc(t(lang, 'another'))}</button>`;
  $('#againBtn').onclick = () => show('home');
  show('result');
});
function renderRx() {
  if (!rxList) return show('home');
  const box = $('#rx');
  box.innerHTML = `
    <div class="card">
      <p class="eyebrow">${esc(t(lang, 'rxTitle'))}</p>
      <p class="med-meta" style="margin:0 0 12px">${esc(t(lang, 'rxNote'))}</p>
      <ul class="rx-list">${rxList.map((it, i) => it.found
        ? `<li><button type="button" data-i="${i}"><b>${esc(it.name)}</b><span>${esc(it.composition)}</span></button></li>`
        : it.choose
          ? `<li><button type="button" data-r="${i}"><b>${esc(it.read)}</b><span>${esc(t(lang, 'rxChoose'))}</span></button></li>`
          : `<li class="rx-miss">${esc(t(lang, 'rxNotFound', { text: it.read }))}</li>`).join('')}</ul>
    </div>
    <button class="secondary" id="rxHome" type="button">${esc(t(lang, 'another'))}</button>`;
  box.querySelectorAll('button[data-i]').forEach((b) => { b.onclick = () => ask({ text: rxList[Number(b.dataset.i)].name, via: 'rx' }); });
  box.querySelectorAll('button[data-r]').forEach((b) => { b.onclick = () => ask({ text: rxList[Number(b.dataset.r)].read, via: 'rx' }); });
  $('#rxHome').onclick = () => { rxList = null; show('home'); };
  show('rx');
}

// v1.3: is this volunteer's link approved? (Only yes/no comes back; checks still work either way.)
if (volCode) fetch(`/api/volunteer/${volCode}`).then((r) => r.json()).then((r) => { volActive = !!r.active; applyStrings(); }).catch(() => {});

renderLangs();
applyStrings();
renderHere();
renderNet();
renderHomeList();
// Everything is in place: show the page (index.html holds it hidden until now).
document.documentElement.removeAttribute('data-boot');
