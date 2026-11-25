/**
 * How the numbers, durations and days of the statistics are written, in the language of the
 * interface. Digits stay Western in every language, as in the rest of the app (deviation 25 of
 * docs/design/SKILLS.md).
 */

import type { TFunction } from 'i18next';

import type { LocalDate } from '@/domain/shared/local-date';

export const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

function locale(language: string): string {
  return `${language}-u-nu-latn`;
}

/** A count with the grouping of the language: "13 600", "13,600". */
export function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(locale(language), { maximumFractionDigits: 0 }).format(value);
}

/**
 * A duration in hours and minutes, cut to the minute: "1 h 42 min". `spoken` writes the words
 * out for VoiceOver ("1 heure 42 minutes"), as charts.md asks of accessibility labels.
 */
export function formatDuration(seconds: number, t: TFunction, spoken = false): string {
  const keys = spoken ? 'durationSpoken' : 'duration';
  if (seconds > 0 && seconds < SECONDS_PER_MINUTE) return t(`${keys}.lessThanMinute`);
  const totalMinutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  const minutesText = t(`${keys}.minutes`, { count: minutes });
  if (hours === 0) return minutesText;
  const hoursText = t(`${keys}.hours`, { count: hours });
  if (minutes === 0) return hoursText;
  return t(`${keys}.join`, { hours: hoursText, minutes: minutesText });
}

function format(date: LocalDate, language: string, options: Intl.DateTimeFormatOptions): string {
  // A LocalDate has no time zone: read and written in UTC so that no zone can shift it.
  return new Intl.DateTimeFormat(locale(language), { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** "vendredi 28 novembre". */
export function formatDayLong(date: LocalDate, language: string): string {
  return format(date, language, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "novembre 2026". */
export function formatMonthLong(date: LocalDate, language: string): string {
  return format(date, language, { month: 'long', year: 'numeric' });
}

/** "28 nov. 2026". */
export function formatDayMedium(date: LocalDate, language: string): string {
  return format(date, language, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The initial of the weekday: "V". */
export function formatWeekdayNarrow(date: LocalDate, language: string): string {
  return format(date, language, { weekday: 'narrow' });
}

/** The initial of the month: "N". */
export function formatMonthNarrow(date: LocalDate, language: string): string {
  return format(date, language, { month: 'narrow' });
}

/** The day of the month: "28". */
export function formatDayOfMonth(date: LocalDate, language: string): string {
  return format(date, language, { day: 'numeric' });
}
