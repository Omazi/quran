import { addDays, compareLocalDates, type LocalDate } from '@/domain/shared/local-date';
import { DEFAULT_KHATM_CONFIG } from './config';
import { summarizeJournal } from './journal-summary';
import type { KhatmConfig, Pause, ReadingJournal, TodayProgress } from './types';
import { assertConfig, assertDailyGoalPages, assertLocalDate, assertPauses } from './validation';

/**
 * Spec rule 5: today's new pages compared with the daily goal. The goal belongs to the user
 * and has no default: it is always given (whole number of pages, at least 1).
 *
 * "New pages" are the journal entries dated today, all khatmas together: the last pages of
 * a khatma and the first pages of the next one add up.
 */
export function getTodayProgress(
  journal: ReadingJournal,
  today: LocalDate,
  dailyGoalPages: number,
): TodayProgress {
  assertLocalDate(today, 'today');
  assertDailyGoalPages(dailyGoalPages);
  const pagesRead = summarizeJournal(journal).newPagesByDay.get(today) ?? 0;
  return {
    pagesRead,
    goalPages: dailyGoalPages,
    pagesRemaining: Math.max(0, dailyGoalPages - pagesRead),
    goalReached: pagesRead >= dailyGoalPages,
  };
}

/**
 * The days that reach `minPagesPerWateredDay` new pages. Internal: the caller has already
 * checked the configuration, and the counts come from a checked journal.
 */
export function selectWateredDays(
  newPagesByDay: ReadonlyMap<LocalDate, number>,
  config: KhatmConfig,
): Set<LocalDate> {
  const wateredDays = new Set<LocalDate>();
  for (const [day, newPages] of newPagesByDay) {
    if (newPages >= config.minPagesPerWateredDay) wateredDays.add(day);
  }
  return wateredDays;
}

/**
 * Spec rule 6: the days with at least `minPagesPerWateredDay` new pages, all khatmas
 * together. A day made only of re-reads has no entry, so it is never watered.
 */
export function getWateredDays(
  journal: ReadingJournal,
  config: KhatmConfig = DEFAULT_KHATM_CONFIG,
): ReadonlySet<LocalDate> {
  assertConfig(config);
  return selectWateredDays(summarizeJournal(journal).newPagesByDay, config);
}

function isPaused(day: LocalDate, pauses: readonly Pause[]): boolean {
  return pauses.some(
    (pause) => compareLocalDates(pause.from, day) <= 0 && compareLocalDates(day, pause.to) <= 0,
  );
}

function findEarliestDay(days: ReadonlySet<LocalDate>): LocalDate | null {
  let earliest: LocalDate | null = null;
  for (const day of days) {
    if (earliest === null || compareLocalDates(day, earliest) < 0) earliest = day;
  }
  return earliest;
}

/**
 * Spec rule 7: number of consecutive watered days ending today, or yesterday when today is
 * not watered yet. A day made only of re-reads has no new page: it is a missed day.
 *
 * Walking back from today, each day is one of:
 * - watered: counted, even inside a pause (a pause forgives, it never erases real reading);
 * - paused, not watered: skipped. It neither breaks the streak nor adds to it;
 * - today, not watered yet: skipped, because the day in progress must not break the streak;
 * - any other day: a missed day, the streak stops there.
 *
 * Days after `today` are ignored. The streak belongs to the user, not to a khatma: it goes
 * on from one khatma to the next.
 */
export function getStreak(
  journal: ReadingJournal,
  today: LocalDate,
  pauses: readonly Pause[] = [],
  config: KhatmConfig = DEFAULT_KHATM_CONFIG,
): number {
  assertLocalDate(today, 'today');
  assertPauses(pauses);
  const wateredDays = getWateredDays(journal, config);
  const earliestWateredDay = findEarliestDay(wateredDays);
  if (earliestWateredDay === null) return 0;

  let streak = 0;
  let day = today;
  // No watered day exists before the earliest one: stopping there bounds the walk even
  // through a very long pause.
  while (compareLocalDates(day, earliestWateredDay) >= 0) {
    const isDayInProgress = day === today;
    if (wateredDays.has(day)) {
      streak += 1;
    } else if (!isPaused(day, pauses) && !isDayInProgress) {
      break;
    }
    // Stop on the earliest day itself: the day before it may not exist in the calendar.
    if (day === earliestWateredDay) break;
    day = addDays(day, -1);
  }
  return streak;
}
