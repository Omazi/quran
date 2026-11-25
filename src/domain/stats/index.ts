/**
 * Reading counters: pages, words, verses, letters and the hasanat estimate, over a period or a
 * khatma, and the time spent in the app. See docs/specs/stats.md and ./README.md.
 */
export {
  HASANAT_PER_LETTER,
  HASANAT_SOURCE,
  MAX_DAILY_RANGE_DAYS,
  MAX_SECONDS_PER_DAY,
} from './config';
export { countLetters } from './letters';
export { buildPageStatsTable } from './page-stats';
export { getPeriodRange, isDateInRange } from './periods';
export type { PeriodRange } from './periods';
export {
  getDailyReadingStats,
  getKhatmStats,
  getMushafTotals,
  getReadingStats,
} from './reading-stats';
export { getSecondsInPeriod, isDaySeconds } from './time-spent';
export type {
  DayReadingStats,
  DaySeconds,
  EndingVerse,
  PageStats,
  PageStatsTable,
  ReadingCounts,
  SecondsByDay,
  StatsPeriod,
} from './types';
