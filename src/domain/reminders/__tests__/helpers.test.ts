/**
 * The small private helpers of the module: times of day, quiet hours, Fridays, pauses.
 */
import { addDays, parseLocalDate } from '@/domain/shared/local-date';

import { isFriday, isPausedOn } from '../calendar';
import {
  compareTimesOfDay,
  isDuringQuietHours,
  isLaterInTheDay,
  outsideQuietHours,
} from '../time-of-day';
import { at } from '../test-support/reminders-test-kit';

describe('isLaterInTheDay', () => {
  it('compares hours first, then minutes', () => {
    expect(isLaterInTheDay(at(20, 30), at(9, 45))).toBe(true);
    expect(isLaterInTheDay(at(9, 45), at(20, 30))).toBe(false);
    expect(isLaterInTheDay(at(9, 46), at(9, 45))).toBe(true);
    expect(isLaterInTheDay(at(9, 44), at(9, 45))).toBe(false);
  });

  it('the same time is not later', () => {
    expect(isLaterInTheDay(at(9, 45), at(9, 45))).toBe(false);
  });
});

describe('compareTimesOfDay', () => {
  it('is negative, zero or positive like a sort comparison', () => {
    expect(compareTimesOfDay(at(9, 0), at(20, 30))).toBeLessThan(0);
    expect(compareTimesOfDay(at(20, 30), at(9, 0))).toBeGreaterThan(0);
    expect(compareTimesOfDay(at(9, 0), at(9, 0))).toBe(0);
    expect(compareTimesOfDay(at(9, 59), at(10, 0))).toBeLessThan(0);
  });
});

describe('isDuringQuietHours', () => {
  const afternoon = { from: at(13, 0), to: at(15, 0) };
  const night = { from: at(22, 0), to: at(7, 0) };

  it('inside one day: from the start, up to but not including the end', () => {
    expect(isDuringQuietHours(at(12, 59), afternoon)).toBe(false);
    expect(isDuringQuietHours(at(13, 0), afternoon)).toBe(true);
    expect(isDuringQuietHours(at(14, 59), afternoon)).toBe(true);
    expect(isDuringQuietHours(at(15, 0), afternoon)).toBe(false);
  });

  it('across midnight: the evening part and the morning part are both quiet', () => {
    expect(isDuringQuietHours(at(21, 59), night)).toBe(false);
    expect(isDuringQuietHours(at(22, 0), night)).toBe(true);
    expect(isDuringQuietHours(at(23, 59), night)).toBe(true);
    expect(isDuringQuietHours(at(0, 0), night)).toBe(true);
    expect(isDuringQuietHours(at(6, 59), night)).toBe(true);
    expect(isDuringQuietHours(at(7, 0), night)).toBe(false);
    expect(isDuringQuietHours(at(12, 0), night)).toBe(false);
  });

  it('quiet hours ending at midnight', () => {
    const evening = { from: at(21, 0), to: at(0, 0) };
    expect(isDuringQuietHours(at(23, 59), evening)).toBe(true);
    expect(isDuringQuietHours(at(0, 0), evening)).toBe(false);
    expect(isDuringQuietHours(at(20, 59), evening)).toBe(false);
  });

  it('quiet hours starting at midnight', () => {
    const smallHours = { from: at(0, 0), to: at(6, 0) };
    expect(isDuringQuietHours(at(0, 0), smallHours)).toBe(true);
    expect(isDuringQuietHours(at(5, 59), smallHours)).toBe(true);
    expect(isDuringQuietHours(at(6, 0), smallHours)).toBe(false);
    expect(isDuringQuietHours(at(23, 59), smallHours)).toBe(false);
  });

  it('the same start and end: never quiet', () => {
    const empty = { from: at(8, 0), to: at(8, 0) };
    for (const time of [at(0, 0), at(7, 59), at(8, 0), at(8, 1), at(23, 59)]) {
      expect(isDuringQuietHours(time, empty)).toBe(false);
    }
  });
});

describe('outsideQuietHours', () => {
  it('keeps the time when there are no quiet hours', () => {
    expect(outsideQuietHours(at(23, 30), null)).toEqual(at(23, 30));
  });

  it('gives the end of the quiet hours for a time inside them', () => {
    expect(outsideQuietHours(at(23, 30), { from: at(22, 0), to: at(7, 15) })).toEqual(at(7, 15));
    expect(outsideQuietHours(at(3, 0), { from: at(22, 0), to: at(7, 15) })).toEqual(at(7, 15));
  });

  it('the time it gives is never quiet, for every minute of the day', () => {
    const quietHours = { from: at(22, 10), to: at(6, 40) };
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minute = 0; minute < 60; minute += 1) {
        const moved = outsideQuietHours(at(hour, minute), quietHours);
        expect(isDuringQuietHours(moved, quietHours)).toBe(false);
      }
    }
  });
});

describe('isFriday', () => {
  const FRIDAY = 5;

  it('knows a few Fridays', () => {
    expect(isFriday(parseLocalDate('2026-11-27'))).toBe(true);
    expect(isFriday(parseLocalDate('2026-11-26'))).toBe(false);
    expect(isFriday(parseLocalDate('2026-11-28'))).toBe(false);
    expect(isFriday(parseLocalDate('2024-03-01'))).toBe(true);
  });

  it('agrees with the calendar of the platform over 60 years, before and after its reference', () => {
    let date = parseLocalDate('1999-12-25');
    for (let index = 0; index < 22_000; index += 1) {
      const expected = new Date(`${date}T00:00:00Z`).getUTCDay() === FRIDAY;
      if (isFriday(date) !== expected) throw new Error(`Wrong weekday for ${date}`);
      date = addDays(date, 1);
    }
  });
});

describe('isPausedOn', () => {
  const pauses = [
    { from: parseLocalDate('2026-11-10'), to: parseLocalDate('2026-11-12') },
    { from: parseLocalDate('2026-12-31'), to: parseLocalDate('2027-01-02') },
  ];

  it('includes both ends of a pause', () => {
    expect(isPausedOn(parseLocalDate('2026-11-09'), pauses)).toBe(false);
    expect(isPausedOn(parseLocalDate('2026-11-10'), pauses)).toBe(true);
    expect(isPausedOn(parseLocalDate('2026-11-12'), pauses)).toBe(true);
    expect(isPausedOn(parseLocalDate('2026-11-13'), pauses)).toBe(false);
  });

  it('follows a pause across the new year', () => {
    expect(isPausedOn(parseLocalDate('2027-01-01'), pauses)).toBe(true);
    expect(isPausedOn(parseLocalDate('2027-01-03'), pauses)).toBe(false);
  });

  it('is false without any pause', () => {
    expect(isPausedOn(parseLocalDate('2026-11-10'), [])).toBe(false);
  });
});
