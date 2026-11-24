import { PAGE_COUNT } from '@/domain/quran/types';
import { addDays, type LocalDate } from '@/domain/shared/local-date';
import { DEFAULT_KHATM_CONFIG } from './config';
import { summarizeJournal } from './journal-summary';
import type { KhatmConfig, ReadingJournal, ReadingPace } from './types';
import {
  assertConfig,
  assertDailyGoalPages,
  assertKhatmNumber,
  assertLocalDate,
  assertObject,
} from './validation';

/** A pace kept as "pages over days": the daily goal is "n pages over 1 day". */
interface PagesOverDays {
  readonly pages: number;
  readonly days: number;
}

/**
 * New pages read during the `dayCount` complete days before `today`. Today is left out: it
 * is not over, and counting it would lower the average every morning.
 */
function countNewPagesInDaysBefore(
  newPagesByDay: ReadonlyMap<LocalDate, number>,
  today: LocalDate,
  dayCount: number,
): number {
  let total = 0;
  for (let daysAgo = 1; daysAgo <= dayCount; daysAgo += 1) {
    total += newPagesByDay.get(addDays(today, -daysAgo)) ?? 0;
  }
  return total;
}

function measurePace(
  newPagesByDay: ReadonlyMap<LocalDate, number>,
  today: LocalDate,
  pace: ReadingPace,
  config: KhatmConfig,
): PagesOverDays {
  assertObject(pace, 'reading pace');
  switch (pace.kind) {
    case 'daily-goal':
      assertDailyGoalPages(pace.dailyGoalPages);
      return { pages: pace.dailyGoalPages, days: 1 };
    case 'recent-average': {
      // The pace is the user's, not the khatma's: new pages of every khatma count.
      const windowDays = config.averagePaceWindowDays;
      return {
        pages: countNewPagesInDaysBefore(newPagesByDay, today, windowDays),
        days: windowDays,
      };
    }
    default:
      throw new TypeError(`Unknown reading pace: ${JSON.stringify(pace)}`);
  }
}

/**
 * Whole days after today needed to read `pagesRemaining` pages, assuming today's share of
 * the pace is read today (spec rule 8): 0 when what remains fits in the rest of today.
 *
 * Every quantity is multiplied by `pace.days`, so an average such as "10 pages over 7 days"
 * is used exactly, in whole numbers: the pace is never rounded, only the day count is.
 */
function countDaysAfterToday(
  pagesRemaining: number,
  pagesReadToday: number,
  pace: PagesOverDays,
): number {
  const remaining = pagesRemaining * pace.days;
  // Today's share of the pace, less what is already read today; never negative.
  const restOfToday = Math.max(0, pace.pages - pagesReadToday * pace.days);
  if (remaining <= restOfToday) return 0;
  return Math.ceil((remaining - restOfToday) / pace.pages);
}

/**
 * Spec rule 8: the day the khatma would be finished at the given pace, assuming today's
 * share of the pace is read today. If the pages remaining fit in the rest of today, it is
 * today; otherwise today plus the days needed for the rest, rounded up to a whole day.
 *
 * "Read today" means the new pages of the day, all khatmas together, as in the daily goal.
 * Pauses are ignored.
 *
 * Returns null when there is nothing to estimate: the pace is zero (no new page in the
 * recent complete days), or the khatma is already complete. A date beyond the year 9999
 * cannot be written as a LocalDate: `addDays` then throws a RangeError, left to propagate.
 */
export function estimateFinishDate(
  journal: ReadingJournal,
  khatm: number,
  today: LocalDate,
  pace: ReadingPace,
  config: KhatmConfig = DEFAULT_KHATM_CONFIG,
): LocalDate | null {
  assertKhatmNumber(khatm);
  assertLocalDate(today, 'today');
  assertConfig(config);
  const { khatmas, newPagesByDay } = summarizeJournal(journal);
  const pagesRemaining = PAGE_COUNT - (khatmas.get(khatm)?.readPages.size ?? 0);
  // Measured before any early return so that an invalid pace is always rejected.
  const measuredPace = measurePace(newPagesByDay, today, pace, config);
  if (pagesRemaining === 0 || measuredPace.pages === 0) return null;

  const pagesReadToday = newPagesByDay.get(today) ?? 0;
  return addDays(today, countDaysAfterToday(pagesRemaining, pagesReadToday, measuredPace));
}
