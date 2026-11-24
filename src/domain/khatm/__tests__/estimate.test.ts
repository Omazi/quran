import type { LocalDate } from '@/domain/shared/local-date';
import { allPagesOutOfOrder, day, pageRange, readPages } from '../__fixtures__/journal-builders';
import {
  DEFAULT_KHATM_CONFIG,
  EMPTY_JOURNAL,
  estimateFinishDate,
  type KhatmConfig,
  type PaceSource,
} from '../index';

const TODAY = day('2026-11-23');

function configWith(overrides: Partial<KhatmConfig>): KhatmConfig {
  return { ...DEFAULT_KHATM_CONFIG, ...overrides };
}

describe('Rule 8 — estimated finish date (date de fin estimée)', () => {
  describe('pace = daily goal', () => {
    it('empty journal: 604 pages at 20 pages a day, rounded up to 31 days', () => {
      const finish = estimateFinishDate(
        EMPTY_JOURNAL,
        1,
        TODAY,
        'daily-goal',
        configWith({ dailyGoalPages: 20 }),
      );

      // 604 / 20 = 30.2 days, rounded up to 31: 2026-11-23 + 31 days.
      expect(finish).toBe('2026-12-24');
    });

    it('an exact division is not rounded up', () => {
      const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 4), TODAY);

      const finish = estimateFinishDate(
        journal,
        1,
        TODAY,
        'daily-goal',
        configWith({ dailyGoalPages: 20 }),
      );

      // 600 pages / 20 = exactly 30 days.
      expect(finish).toBe('2026-12-23');
    });

    it('one page left takes one more day', () => {
      const allButOne = allPagesOutOfOrder().filter((page) => page !== 604);
      const journal = readPages(EMPTY_JOURNAL, 1, allButOne, day('2026-11-01'));

      expect(estimateFinishDate(journal, 1, TODAY, 'daily-goal')).toBe('2026-11-24');
    });

    it('is the default pace', () => {
      expect(estimateFinishDate(EMPTY_JOURNAL, 1, TODAY)).toBe(
        estimateFinishDate(EMPTY_JOURNAL, 1, TODAY, 'daily-goal', DEFAULT_KHATM_CONFIG),
      );
    });

    it('year change: the estimate lands in the next year', () => {
      const finish = estimateFinishDate(
        EMPTY_JOURNAL,
        1,
        day('2026-12-20'),
        'daily-goal',
        configWith({ dailyGoalPages: 20 }),
      );

      expect(finish).toBe('2027-01-20');
    });

    it('a goal of one page a day needs one day per remaining page', () => {
      const finish = estimateFinishDate(
        EMPTY_JOURNAL,
        1,
        day('2026-01-01'),
        'daily-goal',
        configWith({ dailyGoalPages: 1 }),
      );

      // 604 days after 2026-01-01.
      expect(finish).toBe('2027-08-28');
    });

    it('counts only the pages of the requested khatma', () => {
      const firstDone = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), day('2026-11-01'));
      const journal = readPages(firstDone, 2, pageRange(1, 4), TODAY);

      const finish = estimateFinishDate(
        journal,
        2,
        TODAY,
        'daily-goal',
        configWith({ dailyGoalPages: 20 }),
      );

      expect(finish).toBe('2026-12-23');
    });
  });

  describe('pace = average of the last 7 days', () => {
    it('divides the remaining pages by the average of the last 7 days', () => {
      // 2 pages a day for 7 days, today included: 14 pages read, 590 left, 2 pages a day.
      let journal = EMPTY_JOURNAL;
      for (let daysAgo = 0; daysAgo < 7; daysAgo += 1) {
        const firstPage = 1 + 2 * daysAgo;
        journal = readPages(journal, 1, [firstPage, firstPage + 1], day(`2026-11-${23 - daysAgo}`));
      }

      // 590 / 2 = 295 days after 2026-11-23.
      expect(estimateFinishDate(journal, 1, TODAY, 'recent-average')).toBe('2027-09-14');
    });

    it('days without reading count as zero in the average, and the result is rounded up', () => {
      // 7 pages on a single day of the window: 1 page a day on average, 597 pages left.
      const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), day('2026-11-20'));
      // 10 pages on one day: 10/7 page a day, 594 left, 594 * 7 / 10 = 415.8 -> 416 days.
      const tenPages = readPages(EMPTY_JOURNAL, 1, pageRange(1, 10), day('2026-11-20'));

      expect(estimateFinishDate(journal, 1, TODAY, 'recent-average')).toBe('2028-07-12');
      expect(estimateFinishDate(tenPages, 1, TODAY, 'recent-average')).toBe('2028-01-13');
    });

    it('the window is today and the 6 days before: older reading is ignored', () => {
      const sixDaysAgo = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), day('2026-11-17'));
      const sevenDaysAgo = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), day('2026-11-16'));

      expect(estimateFinishDate(sixDaysAgo, 1, TODAY, 'recent-average')).toBe('2028-07-12');
      expect(estimateFinishDate(sevenDaysAgo, 1, TODAY, 'recent-average')).toBeNull();
    });

    it('reading dated after today is ignored by the pace', () => {
      const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), day('2026-11-24'));

      expect(estimateFinishDate(journal, 1, TODAY, 'recent-average')).toBeNull();
    });

    it('null when the pace is zero: empty journal', () => {
      expect(estimateFinishDate(EMPTY_JOURNAL, 1, TODAY, 'recent-average')).toBeNull();
    });

    it('the pace is the reading of every khatma, re-reads included', () => {
      // 7 pages of khatma 1 re-read today: they do not advance khatma 1 but they set the pace.
      let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 7), day('2026-10-01'));
      journal = readPages(journal, 1, pageRange(1, 7), TODAY);

      expect(estimateFinishDate(journal, 1, TODAY, 'recent-average')).toBe('2028-07-12');
    });

    it('the length of the window comes from the configuration', () => {
      const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 4), day('2026-11-22'));
      const twoDayWindow = configWith({ averagePaceWindowDays: 2 });

      // 4 pages over 2 days = 2 pages a day, 600 pages left: 300 days.
      expect(estimateFinishDate(journal, 1, TODAY, 'recent-average', twoDayWindow)).toBe(
        '2027-09-19',
      );
    });
  });

  describe('completed khatma', () => {
    it('null for a completed khatma: there is nothing left to estimate', () => {
      const journal = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), TODAY);

      expect(estimateFinishDate(journal, 1, TODAY, 'daily-goal')).toBeNull();
      expect(estimateFinishDate(journal, 1, TODAY, 'recent-average')).toBeNull();
    });

    it('completed khatma then new khatma: the next one is estimated from zero', () => {
      const journal = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), day('2026-11-01'));

      const finish = estimateFinishDate(
        journal,
        2,
        TODAY,
        'daily-goal',
        configWith({ dailyGoalPages: 20 }),
      );

      expect(finish).toBe('2026-12-24');
    });
  });

  describe('invalid input', () => {
    it.each([0, -1, 1.5])('rejects khatma %p', (khatm) => {
      expect(() => estimateFinishDate(EMPTY_JOURNAL, khatm, TODAY)).toThrow(RangeError);
    });

    it.each([0, -1, 2.5])('rejects a daily goal of %p', (goal) => {
      expect(() =>
        estimateFinishDate(
          EMPTY_JOURNAL,
          1,
          TODAY,
          'daily-goal',
          configWith({ dailyGoalPages: goal }),
        ),
      ).toThrow(RangeError);
    });

    it('rejects an empty averaging window', () => {
      expect(() =>
        estimateFinishDate(
          EMPTY_JOURNAL,
          1,
          TODAY,
          'recent-average',
          configWith({ averagePaceWindowDays: 0 }),
        ),
      ).toThrow(RangeError);
    });

    it('rejects an impossible date', () => {
      // Cast on purpose: a forged LocalDate is what the runtime check must catch.
      const impossible = '2026-02-30' as LocalDate;

      expect(() => estimateFinishDate(EMPTY_JOURNAL, 1, impossible)).toThrow(RangeError);
    });

    it('rejects an unknown pace source', () => {
      // Cast on purpose: simulates an untyped caller (JSON settings, JavaScript).
      const unknown = 'lunar' as PaceSource;

      expect(() => estimateFinishDate(EMPTY_JOURNAL, 1, TODAY, unknown)).toThrow(TypeError);
    });
  });
});
