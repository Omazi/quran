import type { PageRead, Pause, ReadingJournal } from '@/domain/khatm';
import type { LocalDate } from '@/domain/shared/local-date';
import type { SecondsByDay } from '@/domain/stats';
import type { QuietHours, ReminderSettings, TimeOfDay } from '@/domain/reminders';
import type { AppLanguage } from '@/i18n';

/**
 * Which reminders the person wants: exactly what the reminders planner takes (`planReminders`),
 * so the stored settings can be handed to it as they are. `dailyTime` is the time of the daily
 * reminder and of the garden's; `fridayTime` the time of the Friday one.
 */
export type { QuietHours, ReminderSettings };

/** A time of day on a 24-hour clock, in the device's time zone. */
export type ReminderTime = TimeOfDay;

/** Everything the person has chosen, and what the app must remember about them. */
export interface AppSettings {
  /** The language chosen in the app, or null to follow the device. */
  readonly language: AppLanguage | null;
  /** Pages to read each day: a whole number within `DAILY_GOAL_RANGE`. */
  readonly dailyGoalPages: number;
  /** True once the first-launch flow has been finished. */
  readonly onboardingCompleted: boolean;
  /**
   * Drawn once, at the first launch: it makes this person's gardens differ from anyone else's
   * (`gardenVariant(cycle, userSeed)`). A whole number from 0 to 2^53 - 1.
   */
  readonly userSeed: number;
  /**
   * The last page opened in the reader, from 1 to 604, or null when the reader was never opened.
   * The page to resume starts from it (docs/specs/reader.md, section 1).
   */
  readonly lastOpenedPage: number | null;
  /**
   * The pages the person bookmarked in the reader, each once, in the order of the mushaf
   * (pages 1 to 604). Empty until the first bookmark.
   */
  readonly bookmarks: readonly number[];
  /** Periods during which the garden is frozen. */
  readonly pauses: readonly Pause[];
  readonly reminders: ReminderSettings;
}

/** What is kept on the device between two launches. */
export interface AppData {
  readonly settings: AppSettings;
  /** The reading journal, built by the khatm module only. */
  readonly journal: ReadingJournal;
  /**
   * Seconds the app was in the foreground, by local day: all of it, and inside the reader (D37).
   * A day without time has no key. Counted by the app, never derived: the journal holds no time.
   */
  readonly timeSpent: SecondsByDay;
}

/**
 * What can be written to the device or to the copy of the progress: `AppData`, where a missing
 * `timeSpent` stands for "no time counted yet" (data from before the time counters existed).
 */
export type AppDataToWrite = Omit<AppData, 'timeSpent'> & Partial<Pick<AppData, 'timeSpent'>>;

/** Foreground time to add to a day, in whole seconds. The reader is part of the app. */
export interface ForegroundTime {
  /** The local day the time was spent. */
  readonly date: LocalDate;
  /** Seconds in the foreground, in the whole app: a whole number from 0. */
  readonly appSeconds: number;
  /** Of those, seconds in the reader: a whole number from 0 to `appSeconds`. */
  readonly readerSeconds: number;
}

/**
 * What the person must still be told after stored data could not be read back: which part
 * started again from nothing. Null when there is nothing to tell.
 */
export type DataResetNotice = 'settings' | 'journal' | 'everything';

/** The state of the store: the data and the only ways to change it. Every change is saved. */
export interface AppState extends AppData {
  /** Not part of the stored document: kept apart, so that a reset cannot erase it. */
  readonly dataResetNotice: DataResetNotice | null;
  /** The person has read the notice: it is not shown again. */
  dismissDataResetNotice: () => void;
  /**
   * Records the person's choice of language, or null to follow the phone again, which is also what
   * a fresh install does (D32). Showing it is the caller's job. Throws a `RangeError` for anything
   * else.
   */
  setLanguage: (language: AppLanguage | null) => void;
  /** Throws a `RangeError` outside `DAILY_GOAL_RANGE`. */
  setDailyGoalPages: (pages: number) => void;
  /** Changes some of the reminder settings. Throws a `RangeError` for an impossible time. */
  updateReminders: (change: Partial<ReminderSettings>) => void;
  completeOnboarding: () => void;
  /** Remembers the last page opened in the reader, or forgets it with null. */
  setLastOpenedPage: (page: number | null) => void;
  /**
   * Bookmarks a page, or removes its bookmark when it has one. Throws a `RangeError` for anything
   * but a page from 1 to 604.
   */
  toggleBookmark: (page: number) => void;
  /**
   * Adds a page to the journal through the khatm module. A page read again changes nothing.
   * Throws a `RangeError` for a day outside `STORED_DATE_RANGE`: a phone whose clock is that far
   * off must not write a date the app would refuse to read back.
   */
  recordPageRead: (pageRead: PageRead) => void;
  /**
   * Adds a period during which the garden is frozen. Throws a `RangeError` for days outside
   * `STORED_DATE_RANGE`, for an end before the start, and beyond `MAX_PAUSES` pauses.
   */
  addPause: (pause: Pause) => void;
  /**
   * Adds foreground time to a day (D37). Every call writes the document and the copy of the
   * progress: the caller adds in batches (every minute, when the app goes to the background), not
   * every second. Throws a `RangeError` for a day outside `STORED_DATE_RANGE`, for seconds that
   * are not whole numbers from 0, for reader seconds above the app seconds, and when the day
   * would pass 25 hours. Adding nothing changes nothing.
   */
  addForegroundTime: (time: ForegroundTime) => void;
}
