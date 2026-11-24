import type { KhatmConfig } from './types';

/**
 * Default settings of the module.
 *
 * - `minPagesPerWateredDay`: a single new page is enough to water the garden (spec rule 6).
 * - `averagePaceWindowDays`: the "average of the last 7 complete days" of spec rule 8.
 *
 * There is no default daily goal: the user chooses it (docs/DECISIONS.md, D10).
 */
export const DEFAULT_KHATM_CONFIG: KhatmConfig = Object.freeze({
  minPagesPerWateredDay: 1,
  averagePaceWindowDays: 7,
});

/**
 * Longest window the "recent average" pace accepts: a whole year, leap day included. Past
 * that the pace is no longer recent, and an unbounded value would make the estimate walk
 * through as many days as it is asked to.
 */
export const MAX_AVERAGE_PACE_WINDOW_DAYS = 366;

/** Khatmas and pages are numbered from 1, as readers know them. */
export const FIRST_KHATM = 1;
export const FIRST_PAGE = 1;
