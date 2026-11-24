import { SURAH_COUNT } from './types';

/** The shape of the verse files: { "<surah>": ["verse 1", "verse 2", ...] }. */
export type VersesBySurah = Readonly<Record<string, readonly string[]>>;

/**
 * The exact text that `assets/data/integrity.json` fingerprints: one line
 * "<surah>|<verse>|<text>\n" per verse, the 114 surahs in order.
 *
 * Hashing this string (UTF-8, SHA-256) must give the recorded fingerprint. The hash function
 * is left to the caller: the domain has no access to a crypto library.
 */
export function canonicalQuranText(verses: VersesBySurah): string {
  if (typeof verses !== 'object' || verses === null || Array.isArray(verses)) {
    throw new TypeError('Verses must be an object of the form { "<surah>": [verses] }');
  }
  // A surah outside 1..114 would be left out of the fingerprint without a word: refuse it.
  for (const key of Object.keys(verses)) {
    const surah = Number(key);
    if (String(surah) !== key || !Number.isInteger(surah) || surah < 1 || surah > SURAH_COUNT) {
      throw new RangeError(`Surah "${key}" does not exist (expected 1 to ${SURAH_COUNT})`);
    }
  }

  const lines: string[] = [];
  for (let surah = 1; surah <= SURAH_COUNT; surah += 1) {
    const surahVerses = verses[String(surah)];
    if (surahVerses === undefined) {
      throw new RangeError(`Surah ${surah} is missing from the verses`);
    }
    surahVerses.forEach((text, index) => {
      lines.push(`${surah}|${index + 1}|${text}\n`);
    });
  }
  return lines.join('');
}
