/**
 * Reading progress (khatm): reading journal, progress of a khatma, daily goal, watered days,
 * streak, estimated finish date, badges and garden feed. See docs/specs/khatm.md and
 * ./README.md.
 */
export { getBadges } from './badges';
export { DEFAULT_KHATM_CONFIG } from './config';
export { getStreak, getTodayProgress, getWateredDays } from './daily';
export { estimateFinishDate } from './estimate';
export { getGardenFeed } from './garden-feed';
export {
  EMPTY_JOURNAL,
  getCurrentKhatm,
  getReadPages,
  isPageRead,
  recordPageRead,
} from './journal';
export { getKhatmProgress } from './progress';
export { requiredReadingSeconds, type ReadingTimeRules } from './reading-time';
export type {
  GardenFeed,
  HizbPageRange,
  KhatmBadge,
  KhatmConfig,
  KhatmProgress,
  PageRead,
  Pause,
  ReadingEntry,
  ReadingJournal,
  ReadingPace,
  TodayProgress,
} from './types';
