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

/** The state of the store: the data and the only ways to change it. Every change is saved. */
export interface AppState extends AppData {
  /** Records the person's choice of language. Showing it is the caller's job. */
  setLanguage: (language: AppLanguage) => void;
  /** Throws a `RangeError` outside `DAILY_GOAL_RANGE`. */
  setDailyGoalPages: (pages: number) => void;
  /** Changes some of the reminder settings. Throws a `RangeError` for an impossible time. */
  updateReminders: (change: Partial<ReminderSettings>) => void;
  completeOnboarding: () => void;
  /** Adds a page to the journal through the khatm module. A page read again changes nothing. */
  recordPageRead: (pageRead: PageRead) => void;
}
