// v1.3 Registered volunteers, public part of /volunteer: the form prepares a request to send by
// email to the SamaSalt-Mitra team. Nothing is saved from this page: a Registrar enters the request
// in the staff console, a Reviewer calls the volunteer and approves (see worker/src/volunteers.js).
import { validateVolunteer, volunteerRequest } from '/rules.js';

const $ = (s) => document.querySelector(s);
const ERR = {
  vErrName: 'Enter your full name.',
  vErrMobile: 'Enter a 10-digit Indian mobile number.',
  vErrDistrict: 'Enter the district where you help.',
  vErrPin: 'Enter a 6-digit PIN code, or leave it empty.',
  vErrConsent: 'Read the volunteer terms and tick the box to agree.',
};
let regEmail = null;
// Parked on live (VOLUNTEER_REGISTRY = "off"): the join section stays hidden.
fetch('/api/health').then((r) => r.json()).then((h) => {
  regEmail = h.registration_email || null;
  if (h.volunteer_registry === 'on') { $('#join').hidden = false; $('#joinLink').hidden = false; }
}).catch(() => {});

const form = $('#vForm');
let text = '';
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const el = form.elements;
  const v = validateVolunteer({
    name: el.name.value, mobile: el.mobile.value, district: el.district.value, pin: el.pin.value,
    organisation: el.organisation.value, languages: el.languages.value, consent: el.consent.checked,
  });
  if (!v.ok) {
    $('#vErr').hidden = false;
    $('#vErr').textContent = ERR[v.error] || 'Check your details.';
    const field = { vErrName: 'name', vErrMobile: 'mobile', vErrDistrict: 'district', vErrPin: 'pin', vErrConsent: 'consent' }[v.error];
    el[field]?.focus();
    return;
  }
  $('#vErr').hidden = true;
  const r = volunteerRequest(v.value);
  text = `${r.subject}\n\n${r.body}`;
  $('#vText').textContent = text;
  const mail = $('#vMail');
  if (regEmail) {
    mail.hidden = false;
    mail.href = `mailto:${regEmail}?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body)}`;
    $('#vTo').textContent = `To: ${regEmail}`;
  } else {
    // No registration address set yet: copy it and send it to the team you are in touch with.
    mail.hidden = true;
    $('#vTo').textContent = 'Copy the request and send it to the SamaSalt-Mitra team member you are in touch with.';
  }
  form.hidden = true;
  $('#vSend').hidden = false;
  $('#vSend').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('#vEdit').onclick = () => { $('#vSend').hidden = true; form.hidden = false; form.elements.name.focus(); };
$('#vCopy').onclick = async () => {
  try { await navigator.clipboard.writeText(text); $('#vCopy').textContent = 'Copied'; } catch { $('#vCopy').textContent = 'Select the text below to copy'; }
  setTimeout(() => { $('#vCopy').textContent = 'Copy the request'; }, 2500);
};
