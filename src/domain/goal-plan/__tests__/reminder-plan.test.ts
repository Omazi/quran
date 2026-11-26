/** The reading moment is only worth something if the reminders planner schedules it. */
import { planReminders } from '@/domain/reminders';
import {
  ALL_REMINDERS_ON,
  EARLY_MORNING,
  TODAY,
  day,
  remindersInput,
} from '@/domain/reminders/test-support/reminders-test-kit';

import { READING_MOMENTS, readingMomentTime, remindersForReadingMoment } from '../index';

function planFor(moment: (typeof READING_MOMENTS)[number]) {
  const settings = { ...ALL_REMINDERS_ON, ...remindersForReadingMoment(moment) };
  return planReminders(remindersInput({ settings, now: { date: TODAY, time: EARLY_MORNING } }));
}

describe('the planner and the reading moments', () => {
  it.each(READING_MOMENTS)('delivers every reading reminder at the time of %s', (moment) => {
    const time = readingMomentTime(moment);
    const reading = planFor(moment).filter((reminder) => reminder.kind !== 'friday-kahf');
    // The garden's own reminders (thirsty, wilting...) replace the daily one on some days: all of
    // them share the moment's time, and the daily one is among them.
    expect(reading.some((reminder) => reminder.kind === 'daily-goal')).toBe(true);
    expect(reading.every((reminder) => reminder.time.hour === time.hour)).toBe(true);
    expect(reading.every((reminder) => reminder.time.minute === time.minute)).toBe(true);
  });

  it('keeps Friday Al-Kahf on its own time, the first Friday being 3 days away', () => {
    const fridays = planFor('evening').filter((reminder) => reminder.kind === 'friday-kahf');
    expect(fridays.map((reminder) => reminder.date)).toContain(day(3));
    expect(fridays).toHaveLength(4);
    expect(fridays[0]?.time).toEqual(ALL_REMINDERS_ON.fridayTime);
  });

  it('keeps only the daily reminder once the person switched Friday and the garden off', () => {
    const settings = {
      ...ALL_REMINDERS_ON,
      ...remindersForReadingMoment('midday', { fridayKahf: false, thirstyGarden: false }),
    };
    const plan = planReminders(
      remindersInput({ settings, now: { date: TODAY, time: EARLY_MORNING } }),
    );
    expect(plan.some((reminder) => reminder.kind === 'friday-kahf')).toBe(false);
    expect(plan.some((reminder) => reminder.kind === 'daily-goal')).toBe(true);
  });
});
