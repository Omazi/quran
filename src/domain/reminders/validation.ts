/**
 * Guards of the module. Settings and counters can arrive broken from storage even though
 * TypeScript believes them well typed: invalid input always raises an explicit error,
 * nothing is silently corrected (docs/CONTRIBUTING.md).
 *
 * The garden input is not checked here: the garden module checks it when it is asked for
 * the forecast.
 */
import { isLocalDate } from '@/domain/shared/local-date';

import { assertTimeOfDay } from './time-of-day';
import type { LocalMoment, QuietHours, ReminderSettings, RemindersInput } from './types';

/** The daily goal belongs to the user and is at least one page (see the khatm module). */
const MIN_DAILY_GOAL_PAGES = 1;
const MIN_PAGES_READ = 0;

function isObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

function assertWholeNumberAtLeast(value: number, min: number, name: string): void {
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(
      `Reminders: ${name} must be a whole number of at least ${min}, got ${String(value)}`,
    );
  }
}

function assertBoolean(value: boolean, name: string): void {
  if (typeof value !== 'boolean') {
    throw new TypeError(`Reminders: ${name} must be true or false, got ${String(value)}`);
  }
}

function assertMoment(now: LocalMoment): void {
  if (!isObject(now)) throw new TypeError('Reminders: now must be a moment { date, time }');
  if (typeof now.date !== 'string' || !isLocalDate(now.date)) {
    throw new RangeError(
      `Reminders: now.date is not a real YYYY-MM-DD date: "${String(now.date)}"`,
    );
  }
  assertTimeOfDay(now.time, 'now.time');
}

/** `null` is the only way to say "no quiet hours": a forgotten field is an error. */
function assertQuietHours(quietHours: QuietHours | null): void {
  if (quietHours === null) return;
  if (!isObject(quietHours)) {
    throw new TypeError('Reminders: settings.quietHours must be { from, to } or null');
  }
  assertTimeOfDay(quietHours.from, 'settings.quietHours.from');
  assertTimeOfDay(quietHours.to, 'settings.quietHours.to');
}

function assertSettings(settings: ReminderSettings): void {
  if (!isObject(settings)) throw new TypeError('Reminders: settings must be an object');
  assertBoolean(settings.dailyEnabled, 'settings.dailyEnabled');
  assertBoolean(settings.thirstyGardenEnabled, 'settings.thirstyGardenEnabled');
  assertBoolean(settings.fridayKahfEnabled, 'settings.fridayKahfEnabled');
  assertTimeOfDay(settings.dailyTime, 'settings.dailyTime');
  assertTimeOfDay(settings.fridayTime, 'settings.fridayTime');
  assertQuietHours(settings.quietHours);
}

/** Throws a TypeError or a RangeError unless everything but the garden input is valid. */
export function assertValidInput(input: RemindersInput): void {
  if (!isObject(input)) throw new TypeError('Reminders: expected an input object');
  if (!isObject(input.garden)) throw new TypeError('Reminders: garden must be the garden input');
  assertMoment(input.now);
  assertWholeNumberAtLeast(input.dailyGoalPages, MIN_DAILY_GOAL_PAGES, 'dailyGoalPages');
  assertWholeNumberAtLeast(input.pagesReadToday, MIN_PAGES_READ, 'pagesReadToday');
  assertSettings(input.settings);
}
