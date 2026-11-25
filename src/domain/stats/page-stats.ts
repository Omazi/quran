import type { MushafPage, MushafWord, VerseKey } from '@/domain/quran';

import { countLetters } from './letters';
import type { EndingVerse, PageStats, PageStatsTable } from './types';

/** The verse keys of a text line's `verseEnds`, in the order the line prints them. */
function endingVerseKeys(
  words: readonly MushafWord[],
  verseEnds: readonly { readonly afterWordIndex: number }[],
  page: number,
): VerseKey[] {
  return verseEnds.map(({ afterWordIndex }) => {
    const word = words[afterWordIndex];
    if (word === undefined) {
      throw new RangeError(
        `Invalid page ${page}: a verse ends after word ${afterWordIndex}, which does not exist`,
      );
    }
    return word.verseKey;
  });
}

/**
 * Computes, once, what each page of the mushaf is worth when it is read: its words, its letters
 * and the verses that end on it. Reading counters then only add numbers (docs/specs/stats.md,
 * Performance): the text is never walked again.
 *
 * The pages must be the whole mushaf as the app shows it, 1, 2, 3... in order (604 pages for
 * the Quran; a shorter list is accepted so that rules can be tested on a small mushaf). The
 * end of a verse is read from the page's `verseEnds`, the only place that knows where it ends:
 * a verse that has words but never ends, ends twice, or has words after its end is refused.
 */
export function buildPageStatsTable(pages: readonly MushafPage[]): PageStatsTable {
  if (!Array.isArray(pages)) {
    throw new TypeError(`Invalid pages: expected a list, got ${typeof pages}`);
  }
  if (pages.length === 0) throw new RangeError('Invalid pages: the list is empty');

  const pagesOfVerse = new Map<VerseKey, number[]>();
  const endedVerses = new Set<VerseKey>();
  const table: PageStats[] = [];

  pages.forEach((mushafPage, index) => {
    const page = index + 1;
    if (mushafPage?.page !== page) {
      throw new RangeError(
        `Invalid pages: expected page ${page} at position ${index + 1}, got ${mushafPage?.page}`,
      );
    }
    if (!Array.isArray(mushafPage.lines)) {
      throw new TypeError(`Invalid page ${page}: expected a list of lines`);
    }
    let words = 0;
    let letters = 0;
    const endingKeys: VerseKey[] = [];
    for (const line of mushafPage.lines) {
      if (line.kind !== 'text') continue;
      for (const word of line.words) {
        words += 1;
        letters += countLetters(word.text);
        if (endedVerses.has(word.verseKey)) {
          throw new RangeError(
            `Invalid page ${page}: verse ${word.verseKey} has a word after its end`,
          );
        }
        const verseWordPages = pagesOfVerse.get(word.verseKey) ?? [];
        // Words come in order: a page is added when the verse first shows on it.
        if (verseWordPages[verseWordPages.length - 1] !== page) verseWordPages.push(page);
        pagesOfVerse.set(word.verseKey, verseWordPages);
      }
      endingKeys.push(...endingVerseKeys(line.words, line.verseEnds, page));
    }

    const endingVerses: EndingVerse[] = endingKeys.map((verse) => {
      if (endedVerses.has(verse)) {
        throw new RangeError(`Invalid page ${page}: verse ${verse} ends twice`);
      }
      endedVerses.add(verse);
      return { verse, pages: pagesOfVerse.get(verse) ?? [page] };
    });
    table.push({ page, words, letters, endingVerses });
  });

  for (const verse of pagesOfVerse.keys()) {
    if (!endedVerses.has(verse)) {
      throw new RangeError(`Invalid pages: verse ${verse} has words but never ends`);
    }
  }
  return table;
}
