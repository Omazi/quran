/**
 * What the text of a reminder rests on, without the words (they live in the `notifications`
 * namespace): which of its variants a day gets, and how many pages of the goal that day asks for.
 * See docs/specs/reminders-copy.md.
 */
import { daysBetween, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

import { DAYS_PER_WEEK } from './calendar';
import type { ReminderKind, RemindersInput } from './types';

/** Any fixed day does: it only numbers the days. */
const FIRST_DAY = parseLocalDate('2000-01-01');

/**
 * The reminders that come once a week: the Friday one, and `come-back` (7, 14, 21 and 28 days after
 * the death of the garden). They change variant from one week to the next.
 */
const WEEKLY_KINDS: readonly ReminderKind[] = ['friday-kahf', 'come-back'];

/**
 * Which of `count` variants the text of a reminder uses on a day, from 0 to `count - 1`.
 * Deterministic: the same kind on the same day always gets the same text, so planning again
 * changes nothing. The variants follow one another day after day (week after week for the weekly
 * reminders): with two variants or more, two consecutive reminders of a kind never share one.
 */
export function copyVariantIndex(kind: ReminderKind, date: LocalDate, count: number): number {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`A reminder has at least one variant, received ${String(count)}.`);
  }
  const day = daysBetween(FIRST_DAY, date);
  const step = WEEKLY_KINDS.includes(kind) ? Math.floor(day / DAYS_PER_WEEK) : day;
  return ((step % count) + count) % count;
}

/** The goal of a day as its reminder can say it. */
export interface ReadingGoalOfDay {
  /** Pages still to read that day for the goal, if nothing more is read before the reminder. */
  readonly pagesLeft: number;
  /** Whether some of that day's pages are already read. */
  readonly hasStarted: boolean;
}

/**
 * The goal of `date`. Only today's reading is known: on a coming day, the whole goal is still to
 * read. A reminder is planned "if nothing more is read" and planned again as soon as a page is.
 */
export function readingGoalOn(
  {
    now,
    dailyGoalPages,
    pagesReadToday,
  }: Pick<RemindersInput, 'now' | 'dailyGoalPages' | 'pagesReadToday'>,
  date: LocalDate,
): ReadingGoalOfDay {
  const pagesRead = date === now.date ? pagesReadToday : 0;
  return { pagesLeft: Math.max(0, dailyGoalPages - pagesRead), hasStarted: pagesRead > 0 };
}
