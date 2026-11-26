import { EMPTY_JOURNAL, estimateFinishDate } from '@/domain/khatm';
import { HIZB_COUNT, PAGE_COUNT } from '@/domain/quran';
import { daysBetween, type LocalDate } from '@/domain/shared/local-date';

import {
  DEFAULT_OWN_PACE_PAGES,
  GOAL_DURATION_DAYS,
  GOAL_KINDS,
  PROGRESS_HORIZON_DAYS,
} from './config';
import type { Goal, GoalPlan } from './types';

/** The first khatma, the one a new garden starts. */
const FIRST_KHATM = 1;

/**
 * The pages to read each day for a goal: the whole Quran over the duration, rounded up, or the own
 * pace. Throws a `TypeError` for an unknown goal and a `RangeError` for an own pace that is not a
 * whole number of pages from 1 to 604.
 */
export function goalPagesPerDay(goal: Goal): number {
  if (typeof goal !== 'object' || goal === null || !GOAL_KINDS.includes(goal.kind)) {
    throw new TypeError(`Goal plan: unknown goal ${JSON.stringify(goal)}.`);
  }
  switch (goal.kind) {
    case '1-month':
    case '3-months':
    case '1-year':
      return Math.ceil(PAGE_COUNT / GOAL_DURATION_DAYS[goal.kind]);
    case 'own-pace': {
      const pages = goal.pagesPerDay ?? DEFAULT_OWN_PACE_PAGES;
      if (!Number.isInteger(pages) || pages < 1 || pages > PAGE_COUNT) {
        throw new RangeError(
          `Goal plan: pagesPerDay must be a whole number from 1 to ${PAGE_COUNT}, received ${String(pages)}.`,
        );
      }
      return pages;
    }
  }
}

/**
 * What a goal means from `today`: the pages to read each day (the whole Quran, 604 pages, over
 * the duration, rounded up), the day the khatma ends and the hizb finished after 30 days.
 *
 * The end date is the khatm module's own estimate for an empty journal at that daily goal
 * (`estimateFinishDate`): today is the first day of reading. It is therefore at or before the
 * nominal duration (7 pages a day finish in 87 days, not 90). The hizb count is proportional
 * (pages read × 60 / 604, rounded down): a hizb counts once it is finished.
 *
 * Pure: the day is a parameter. Throws a `TypeError` for an unknown goal and a `RangeError` for
 * an own pace that is not a whole number of pages from 1 to 604.
 */
export function computeGoalPlan(goal: Goal, today: LocalDate): GoalPlan {
  const pagesPerDay = goalPagesPerDay(goal);
  const endDate =
    estimateFinishDate(EMPTY_JOURNAL, FIRST_KHATM, today, {
      kind: 'daily-goal',
      dailyGoalPages: pagesPerDay,
    }) ?? today;
  const pagesAfterHorizon = Math.min(PAGE_COUNT, pagesPerDay * PROGRESS_HORIZON_DAYS);
  return {
    kind: goal.kind,
    pagesPerDay,
    readingDays: daysBetween(today, endDate) + 1,
    endDate,
    hizbAfter30Days: Math.floor((pagesAfterHorizon * HIZB_COUNT) / PAGE_COUNT),
  };
}
