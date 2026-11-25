/**
 * The numbers and the order of docs/specs/reminders.md, in one place.
 */
import type { ReadingReminderKind, ReminderParams } from './types';

export const REMINDERS_CONFIG = Object.freeze({
  /** The plan covers this many days: today and the days that follow. */
  planHorizonDays: 30,
  /**
   * After the garden's death, number of `come-back` reminders: one a week. After them,
   * no reading reminder is sent until the user reads again.
   */
  comeBackWeeks: 4,
  /**
   * Most notifications kept scheduled at once. iOS keeps the 64 soonest and silently drops the
   * rest, so staying under it keeps what the person sees equal to what the plan says. A plan
   * holds at most 35; the rest of the room is for a plan that grows.
   */
  maxPendingNotifications: 60,
});

/**
 * At most one reading reminder a day: when several fall on the same day, the first of
 * this list is kept and the others are dropped (they are not moved to another day).
 * `friday-kahf` is not in the list: it is added to its day, whatever else that day holds.
 */
export const REMINDER_PRIORITY: readonly ReadingReminderKind[] = Object.freeze([
  'last-chance',
  'dead',
  'dying',
  'wilting',
  'thirsty',
  'water-stopped',
  'come-back',
  'daily-goal',
]);

/** The only value `params` takes: see `ReminderParams`. */
export const NO_PARAMS: ReminderParams = Object.freeze({});
