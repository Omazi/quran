import { addDays, compareLocalDates, type LocalDate } from '@/domain/shared/local-date';
import { DEFAULT_KHATM_CONFIG } from './config';
import type { KhatmConfig, Pause, ReadingJournal, TodayProgress } from './types';
import { assertConfig, assertEntry, assertLocalDate, assertPauses } from './validation';

/**
 * The one definition of "pages read on a day" shared by the daily goal, the watered days
 * and the recent pace: distinct page numbers read that day, all khatmas merged. A page read
 * again on another day counts for that day too.
 */
function countPagesReadByDay(journal: ReadingJournal): ReadonlyMap<LocalDate, number> {
  const pagesByDay = new Map<LocalDate, Set<number>>();
  for (const entry of journal) {
    assertEntry(entry);
    const pages = pagesByDay.get(entry.date) ?? new Set<number>();
    pages.add(entry.page);
    pagesByDay.set(entry.date, pages);
  }

  const countByDay = new Map<LocalDate, number>();
  for (const [day, pages] of pagesByDay) countByDay.set(day, pages.size);
  return countByDay;
}

/**
 * Pages read during the `dayCount` days ending on `lastDay` (included). Each day is counted
 * on its own, so a page read on two days of the window counts twice.
 */
export function countPagesReadInLastDays(
  journal: ReadingJournal,
  lastDay: LocalDate,
  dayCount: number,
): number {
  assertLocalDate(lastDay, 'last day');
  const countByDay = countPagesReadByDay(journal);
  let total = 0;
  for (let daysAgo = 0; daysAgo < dayCount; daysAgo += 1) {
    total += countByDay.get(addDays(lastDay, -daysAgo)) ?? 0;
  }
  return total;
}

/** Spec rule 5: today's reading compared with the daily goal. */
export function getTodayProgress(
  journal: ReadingJournal,
  today: LocalDate,
  config: KhatmConfig = DEFAULT_KHATM_CONFIG,
): TodayProgress {
  assertLocalDate(today, 'today');
  assertConfig(config);
  const pagesRead = countPagesReadByDay(journal).get(today) ?? 0;
  const goalPages = config.dailyGoalPages;
  return {
    pagesRead,
    goalPages,
    pagesRemaining: Math.max(0, goalPages - pagesRead),
    goalReached: pagesRead >= goalPages,
  };
}

/** Spec rule 6: the days on which at least `minPagesPerWateredDay` pages were read. */
export function getWateredDays(
  journal: ReadingJournal,
  config: KhatmConfig = DEFAULT_KHATM_CONFIG,
): ReadonlySet<LocalDate> {
  assertConfig(config);
  const wateredDays = new Set<LocalDate>();
  for (const [day, pagesRead] of countPagesReadByDay(journal)) {
    if (pagesRead >= config.minPagesPerWateredDay) wateredDays.add(day);
  }
  return wateredDays;
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
 * not watered yet.
 *
 * Walking back from today, each day is one of:
 * - watered: counted, even inside a pause (a pause forgives, it never erases real reading);
 * - paused, not watered: skipped. It neither breaks the streak nor adds to it;
 * - today, not watered yet: skipped, because the day in progress must not break the streak;
 * - any other day: a missed day, the streak stops there.
 *
 * Days after `today` are ignored.
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
    day = addDays(day, -1);
  }
  return streak;
}
