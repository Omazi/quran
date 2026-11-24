/**
 * Times of day on the user's own clock, and the quiet hours.
 *
 * Nothing here knows about dates, time zones or the system clock: a time is two whole
 * numbers, compared as minutes since midnight.
 */
import type { QuietHours, TimeOfDay } from './types';

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

function isWholeNumberBelow(value: unknown, limit: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < limit;
}

/** Throws unless `time` is a real time of day: 00:00 to 23:59. */
export function assertTimeOfDay(time: TimeOfDay, name: string): void {
  if (typeof time !== 'object' || time === null) {
    throw new TypeError(`Reminders: ${name} must be a time of day { hour, minute }`);
  }
  const isRealTime =
    isWholeNumberBelow(time.hour, HOURS_PER_DAY) &&
    isWholeNumberBelow(time.minute, MINUTES_PER_HOUR);
  if (!isRealTime) {
    throw new RangeError(
      `Reminders: ${name} must be a time from 00:00 to 23:59, got ${String(time.hour)}:${String(time.minute)}`,
    );
  }
}

function minutesSinceMidnight(time: TimeOfDay): number {
  return time.hour * MINUTES_PER_HOUR + time.minute;
}

/** Negative when `a` comes before `b` in the day, 0 when they are the same time. */
export function compareTimesOfDay(a: TimeOfDay, b: TimeOfDay): number {
  return minutesSinceMidnight(a) - minutesSinceMidnight(b);
}

/** True when `time` comes strictly after `reference` on the same day. */
export function isLaterInTheDay(time: TimeOfDay, reference: TimeOfDay): boolean {
  return compareTimesOfDay(time, reference) > 0;
}

/** `from` is quiet, `to` no longer is. Quiet hours such as 22:00 to 07:00 span midnight. */
export function isDuringQuietHours(time: TimeOfDay, quietHours: QuietHours): boolean {
  const minute = minutesSinceMidnight(time);
  const from = minutesSinceMidnight(quietHours.from);
  const to = minutesSinceMidnight(quietHours.to);
  const spansMidnight = from > to;
  return spansMidnight ? minute >= from || minute < to : minute >= from && minute < to;
}

/**
 * The time a reminder wanted at `time` is delivered at: `time` itself, or the end of the
 * quiet hours when it falls inside them.
 *
 * Only the time of day moves, never the day: a reminder wanted at 23:30 with quiet hours
 * from 22:00 to 07:00 is planned at 07:00 on its own day, and the planner decides what
 * each morning's reminder says from the garden of that very morning.
 */
export function outsideQuietHours(time: TimeOfDay, quietHours: QuietHours | null): TimeOfDay {
  if (quietHours === null || !isDuringQuietHours(time, quietHours)) return time;
  return quietHours.to;
}
