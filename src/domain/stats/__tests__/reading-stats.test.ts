import {
  EMPTY_JOURNAL,
  recordPageRead,
  type ReadingEntry,
  type ReadingJournal,
} from '@/domain/khatm';
import { addDays, parseLocalDate as day, type LocalDate } from '@/domain/shared/local-date';

import {
  buildSmallMushaf,
  buildUniformMushaf,
  UNIFORM_LETTERS_PER_PAGE,
  UNIFORM_PAGE_COUNT,
  UNIFORM_WORDS_PER_PAGE,
} from '../__fixtures__/small-mushaf';
import { HASANAT_PER_LETTER } from '../config';
import { buildPageStatsTable } from '../page-stats';
import {
  getDailyReadingStats,
  getKhatmStats,
  getMushafTotals,
  getReadingStats,
} from '../reading-stats';
import type { ReadingCounts } from '../types';

const SMALL = buildPageStatsTable(buildSmallMushaf());
const UNIFORM = buildPageStatsTable(buildUniformMushaf());
const CUT = buildPageStatsTable(buildUniformMushaf(true));

// Letters of the small mushaf by page: 21, 19, 6. Words: 5, 5, 2.
const D1 = day('2026-11-23');
const D2 = day('2026-11-24');
const TODAY = day('2026-11-25');

function entry(khatm: number, page: number, date: LocalDate): ReadingEntry {
  return { khatm, page, date };
}

/** A whole khatma, 604 pages, all read on `date`. */
function wholeKhatma(khatm: number, date: LocalDate): ReadingEntry[] {
  return Array.from({ length: UNIFORM_PAGE_COUNT }, (_, index) => entry(khatm, index + 1, date));
}

function counts(pages: number, words: number, verses: number, letters: number): ReadingCounts {
  return { pages, words, verses, letters, hasanatEstimate: letters * HASANAT_PER_LETTER };
}

