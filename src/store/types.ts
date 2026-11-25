import type { PageRead, Pause, ReadingJournal } from '@/domain/khatm';
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
  /** Periods during which the garden is frozen. */
  readonly pauses: readonly Pause[];
  readonly reminders: ReminderSettings;
}

/** What is kept on the device between two launches. */
export interface AppData {
  readonly settings: AppSettings;
  /** The reading journal, built by the khatm module only. */
  readonly journal: ReadingJournal;
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
}
