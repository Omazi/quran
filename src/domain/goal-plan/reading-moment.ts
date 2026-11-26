import type { ReminderSettings, TimeOfDay } from '@/domain/reminders';

import { DEFAULT_REMINDERS_CHOICES, READING_MOMENT_TIMES, READING_MOMENTS } from './config';
import type { ReadingMoment, ReminderChoices } from './types';

/** The local time the daily reminder takes for a moment. Throws a `TypeError` for another value. */
export function readingMomentTime(moment: ReadingMoment): TimeOfDay {
  if (!READING_MOMENTS.includes(moment)) {
    throw new TypeError(`Reading moment: unknown moment ${JSON.stringify(moment)}.`);
  }
  const { hour, minute } = READING_MOMENT_TIMES[moment];
  return { hour, minute };
}

/**
 * The moment whose time is `time`, or null for a time chosen by hand in the settings. The moment
 * is not stored: it is read back from the time of the daily reminder.
 */
export function readingMomentAt(time: TimeOfDay): ReadingMoment | null {
  return (
    READING_MOMENTS.find((moment) => {
      const { hour, minute } = READING_MOMENT_TIMES[moment];
      return time.hour === hour && time.minute === minute;
    }) ?? null
  );
}

/**
 * The reminder settings the first-launch flow applies: the daily reminder on, at the time of the
 * moment, and the two optional ones (Friday Al-Kahf, thirsty garden) on unless switched off. A
 * change for the reminders store (`updateReminders`); the other settings keep their value.
 */
export function remindersForReadingMoment(
  moment: ReadingMoment,
  choices: ReminderChoices = DEFAULT_REMINDERS_CHOICES,
): Pick<
  ReminderSettings,
  'dailyEnabled' | 'dailyTime' | 'fridayKahfEnabled' | 'thirstyGardenEnabled'
> {
  return {
    dailyEnabled: true,
    dailyTime: readingMomentTime(moment),
    fridayKahfEnabled: choices.fridayKahf,
    thirstyGardenEnabled: choices.thirstyGarden,
  };
}
