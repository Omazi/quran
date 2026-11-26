import { parseLocalDate } from '@/domain/shared/local-date';
import { estimateFinishDate, EMPTY_JOURNAL } from '@/domain/khatm';

import { computeGoalPlan, DEFAULT_OWN_PACE_PAGES, GOAL_KINDS, goalPagesPerDay } from '../index';

const TODAY = parseLocalDate('2026-11-25');

describe('computeGoalPlan: pages per day', () => {
  it('1 month asks for 21 pages a day (604 pages over 30 days, rounded up)', () => {
    expect(computeGoalPlan({ kind: '1-month' }, TODAY).pagesPerDay).toBe(21);
  });

  it('3 months asks for 7 pages a day (604 over 90 days is 6.7, rounded up)', () => {
    expect(computeGoalPlan({ kind: '3-months' }, TODAY).pagesPerDay).toBe(7);
  });

  it('1 year asks for 2 pages a day (604 over 365 days is 1.65, rounded up)', () => {
    expect(computeGoalPlan({ kind: '1-year' }, TODAY).pagesPerDay).toBe(2);
  });

  it('own pace defaults to 5 pages a day', () => {
    expect(DEFAULT_OWN_PACE_PAGES).toBe(5);
    expect(computeGoalPlan({ kind: 'own-pace' }, TODAY).pagesPerDay).toBe(5);
  });

  it('own pace keeps the number of pages the person chose', () => {
    expect(computeGoalPlan({ kind: 'own-pace', pagesPerDay: 12 }, TODAY).pagesPerDay).toBe(12);
  });

  it('the pages of a fixed duration goal are not changed by a stray pagesPerDay', () => {
    const goal = { kind: '3-months', pagesPerDay: 40 } as const;
    expect(computeGoalPlan(goal, TODAY).pagesPerDay).toBe(7);
  });
});

describe('goalPagesPerDay', () => {
  it('is the pages of the plan, without needing a day', () => {
    expect(goalPagesPerDay({ kind: '1-month' })).toBe(21);
    expect(goalPagesPerDay({ kind: 'own-pace', pagesPerDay: 8 })).toBe(8);
    expect(() => goalPagesPerDay({ kind: 'own-pace', pagesPerDay: 0 })).toThrow(RangeError);
  });
});

describe('computeGoalPlan: end date of the khatma', () => {
  it('counts today as the first day of reading: 7 pages a day end 86 days after today', () => {
    // 604 / 7 = 86.3: 87 days of reading, today included.
    expect(computeGoalPlan({ kind: '3-months' }, TODAY).endDate).toBe('2027-02-19');
    expect(computeGoalPlan({ kind: '3-months' }, TODAY).readingDays).toBe(87);
  });

  it('1 month ends 28 days after today (29 days of reading at 21 pages)', () => {
    expect(computeGoalPlan({ kind: '1-month' }, TODAY).endDate).toBe('2026-12-23');
  });

  it('an exact division is not rounded up: 4 pages a day end on day 151', () => {
    const plan = computeGoalPlan({ kind: 'own-pace', pagesPerDay: 4 }, TODAY);
    expect(plan.readingDays).toBe(151);
    expect(plan.endDate).toBe('2027-04-24');
  });

  it('reading the whole Quran in one day ends today', () => {
    expect(computeGoalPlan({ kind: 'own-pace', pagesPerDay: 604 }, TODAY).endDate).toBe(TODAY);
  });

  it.each(GOAL_KINDS)('gives the date the khatm module estimates for %s', (kind) => {
    const plan = computeGoalPlan({ kind }, TODAY);
    const estimate = estimateFinishDate(EMPTY_JOURNAL, 1, TODAY, {
      kind: 'daily-goal',
      dailyGoalPages: plan.pagesPerDay,
    });
    expect(plan.endDate).toBe(estimate);
  });
});

describe('computeGoalPlan: hizb expected after 30 days', () => {
  it('3 months: 210 pages in 30 days are 20 hizb (the prototype says 20)', () => {
    expect(computeGoalPlan({ kind: '3-months' }, TODAY).hizbAfter30Days).toBe(20);
  });

  it('own pace of 5 pages: 150 pages are 14 hizb, a hizb counted only once finished', () => {
    expect(computeGoalPlan({ kind: 'own-pace' }, TODAY).hizbAfter30Days).toBe(14);
  });

  it('1 year: 60 pages are 5 hizb', () => {
    expect(computeGoalPlan({ kind: '1-year' }, TODAY).hizbAfter30Days).toBe(5);
  });

  it('never goes past the 60 hizb of the khatma: 1 month finishes before day 30', () => {
    expect(computeGoalPlan({ kind: '1-month' }, TODAY).hizbAfter30Days).toBe(60);
  });
});

describe('computeGoalPlan: the plan echoes its goal', () => {
  it('returns the kind it was asked for', () => {
    expect(computeGoalPlan({ kind: '1-year' }, TODAY).kind).toBe('1-year');
  });
});

describe('computeGoalPlan: invalid input', () => {
  it.each([0, -3, 2.5, Number.NaN, 605])('refuses %p pages a day for own pace', (pagesPerDay) => {
    expect(() => computeGoalPlan({ kind: 'own-pace', pagesPerDay }, TODAY)).toThrow(RangeError);
  });

  it('refuses an unknown kind', () => {
    const goal = { kind: '2-weeks' } as unknown as Parameters<typeof computeGoalPlan>[0];
    expect(() => computeGoalPlan(goal, TODAY)).toThrow(TypeError);
  });

  it('refuses a date that is not a local date', () => {
    expect(() => computeGoalPlan({ kind: '1-month' }, 'tomorrow' as never)).toThrow();
  });
});
