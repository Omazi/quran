/**
 * Keys to COMPARE the same word across two spellings. They are never written to the data:
 * the generated text is always the source text, untouched.
 *
 * Characters are written as code points on purpose: most of them are combining marks that
 * cannot be read once typed inside a regular expression.
 */

// Vowel signs and hamza marks U+064B..U+065F, superscript alif U+0670, Quranic annotation
// marks U+06D6..U+06ED, tatweel U+0640, thin space U+2009, zero-width joiner U+200D.
const MARKS_AND_FILLERS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u2009\u200D]/gu;
const ALIF = '\u0627';
const WAW = '\u0648';
const YA = '\u064A';
// Alif with madda U+0622, with hamza above U+0623, with hamza below U+0625, alif wasla U+0671.
const ALIF_FORMS = /[\u0622\u0623\u0625\u0671]/gu;
// Alif maqsura U+0649, ya with hamza U+0626.
const YA_FORMS = /[\u0649\u0626]/gu;
const WAW_WITH_HAMZA = /\u0624/gu;
const LONE_HAMZA = /\u0621/gu;
const LONG_VOWEL_LETTERS = /[\u0627\u0648\u064A]/gu;
/** The layout source left a few marks written as HTML entities, e.g. "&#1756;". */
const HTML_NUMERIC_ENTITY = /&#\d+;/gu;

/**
 * Two Uthmani spellings of a word (Uthmani source, Tanzil file) give the same key.
 * Vowel signs, Quranic annotation marks and the tatweel are removed; the letters the two
 * publishers write differently (alif and hamza carriers, ya and alif maqsura) are unified.
 */
export function comparisonKey(word) {
  return word
    .replace(MARKS_AND_FILLERS, '')
    .replace(ALIF_FORMS, ALIF)
    .replace(YA_FORMS, YA)
    .replace(WAW_WITH_HAMZA, WAW)
    .replace(LONE_HAMZA, '');
}

/**
 * Looser key, for the layout source: its words are spelled in everyday (imla'i) script,
 * which writes long vowels where the Uthmani script does not. Only the consonants are
 * compared, so the same word gives the same key in both scripts.
 */
export function consonantKey(word) {
  return comparisonKey(word.replace(HTML_NUMERIC_ENTITY, '')).replace(LONG_VOWEL_LETTERS, '');
}
