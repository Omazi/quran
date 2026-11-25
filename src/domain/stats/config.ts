/**
 * Reward estimate: one hasana per letter, multiplied by ten, after the hadith reported by Ibn
 * Mas'ud (Sunan at-Tirmidhi no. 2910). It is an estimate: only Allah knows the reward. The
 * wording shown to the person, and this figure, are to be validated by a qualified person.
 */
export const HASANAT_PER_LETTER = 10;

/** Source named on screen next to the estimate. */
export const HASANAT_SOURCE = "Sunan at-Tirmidhi no. 2910 (Ibn Mas'ud)";

/**
 * The week starts on a Monday (docs/specs/stats.md). 1970-01-05, the first Monday after the
 * epoch, is the reference to count weekdays from.
 */
export const REFERENCE_MONDAY = '1970-01-05';
export const DAYS_PER_WEEK = 7;

/**
 * The longest range `getDailyReadingStats` walks day by day: a whole leap year. A longer one is
 * refused, so a wrong date cannot make it loop for centuries.
 */
export const MAX_DAILY_RANGE_DAYS = 366;

/**
 * The most seconds one local day can hold: 25 hours, because the day a clock goes back lasts 25
 * hours. More than that for one day is not a measure, it is a bug.
 */
export const MAX_SECONDS_PER_DAY = 25 * 60 * 60;
