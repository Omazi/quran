/**
 * The words of each page of the mushaf, for the time a page asks (spec 3,
 * `requiredReadingSeconds`). A page holds whole verses (`reading-sections.ts`), so its words are
 * the words of its verses in the Uthmani text, the text of the mushaf's pages, whatever script
 * the reader shows.
 */

import { quranStructure } from '@/data/quran';
import { splitVerseWords, type VerseRef } from '@/domain/quran';

import { pageSections } from './reading-sections';

/** Words of pages 1 to 604, in order: index 0 is page 1. */
export function pageWordCounts(uthmaniTextOf: (ref: VerseRef) => string): readonly number[] {
  return pageSections(quranStructure).map((section) =>
    section.segments.reduce((total, segment) => {
      let words = total;
      for (let verse = segment.firstVerse; verse <= segment.lastVerse; verse += 1) {
        words += splitVerseWords(uthmaniTextOf({ surah: segment.surah, verse })).length;
      }
      return words;
    }, 0),
  );
}
