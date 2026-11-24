/**
 * Second opinion on the text: the Uthmani source and the Tanzil file come from two
 * different publishers. Word by word, they must spell the same consonants. The only
 * accepted difference is a declared joined word, which must equal two Tanzil words.
 */
import { comparisonKey } from './comparison-key.mjs';
import { JOINED_WORDS } from './declared.mjs';
import { fail } from './fail.mjs';
import { forEachVerse, splitWords, verseKey } from './texts.mjs';

/** @returns {number} how many Uthmani words were compared. */
export function crossCheckTexts(uthmani, tanzil) {
  let comparedWords = 0;
  forEachVerse(uthmani.verses, (surah, verse, text) => {
    const key = verseKey(surah, verse);
    const joined = JOINED_WORDS[key] ?? [];
    const otherWords = splitWords(tanzil.verses[surah - 1][verse - 1]);

    let otherIndex = 0;
    splitWords(text).forEach((word, index) => {
      const take = joined.includes(index + 1) ? 2 : 1;
      const counterpart = otherWords.slice(otherIndex, otherIndex + take).join('');
      otherIndex += take;
      if (comparisonKey(word) !== comparisonKey(counterpart)) {
        fail(
          `Texts disagree at ${key} word ${index + 1}: Uthmani source "${word}", ` +
            `Tanzil file "${counterpart}". Resolve it explicitly in declared.mjs.`,
        );
      }
      comparedWords += 1;
    });
    if (otherIndex !== otherWords.length) {
      fail(
        `Texts disagree at ${key}: the Tanzil file has ${otherWords.length} words where the ` +
          `Uthmani source accounts for ${otherIndex}. Resolve it explicitly in declared.mjs.`,
      );
    }
  });
  return comparedWords;
}
