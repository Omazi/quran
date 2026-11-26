import type { GoalKind, ReadingMoment, ReminderChoices } from './types';
import type { TimeOfDay } from '@/domain/reminders';

export const GOAL_KINDS: readonly GoalKind[] = Object.freeze([
  '1-month',
  '3-months',
  '1-year',
  'own-pace',
]);

/** Days of a fixed duration goal. A month is 30 days and a year 365: the plan is in whole days. */
export const GOAL_DURATION_DAYS = Object.freeze({
  '1-month': 30,
  '3-months': 90,
  '1-year': 365,
} as const);

/** The pace proposed for `own-pace` (the daily goal of a first launch, half a hizb). */
export const DEFAULT_OWN_PACE_PAGES = 5;

/** The expected-progress horizon of the plan: "in a month". */
export const PROGRESS_HORIZON_DAYS = 30;

export const READING_MOMENTS: readonly ReadingMoment[] = Object.freeze([
  'after-fajr',
  'midday',
  'evening',
  'before-sleep',
]);

/**
 * The fixed local time of each moment, until the app knows the prayer times (then `after-fajr`
 * follows Fajr; the others stay).
 */
export const READING_MOMENT_TIMES: Readonly<Record<ReadingMoment, TimeOfDay>> = Object.freeze({
  'after-fajr': Object.freeze({ hour: 6, minute: 30 }),
  midday: Object.freeze({ hour: 12, minute: 30 }),
  evening: Object.freeze({ hour: 19, minute: 0 }),
  'before-sleep': Object.freeze({ hour: 22, minute: 0 }),
});

/** Friday Al-Kahf and the thirsty garden are on unless the person switches them off. */
export const DEFAULT_REMINDERS_CHOICES: ReminderChoices = Object.freeze({
  fridayKahf: true,
  thirstyGarden: true,
});
