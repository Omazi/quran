import { isLocalDate, type LocalDate } from '@/domain/shared/local-date';

import { MAX_SECONDS_PER_DAY } from './config';
import { getPeriodRange, isDateInRange } from './periods';
import type { DaySeconds, SecondsByDay, StatsPeriod } from './types';

function isWholeSecondsUpTo(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

/**
 * One day of time: whole seconds, none negative, at most 25 hours, and reader time inside the
 * app time (the reader is part of the app: time in it is also time in the app).
 */
export function isDaySeconds(value: unknown): value is DaySeconds {
  if (typeof value !== 'object' || value === null) return false;
  const { app, reader } = value as Partial<Record<keyof DaySeconds, unknown>>;
  return isWholeSecondsUpTo(app, MAX_SECONDS_PER_DAY) && isWholeSecondsUpTo(reader, app as number);
}

/**
 * The time spent in the app and in the reader over a period ending `today`. The seconds are
 * kept by day in the store: the journal has no time of day.
 */
export function getSecondsInPeriod(
  secondsByDay: SecondsByDay,
  period: StatsPeriod,
  today: LocalDate,
): DaySeconds {
  const range = getPeriodRange(period, today);
  if (typeof secondsByDay !== 'object' || secondsByDay === null || Array.isArray(secondsByDay)) {
    throw new TypeError('Invalid time spent: expected a record of days');
  }
  let app = 0;
  let reader = 0;
  for (const [date, seconds] of Object.entries(secondsByDay)) {
    if (!isLocalDate(date))
      throw new RangeError(`Invalid time spent: ${JSON.stringify(date)} is not a day`);
    if (!isDaySeconds(seconds)) {
      throw new RangeError(`Invalid time spent on ${date}: ${JSON.stringify(seconds)}`);
    }
    if (isDateInRange(date, range)) {
      app += seconds.app;
      reader += seconds.reader;
    }
  }
  return { app, reader };
}
