/**
 * Vocabulary of the reminders module.
 *
 * The module sends nothing. It computes a plan: a plain list of "which reminder, which day,
 * at what time" that the data layer schedules as local notifications (decision D13).
 */
import type { GardenInput } from '@/domain/garden';
import type { LocalDate } from '@/domain/shared/local-date';

/** A time on the user's own clock, to the minute. No time zone: it is what the phone shows. */
export interface TimeOfDay {
  /** Whole number 0..23. */
  readonly hour: number;
  /** Whole number 0..59. */
  readonly minute: number;
}

/** The moment the plan is computed, as the user's phone shows it. Always injected. */
export interface LocalMoment {
  readonly date: LocalDate;
  readonly time: TimeOfDay;
}

/**
 * Hours during which no reminder may arrive, from `from` (included) to `to` (excluded).
 * They span midnight when `from` is later than `to` (22:00 to 07:00). When both are the
 * same time the period is empty: nothing is quiet.
 */
export interface QuietHours {
  readonly from: TimeOfDay;
  readonly to: TimeOfDay;
}

/** What the user chose on the reminders screen. */
export interface ReminderSettings {
  /** The `daily-goal` reminder. */
  readonly dailyEnabled: boolean;
  /** The time of every reading reminder: `daily-goal` and the garden reminders. */
  readonly dailyTime: TimeOfDay;
  /**
   * The garden reminders: `water-stopped`, `thirsty`, `wilting`, `dying`, `last-chance`,
   * `dead` and `come-back`.
   */
  readonly thirstyGardenEnabled: boolean;
  /** The `friday-kahf` reminder. */
  readonly fridayKahfEnabled: boolean;
  /** The time of the `friday-kahf` reminder. */
  readonly fridayTime: TimeOfDay;
  /** `null` when the user set no quiet hours. */
  readonly quietHours: QuietHours | null;
}

/**
 * The garden input without its `today`: the plan has a single clock, `RemindersInput.now`
 * (a `today` left in the object is ignored). The pauses are the garden's own (`pauses`):
 * a paused day gets no reminder.
 */
export type ReminderGardenInput = Omit<GardenInput, 'today'>;

/** Everything the plan depends on. All of it is injected, including the current time. */
export interface RemindersInput {
  readonly garden: ReminderGardenInput;
  readonly now: LocalMoment;
  /** The user's daily goal, a whole number of pages, at least 1 (see the khatm module). */
  readonly dailyGoalPages: number;
  /** New pages read today, a whole number, 0 or more (see the khatm module). */
  readonly pagesReadToday: number;
  readonly settings: ReminderSettings;
}

/**
 * The reminders that depend on the garden: its changes of state, then `come-back`, once
 * a week for a few weeks after its death.
 */
export type GardenReminderKind =
  'water-stopped' | 'thirsty' | 'wilting' | 'dying' | 'last-chance' | 'dead' | 'come-back';

/** The reminders about reading. At most one of them a day, at `dailyTime`. */
export type ReadingReminderKind = 'daily-goal' | GardenReminderKind;

/**
 * What a reminder is about. It is the translation key of its text. `friday-kahf` follows
 * the calendar, not the garden: it comes on top of the reading reminder of its day.
 */
export type ReminderKind = ReadingReminderKind | 'friday-kahf';

/**
 * Values the text of a reminder may use. Empty on purpose, for every kind.
 *
 * A notification is read on a locked screen, by whoever holds the phone. Anything placed
 * here ends up in that text, so nothing here may say how much the user reads (pages,
 * hizb, goal) or for how long they have not read (days, drought). The kind alone is
 * enough to choose a warm, short sentence.
 */
export type ReminderParams = Readonly<Record<string, never>>;

export interface Reminder {
  /** The day the reminder is delivered. */
  readonly date: LocalDate;
  /** The time it is delivered at, on the user's clock. Never inside the quiet hours. */
  readonly time: TimeOfDay;
  readonly kind: ReminderKind;
  readonly params: ReminderParams;
}

/** The reminders to schedule, earliest first: at most one reading reminder and one Friday reminder a day. */
export type ReminderPlan = readonly Reminder[];
