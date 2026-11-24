import type { KhatmConfig } from './types';

/**
 * Default settings of the module.
 *
 * - `dailyGoalPages`: 20 pages is about one juz a day, the classic pace of a khatma in a
 *   month. It is only a starting value: the real goal is chosen by the user.
 * - `minPagesPerWateredDay`: a single page is enough to water the garden (spec rule 6).
 * - `averagePaceWindowDays`: the "average of the last 7 days" of spec rule 8.
 */
export const DEFAULT_KHATM_CONFIG: KhatmConfig = Object.freeze({
  dailyGoalPages: 20,
  minPagesPerWateredDay: 1,
  averagePaceWindowDays: 7,
});

/** Khatmas and pages are numbered from 1, as readers know them. */
export const FIRST_KHATM = 1;
export const FIRST_PAGE = 1;
