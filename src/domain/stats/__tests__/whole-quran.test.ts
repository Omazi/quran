import { splitVerseWords, VERSE_COUNT, PAGE_COUNT } from '@/domain/quran';
import type { ReadingEntry } from '@/domain/khatm';
import { parseLocalDate as day } from '@/domain/shared/local-date';

import integrity from '../../../../assets/data/integrity.json';
import { allVerseTexts, loadWholeMushaf } from '../__fixtures__/whole-quran';
import { HASANAT_PER_LETTER } from '../config';
import { countLetters } from '../letters';
import { buildPageStatsTable } from '../page-stats';
import { getKhatmStats, getMushafTotals, getReadingStats } from '../reading-stats';

/**
 * Control totals on the real text of the app (assets/data): one complete khatma must give
 * exactly 6,236 verses and the words and letters of the data.
 */

/** Written another way than `countLetters`, on purpose: two rules that agree check each other. */
const LETTERS = /[ء-غف-يٱ]/g;
const HAMZA_ON_TATWEEL = /ـ[ً-ٖٓ-ٰٟۖ-ۭ]*[ٕٔ]/g;

function countLettersWithRegularExpressions(text: string): number {
  return (text.match(LETTERS)?.length ?? 0) + (text.match(HAMZA_ON_TATWEEL)?.length ?? 0);
}

/** The totals this data gives under the letter rule of letters.ts, written down on purpose. */
const EXPECTED_LETTERS = 325_882;
const EXPECTED_WORDS = 77_430;

const pages = loadWholeMushaf();
const table = buildPageStatsTable(pages);
const totals = getMushafTotals(table);

describe('whole Quran — control totals of one complete khatma', () => {
  it('has 604 pages', () => {
    expect(table).toHaveLength(PAGE_COUNT);
  });

  it('gives exactly 6,236 verses', () => {
    expect(totals.verses).toBe(VERSE_COUNT);
    expect(VERSE_COUNT).toBe(6236);
  });

  it('gives the total number of words of the data, end-of-verse marks excluded', () => {
    expect(totals.words).toBe(integrity.counts.uthmaniWords);
    expect(totals.words).toBe(EXPECTED_WORDS);
  });

  it('gives as many words as the verse texts hold (page by page and verse by verse agree)', () => {
    const wordsOfVerses = allVerseTexts().reduce(
      (sum, text) => sum + splitVerseWords(text).length,
      0,
    );
    expect(totals.words).toBe(wordsOfVerses);
  });

  it('gives the total number of letters of the data, counted two ways', () => {
    const texts = allVerseTexts();
    const byRule = texts.reduce(
      (sum, text) =>
        sum + splitVerseWords(text).reduce((inVerse, word) => inVerse + countLetters(word), 0),
      0,
    );
    const byRegularExpressions = texts.reduce(
      (sum, text) => sum + countLettersWithRegularExpressions(text),
      0,
    );
    expect(totals.letters).toBe(byRule);
    expect(totals.letters).toBe(byRegularExpressions);
    expect(totals.letters).toBe(EXPECTED_LETTERS);
  });

  it('gives ten hasanat per letter', () => {
    expect(totals.hasanatEstimate).toBe(EXPECTED_LETTERS * HASANAT_PER_LETTER);
  });

  it('lists every verse once, on the page where it ends', () => {
    const verses = new Map(
      table.flatMap(({ endingVerses }) => endingVerses.map((v) => [v.verse, v.pages] as const)),
    );
    expect(verses.size).toBe(VERSE_COUNT);
    expect(verses.get('1:1')).toEqual([1]);
    expect(verses.get('114:6')).toEqual([604]);
  });

  it('has no verse cut between two pages in this mushaf: every page starts a new verse', () => {
    // A fact of the data (structure.json: "a page always starts with a new verse"), not a rule
    // of the module: the cut-verse rules are tested on small mushafs written for it.
    const cut = table
      .flatMap(({ endingVerses }) => endingVerses)
      .filter(({ pages: versePages }) => versePages.length > 1);
    expect(cut).toEqual([]);
  });

  it('ends every verse once: the table agrees with the end-of-verse marks of the pages', () => {
    const marks = pages.reduce(
      (sum, page) =>
        sum +
        page.lines.reduce(
          (inPage, line) => inPage + (line.kind === 'text' ? line.verseEnds.length : 0),
          0,
        ),
      0,
    );
    expect(marks).toBe(VERSE_COUNT);
  });

  describe('a journal that reads the whole Quran', () => {
    const date = day('2026-11-25');
    const journal: ReadingEntry[] = Array.from({ length: PAGE_COUNT }, (_, index) => ({
      khatm: 1,
      page: index + 1,
      date,
    }));

    it('gives the control totals for the khatma', () => {
      expect(getKhatmStats(journal, table, 1)).toEqual(totals);
    });

    it('gives the control totals for all time and for the day it was read', () => {
      expect(getReadingStats(journal, table, 'all-time', date)).toEqual(totals);
      expect(getReadingStats(journal, table, 'today', date)).toEqual(totals);
    });

    it('doubles for a second complete khatma, and each khatma keeps its own totals', () => {
      const second = journal.map((entry) => ({ ...entry, khatm: 2 }));
      const both = [...journal, ...second];
      expect(getReadingStats(both, table, 'all-time', date).verses).toBe(2 * VERSE_COUNT);
      expect(getReadingStats(both, table, 'all-time', date).letters).toBe(2 * EXPECTED_LETTERS);
      expect(getKhatmStats(both, table, 2)).toEqual(totals);
    });

    it('reads the khatma in any order and gets the same verses', () => {
      const reversed = [...journal].reverse();
      expect(getKhatmStats(reversed, table, 1)).toEqual(totals);
    });

    it('is fast: the counters of a whole khatma are added up, not recomputed from the text', () => {
      const start = performance.now();
      getReadingStats(journal, table, 'all-time', date);
      expect(performance.now() - start).toBeLessThan(200);
    });
  });

  describe('a half-read khatma never counts a verse before all its pages', () => {
    it('does not count verses of an unread page, nor a verse whose other page is unread', () => {
      const date = day('2026-11-25');
      const firstHalf: ReadingEntry[] = Array.from({ length: 302 }, (_, index) => ({
        khatm: 1,
        page: index + 1,
        date,
      }));
      const stats = getKhatmStats(firstHalf, table, 1);
      const endingInFirstHalf = table
        .slice(0, 302)
        .reduce((sum, { endingVerses }) => sum + endingVerses.length, 0);
      expect(stats.verses).toBe(endingInFirstHalf);
      expect(stats.verses).toBeLessThan(VERSE_COUNT);
    });
  });
});
