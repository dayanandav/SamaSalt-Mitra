// Kannada and Hindi (Devanagari) medicine names in English letters, without a model (roadmap S2.5):
// "ಡೋಲೋ 650" / "डोलो 650" -> "dolo 650". A fixed letter table (consonants carry "a" unless a vowel
// sign or virama follows), Indian digits -> 0-9. Then a "sounds-like" key for comparing with brand
// names ("pairasitamol" ~ "paracetamol"). The result is only ever used to find names to check;
// a medicine is answered only on an exact fit, otherwise the patient chooses.

// Index = code point offset within the block (same layout in Devanagari U+0900 and Kannada U+0C80).
const VOWELS = { 0x05: 'a', 0x06: 'aa', 0x07: 'i', 0x08: 'ii', 0x09: 'u', 0x0a: 'uu', 0x0b: 'ri', 0x0e: 'e', 0x0f: 'e', 0x10: 'ai', 0x12: 'o', 0x13: 'o', 0x14: 'au', 0x0d: 'e', 0x11: 'o' };
const SIGNS = { 0x3e: 'aa', 0x3f: 'i', 0x40: 'ii', 0x41: 'u', 0x42: 'uu', 0x43: 'ri', 0x46: 'e', 0x47: 'e', 0x48: 'ai', 0x4a: 'o', 0x4b: 'o', 0x4c: 'au', 0x45: 'e', 0x49: 'o' };
const CONS = {
  0x15: 'k', 0x16: 'kh', 0x17: 'g', 0x18: 'gh', 0x19: 'n', 0x1a: 'ch', 0x1b: 'chh', 0x1c: 'j', 0x1d: 'jh', 0x1e: 'n',
  0x1f: 't', 0x20: 'th', 0x21: 'd', 0x22: 'dh', 0x23: 'n', 0x24: 't', 0x25: 'th', 0x26: 'd', 0x27: 'dh', 0x28: 'n',
  0x2a: 'p', 0x2b: 'ph', 0x2c: 'b', 0x2d: 'bh', 0x2e: 'm', 0x2f: 'y', 0x30: 'r', 0x31: 'r', 0x32: 'l', 0x33: 'l', 0x35: 'v',
  0x36: 'sh', 0x37: 'sh', 0x38: 's', 0x39: 'h', 0x34: 'l',
};
const VIRAMA = 0x4d;
const BLOCKS = [0x0900, 0x0c80]; // Devanagari, Kannada
const NUKTA = { 0x15: 'q', 0x16: 'kh', 0x17: 'g', 0x1c: 'z', 0x21: 'r', 0x22: 'rh', 0x2b: 'f', 0x2f: 'y' };

const blockOf = (cp) => BLOCKS.find((b) => cp >= b && cp < b + 0x80);

/** Does the text have Kannada or Devanagari letters? */
export const hasIndic = (s) => /[ऀ-ॿಀ-೿]/.test(String(s || ''));

/** Kannada / Devanagari -> English letters (lowercase); other text unchanged. */
export function transliterate(text) {
  const cps = [...String(text || '')].map((c) => c.codePointAt(0));
  let out = '';
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i];
    const b = blockOf(cp);
    if (b == null) { out += String.fromCodePoint(cp); continue; }
    const o = cp - b;
    if (o >= 0x66 && o <= 0x6f) { out += String(o - 0x66); continue; } // digits
    if (VOWELS[o]) { out += VOWELS[o]; continue; }
    if (o === 0x02) { out += 'n'; continue; } // anusvara
    if (o === 0x03) { out += 'h'; continue; } // visarga
    if (o === 0x01) { out += 'n'; continue; } // chandrabindu
    if (CONS[o] != null) {
      const nukta = cps[i + 1] === b + 0x3c;
      out += nukta ? NUKTA[o] || CONS[o] : CONS[o];
      if (nukta) i++;
      const next = cps[i + 1];
      if (next === b + VIRAMA) { i++; continue; } // no vowel
      if (next != null && blockOf(next) === b && SIGNS[next - b]) { out += SIGNS[next - b]; i++; continue; }
      // Inherent "a": Hindi drops it at the end of a word ("पैन" -> "pain") and inside a word between
      // a vowel and a consonant that has its own vowel sign ("मेटफॉर्मिन" -> "metformin"). Kannada keeps it.
      const endOfWord = next == null || blockOf(next) == null;
      const afterVowel = /[aeiou]$/.test(out.slice(0, -CONS[o].length));
      const nextHasSign = next != null && blockOf(next) === b && CONS[next - b] != null && cps[i + 2] != null && (SIGNS[cps[i + 2] - b] != null || cps[i + 2] === b + VIRAMA);
      if (!(b === 0x0900 && (endOfWord || (afterVowel && nextHasSign)))) out += 'a';
      continue;
    }
    // nukta, avagraha, danda and other signs: nothing
  }
  return out.toLowerCase();
}

