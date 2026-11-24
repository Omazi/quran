/**
 * The two calendar questions the plan asks about a day: is it a Friday, is it paused?
 */
import type { GardenPause } from '@/domain/garden';
import {
  compareLocalDates,
  daysBetween,
  parseLocalDate,
  type LocalDate,
} from '@/domain/shared/local-date';

export const DAYS_PER_WEEK = 7;

/** Any Friday works: every other Friday is a whole number of weeks away from it. */
const A_FRIDAY = parseLocalDate('2026-01-02');

export function isFriday(date: LocalDate): boolean {
  return daysBetween(A_FRIDAY, date) % DAYS_PER_WEEK === 0;
}

/**
 * Whether `date` is inside one of the pauses, both ends included.
 *
 * Asked to the list of pauses rather than to `GardenState.isPausedToday`: a complete
 * garden no longer follows the calendar, pauses included, while "no reminder during a
 * pause" also holds for a pause taken after the khatma was finished.
 */
export function isPausedOn(date: LocalDate, pauses: readonly GardenPause[]): boolean {
  return pauses.some(
    (pause) => compareLocalDates(pause.from, date) <= 0 && compareLocalDates(date, pause.to) <= 0,
  );
}
