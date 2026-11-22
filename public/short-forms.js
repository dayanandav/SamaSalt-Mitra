// Short forms patients type (roadmap S1.3): a whole typed word -> what it stands for.
// Tried only when the name as typed is not found (a brand really called "PCM 650" is found first),
// and the usual exact matching follows: same salt, strength, form and release only.
//
// SAFETY: one meaning per short form, widely used in India, and only for a single salt or a form
// word. Never a brand, never a combination, never an abbreviation with two meanings (MTX, ORS,
// "D" or "M" suffixes). Review: drafted and approved by the owner 22 Nov 2026; every new entry needs the same review.

export const SHORT_FORMS = {
  // Salts
  pcm: 'paracetamol',
  cpm: 'chlorpheniramine',
  hcq: 'hydroxychloroquine',
  hctz: 'hydrochlorothiazide',
  inh: 'isoniazid',
  asa: 'aspirin',
  // Forms
  tabs: 'tablets',
  caps: 'capsules',
  syp: 'syrup',
  syr: 'syrup',
  susp: 'suspension',
  oint: 'ointment',
  drp: 'drops',
  drps: 'drops',
};

/** "pcm 500" -> "paracetamol 500"; the same text when nothing is a short form. Whole words only. */
export function expandShortForms(text) {
  return String(text || '').replace(/[A-Za-z]+/g, (w) => SHORT_FORMS[w.toLowerCase()] ?? w);
}
