import { parseLocalDate as day, type LocalDate } from '@/domain/shared/local-date';

import { MAX_SECONDS_PER_DAY } from '../config';
import { getSecondsInPeriod, isDaySeconds } from '../time-spent';
import type { SecondsByDay } from '../types';

const TODAY = day('2026-11-25'); // a Wednesday

const SECONDS: SecondsByDay = {
  [day('2026-10-31')]: { app: 1000, reader: 100 },
  [day('2026-11-01')]: { app: 2000, reader: 200 },
  [day('2026-11-22')]: { app: 3000, reader: 300 }, // Sunday
  [day('2026-11-23')]: { app: 4000, reader: 400 }, // Monday
  [day('2026-11-25')]: { app: 5000, reader: 500 },
};

describe('getSecondsInPeriod — time in the app and in the reader, by period', () => {
  it('today is the seconds of today', () => {
    expect(getSecondsInPeriod(SECONDS, 'today', TODAY)).toEqual({ app: 5000, reader: 500 });
  });

  it('this week adds from Monday to today', () => {
    expect(getSecondsInPeriod(SECONDS, 'week', TODAY)).toEqual({ app: 9000, reader: 900 });
  });

  it('this month adds from the first of the month to today', () => {
    expect(getSecondsInPeriod(SECONDS, 'month', TODAY)).toEqual({ app: 14000, reader: 1400 });
  });

  it('all time adds everything', () => {
    expect(getSecondsInPeriod(SECONDS, 'all-time', TODAY)).toEqual({ app: 15000, reader: 1500 });
  });

  it('is zero without any time', () => {
    expect(getSecondsInPeriod({}, 'all-time', TODAY)).toEqual({ app: 0, reader: 0 });
    expect(getSecondsInPeriod(SECONDS, 'today', day('2026-12-01'))).toEqual({ app: 0, reader: 0 });
  });

  it('keeps the reader time inside the app time, whatever the period', () => {
    for (const period of ['today', 'week', 'month', 'all-time'] as const) {
      const { app, reader } = getSecondsInPeriod(SECONDS, period, TODAY);
      expect(reader).toBeLessThanOrEqual(app);
    }
  });

  describe('invalid input', () => {
    it('rejects something that is not a record', () => {
      expect(() => getSecondsInPeriod(undefined as never, 'today', TODAY)).toThrow(TypeError);
      expect(() => getSecondsInPeriod([] as never, 'today', TODAY)).toThrow(TypeError);
    });

    it('rejects a key that is not a day', () => {
      const broken = { '2026-02-30': { app: 1, reader: 0 } } as unknown as SecondsByDay;
      expect(() => getSecondsInPeriod(broken, 'all-time', TODAY)).toThrow(RangeError);
    });

    it.each([
      ['negative seconds', { app: -1, reader: 0 }],
      ['fractional seconds', { app: 1.5, reader: 0 }],
      ['not a number', { app: '5', reader: 0 }],
      ['more than a day', { app: MAX_SECONDS_PER_DAY + 1, reader: 0 }],
      ['reader time above the app time', { app: 10, reader: 11 }],
      ['a missing field', { app: 10 }],
    ])('rejects %s', (_name, value) => {
      const broken = { [TODAY]: value } as unknown as SecondsByDay;
      expect(() => getSecondsInPeriod(broken, 'all-time', TODAY)).toThrow(RangeError);
    });

    it('rejects an unknown period and an invalid today', () => {
      expect(() => getSecondsInPeriod(SECONDS, 'year' as never, TODAY)).toThrow(RangeError);
      expect(() => getSecondsInPeriod(SECONDS, 'today', 'x' as LocalDate)).toThrow(RangeError);
    });
  });
});

describe('isDaySeconds — what one day of time may hold', () => {
  it('accepts whole seconds, reader inside app, up to 25 hours', () => {
    expect(isDaySeconds({ app: 0, reader: 0 })).toBe(true);
    expect(isDaySeconds({ app: MAX_SECONDS_PER_DAY, reader: MAX_SECONDS_PER_DAY })).toBe(true);
  });

  it('refuses everything else', () => {
    expect(isDaySeconds(null)).toBe(false);
    expect(isDaySeconds({ app: 1, reader: 2 })).toBe(false);
    expect(isDaySeconds({ app: Number.NaN, reader: 0 })).toBe(false);
    expect(isDaySeconds({ app: Infinity, reader: 0 })).toBe(false);
  });
});
