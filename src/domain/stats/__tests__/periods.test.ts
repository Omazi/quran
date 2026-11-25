import { parseLocalDate as day } from '@/domain/shared/local-date';

import { getPeriodRange, isDateInRange } from '../periods';
import type { StatsPeriod } from '../types';

// 2026-11-25 is a Wednesday; Monday of that week is 2026-11-23.
const WEDNESDAY = day('2026-11-25');

describe('getPeriodRange — today, week from Monday, month, all time', () => {
  it('today is the single day given', () => {
    expect(getPeriodRange('today', WEDNESDAY)).toEqual({ from: WEDNESDAY, to: WEDNESDAY });
  });

  it('the week starts on the Monday of today, and ends today', () => {
    expect(getPeriodRange('week', WEDNESDAY)).toEqual({ from: day('2026-11-23'), to: WEDNESDAY });
  });

  it('on a Monday the week is only today', () => {
    expect(getPeriodRange('week', day('2026-11-23'))).toEqual({
      from: day('2026-11-23'),
      to: day('2026-11-23'),
    });
  });

  it('on a Sunday the week started six days before', () => {
    expect(getPeriodRange('week', day('2026-11-29'))).toEqual({
      from: day('2026-11-23'),
      to: day('2026-11-29'),
    });
  });

  it('the week can start in the previous month and the previous year', () => {
    // 2027-01-01 is a Friday.
    expect(getPeriodRange('week', day('2027-01-01')).from).toBe('2026-12-28');
    expect(getPeriodRange('week', day('2026-12-02')).from).toBe('2026-11-30');
  });

  it('the week is right on a day before the epoch reference and in a leap year', () => {
    // 2024-02-29 is a Thursday.
    expect(getPeriodRange('week', day('2024-02-29')).from).toBe('2024-02-26');
    // 1969-12-31 is a Wednesday.
    expect(getPeriodRange('week', day('1969-12-31')).from).toBe('1969-12-29');
  });

  it('the month starts on its first day, and ends today', () => {
    expect(getPeriodRange('month', WEDNESDAY)).toEqual({ from: day('2026-11-01'), to: WEDNESDAY });
    expect(getPeriodRange('month', day('2026-11-01'))).toEqual({
      from: day('2026-11-01'),
      to: day('2026-11-01'),
    });
    expect(getPeriodRange('month', day('2024-02-29')).from).toBe('2024-02-01');
  });

  it('all time has no bound', () => {
    expect(getPeriodRange('all-time', WEDNESDAY)).toEqual({ from: null, to: null });
  });

  describe('invalid input', () => {
    it.each(['2026-02-30', '', '25/11/2026'])('rejects the day %j', (value) => {
      expect(() => getPeriodRange('today', value as never)).toThrow(RangeError);
    });

    it('rejects a day that is not a string', () => {
      expect(() => getPeriodRange('today', 20261125 as never)).toThrow(TypeError);
    });

    it('rejects an unknown period', () => {
      expect(() => getPeriodRange('year' as StatsPeriod, WEDNESDAY)).toThrow(RangeError);
    });
  });
});

describe('isDateInRange', () => {
  const range = { from: day('2026-11-23'), to: day('2026-11-25') };

  it('includes both ends', () => {
    expect(isDateInRange(day('2026-11-23'), range)).toBe(true);
    expect(isDateInRange(day('2026-11-25'), range)).toBe(true);
  });

  it('excludes the days around', () => {
    expect(isDateInRange(day('2026-11-22'), range)).toBe(false);
    expect(isDateInRange(day('2026-11-26'), range)).toBe(false);
  });

  it('accepts everything without bounds', () => {
    expect(isDateInRange(day('2000-01-01'), { from: null, to: null })).toBe(true);
    expect(isDateInRange(day('2099-12-31'), { from: null, to: null })).toBe(true);
  });
});
