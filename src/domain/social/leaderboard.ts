import { addDays, daysBetween, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

import { DAYS_PER_WEEK, REFERENCE_MONDAY, SOCIAL_CONFIG } from './config';
import type { DailyReading, DayRange, LeaderboardEntry, LeaderboardPeriod, UserId } from './types';
import { assertId, assertList, assertLocalDate, assertObject } from './validation';

/**
 * Rule 9: the leaderboard of a group over a week or a month. The days are the local days the
 * members' phones wrote: two people do not share a calendar, and a day may differ by one from
 * what another member calls today.
 */

const DAYS_TO_NEXT_MONTH = 31;

/** `YYYY-MM-01` of the month of a day. */
function firstOfMonth(date: LocalDate): LocalDate {
  return parseLocalDate(`${date.slice(0, 7)}-01`);
}

/** The first and last day of the period of `period.day`, both included. */
export function periodRange(period: LeaderboardPeriod): DayRange {
  assertObject(period, 'period');
  assertLocalDate(period.day, 'period day');

  if (period.kind === 'week') {
    // Counted from a known Monday; the double modulo keeps days before it in range.
    const sinceMonday = daysBetween(parseLocalDate(REFERENCE_MONDAY), period.day);
    const dayOfWeek = ((sinceMonday % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
    const from = addDays(period.day, -dayOfWeek);
    return { from, to: addDays(from, DAYS_PER_WEEK - 1) };
  }
  if (period.kind === 'month') {
    const monthStart = firstOfMonth(period.day);
    // 31 days after the first always falls in the next month; its first day is the end plus one.
    const nextMonthStart = firstOfMonth(addDays(monthStart, DAYS_TO_NEXT_MONTH));
    return { from: monthStart, to: addDays(nextMonthStart, -1) };
  }
  throw new RangeError(`Invalid period kind: ${String(period.kind)} (expected week or month)`);
}

function assertReading(reading: DailyReading): void {
  assertObject(reading, 'daily reading');
  assertId(reading.userId, 'reading user');
  assertLocalDate(reading.day, 'reading day');
  if (typeof reading.newPages !== 'number') {
    throw new TypeError(`Invalid newPages: expected a number, got ${typeof reading.newPages}`);
  }
  if (
    !Number.isInteger(reading.newPages) ||
    reading.newPages < 0 ||
    reading.newPages > SOCIAL_CONFIG.maxNewPagesPerDay
  ) {
    throw new RangeError(
      `Invalid newPages: ${String(reading.newPages)} (expected a whole number, 0 to ${SOCIAL_CONFIG.maxNewPagesPerDay})`,
    );
  }
}

/**
 * Every member with the sum of their new pages over the period, most pages first. Equal sums
 * share a rank (1, 1, 3) and are listed by identifier. All rows given are checked, members or
 * not, in the period or not: a damaged row is never skipped quietly.
 */
export function computeLeaderboard(
  memberIds: readonly UserId[],
  readings: readonly DailyReading[],
  period: LeaderboardPeriod,
): LeaderboardEntry[] {
  assertList(memberIds, 'members');
  assertList(readings, 'daily readings');
  const range = periodRange(period);

  const totals = new Map<UserId, number>();
  for (const memberId of memberIds) {
    assertId(memberId, 'member');
    if (totals.has(memberId)) throw new RangeError('Invalid members: the same person twice');
    totals.set(memberId, 0);
  }

  const seen = new Set<string>();
  for (const reading of readings) {
    assertReading(reading);
    const key = `${reading.userId}|${reading.day}`;
    if (seen.has(key)) {
      throw new RangeError('Invalid daily readings: two rows for one person and one day');
    }
    seen.add(key);

    const total = totals.get(reading.userId);
    if (total !== undefined && reading.day >= range.from && reading.day <= range.to) {
      totals.set(reading.userId, total + reading.newPages);
    }
  }

  const sorted = [...totals.entries()].sort(
    ([firstId, firstPages], [secondId, secondPages]) =>
      secondPages - firstPages || (firstId < secondId ? -1 : firstId > secondId ? 1 : 0),
  );
  let rank = 0;
  return sorted.map(([userId, newPages], index) => {
    const previous = sorted[index - 1];
    if (previous === undefined || previous[1] !== newPages) rank = index + 1;
    return { userId, newPages, rank };
  });
}

/**
 * The reading row my app publishes for one day. A day after today is refused: a phone has only
 * one day, its own.
 */
export function toDailyReading(
  userId: UserId,
  day: LocalDate,
  newPages: number,
  today: LocalDate,
): DailyReading {
  assertLocalDate(today, 'today');
  const reading: DailyReading = { userId, day, newPages };
  assertReading(reading);
  if (day > today) throw new RangeError(`Invalid reading day: ${day} is after today (${today})`);
  return reading;
}
