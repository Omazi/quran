import { EMPTY_JOURNAL, estimateFinishDate } from '@/domain/khatm';
import { daysBetween, parseLocalDate } from '@/domain/shared/local-date';
import { DAILY_GOAL_RANGE } from '@/store';

import { describeDailyGoal } from '../daily-goal';

describe('pace of a daily goal', () => {
  it('is the example of the specification: 5 pages a day, half a hizb, a khatma in 121 days', () => {
    expect(describeDailyGoal(5)).toEqual({ khatmaDays: 121, landmark: 'half-hizb' });
  });

  it.each([
    [1, 604],
    [2, 302],
    [7, 87],
    [10, 61],
    [20, 31],
    [60, 11],
  ])('reads the 604 pages at %i pages a day in %i days', (pages, days) => {
    expect(describeDailyGoal(pages).khatmaDays).toBe(days);
  });

  it('agrees with the finish date the khatm module estimates, for every goal of the stepper', () => {
    const today = parseLocalDate('2026-11-24');
    for (let pages = DAILY_GOAL_RANGE.min; pages <= DAILY_GOAL_RANGE.max; pages += 1) {
      const finish = estimateFinishDate(EMPTY_JOURNAL, 1, today, {
        kind: 'daily-goal',
        dailyGoalPages: pages,
      });
      if (finish === null) throw new Error('A daily goal always gives a finish date.');
      // The first and the last day both count.
      expect(describeDailyGoal(pages).khatmaDays).toBe(daysBetween(today, finish) + 1);
    }
  });

  it('names the goals readers know, and only those', () => {
    const landmarks = new Map<number, string>();
    for (let pages = DAILY_GOAL_RANGE.min; pages <= DAILY_GOAL_RANGE.max; pages += 1) {
      const { landmark } = describeDailyGoal(pages);
      if (landmark !== null) landmarks.set(pages, landmark);
    }
    expect([...landmarks]).toEqual([
      [5, 'half-hizb'],
      [10, 'hizb'],
      [20, 'juz'],
    ]);
  });

  it.each([0, -3, 2.5, Number.NaN])('refuses a goal of %p pages', (pages) => {
    expect(() => describeDailyGoal(pages)).toThrow(RangeError);
  });
});