describe('reading counters — pages, words, verses, letters, hasanat', () => {
  describe('with nothing read', () => {
    it('everything is zero', () => {
      expect(getReadingStats(EMPTY_JOURNAL, SMALL, 'all-time', TODAY)).toEqual(counts(0, 0, 0, 0));
      expect(getKhatmStats(EMPTY_JOURNAL, SMALL, 1)).toEqual(counts(0, 0, 0, 0));
    });
  });

  describe('words read: the words of the pages read', () => {
    it('adds the words of each page read', () => {
      expect(getReadingStats([entry(1, 1, D1)], SMALL, 'all-time', TODAY).words).toBe(5);
      expect(
        getReadingStats([entry(1, 1, D1), entry(1, 3, D1)], SMALL, 'all-time', TODAY).words,
      ).toBe(7);
    });

    it('counts the words of a cut verse on the page where they are, not at the end of the verse', () => {
      // Page 1 holds 2 of the 4 words of verse 1:2: they are read even if the verse is not.
      const stats = getReadingStats([entry(1, 1, D1)], SMALL, 'all-time', TODAY);
      expect(stats.words).toBe(5);
      expect(stats.verses).toBe(1);
    });
  });

  describe('letters read: the letters of the words read', () => {
    it('adds the letters of each page read', () => {
      expect(getReadingStats([entry(1, 2, D1)], SMALL, 'all-time', TODAY).letters).toBe(19);
      expect(
        getReadingStats([entry(1, 1, D1), entry(1, 2, D1)], SMALL, 'all-time', TODAY).letters,
      ).toBe(40);
    });
  });

  describe('hasanat: letters read x 10, an estimate', () => {
    it('is ten times the letters', () => {
      const stats = getReadingStats([entry(1, 1, D1)], SMALL, 'all-time', TODAY);
      expect(stats.letters).toBe(21);
      expect(stats.hasanatEstimate).toBe(210);
    });

    it('uses the named constant of 10 per letter', () => {
      expect(HASANAT_PER_LETTER).toBe(10);
    });
  });

  describe('verses read: a verse counts when ALL its words are on pages read in the same khatma', () => {
    it('counts a verse that is on one page as soon as the page is read', () => {
      expect(getReadingStats([entry(1, 1, D1)], SMALL, 'all-time', TODAY).verses).toBe(1); // 1:1
      expect(getReadingStats([entry(1, 3, D1)], SMALL, 'all-time', TODAY).verses).toBe(0); // 1:4 is cut
    });

    it('does not count a verse cut between two pages while only one of them is read', () => {
      // Page 2 alone: 1:3 is whole; 1:2 (pages 1-2) and 1:4 (pages 2-3) are not.
      expect(getReadingStats([entry(1, 2, D1)], SMALL, 'all-time', TODAY).verses).toBe(1);
    });

    it('counts a verse cut between two pages when the second page is read', () => {
      const journal = [entry(1, 1, D1), entry(1, 2, D1)];
      // 1:1, 1:2 and 1:3. 1:4 still waits for page 3.
      expect(getReadingStats(journal, SMALL, 'all-time', TODAY).verses).toBe(3);
    });

    it('counts it whichever page is read first', () => {
      const journal = [entry(1, 2, D1), entry(1, 1, D2)];
      expect(getReadingStats(journal, SMALL, 'all-time', TODAY).verses).toBe(3);
    });

    it('counts all the verses when every page is read', () => {
      const journal = [entry(1, 1, D1), entry(1, 2, D1), entry(1, 3, D1)];
      expect(getReadingStats(journal, SMALL, 'all-time', TODAY)).toEqual(counts(3, 12, 4, 46));
    });

    it('dates a cut verse by the day of the second page read: it counts for that day only', () => {
      const journal = [entry(1, 1, D1), entry(1, 2, D2)];
      const days = getDailyReadingStats(journal, SMALL, D1, D2);
      expect(days.map(({ date, verses }) => [date, verses])).toEqual([
        [D1, 1], // 1:1 only: 1:2 is half read
        [D2, 2], // 1:2 completed + 1:3
      ]);
    });

    it('dates a cut verse by the later page even when the later page was read first', () => {
      const journal = [entry(1, 2, D1), entry(1, 1, D2)];
      const days = getDailyReadingStats(journal, SMALL, D1, D2);
      expect(days.map(({ verses }) => verses)).toEqual([1, 2]);
    });
  });

  describe('rereading: the same khatma never counts twice, a later khatma counts again', () => {
    it('does not count a page read again in the same khatma', () => {
      const once = recordPageRead(EMPTY_JOURNAL, { page: 1, date: D1 });
      const twice = recordPageRead(once, { page: 1, date: D2 });
      expect(twice).toBe(once);
      expect(getReadingStats(twice, SMALL, 'all-time', TODAY)).toEqual(
        getReadingStats(once, SMALL, 'all-time', TODAY),
      );
    });

    it('counts a page read again in a later khatma', () => {
      const journal: ReadingJournal = [...wholeKhatma(1, D1), entry(2, 1, D2)];
      const all = getReadingStats(journal, UNIFORM, 'all-time', TODAY);
      expect(all.pages).toBe(UNIFORM_PAGE_COUNT + 1);
      expect(all.words).toBe((UNIFORM_PAGE_COUNT + 1) * UNIFORM_WORDS_PER_PAGE);
      expect(all.letters).toBe((UNIFORM_PAGE_COUNT + 1) * UNIFORM_LETTERS_PER_PAGE);
      expect(all.verses).toBe(UNIFORM_PAGE_COUNT + 1);
    });

    it('does not mix the pages of two khatmas to complete a verse', () => {
      // Verse 1:1 is on pages 1-2. Khatma 1 read both; in khatma 2 only page 1 is read so far.
      const journal: ReadingJournal = [...wholeKhatma(1, D1), entry(2, 1, D2)];
      const stats = getKhatmStats(journal, CUT, 2);
      expect(stats.pages).toBe(1);
      expect(stats.verses).toBe(0);
      // Page 2 of khatma 2 completes it, in that khatma.
      const next: ReadingJournal = [...journal, entry(2, 2, TODAY)];
      expect(getKhatmStats(next, CUT, 2).verses).toBe(1);
      expect(getReadingStats(next, CUT, 'today', TODAY).verses).toBe(1);
    });
  });

  describe('per khatma', () => {
    const journal: ReadingJournal = [...wholeKhatma(1, D1), entry(2, 5, D2), entry(2, 6, D2)];

    it('counts one khatma on its own', () => {
      expect(getKhatmStats(journal, UNIFORM, 2)).toEqual(
        counts(2, 4, 2, 2 * UNIFORM_LETTERS_PER_PAGE),
      );
    });

    it('counts a complete khatma as the whole mushaf', () => {
      expect(getKhatmStats(journal, UNIFORM, 1)).toEqual(getMushafTotals(UNIFORM));
    });

    it('gives zero for a khatma that does not exist yet', () => {
      expect(getKhatmStats(journal, UNIFORM, 3)).toEqual(counts(0, 0, 0, 0));
    });

    it('rejects a khatma number that is not a whole number from 1', () => {
      for (const khatm of [0, -1, 1.5, Number.NaN]) {
        expect(() => getKhatmStats(journal, UNIFORM, khatm)).toThrow(RangeError);
      }
      expect(() => getKhatmStats(journal, UNIFORM, '1' as unknown as number)).toThrow(TypeError);
    });
  });

  describe('getMushafTotals — the control totals of one complete khatma', () => {
    it('adds every page of the table', () => {
      expect(getMushafTotals(SMALL)).toEqual(counts(3, 12, 4, 46));
    });

    it('is what a complete khatma gives, on the uniform mushaf too', () => {
      const totals = getMushafTotals(UNIFORM);
      expect(totals).toEqual(
        counts(
          UNIFORM_PAGE_COUNT,
          UNIFORM_PAGE_COUNT * 2,
          UNIFORM_PAGE_COUNT,
          UNIFORM_PAGE_COUNT * 5,
        ),
      );
    });
  });

  describe('by period — today, week from Monday, month, all time', () => {
    // 2026-11-25 is a Wednesday. One new page per day, in khatma 1.
    const days = {
      lastMonth: day('2026-10-31'),
      monthStart: day('2026-11-01'),
      lastSunday: day('2026-11-22'),
      monday: day('2026-11-23'),
      today: day('2026-11-25'),
      tomorrow: day('2026-11-26'),
    };
    const journal: ReadingJournal = [
      entry(1, 1, days.lastMonth),
      entry(1, 2, days.monthStart),
      entry(1, 3, days.lastSunday),
      entry(1, 4, days.monday),
      entry(1, 5, days.today),
      entry(1, 6, days.tomorrow),
    ];

    function pagesOf(period: Parameters<typeof getReadingStats>[2]): number {
      return getReadingStats(journal, UNIFORM, period, days.today).pages;
    }

    it('today counts the pages first read today', () => {
      expect(pagesOf('today')).toBe(1);
    });

    it('this week counts from Monday to today', () => {
      expect(pagesOf('week')).toBe(2); // Monday and today, not Sunday
    });

    it('this month counts from the first of the month to today', () => {
      expect(pagesOf('month')).toBe(4); // 1st, Sunday 22nd, Monday, today
    });

    it('all time counts every page, even one dated after today', () => {
      expect(pagesOf('all-time')).toBe(6);
    });

    it('gives words, verses, letters and hasanat of the period, not only pages', () => {
      expect(getReadingStats(journal, UNIFORM, 'week', days.today)).toEqual(
        counts(2, 4, 2, 2 * UNIFORM_LETTERS_PER_PAGE),
      );
    });

    it('is zero for a period without reading', () => {
      expect(getReadingStats(journal, UNIFORM, 'today', day('2026-12-15'))).toEqual(
        counts(0, 0, 0, 0),
      );
    });

    it('puts a re-read page nowhere: the day of its first read keeps it', () => {
      const withReread = recordPageRead(journal, { page: 5, date: days.tomorrow });
      expect(withReread).toBe(journal);
    });

    it('a period only holds the verses completed in it', () => {
      // Small mushaf: page 1 on Sunday 22nd, page 2 today. 1:2 is whole today only.
      const cut: ReadingJournal = [entry(1, 1, days.lastSunday), entry(1, 2, days.today)];
      expect(getReadingStats(cut, SMALL, 'today', days.today).verses).toBe(2);
      expect(getReadingStats(cut, SMALL, 'week', days.today).verses).toBe(2);
      expect(getReadingStats(cut, SMALL, 'all-time', days.today).verses).toBe(3);
    });

    it('splits a total exactly: yesterday + today = the two days together', () => {
      const two: ReadingJournal = [entry(1, 1, D2), entry(1, 2, TODAY), entry(1, 3, TODAY)];
      const both = getReadingStats(two, SMALL, 'week', TODAY);
      const sum = getDailyReadingStats(two, SMALL, D2, TODAY).reduce(
        (total, dayStats) => total + dayStats.letters,
        0,
      );
      expect(sum).toBe(both.letters);
    });
  });

  describe('getDailyReadingStats — one entry per day, for the evolution chart', () => {
    const journal: ReadingJournal = [entry(1, 1, D1), entry(1, 3, TODAY)];

    it('lists every day of the range, with zeros on the days without reading', () => {
      const days = getDailyReadingStats(journal, SMALL, D1, TODAY);
      expect(days.map(({ date }) => date)).toEqual([D1, D2, TODAY]);
      expect(days[1]).toEqual({ date: D2, ...counts(0, 0, 0, 0) });
    });

    it('gives the full counters of each day', () => {
      const [first, , last] = getDailyReadingStats(journal, SMALL, D1, TODAY);
      expect(first).toEqual({ date: D1, ...counts(1, 5, 1, 21) });
      expect(last).toEqual({ date: TODAY, ...counts(1, 2, 0, 6) });
    });

    it('is one day long when from and to are the same day', () => {
      expect(getDailyReadingStats(journal, SMALL, D1, D1)).toHaveLength(1);
    });

    it('ignores the days outside the range', () => {
      expect(getDailyReadingStats(journal, SMALL, D2, D2)[0]).toEqual({
        date: D2,
        ...counts(0, 0, 0, 0),
      });
    });

    it('accepts a range of 366 days and refuses a longer one', () => {
      expect(getDailyReadingStats(journal, SMALL, addDays(TODAY, -365), TODAY)).toHaveLength(366);
      expect(() => getDailyReadingStats(journal, SMALL, addDays(TODAY, -366), TODAY)).toThrow(
        RangeError,
      );
    });

    it('rejects an end before the start', () => {
      expect(() => getDailyReadingStats(journal, SMALL, TODAY, D1)).toThrow(RangeError);
    });

    it('rejects days that are not real dates', () => {
      expect(() => getDailyReadingStats(journal, SMALL, '2026-13-01' as LocalDate, TODAY)).toThrow(
        RangeError,
      );
      expect(() => getDailyReadingStats(journal, SMALL, D1, 5 as unknown as LocalDate)).toThrow(
        TypeError,
      );
    });
  });

  describe('invalid input', () => {
    it('rejects a journal that is not a list', () => {
      expect(() =>
        getReadingStats(undefined as unknown as ReadingJournal, SMALL, 'all-time', TODAY),
      ).toThrow(TypeError);
    });

    it('rejects a damaged journal: the same page twice in a khatma', () => {
      const damaged = [entry(1, 1, D1), entry(1, 1, D2)];
      expect(() => getReadingStats(damaged, SMALL, 'all-time', TODAY)).toThrow(RangeError);
      expect(() => getKhatmStats(damaged, SMALL, 1)).toThrow(RangeError);
      expect(() => getDailyReadingStats(damaged, SMALL, D1, D2)).toThrow(RangeError);
    });

    it('rejects a damaged journal: an entry with a date that is not a day', () => {
      const damaged = [entry(1, 1, '2026-02-30' as LocalDate)];
      expect(() => getReadingStats(damaged, SMALL, 'all-time', TODAY)).toThrow(RangeError);
    });

    it('rejects a journal page the table does not have', () => {
      expect(() => getReadingStats([entry(1, 4, D1)], SMALL, 'all-time', TODAY)).toThrow(
        RangeError,
      );
      expect(() => getKhatmStats([entry(1, 4, D1)], SMALL, 1)).toThrow(RangeError);
    });

    it('rejects a table that is not one', () => {
      expect(() => getReadingStats([], undefined as never, 'all-time', TODAY)).toThrow(TypeError);
      expect(() => getReadingStats([], [] as never, 'all-time', TODAY)).toThrow(RangeError);
      expect(() => getMushafTotals([] as never)).toThrow(RangeError);
    });

    it('rejects an unknown period and an invalid today', () => {
      expect(() => getReadingStats([], SMALL, 'year' as never, TODAY)).toThrow(RangeError);
      expect(() => getReadingStats([], SMALL, 'today', '2026-02-30' as LocalDate)).toThrow(
        RangeError,
      );
    });

    it('does not modify the journal or the table', () => {
      const journal = Object.freeze([Object.freeze(entry(1, 1, D1))]);
      const frozenTable = Object.freeze(SMALL.map((page) => Object.freeze(page)));
      expect(() => getReadingStats(journal, frozenTable, 'all-time', TODAY)).not.toThrow();
    });
  });
});
