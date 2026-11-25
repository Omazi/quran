import { DAYS_PER_WEEK, REFERENCE_MONDAY } from './config';
import {
  addDays,
  daysBetween,
  isLocalDate,
  parseLocalDate,
  type LocalDate,
} from '@/domain/shared/local-date';
import type { StatsPeriod } from './types';

/** Both ends included. A null end is no limit. */
export interface PeriodRange {
  readonly from: LocalDate | null;
  readonly to: LocalDate | null;
}

const MONTH_START_LENGTH = 'YYYY-MM-'.length;
const FIRST_OF_MONTH = '01';

export function assertToday(today: string): asserts today is LocalDate {
  if (typeof today !== 'string') {
    throw new TypeError(`Invalid day: expected a YYYY-MM-DD text, got ${typeof today}`);
  }
  if (!isLocalDate(today)) {
    throw new RangeError(`Invalid day: ${JSON.stringify(today)} (expected a real YYYY-MM-DD date)`);
  }
}

/** Days since the Monday of the week of `date`: 0 on a Monday, 6 on a Sunday. */
function daysSinceMonday(date: LocalDate): number {
  const sinceReference = daysBetween(parseLocalDate(REFERENCE_MONDAY), date);
  // The remainder of a negative number is negative: bring it back into 0..6.
  return ((sinceReference % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

/**
 * The days a period covers, ending today: today; this week from Monday; this month from its
 * first day; or all time (no bound, so a day after today, from a phone whose clock was ahead,
 * still counts there and nowhere else).
 */
export function getPeriodRange(period: StatsPeriod, today: LocalDate): PeriodRange {
  assertToday(today);
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: addDays(today, -daysSinceMonday(today)), to: today };
    case 'month':
      return {
        from: parseLocalDate(today.slice(0, MONTH_START_LENGTH) + FIRST_OF_MONTH),
        to: today,
      };
    case 'all-time':
      return { from: null, to: null };
    default:
      throw new RangeError(`Invalid period: ${JSON.stringify(period)}`);
  }
}

/** `YYYY-MM-DD` texts compare like the days they name. */
export function isDateInRange(date: LocalDate, { from, to }: PeriodRange): boolean {
  return (from === null || date >= from) && (to === null || date <= to);
}
