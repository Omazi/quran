import type { LocalDate } from '@/domain/shared/local-date';

/** The goals of the first-launch flow: a duration to finish the khatma in, or the person's own pace. */
export type GoalKind = '1-month' | '3-months' | '1-year' | 'own-pace';

/**
 * What the person chose. `pagesPerDay` only matters for `own-pace` (the default is
 * `DEFAULT_OWN_PACE_PAGES`); the fixed durations ignore it.
 */
export interface Goal {
  readonly kind: GoalKind;
  readonly pagesPerDay?: number;
}

/** What a goal means over time, from a given day. */
export interface GoalPlan {
  readonly kind: GoalKind;
  /** Pages to read each day, a whole number: the daily goal of the khatm module. */
  readonly pagesPerDay: number;
  /** Days of reading to finish the khatma, today included. */
  readonly readingDays: number;
  /** The day the khatma ends, reading `pagesPerDay` pages every day from today (today included). */
  readonly endDate: LocalDate;
  /** Hizb finished after 30 days of reading (today is the first), from 0 to 60. */
  readonly hizbAfter30Days: number;
}

/** The moment of the day the person reads, as the first-launch flow offers it. */
export type ReadingMoment = 'after-fajr' | 'midday' | 'evening' | 'before-sleep';

/** The two optional reminders the first-launch flow lets the person switch off. */
export interface ReminderChoices {
  /** The Friday Al-Kahf reminder. */
  readonly fridayKahf: boolean;
  /** The "garden is thirsty" reminders. */
  readonly thirstyGarden: boolean;
}