/**
 * A "sounds-like" key: spellings that sound alike give the same key ("paracetamol",
 * "pairaasitaamol", "parasitamol" -> "parasitamol"; "crocin", "kroshin" -> "krosin").
 */
export function soundKey(word) {
  let w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  w = w
    .replace(/ph/g, 'f').replace(/c(?=[eiy])/g, 's').replace(/ck/g, 'k').replace(/c/g, 'k').replace(/q/g, 'k').replace(/x/g, 'ks')
    .replace(/z/g, 'j').replace(/w/g, 'v').replace(/sh/g, 's').replace(/([kgtdpbj])h/g, '$1')
    .replace(/aa/g, 'a').replace(/ee|ii/g, 'i').replace(/oo|uu/g, 'u').replace(/ai|ay/g, 'e').replace(/au|ou/g, 'o')
    .replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1');
  return w;
}

/** Consonants of the sound key only ("parasitamol" -> "prstml"): vowels are what scripts and spellings disagree on most. */
export const consonants = (key) => String(key || '').replace(/[aeiou]/g, '');

/** Do two words sound alike? Same consonants (3 or more), or keys at most 1-2 letters apart. */
export function soundsAlike(a, b) {
  const ka = soundKey(a);
  const kb = soundKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const ca = consonants(ka);
  if (ca.length >= 3 && ca === consonants(kb)) return true;
  const max = Math.min(ka.length, kb.length) >= 7 ? 2 : 1;
  if (Math.abs(ka.length - kb.length) > max) return false;
  let prev = Array.from({ length: kb.length + 1 }, (_, i) => i);
  for (let i = 1; i <= ka.length; i++) {
    const cur = [i];
    for (let j = 1; j <= kb.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ka[i - 1] === kb[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[kb.length] <= max;
}

// How a sound may be spelled at the start of a brand name.
const SPELL = { k: ['k', 'c', 'q', 'ch'], s: ['s', 'c', 'sh'], t: ['t', 'th'], f: ['f', 'ph'], j: ['j', 'z', 'g'], v: ['v', 'w'], g: ['g', 'gh'], d: ['d', 'dh'], b: ['b', 'bh'], c: ['ch', 'c', 'k'] };
const VOWEL_LETTERS = ['a', 'e', 'i', 'o', 'u', 'y'];

/**
 * Likely 3-letter starts of the brand name for a transliterated word ("pairasitamol" -> par, per,
 * pir…; "sitrijin" -> cet, cit, set…; "thaironarm" -> thy, thi, tha…), to read the name index.
 */
export function namePrefixes(word, max = 40) {
  const w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (w.length < 3) return [];
  const out = new Set();
  const add = (p) => { if (p.length >= 3 && out.size < max) out.add(p.slice(0, 3)); };
  const m = w.match(/^([^aeiouy]*)([aeiouy]*)([^aeiouy]?)/);
  const [, cluster, , next] = m;
  const firsts = cluster ? (SPELL[cluster[0]] || [cluster[0]]).map((s) => s + cluster.slice(1)) : VOWEL_LETTERS.slice(0, 5);
  const nexts = next ? (SPELL[next] || [next]) : [''];
  for (const f of firsts) {
    if (f.length >= 3) add(f);
    else if (f.length === 2 && cluster.length >= 2) for (const v of VOWEL_LETTERS) add(f + v);
    else if (cluster) for (const v of VOWEL_LETTERS) for (const n of nexts) add(f + v + n);
    else for (const n of nexts) for (const v of VOWEL_LETTERS) add(f + n + v); // a vowel first: "etorva" -> ato, eto…
  }
  add(w);
  // A 3-letter file lists at most 400 names ("tel…" ends before "Telma"): also read the 4-letter
  // ones that follow the next consonant sound ("telm", "ator", "metf", "amox").
  const cons = consonants(soundKey(w));
  const longer = new Set();
  for (const p of out) {
    const used = p.replace(/[aeiouy]/g, '').replace(/h/g, '').length;
    const nextC = cons[used];
    if (!nextC) continue;
    const spellings = [...(SPELL[nextC] || [nextC]), ...(nextC === 'k' && cons[used + 1] === 's' ? ['x'] : [])];
    for (const s of spellings) if (longer.size < max * 2) longer.add(p + s);
  }
  return [...out, ...longer];
}
