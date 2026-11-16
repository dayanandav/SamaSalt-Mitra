// Safety rules for what the web app shows, kept apart from the page code so they are tested
// (test/rules.test.mjs). Shared by the browser (app.js) and Node tests; no DOM here.

/** The entry for the pharmacist list. A never-switch medicine gets NO Jan Aushadhi code. */
export function pharmacistEntry(r) {
  const m = r.medicine;
  const ja = r.jan_aushadhi || {};
  const nti = !!m.nti || !!ja.nti;
  return {
    ckey: m.ckey,
    name: m.name,
    composition: String(m.composition || '').split(' · ')[0],
    form: m.form || '',
    nti,
    ja: ja.available && !nti && ja.product ? { name: ja.product.generic_name, code: ja.product.drug_code } : null,
  };
}

/** Newest first, one entry per composition key, at most `max`. */
export function mergeMedList(list, entry, max = 15) {
  return [entry, ...(Array.isArray(list) ? list : []).filter((x) => x && x.ckey !== entry.ckey)].slice(0, max);
}

/**
 * "Will you buy a lower-priced option?" Only on a found medicine that is not never-switch, and
 * whenever an option is listed: the Jan Aushadhi generic or another brand with the same composition.
 */
export function asksToSwitch(r) {
  if (r?.status !== 'ok' || !r.medicine) return false;
  if (r.needs_confirmation && !r.confirmed) return false;
  const m = r.medicine;
  if (m.nti || r.jan_aushadhi?.nti) return false;
  const items = r.same_salt?.items || [];
  return !!(r.jan_aushadhi?.available || (r.saving?.saving_pack > 0) || items.some((x) => x.name.toLowerCase() !== m.name.toLowerCase()));
}

/** "Show to the pharmacist" and the list: only for a found (and, for photos, confirmed) medicine. */
export function canShowPharmacist(r) {
  return r?.status === 'ok' && !!r.medicine && !(r.needs_confirmation && !r.confirmed);
}

/**
 * Add to the pharmacist list only on a NEW lookup, once. Re-showing the same result (after a
 * language change, or the confirm step) must never bring back a medicine the person removed.
 */
export function shouldAddToList(r) {
  return canShowPharmacist(r) && r.fresh !== false && !r.addedToList;
}

/** Listen reads the answer only in the language it is written in, and only if that is the chosen one. */
export function listenAllowed(answerLang, uiLang, voices) {
  if (answerLang !== uiLang) return false;
  return !!pickVoice(answerLang, voices);
}

const VOICE = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' };
/** A voice for the language; Android names them "kn_IN". Never a voice of another language. */
export function pickVoice(lang, voices) {
  const want = (VOICE[lang] || 'en-IN').toLowerCase();
  const norm = (v) => String(v?.lang || '').replace('_', '-').toLowerCase();
  const list = voices || [];
  return list.find((v) => norm(v) === want) || list.find((v) => norm(v).startsWith(lang + '-')) || null;
}
