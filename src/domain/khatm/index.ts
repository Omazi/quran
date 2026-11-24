/**
 * Reading progress (khatm): reading journal, progress of a khatma, daily goal, watered days,
 * streak and estimated finish date. See docs/specs/khatm.md and ./README.md.
 */
export { DEFAULT_KHATM_CONFIG } from './config';
export { getStreak, getTodayProgress, getWateredDays } from './daily';
export { estimateFinishDate } from './estimate';
export {
  EMPTY_JOURNAL,
  getCurrentKhatm,
  getReadPages,
  isPageRead,
  recordPageRead,
} from './journal';
export { getKhatmProgress } from './progress';
export type {
  HizbPageRange,
  KhatmConfig,
  KhatmProgress,
  PaceSource,
  Pause,
  ReadingEntry,
  ReadingJournal,
  TodayProgress,
} from './types';
