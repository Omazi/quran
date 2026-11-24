import type { LocalDate } from '@/domain/shared/local-date';
import { allPagesOutOfOrder, day, pageRange, readPages } from '../__fixtures__/journal-builders';
import {
  DEFAULT_KHATM_CONFIG,
  EMPTY_JOURNAL,
  estimateFinishDate,
  type KhatmConfig,
  type ReadingJournal,
  type ReadingPace,
} from '../index';

const TODAY = day('2026-11-23');
const RECENT_AVERAGE: ReadingPace = { kind: 'recent-average' };

function dailyGoal(dailyGoalPages: number): ReadingPace {
  return { kind: 'daily-goal', dailyGoalPages };
}

function configWith(overrides: Partial<KhatmConfig>): KhatmConfig {
  return { ...DEFAULT_KHATM_CONFIG, ...overrides };
}

describe('Rule 8 — estimated finish date (date de fin estimée)', () => {
  describe('pace = daily goal', () => {
    it('spec example: 10 pages left, 5 pages a day, nothing read today: tomorrow', () => {
      const tenLeft = allPagesOutOfOrder().filter((page) => page > 10);
      const journal = readPages(EMPTY_JOURNAL, 1, tenLeft, day('2026-11-01'));

      // 5 pages today, the other 5 tomorrow.
      expect(estimateFinishDate(journal, 1, TODAY, dailyGoal(5))).toBe('2026-11-24');
    });

    it('empty journal: 604 pages at 20 pages a day, today included, rounded up to 30 days after today', () => {
      // 20 pages today, then 584 / 20 = 29.2 days, rounded up to 30: 2026-11-23 + 30 days.
      expect(estimateFinishDate(EMPTY_JOURNAL, 1, TODAY, dailyGoal(20))).toBe('2026-12-23');
    });

    it('an exact division is not rounded up', () => {
      const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 4), day('2026-11-22'));

      // 600 pages left: 20 today, then 580 / 20 = exactly 29 days.
      expect(estimateFinishDate(journal, 1, TODAY, dailyGoal(20))).toBe('2026-12-22');
    });

    it('the pages remaining fit in the rest of today: the finish date is today', () => {
      const allButOne = allPagesOutOfOrder().filter((page) => page !== 604);
      const journal = readPages(EMPTY_JOURNAL, 1, allButOne, day('2026-11-01'));

      expect(estimateFinishDate(journal, 1, TODAY, dailyGoal(20))).toBe(TODAY);
      expect(estimateFinishDate(journal, 1, TODAY, dailyGoal(1))).toBe(TODAY);
    });

    it('a goal larger than what is left finishes today', () => {
      const threeLeft = allPagesOutOfOrder().filter((page) => page > 3);
      const journal = readPages(EMPTY_JOURNAL, 1, threeLeft, day('2026-11-01'));

      expect(estimateFinishDate(journal, 1, TODAY, dailyGoal(1000))).toBe(TODAY);
    });

    it('the rest of today is the goal less the pages already read today', () => {
      // Goal 20, 15 pages read today: 5 more pages fit today, a 6th one waits for tomorrow.
      const twentyLeft = allPagesOutOfOrder().filter((page) => page > 20);
      const twentyOneLeft = allPagesOutOfOrder().filter((page) => page > 21);
      let fiveLeft = readPages(EMPTY_JOURNAL, 1, twentyLeft, day('2026-11-01'));
      fiveLeft = readPages(fiveLeft, 1, pageRange(1, 15), TODAY);
      let sixLeft = readPages(EMPTY_JOURNAL, 1, twentyOneLeft, day('2026-11-01'));
      sixLeft = readPages(sixLeft, 1, pageRange(1, 15), TODAY);

      expect(estimateFinishDate(fiveLeft, 1, TODAY, dailyGoal(20))).toBe(TODAY);
      expect(estimateFinishDate(sixLeft, 1, TODAY, dailyGoal(20))).toBe('2026-11-24');
    });

    it('today counts for a full share: the date is the same before and after reading it', () => {
      // 60 pages left this morning at 20 a day: today, tomorrow and the day after. Once
      // today's 20 pages are read, 40 are left for the same two following days.
      const sixtyLeft = allPagesOutOfOrder().filter((page) => page > 60);
      const thisMorning = readPages(EMPTY_JOURNAL, 1, sixtyLeft, day('2026-11-01'));
      const thisEvening = readPages(thisMorning, 1, pageRange(1, 20), TODAY);

      expect(estimateFinishDate(thisMorning, 1, TODAY, dailyGoal(20))).toBe('2026-11-25');
      expect(estimateFinishDate(thisEvening, 1, TODAY, dailyGoal(20))).toBe('2026-11-25');
    });

    it('the rest of today is never negative: reading beyond the goal only shortens what remains', () => {
      // 60 pages left this morning, 45 read today for a goal of 20: 15 left, no share left
      // today, so they are for tomorrow. (A negative rest of today would give 2 days.)
      const sixtyLeft = allPagesOutOfOrder().filter((page) => page > 60);
      let journal = readPages(EMPTY_JOURNAL, 1, sixtyLeft, day('2026-11-01'));
      journal = readPages(journal, 1, pageRange(1, 45), TODAY);

      expect(estimateFinishDate(journal, 1, TODAY, dailyGoal(20))).toBe('2026-11-24');
    });

    it('today’s goal already reached: one page left waits for tomorrow', () => {
      const twentyOneLeft = allPagesOutOfOrder().filter((page) => page > 21);
      let journal = readPages(EMPTY_JOURNAL, 1, twentyOneLeft, day('2026-11-01'));
      journal = readPages(journal, 1, pageRange(1, 20), TODAY);

      expect(estimateFinishDate(journal, 1, TODAY, dailyGoal(20))).toBe('2026-11-24');
    });

    it('year change: the estimate lands in the next year', () => {
      expect(estimateFinishDate(EMPTY_JOURNAL, 1, day('2026-12-20'), dailyGoal(20))).toBe(
        '2027-01-19',
      );
    });

    it('a goal of one page a day needs one day per page: 604 pages end 603 days after today', () => {
      expect(estimateFinishDate(EMPTY_JOURNAL, 1, day('2026-01-01'), dailyGoal(1))).toBe(
        '2027-08-27',
      );
    });

    it('counts only the pages of the requested khatma', () => {
      const firstDone = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), day('2026-11-01'));
      const journal = readPages(firstDone, 2, pageRange(1, 4), day('2026-11-22'));

      // Khatma 2 has 600 pages left, whatever khatma 1 holds: the same date as above.
      expect(estimateFinishDate(journal, 2, TODAY, dailyGoal(20))).toBe('2026-12-22');
    });

    it('the pages read today are the new pages of the day, all khatmas together', () => {
      // The last 20 pages of khatma 1 are read today: today's share is used up, so the 604
      // pages of khatma 2 start tomorrow. 604 / 20 = 30.2 days, rounded up to 31.
      const twentyLeft = allPagesOutOfOrder().filter((page) => page > 20);
      const beforeToday = readPages(EMPTY_JOURNAL, 1, twentyLeft, day('2026-11-01'));
      const firstDoneToday = readPages(beforeToday, 1, pageRange(1, 20), TODAY);

      expect(estimateFinishDate(firstDoneToday, 2, TODAY, dailyGoal(20))).toBe('2026-12-24');
    });
  });

  describe('pace = average of the last 7 complete days', () => {
    it('uses the average of the last 7 complete days as the pace, and as today’s share', () => {
      // 2 pages a day on the 7 days before today (the 16th to the 22nd): 14 pages read,
      // 590 left, 2 pages a day.
      let journal = EMPTY_JOURNAL;
      for (let daysAgo = 1; daysAgo <= 7; daysAgo += 1) {
        const firstPage = 2 * daysAgo - 1;
        journal = readPages(journal, 1, [firstPage, firstPage + 1], day(`2026-11-${23 - daysAgo}`));
      }

      // 2 pages today, then 588 / 2 = 294 days after 2026-11-23.
      expect(estimateFinishDate(journal, 1, TODAY, RECENT_AVERAGE)).toBe('2027-09-13');
    });

    it('today is not part of the average: reading today does not change the pace', () => {
      // 7 pages three days ago: 1 page a day. This morning 597 pages are left: 1 today,
      // then 596 days. After 7 pages today the pace is still 1 page a day: 590 pages left,
      // today's share is used up, 590 days.
      const beforeToday = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), day('2026-11-20'));
      const withToday = readPages(beforeToday, 1, pageRange(8, 14), TODAY);

      expect(estimateFinishDate(beforeToday, 1, TODAY, RECENT_AVERAGE)).toBe('2028-07-11');
      expect(estimateFinishDate(withToday, 1, TODAY, RECENT_AVERAGE)).toBe('2028-07-05');
    });

    it('today is not part of the average: a first day of reading has no pace yet', () => {
      const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), TODAY);

      expect(estimateFinishDate(journal, 1, TODAY, RECENT_AVERAGE)).toBeNull();
      // The next day, that reading is one of the 7 complete days: 1 page a day, 597 left.
      expect(estimateFinishDate(journal, 1, day('2026-11-24'), RECENT_AVERAGE)).toBe('2028-07-12');
    });

    it('days without reading count as zero in the average, and the result is rounded up', () => {
      // 7 pages on a single day of the window: 1 page a day on average, 597 pages left.
      const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), day('2026-11-20'));
      // 10 pages on one day: 10/7 page a day, 594 left. 10/7 page today, then
      // (594 - 10/7) / (10/7) = 414.8 days, rounded up to 415.
      const tenPages = readPages(EMPTY_JOURNAL, 1, pageRange(1, 10), day('2026-11-20'));

      expect(estimateFinishDate(journal, 1, TODAY, RECENT_AVERAGE)).toBe('2028-07-11');
      expect(estimateFinishDate(tenPages, 1, TODAY, RECENT_AVERAGE)).toBe('2028-01-12');
    });

    it('a fractional average is used exactly: only the number of days is rounded up', () => {
      // 10 pages on one day of the window: 10/7 page a day (about 1.43).
      const average = readPages(EMPTY_JOURNAL, 1, pageRange(1, 10), day('2026-11-20'));
      const allButOne = allPagesOutOfOrder().filter((page) => page > 11);
      const allButTwo = allPagesOutOfOrder().filter((page) => page > 12);
      // 1 page left fits in today's 1.43 page; 2 pages left do not: the 2nd is for tomorrow.
      const oneLeft = readPages(average, 1, allButOne, day('2026-10-01'));
      const twoLeft = readPages(average, 1, allButTwo, day('2026-10-01'));
      // 1 page read today leaves 0.43 page for today: (593 - 3/7) / (10/7) = 414.8 days.
      const onePageToday = readPages(average, 1, [11], TODAY);

      expect(estimateFinishDate(oneLeft, 1, TODAY, RECENT_AVERAGE)).toBe(TODAY);
      expect(estimateFinishDate(twoLeft, 1, TODAY, RECENT_AVERAGE)).toBe('2026-11-24');
      expect(estimateFinishDate(onePageToday, 1, TODAY, RECENT_AVERAGE)).toBe('2028-01-12');
    });

    it('with an average, the pages read today use up today’s share', () => {
      // 14 pages in the window: 2 pages a day. 2 pages are read today, 1 page is left: the
      // share of today is used up, so that page is for tomorrow.
      const average = readPages(EMPTY_JOURNAL, 1, pageRange(1, 14), day('2026-11-20'));
      const allButThree = allPagesOutOfOrder().filter((page) => page > 17);
      const threeLeft = readPages(average, 1, allButThree, day('2026-10-01'));
      const oneLeft = readPages(threeLeft, 1, [15, 16], TODAY);

      // Before reading today: 2 of the 3 pages fit today, the 3rd is for tomorrow as well.
      expect(estimateFinishDate(threeLeft, 1, TODAY, RECENT_AVERAGE)).toBe('2026-11-24');
      expect(estimateFinishDate(oneLeft, 1, TODAY, RECENT_AVERAGE)).toBe('2026-11-24');
    });

    it('an average below one page a day: today’s share is a fraction of a page', () => {
      // 3 pages in the window: 3/7 page a day. The last page takes 1 / (3/7) = 2.33 days:
      // 3/7 today, 3/7 tomorrow, the rest the day after.
      const threeRecent = readPages(EMPTY_JOURNAL, 1, pageRange(1, 3), day('2026-11-20'));
      const allButOne = allPagesOutOfOrder().filter((page) => page > 4);
      const oneLeft = readPages(threeRecent, 1, allButOne, day('2026-10-01'));

      expect(estimateFinishDate(oneLeft, 1, TODAY, RECENT_AVERAGE)).toBe('2026-11-25');
    });

    it('the window is the 7 days before today: yesterday to 7 days ago, older reading is ignored', () => {
      const yesterday = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), day('2026-11-22'));
      const sevenDaysAgo = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), day('2026-11-16'));
      const eightDaysAgo = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), day('2026-11-15'));

      expect(estimateFinishDate(yesterday, 1, TODAY, RECENT_AVERAGE)).toBe('2028-07-11');
      expect(estimateFinishDate(sevenDaysAgo, 1, TODAY, RECENT_AVERAGE)).toBe('2028-07-11');
      expect(estimateFinishDate(eightDaysAgo, 1, TODAY, RECENT_AVERAGE)).toBeNull();
    });

    it('reading dated after today is ignored by the pace', () => {
      const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), day('2026-11-24'));

      expect(estimateFinishDate(journal, 1, TODAY, RECENT_AVERAGE)).toBeNull();
    });

    it('null when the pace is zero: empty journal', () => {
      expect(estimateFinishDate(EMPTY_JOURNAL, 1, TODAY, RECENT_AVERAGE)).toBeNull();
    });

    it('page read again another day: re-reads do not set the pace', () => {
      // 7 pages read last month and read again yesterday: no new page in the last 7 days.
      const lastMonth = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), day('2026-10-01'));
      const rereadYesterday = readPages(lastMonth, 1, pageRange(1, 7), day('2026-11-22'));
      // 7 new pages yesterday do set it: 1 page a day, 590 pages left, 589 days after today.
      const newPagesYesterday = readPages(lastMonth, 1, pageRange(8, 14), day('2026-11-22'));

      expect(estimateFinishDate(rereadYesterday, 1, TODAY, RECENT_AVERAGE)).toBeNull();
      expect(estimateFinishDate(newPagesYesterday, 1, TODAY, RECENT_AVERAGE)).toBe('2028-07-04');
    });

    it('the pace is the reading of the user: the last pages of the previous khatma count', () => {
      // The last 7 pages of khatma 1 were read 3 days ago; khatma 2 is not started.
      const sevenLeft = allPagesOutOfOrder().filter((page) => page > 7);
      let journal = readPages(EMPTY_JOURNAL, 1, sevenLeft, day('2026-10-01'));
      journal = readPages(journal, 1, pageRange(1, 7), day('2026-11-20'));

      // 1 page a day on average, 604 pages left in khatma 2: 1 today, then 603 days.
      expect(estimateFinishDate(journal, 2, TODAY, RECENT_AVERAGE)).toBe('2028-07-18');
    });

    it('the length of the window comes from the configuration', () => {
      const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 4), day('2026-11-21'));
      const twoDayWindow = configWith({ averagePaceWindowDays: 2 });
      const oneDayWindow = configWith({ averagePaceWindowDays: 1 });

      // Two days ago is inside a 2-day window: 4 pages over 2 days = 2 pages a day, 600
      // pages left: 2 today, then 299 days. It is outside a 1-day window (yesterday only).
      expect(estimateFinishDate(journal, 1, TODAY, RECENT_AVERAGE, twoDayWindow)).toBe(
        '2027-09-18',
      );
      expect(estimateFinishDate(journal, 1, TODAY, RECENT_AVERAGE, oneDayWindow)).toBeNull();
    });
  });

  describe('completed khatma', () => {
    it('null for a completed khatma: there is nothing left to estimate', () => {
      const journal = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), TODAY);

      expect(estimateFinishDate(journal, 1, TODAY, dailyGoal(20))).toBeNull();
      expect(estimateFinishDate(journal, 1, TODAY, RECENT_AVERAGE)).toBeNull();
    });

    it('completed khatma then new khatma: the next one is estimated from zero', () => {
      const journal = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), day('2026-11-01'));

      // Like an empty journal: 20 pages today, then 30 days.
      expect(estimateFinishDate(journal, 2, TODAY, dailyGoal(20))).toBe('2026-12-23');
    });
  });

  describe('invalid input', () => {
    it.each([0, -1, 1.5])('rejects khatma %p', (khatm) => {
      expect(() => estimateFinishDate(EMPTY_JOURNAL, khatm, TODAY, dailyGoal(20))).toThrow(
        RangeError,
      );
    });

    it.each([0, -1, 2.5, Number.NaN])('rejects a daily goal of %p', (goal) => {
      expect(() => estimateFinishDate(EMPTY_JOURNAL, 1, TODAY, dailyGoal(goal))).toThrow(
        RangeError,
      );
    });

    it('rejects an invalid daily goal even for a completed khatma', () => {
      const journal = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), TODAY);

      expect(() => estimateFinishDate(journal, 1, TODAY, dailyGoal(0))).toThrow(RangeError);
    });

    it('rejects an empty averaging window', () => {
      const noWindow = configWith({ averagePaceWindowDays: 0 });

      expect(() => estimateFinishDate(EMPTY_JOURNAL, 1, TODAY, RECENT_AVERAGE, noWindow)).toThrow(
        RangeError,
      );
    });

    it('rejects an impossible date', () => {
      // Cast on purpose: a forged LocalDate is what the runtime check must catch.
      const impossible = '2026-02-30' as LocalDate;

      expect(() => estimateFinishDate(EMPTY_JOURNAL, 1, impossible, dailyGoal(20))).toThrow(
        RangeError,
      );
    });

    it('rejects a corrupted journal', () => {
      const duplicated: ReadingJournal = [
        { khatm: 1, page: 5, date: TODAY },
        { khatm: 1, page: 5, date: TODAY },
      ];

      expect(() => estimateFinishDate(duplicated, 1, TODAY, dailyGoal(20))).toThrow(RangeError);
      expect(() => estimateFinishDate(duplicated, 1, TODAY, RECENT_AVERAGE)).toThrow(RangeError);
    });

    it('rejects an unknown pace', () => {
      // Cast on purpose: simulates an untyped caller (JSON settings, JavaScript).
      const unknown = { kind: 'lunar' } as unknown as ReadingPace;

      expect(() => estimateFinishDate(EMPTY_JOURNAL, 1, TODAY, unknown)).toThrow(TypeError);
    });
  });
});
