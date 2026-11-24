import type { LocalDate } from '@/domain/shared/local-date';

/**
 * What the app reports when the user has read a page: the page and the day, nothing else.
 * There is no khatma number on purpose: `recordPageRead` files the page in the khatma in
 * progress, so an app holding an outdated number can never lose a read.
 */
export interface PageRead {
  /** Mushaf page, 1..604. */
  readonly page: number;
  /** The calendar day the page was read, in the user's time zone. */
  readonly date: LocalDate;
}

/**
 * One page read for the first time in a khatma, as stored in the journal. The journal is
 * made of these and nothing else. There is at most one entry per (khatm, page): reading the
 * page again never counts.
 */
export interface ReadingEntry {
  /**
   * 1-based number of the khatma (complete reading of the Quran) this page belongs to. It
   * is chosen by `recordPageRead`, never by the caller.
   */
  readonly khatm: number;
  /** Mushaf page, 1..604. */
  readonly page: number;
  /** The calendar day of the first read of the page in this khatma, in the user's time zone. */
  readonly date: LocalDate;
}

/**
 * The reading journal: the single source of truth of the module. It is never mutated;
 * `recordPageRead` returns a new journal. Everything else is derived from it.
 *
 * A valid journal has at most one entry per (khatm, page) and one khatma in progress at a
 * time: khatmas are numbered 1, 2, 3... without a gap and all but the last are complete.
 * `recordPageRead` only builds valid journals; a journal loaded from storage can still be
 * damaged, so every function rejects one that breaks these rules (RangeError).
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

/**
 * Business settings of the module. See `DEFAULT_KHATM_CONFIG`.
 *
 * The daily goal is not here on purpose: it belongs to the user (docs/DECISIONS.md, D10)
 * and is always passed explicitly.
 */
export interface KhatmConfig {
  /** New pages needed for a day to count as "watered". Whole number, at least 1. */
  readonly minPagesPerWateredDay: number;
  /**
   * Number of complete days, ending yesterday, averaged by the "recent average" pace. Whole
   * number from 1 to 366.
   */
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
  /** Pages read today for the first time in their khatma (journal entries dated today). */
  readonly pagesRead: number;
  readonly goalPages: number;
  /** Pages still to read to reach the goal; 0 once it is reached. */
  readonly pagesRemaining: number;
  readonly goalReached: boolean;
}

/**
 * The reading pace used to estimate a finish date:
 * - `daily-goal`: the user reads exactly their daily goal (whole number of pages, at least 1);
 * - `recent-average`: the user keeps the average of their last complete days of reading
 *   (today is left out: a day in progress would lower the average every morning).
 */
export type ReadingPace =
  | { readonly kind: 'daily-goal'; readonly dailyGoalPages: number }
  | { readonly kind: 'recent-average' };

/** The reward of a completed khatma, derived from the journal. */
export interface KhatmBadge {
  /**
   * Number of the completed khatma. It is also the cycle number of its garden: the garden
   * module draws the picture of the badge from it.
   */
  readonly khatm: number;
  /** Earliest date among the entries of the khatma. */
  readonly startedOn: LocalDate;
  /** Latest date among the entries of the khatma: the day its last page was read. */
  readonly completedOn: LocalDate;
  /**
   * Calendar days from `startedOn` to `completedOn`, both included: a khatma read in a
   * single day took 1 day, one started on Monday and completed on Tuesday took 2.
   */
  readonly daysTaken: number;
}

/**
 * What the garden on display needs from the reading journal (spec rule 10). The field names
 * are the garden's own input names (docs/specs/garden.md); the garden adds `today`, the
 * pauses and its own settings.
 */
export interface GardenFeed {
  /**
   * The khatma whose garden is on display: the khatma in progress or, while the next one
   * has no page yet, the khatma just completed. It is the cycle number of the garden (one
   * garden per khatma).
   */
  readonly khatm: number;
  /** Hizb completed in that khatma, 0..60: one garden element each. 60 is the complete garden. */
  readonly hizbCompleted: number;
  /**
   * How far the next element has grown: the fraction of the pages of the first unfinished
   * hizb already read. It moves with every new page of that hizb; 0 or more, always below
   * 1, and 0 for a complete garden (nothing is left to grow).
   */
  readonly currentHizbProgress: number;
  /**
   * Day the garden starts: the date of the first page read in that khatma. Null only while
   * no page has ever been read: the garden is then a bare ground.
   */
  readonly startDate: LocalDate | null;
  /**
   * Days watered by at least `minPagesPerWateredDay` new pages, from `startDate` onwards;
   * empty while no page has ever been read. Re-reads never water a day.
   */
  readonly wateredDays: ReadonlySet<LocalDate>;
  /**
   * Day a first hizb of that khatma was completed; null while none is. A hizb is completed
   * on the most recent date among its pages, and this is the earliest such day over the
   * completed hizb (not necessarily hizb 1: pages can be read in any order).
   */
  readonly firstHizbCompletedOn: LocalDate | null;
  /**
   * Day that khatma was completed, the same as on its badge; null while it is in progress.
   * Not null exactly when the feed carries a completed khatma, with its 60 hizb.
   */
  readonly completedOn: LocalDate | null;
}
