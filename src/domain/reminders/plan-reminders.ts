/**
 * The reminder plan over the coming days: at most one reading reminder a day, deduced
 * from the garden "if nothing more is read", plus the Friday reminder.
 * See docs/specs/reminders.md and ./README.md.
 */
import { DAYS_PER_WEEK, isFriday, isPausedOn } from './calendar';
import { NO_PARAMS, REMINDER_PRIORITY, REMINDERS_CONFIG } from './config';
import { describeGardenDays, type GardenDay } from './garden-days';
import { compareTimesOfDay, isLaterInTheDay, outsideQuietHours } from './time-of-day';
import type {
  ReadingReminderKind,
  Reminder,
  ReminderKind,
  ReminderPlan,
  RemindersInput,
  TimeOfDay,
} from './types';
import { assertValidInput } from './validation';

/** `come-back` is sent 7, 14, 21 and 28 days after the death of the garden. */
function isComeBackDay(daysAfterDeath: number): boolean {
  const lastComeBackDay = REMINDERS_CONFIG.comeBackWeeks * DAYS_PER_WEEK;
  return daysAfterDeath <= lastComeBackDay && daysAfterDeath % DAYS_PER_WEEK === 0;
}

/** The single reading reminder of a day, or `null` when that day has none. */
function readingReminderKindOn(
  day: GardenDay,
  isToday: boolean,
  input: RemindersInput,
): ReadingReminderKind | null {
  const { settings } = input;

  // 0 on the day the garden dies: that day is an ordinary one, it carries `dead`.
  const daysAfterDeath = day.daysSinceDeath ?? 0;
  if (daysAfterDeath > 0) {
    // Silence after the death: no daily reminder, no garden reminder, only `come-back`.
    const isComeBack = settings.thirstyGardenEnabled && isComeBackDay(daysAfterDeath);
    return isComeBack ? 'come-back' : null;
  }

  const wanted: ReadingReminderKind[] = [];
  if (settings.thirstyGardenEnabled) wanted.push(...day.changes);
  // Only today's reading is known: on the coming days the goal is still to be reached.
  const isGoalReached = isToday && input.pagesReadToday >= input.dailyGoalPages;
  if (settings.dailyEnabled && !isGoalReached) wanted.push('daily-goal');

  return REMINDER_PRIORITY.find((kind) => wanted.includes(kind)) ?? null;
}

function reminder(day: GardenDay, time: TimeOfDay, kind: ReminderKind): Reminder {
  return {
    date: day.date,
    time: { hour: time.hour, minute: time.minute },
    kind,
    params: NO_PARAMS,
  };
}

/**
 * Computes the reminders to schedule over `REMINDERS_CONFIG.planHorizonDays` days, today
 * included, earliest first. A day holds at most one reading reminder, at `dailyTime`,
 * and on Fridays the Friday reminder, at `fridayTime`.
 *
 * Pure: the same input always gives the same plan, and nothing reads the clock. The data
 * layer replaces every scheduled notification by this plan each time something changes
 * (page read, setting changed, app opened).
 *
 * A reminder of today is in the plan only while its time is still to come. Once that time
 * is reached it has been delivered, or it is too late: it is not moved to tomorrow, which
 * gets its own reminder from its own garden.
 *
 * Throws a TypeError or a RangeError on invalid input (the garden input is checked by the
 * garden module).
 */
export function planReminders(input: RemindersInput): ReminderPlan {
  assertValidInput(input);
  const { now, settings } = input;
  const readingTime = outsideQuietHours(settings.dailyTime, settings.quietHours);
  const fridayTime = outsideQuietHours(settings.fridayTime, settings.quietHours);

  const plan: Reminder[] = [];
  for (const day of describeGardenDays(input.garden, now.date)) {
    // No reminder of any kind during a pause.
    if (isPausedOn(day.date, input.garden.pauses)) continue;
    const isToday = day.date === now.date;

    const remindersOfDay: Reminder[] = [];
    const readingKind = readingReminderKindOn(day, isToday, input);
    if (readingKind !== null) remindersOfDay.push(reminder(day, readingTime, readingKind));
    if (settings.fridayKahfEnabled && isFriday(day.date)) {
      remindersOfDay.push(reminder(day, fridayTime, 'friday-kahf'));
    }

    // At the same time, the reading reminder stays first: the sort keeps equal items in order.
    remindersOfDay.sort((a, b) => compareTimesOfDay(a.time, b.time));
    for (const planned of remindersOfDay) {
      if (!isToday || isLaterInTheDay(planned.time, now.time)) plan.push(planned);
    }
  }
  return plan;
}
