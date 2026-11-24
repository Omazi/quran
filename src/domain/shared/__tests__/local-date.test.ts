import {
  addDays,
  compareLocalDates,
  daysBetween,
  isLocalDate,
  localDateInTimeZone,
  parseLocalDate,
} from '../local-date';

describe('local-date', () => {
  it('accepts real calendar dates only', () => {
    expect(isLocalDate('2026-11-23')).toBe(true);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('2026-1-1')).toBe(false);
    expect(() => parseLocalDate('yesterday')).toThrow(RangeError);
  });

  it('adds days across months, years and leap days', () => {
    expect(addDays(parseLocalDate('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(parseLocalDate('2028-02-28'), 1)).toBe('2028-02-29');
    expect(addDays(parseLocalDate('2026-03-01'), -1)).toBe('2026-02-28');
    expect(() => addDays(parseLocalDate('2026-03-01'), 0.5)).toThrow(RangeError);
    expect(() => addDays(parseLocalDate('9999-12-31'), 1)).toThrow(RangeError);
    expect(() => addDays(parseLocalDate('0001-01-01'), -1)).toThrow(RangeError);
    expect(addDays(parseLocalDate('9999-12-30'), 1)).toBe('9999-12-31');
  });

  it('counts whole days regardless of daylight saving changes', () => {
    // Toronto leaves daylight saving time on 2026-11-01: that day lasts 25 hours.
    expect(daysBetween(parseLocalDate('2026-10-31'), parseLocalDate('2026-11-02'))).toBe(2);
    expect(daysBetween(parseLocalDate('2026-11-23'), parseLocalDate('2026-11-20'))).toBe(-3);
  });

  it('compares dates', () => {
    expect(compareLocalDates(parseLocalDate('2026-01-01'), parseLocalDate('2026-01-02'))).toBe(-1);
    expect(compareLocalDates(parseLocalDate('2026-01-02'), parseLocalDate('2026-01-02'))).toBe(0);
  });

  it('gives the calendar day the user is living, not the UTC day', () => {
    const lateEveningInToronto = new Date('2026-11-24T03:30:00Z');
    expect(localDateInTimeZone(lateEveningInToronto, 'America/Toronto')).toBe('2026-11-23');
    expect(localDateInTimeZone(lateEveningInToronto, 'Asia/Riyadh')).toBe('2026-11-24');
  });
});
