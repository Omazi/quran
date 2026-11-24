import type { LocalDate } from '@/domain/shared/local-date';

/** One page read on one day, for one khatma. The journal is made of these and nothing else. */
export interface ReadingEntry {
  /** 1-based number of the khatma (complete reading of the Quran) this page belongs to. */
  readonly khatm: number;
  /** Mushaf page, 1..604. */
  readonly page: number;
  /** The calendar day the user read the page, in their own time zone. */
  readonly date: LocalDate;
}

/**
 * The reading journal: the single source of truth of the module. It is never mutated;
 * `recordPageRead` returns a new journal. Everything else is derived from it.
 */
export type ReadingJournal = readonly ReadingEntry[];

/**
 * First and last mushaf page of a hizb. The 60 ranges are injected by the caller (they come
 * from the Quran structure data); this module never loads them itself.
 */
export interface HizbPageRange {
  /** 1-based hizb number, 1..60. */
  readonly hizb: number;
  readonly firstPage: number;
  readonly lastPage: number;
}

/** A period the user declared as paused (illness, travel...). Both ends are included. */
export interface Pause {
  readonly from: LocalDate;
  readonly to: LocalDate;
}

/** Business settings of the module. See `DEFAULT_KHATM_CONFIG`. */
export interface KhatmConfig {
  /** Pages the user aims to read each day. Whole number, at least 1. */
  readonly dailyGoalPages: number;
  /** Pages needed for a day to count as "watered". Whole number, at least 1. */
  readonly minPagesPerWateredDay: number;
  /** Number of days, ending today, averaged by the "recent average" pace. At least 1. */
  readonly averagePaceWindowDays: number;
}

/** Where one khatma stands. `hizbCompleted` and `currentHizbProgress` feed the garden as is. */
export interface KhatmProgress {
  readonly khatm: number;
  /** Distinct pages read, 0..604. */
  readonly pagesRead: number;
  readonly pagesRemaining: number;
  /** `pagesRead / 604`, from 0 to 1. */
  readonly fraction: number;
  /** Number of hizb whose pages are all read, 0..60. */
  readonly hizbCompleted: number;
  /** First hizb (in mushaf order) that is not completed, or null when the khatma is complete. */
  readonly currentHizb: number | null;
  /** Fraction (0 to 1) of the pages of `currentHizb` already read; 0 when there is none. */
  readonly currentHizbProgress: number;
  /** Lowest page number not read yet, or null when the khatma is complete. */
  readonly firstUnreadPage: number | null;
  /** True when the 604 pages are read. */
  readonly isComplete: boolean;
}

/** Today's reading compared with the daily goal. */
export interface TodayProgress {
  /** Distinct pages read today, all khatmas merged. */
  readonly pagesRead: number;
  readonly goalPages: number;
  /** Pages still to read to reach the goal; 0 once it is reached. */
  readonly pagesRemaining: number;
  readonly goalReached: boolean;
}

/**
 * The reading pace used to estimate a finish date:
 * - `daily-goal`: the user reads exactly their daily goal;
 * - `recent-average`: the user keeps the average of their last days of reading.
 */
export type PaceSource = 'daily-goal' | 'recent-average';
