import { LANGS, STRINGS, t, rupees, unitKind } from '/strings.js';
import { pharmacistEntry, mergeMedList, asksToSwitch, shouldAddToList, listenAllowed, pickVoice } from '/rules.js';

const $ = (s) => document.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

// ── State: language, test flag, volunteer mode, developer mode, anonymous device token ─
const params = new URLSearchParams(location.search);
if (params.has('test')) store.set('ss_test', params.get('test') === '0' ? null : '1');
// Developer mode (?dev=1 / ?dev=0): shows the impact, volunteer and GitHub links, and flags
// this browser's lookups as test traffic so developer checks never count on /impact.
if (params.has('dev')) store.set('ss_devmode', params.get('dev') === '0' ? null : '1');
const devMode = store.get('ss_devmode') === '1';
if (devMode) store.set('ss_test', '1');
else if (params.get('dev') === '0') store.set('ss_test', null);
$('#devLinks').hidden = !devMode;
if (params.has('volunteer')) store.set('ss_vol', params.get('volunteer') === '0' ? null : '1');
if (params.has('lang') && STRINGS[params.get('lang')]) store.set('ss_lang', params.get('lang'));

// English unless the person has picked another language from the menu (top right).
let lang = STRINGS[store.get('ss_lang')] ? store.get('ss_lang') : 'en';
const isTest = store.get('ss_test') === '1';
const volunteer = store.get('ss_vol') === '1';
let device = store.get('ss_dev');
if (!device) {
  device = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, '0')).join('');
  store.set('ss_dev', device);
}
let last = null; // last result, re-rendered on language change

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
  $('#volBanner').hidden = !volunteer;
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
  renderHomeList();
  if ($('#pharmacist').open) showPharmacist();
  if (last) {
    // Re-ask so the agent's answer is composed in the new language (cheap: no photo is re-sent).
    // Not yet confirmed: only redraw in the new language (re-asking by name would skip the check).
    if (last.needs_confirmation && !last.confirmed) render(last);
    else if (last.medicine) ask({ text: last.medicine.name, relog: false });
  }
}

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

$('#typeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#nameInput').value.trim();
  if (q) ask({ text: q });
});

// ── Photo: take it, choose the area with the name and composition, send only that ──
// Phone photos are 3-12 MB; the server takes up to ~1.8 MB, so nothing is sent full size.
// The photo is kept at up to 2000 px for cropping (small print stays sharp), and the chosen
// area is sent at up to 1280 px.
const SEND_MAX_SIDE = 1280;
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
$('#scanBtn').onclick = () => (hasInAppCamera() ? openCamera() : phoneCamera());
// The other two options sit on the home screen too.
$('#homeGallery').onclick = () => $('#gallery').click();
$('#homePhoneCam').onclick = () => phoneCamera();
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
{
  const at = Number(store.get('ss_cam_at') || 0);
  store.set('ss_cam_at', null);
  if (at && Date.now() - at < 10 * 60_000) {
    // Android closed the browser for lack of memory while its camera app was open (Chrome shows
    // "Unable to complete previous operation due to low memory"); the photo cannot be recovered.
    // Scan already uses the in-app camera (never leaves the page); say what happened.
    $('#camLost').hidden = false;
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

$('#cropUse').onclick = () => ask({ image: jpegOf(photo, crop, SEND_MAX_SIDE, 0.85) });
$('#cropFull').onclick = () => ask({ image: jpegOf(photo, { x: 0, y: 0, w: 1, h: 1 }, SEND_MAX_SIDE, 0.85) });
$('#cropRetake').onclick = () => $('#scanBtn').click();
$('#cropCancel').onclick = () => { photo = null; show('home'); };

// ── Agent call ─────────────────────────────────────────────────────────────
function show(section) {
  if (section !== 'camera') stopCamera();
  for (const id of ['home', 'camera', 'crop', 'busy', 'result']) $('#' + id).hidden = id !== section;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

async function ask({ text, image, ocr, relog = true }) {
  $('#busyText').textContent = image ? t(lang, 'reading') : t(lang, 'checking');
  const thumb = $('#thumb');
  thumb.hidden = !image;
  if (image) thumb.src = image;
  show('busy');
  const body = {
    text, image, ocr, lang,
    pin: pinInput.value.length === 6 ? pinInput.value : undefined,
    lat: coords?.lat, lng: coords?.lng,
    mode: volunteer ? 'volunteer' : 'self',
    device,
    test: isTest ? true : undefined,
    nolog: relog ? undefined : true,
  };
  let r;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      r = await res.json();
    } catch {
      r = { status: 'error' };
    }
    if (r.status !== 'error' && !r.error) break;
    await new Promise((ok) => setTimeout(ok, 2000)); // one quiet retry on a network/server hiccup
  }
  // Photo reading is down (quota used up or model error). The on-phone OCR fallback was removed:
  // on real strips it read junk and matched wrong medicines. Ask for typing / keyboard scan.
  if (r.status === 'vision_unavailable') r = { status: 'vision_down' };
  if (!relog && last?.lookup_id) r.lookup_id = last.lookup_id; // keep feedback tied to the original lookup
  // A re-ask for a language change is the same lookup: it must not add to the pharmacist list again.
  r.fresh = relog;
  last = r;
  render(r);
}


// "Same brand only. Do not substitute. Why?" — tap to read the reason (never-switch medicines).
function whyHtml(cls, lead) {
  return `<details class="why ${cls}"><summary>${lead ? `<span>${esc(lead)}</span> ` : ''}<span class="why-link">${esc(t(lang, 'ntiWhyTitle'))}</span></summary><p>${esc(t(lang, 'ntiWhy'))}</p></details>`;
}

// ── Medicine list for the pharmacist ────────────────────────────────────────
// Every medicine found (and confirmed, for photos) is added, one entry per composition, so the
// person can check several strips and show them all at once. Kept on this phone only.
const MAX_LIST = 15;
store.set('ss_medlist', null); // the old long-lived list (before Nov 2026) is removed
function medList() {
  try { const v = JSON.parse(session.get('ss_medlist') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveMedList(list) {
  session.set('ss_medlist', list.length ? JSON.stringify(list.slice(0, MAX_LIST)) : null);
  renderHomeList();
}
function addToMedList(r) {
  if (!shouldAddToList(r)) return;
  r.addedToList = true;
  saveMedList(mergeMedList(medList(), pharmacistEntry(r), MAX_LIST));
}
function renderHomeList() {
  const n = medList().length;
  const b = $('#homeListBtn');
  b.hidden = !n;
  b.textContent = n === 1 ? t(lang, 'pharmacistBtn') : t(lang, 'pharmacistBtnN', { n });
}
const nbspUnits = (s) => s.replace(/(\d) (mg|mcg|ml|IU|%)/g, '$1 $2');
function showPharmacist() {
  const list = medList();
  if (!list.length) return;
  $('#phLead').textContent = t(lang, list.length > 1 ? 'pharmacistCardMany' : 'pharmacistCard');
  $('#phList').innerHTML = list.map((x, i) => `
    <li>
      <p class="ph-comp">${esc(nbspUnits(x.composition))}</p>
      <p class="ph-sub">${esc([x.form, x.name].filter(Boolean).join(' · '))}</p>
      ${x.nti ? whyHtml('ph-nti', t(lang, 'phNti')) : ''}
      ${x.ja ? `<p class="ph-ja">${esc(t(lang, 'phJa', { name: x.ja.name, code: x.ja.code }))}</p>` : ''}
      <button class="link ph-remove" type="button" data-i="${i}">${esc(t(lang, 'listRemove'))}</button>
    </li>`).join('');
  for (const b of $('#phList').querySelectorAll('.ph-remove')) {
    b.onclick = () => {
      const l = medList();
      l.splice(Number(b.dataset.i), 1);
      saveMedList(l);
      if (l.length) showPharmacist();
      else $('#pharmacist').close();
      updatePhBtn();
    };
  }
  $('#phClear').hidden = false; // always: the whole list can be cleared at any time
  if (!$('#pharmacist').open) $('#pharmacist').showModal();
}
// Clear list: removes EVERY medicine (nothing is kept, not even the one on screen).
$('#phClear').onclick = () => {
  saveMedList([]);
  $('#pharmacist').close();
  updatePhBtn();
};
$('#homeListBtn').onclick = showPharmacist;
function updatePhBtn() {
  const b = $('#phBtn');
  if (!b) return;
  const n = medList().length;
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

function render(r) {
  const out = $('#result');
  applyStrings();
  if (r.status !== 'ok') {
    // Say what actually went wrong: not in the database, photo unreadable, or the check failed.
    const why = r.status === 'not_found' ? 'notFound' : r.status === 'unreadable' ? 'photoUnreadable' : r.status === 'vision_down' ? 'visionDown' : 'checkFailed';
    // Read check failed: say why, show what was read, and offer a retake or typing.
    const whyRead = { no_composition: 'readNoComposition', brand_mismatch: 'readMismatch', low_confidence: 'readBlurry' }[r.reason];
    const readText = [r.read?.brand, r.read?.composition].filter(Boolean).join(' · ');
    out.innerHTML = `
      <div class="card"><p class="med-name" style="font-size:22px;line-height:1.35">${esc(t(lang, why))}</p>
      ${r.status === 'unreadable' && whyRead ? `<p class="read-why">${esc(t(lang, whyRead))}</p>` : ''}
      ${readText ? `<p class="med-meta">${esc(t(lang, 'readOnStrip', { text: readText }))}</p>` : ''}
      ${r.status === 'unreadable' ? `<div class="crop-actions" style="margin-top:14px"><button class="primary" id="retakeBtn" type="button">${esc(t(lang, 'retakePhoto'))}</button><button class="secondary" id="typeBtn" type="button">${esc(t(lang, 'confirmType'))}</button></div>` : ''}
      ${devMode ? `<p class="source">developer: status=${esc(r.status || '-')}${r.read_score != null ? ` · read score=${r.read_score}/100 (pass 70)${r.reason ? ` · ${esc(r.reason)}` : ''}` : ''}${r.error ? ` · error=${esc(r.error)}` : ''}${r.detail ? ` · ${esc(r.detail)}` : ''}${r.trace?.length ? ` · steps=${esc(r.trace.map((s) => s.tool + (s.error ? '!' : '') + (s.output?.failed ? `(${[].concat(s.output.failed).join('; ')})` : '')).join(' > '))}` : ''}</p>` : ''}</div>
      <button class="secondary" id="againBtn">${esc(t(lang, 'another'))}</button>`;
    $('#againBtn').onclick = () => { show('home'); $('#nameInput').focus(); };
    if ($('#retakeBtn')) $('#retakeBtn').onclick = () => $('#scanBtn').click();
    if ($('#typeBtn')) $('#typeBtn').onclick = () => { show('home'); $('#nameInput').focus(); };
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
`
    : `<p class="muted" style="margin:0">${esc(t(lang, ja.pending ? 'jaPending' : 'jaNone'))}</p>`;

  // The official list's "name" is often the licensee's personal name, so a Kendra is shown by
  // its PMBJK code and address only.
  const k = r.kendras || {};
  const kDate = r.data?.kendra_list_date;
  const kQuery = (x) => `Jan Aushadhi Kendra ${[x.address, x.district, x.pin].filter(Boolean).join(' ')}`;
  const kHtml = k.items?.length
    ? `${k.by === 'nearby-pin' ? `<p class="med-meta" style="margin:0 0 4px">${esc(t(lang, 'kendraNearby'))}</p>` : ''}
      <ul class="list">${k.items.map((x) => `
        <li><div><div class="n">${esc(t(lang, 'kendraName'))}<span class="tag grey">${esc(x.code)}</span></div>
        <div class="m">${esc([x.address, x.district].filter(Boolean).join(', '))}</div>
        ${x.phone ? `<div class="k-actions"><a href="tel:${esc(x.phone)}">${esc(t(lang, 'call'))}</a></div>` : ''}</div>
        <div class="p">${x.km != null ? `<b>${x.km} km</b>` : `<b>${esc(x.pin)}</b><span>PIN</span>`}
          <a class="dir-btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(x.lat && x.lng ? `${x.lat},${x.lng}` : kQuery(x))}">${dirIcon}<span>${esc(t(lang, 'directions'))}</span></a></div></li>`).join('')}</ul>`
    : `<p class="muted" style="margin:0">${esc(t(lang, k.pending ? 'kendraPending' : pinInput.value.length === 6 ? 'kendraNone' : 'kendraNeedPin'))}</p>`;

  // The brand name as read from the strip, when the match was made by composition alone.
  const readName = (r.read?.brand || '').trim();
  // "Will you buy a lower-priced option?" whenever an option is listed: the Jan Aushadhi generic
  // or another brand with the same composition. Never for a never-switch medicine.
  const hasOption = asksToSwitch(r);
  addToMedList(r);

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

    <div class="card">
      <p class="eyebrow">${esc(t(lang, 'kendraTitle'))}</p>
      ${kHtml}
    </div>

    <div class="safety">${warnIcon}<div>${esc(t(lang, 'safety'))}</div></div>

    <div class="actions">
      <button class="primary" id="phBtn">${esc(t(lang, 'pharmacistBtn'))}</button>
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

  $('#phBtn').onclick = () => {
    if (!medList().some((x) => x.ckey === m.ckey)) saveMedList(mergeMedList(medList(), pharmacistEntry(r), MAX_LIST));
    updatePhBtn();
    showPharmacist();
  };
  updatePhBtn();
  for (const b of out.querySelectorAll('.chip')) {
    b.onclick = async () => {
      $('#fb').innerHTML = `<p style="margin:0">${esc(t(lang, 'thanks'))}</p>`;
      if (r.lookup_id) {
        fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.lookup_id, switched: b.dataset.v }) }).catch(() => {});
      }
    };
  }
  $('#againBtn').onclick = () => { show('home'); };
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

renderLangs();
applyStrings();
renderHomeList();
// Everything is in place: show the page (index.html holds it hidden until now).
document.documentElement.removeAttribute('data-boot');
