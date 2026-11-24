/**
 * Properties that hold for any garden and any settings, checked on many random inputs.
 *
 * The expected reminders of each day are recomputed here in the most direct way: one call
 * to `computeGardenState` per day looked at. The module itself asks the garden for a
 * single forecast started in the past; both must agree.
 */
import { computeGardenState, type GardenPause, type GardenState } from '@/domain/garden';
import { addDays, daysBetween, type LocalDate } from '@/domain/shared/local-date';

import { planReminders } from '../index';
import {
  at,
  createSeededRandom,
  day,
  gardenFromTimeline,
  randomInteger,
  TODAY,
} from '../test-support/reminders-test-kit';
import type {
  QuietHours,
  ReadingReminderKind,
  ReminderGardenInput,
  RemindersInput,
  TimeOfDay,
} from '../types';

const RANDOM_CASES = 300;
const PLAN_DAYS = 30;
const COME_BACK_DAYS = [7, 14, 21, 28];
const LAST_COME_BACK_DAY = 28;
const FRIDAY = 5;

const minutesOf = (time: TimeOfDay): number => time.hour * 60 + time.minute;

function isQuiet(time: TimeOfDay, quietHours: QuietHours | null): boolean {
  if (quietHours === null) return false;
  const [minute, from, to] = [
    minutesOf(time),
    minutesOf(quietHours.from),
    minutesOf(quietHours.to),
  ];
  if (from === to) return false;
  return from < to ? minute >= from && minute < to : minute >= from || minute < to;
}

function deliveryTime(time: TimeOfDay, quietHours: QuietHours | null): TimeOfDay {
  return quietHours !== null && isQuiet(time, quietHours) ? quietHours.to : time;
}

function isPaused(date: LocalDate, pauses: readonly GardenPause[]): boolean {
  return pauses.some((pause) => pause.from <= date && date <= pause.to);
}

function isFriday(date: LocalDate): boolean {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === FRIDAY;
}

type StateOn = (when: LocalDate) => GardenState;

/** The garden computed directly on any day, each day computed once. */
function directStates(garden: ReminderGardenInput): StateOn {
  const known = new Map<LocalDate, GardenState>();
  return (when) => {
    const state = known.get(when) ?? computeGardenState({ ...garden, today: when });
    known.set(when, state);
    return state;
  };
}

/** Days since the garden died, seen on `date`: null if alive, more than 28 if long dead. */
function daysSinceDeath(stateOn: StateOn, date: LocalDate): number | null {
  if (stateOn(date).phase !== 'dead') return null;
  let days = 0;
  while (days <= LAST_COME_BACK_DAY && stateOn(addDays(date, -(days + 1))).phase === 'dead') {
    days += 1;
  }
  return days;
}

/** The reading reminder a day must carry, written straight from the specification. */
function expectedReadingKind(
  input: RemindersInput,
  stateOn: StateOn,
  date: LocalDate,
): ReadingReminderKind | null {
  const { settings } = input;
  const before = stateOn(addDays(date, -1));
  const state = stateOn(date);
  const after = stateOn(addDays(date, 1));

  const deadFor = daysSinceDeath(stateOn, date);
  if (deadFor !== null && deadFor > 0) {
    return settings.thirstyGardenEnabled && COME_BACK_DAYS.includes(deadFor) ? 'come-back' : null;
  }

  if (settings.thirstyGardenEnabled) {
    const drier = state.droughtDays > before.droughtDays;
    if (state.phase !== 'dead' && after.phase === 'dead') return 'last-chance';
    if (state.phase === 'dead' && before.phase !== 'dead') return 'dead';
    if (state.phase === 'dying' && before.phase !== 'dying' && drier) return 'dying';
    if (state.phase === 'wilting' && before.phase !== 'wilting' && drier) return 'wilting';
    if (state.phase === 'thirsty' && before.phase !== 'thirsty' && drier) return 'thirsty';
    if (before.water === 'flowing' && state.water !== 'flowing') return 'water-stopped';
  }
  const goalReached = date === input.now.date && input.pagesReadToday >= input.dailyGoalPages;
  return settings.dailyEnabled && !goalReached ? 'daily-goal' : null;
}

/** Every reminder a day must carry, as "HH:MM kind" lines in the order of the plan. */
function expectedDay(input: RemindersInput, stateOn: StateOn, date: LocalDate): string[] {
  const { settings, now } = input;
  if (isPaused(date, input.garden.pauses)) return [];

  const wanted: { time: TimeOfDay; kind: string }[] = [];
  const readingKind = expectedReadingKind(input, stateOn, date);
  if (readingKind !== null) {
    wanted.push({ time: deliveryTime(settings.dailyTime, settings.quietHours), kind: readingKind });
  }
  if (settings.fridayKahfEnabled && isFriday(date)) {
    const time = deliveryTime(settings.fridayTime, settings.quietHours);
    const isBeforeReading = wanted[0] !== undefined && minutesOf(time) < minutesOf(wanted[0].time);
    if (isBeforeReading) wanted.unshift({ time, kind: 'friday-kahf' });
    else wanted.push({ time, kind: 'friday-kahf' });
  }
  return wanted
    .filter(({ time }) => date !== now.date || minutesOf(time) > minutesOf(now.time))
    .map(({ time, kind }) => `${time.hour}:${time.minute} ${kind}`);
}

function randomTime(random: () => number): TimeOfDay {
  return at(randomInteger(random, 0, 23), randomInteger(random, 0, 59));
}

function randomGarden(random: () => number): ReminderGardenInput {
  const length = randomInteger(random, 0, 70);
  const readingChance = random();
  let timeline = '';
  for (let index = 0; index < length; index += 1) {
    const draw = random();
    timeline += draw < 0.08 ? 'P' : draw < 0.08 + 0.92 * readingChance ? 'W' : 'M';
  }
  const garden = gardenFromTimeline(timeline, random() < 0.3);

  // Pauses to come, on top of the past ones of the timeline.
  const pauses: GardenPause[] = [...garden.pauses];
  for (let count = randomInteger(random, 0, 2); count > 0; count -= 1) {
    const from = randomInteger(random, -3, 32);
    pauses.push({ from: day(from), to: day(from + randomInteger(random, 0, 9)) });
  }

  const shape = random();
  if (shape < 0.1) {
    return { ...garden, pauses, hizbCompleted: 0, firstHizbCompletedOn: null };
  }
  if (shape < 0.2) {
    const completedOn = day(-randomInteger(random, 0, 40));
    return { ...garden, pauses, hizbCompleted: 60, currentHizbProgress: 0, completedOn };
  }
  return { ...garden, pauses, hizbCompleted: randomInteger(random, 1, 59) };
}

function randomInput(random: () => number): RemindersInput {
  const hasQuietHours = random() < 0.6;
  return {
    garden: randomGarden(random),
    now: { date: TODAY, time: randomTime(random) },
    dailyGoalPages: randomInteger(random, 1, 20),
    pagesReadToday: randomInteger(random, 0, 25),
    settings: {
      dailyEnabled: random() < 0.7,
      dailyTime: randomTime(random),
      thirstyGardenEnabled: random() < 0.7,
      fridayKahfEnabled: random() < 0.5,
      fridayTime: randomTime(random),
      quietHours: hasQuietHours ? { from: randomTime(random), to: randomTime(random) } : null,
    },
  };
}

describe('properties of the plan, on random gardens and settings', () => {
  const random = createSeededRandom(20261124);
  const inputs = Array.from({ length: RANDOM_CASES }, () => randomInput(random));
  const plans = inputs.map((input) => planReminders(input));

  it('covers a useful variety of cases', () => {
    const kinds = new Set(plans.flatMap((plan) => plan.map((reminder) => reminder.kind)));
    expect([...kinds].sort()).toEqual([
      'come-back',
      'daily-goal',
      'dead',
      'dying',
      'friday-kahf',
      'last-chance',
      'thirsty',
      'water-stopped',
      'wilting',
    ]);
    expect(plans.some((plan) => plan.length === 0)).toBe(true);
  });

  it('plans exactly the reminders the specification gives each day, in order', () => {
    inputs.forEach((input, index) => {
      const plan = plans[index] ?? [];
      const stateOn = directStates(input.garden);
      for (let offset = 0; offset < PLAN_DAYS; offset += 1) {
        const date = day(offset);
        const plannedThatDay = plan
          .filter((reminder) => reminder.date === date)
          .map((reminder) => `${reminder.time.hour}:${reminder.time.minute} ${reminder.kind}`);
        expect({ case: index, offset, reminders: plannedThatDay }).toEqual({
          case: index,
          offset,
          reminders: expectedDay(input, stateOn, date),
        });
      }
    });
  });

  it('stays inside the 30 days, ordered by day then by time', () => {
    for (const plan of plans) {
      const moments = plan.map(
        (reminder) => daysBetween(TODAY, reminder.date) * 1440 + minutesOf(reminder.time),
      );
      moments.forEach((moment, index) => {
        expect(moment).toBeGreaterThanOrEqual(0);
        expect(moment).toBeLessThan(PLAN_DAYS * 1440);
        expect(moment).toBeGreaterThanOrEqual(moments[index - 1] ?? 0);
      });
    }
  });

  it('plans at most one reading reminder and one Friday reminder a day', () => {
    for (const plan of plans) {
      const seen = new Set<string>();
      for (const reminder of plan) {
        const slot = `${reminder.date} ${reminder.kind === 'friday-kahf' ? 'friday' : 'reading'}`;
        expect(seen.has(slot)).toBe(false);
        seen.add(slot);
      }
    }
  });

  it('never plans a reminder during a pause', () => {
    inputs.forEach((input, index) => {
      for (const reminder of plans[index] ?? []) {
        expect(isPaused(reminder.date, input.garden.pauses)).toBe(false);
      }
    });
  });

  it('never plans a reminder inside the quiet hours', () => {
    inputs.forEach((input, index) => {
      for (const reminder of plans[index] ?? []) {
        expect(isQuiet(reminder.time, input.settings.quietHours)).toBe(false);
      }
    });
  });

  it('never plans a reminder of today at a time that is not still to come', () => {
    inputs.forEach((input, index) => {
      for (const reminder of plans[index] ?? []) {
        if (reminder.date !== input.now.date) continue;
        expect(minutesOf(reminder.time)).toBeGreaterThan(minutesOf(input.now.time));
      }
    });
  });

  it('plans no garden reminder on a day the user has read', () => {
    inputs.forEach((input, index) => {
      if (!input.garden.wateredDays.has(TODAY)) return;
      for (const reminder of plans[index] ?? []) {
        if (reminder.date !== TODAY) continue;
        expect(['daily-goal', 'friday-kahf']).toContain(reminder.kind);
      }
    });
  });

  it('plans no daily-goal today once the goal is reached', () => {
    inputs.forEach((input, index) => {
      if (input.pagesReadToday < input.dailyGoalPages) return;
      const kindsOfToday = (plans[index] ?? [])
        .filter((reminder) => reminder.date === TODAY)
        .map((reminder) => reminder.kind);
      expect(kindsOfToday).not.toContain('daily-goal');
    });
  });

  it('plans only the kinds the settings allow', () => {
    inputs.forEach((input, index) => {
      for (const reminder of plans[index] ?? []) {
        if (reminder.kind === 'daily-goal') expect(input.settings.dailyEnabled).toBe(true);
        else if (reminder.kind === 'friday-kahf') {
          expect(input.settings.fridayKahfEnabled).toBe(true);
        } else expect(input.settings.thirstyGardenEnabled).toBe(true);
      }
    });
  });

  it('plans the Friday reminder on every Friday that is not paused, whatever the garden', () => {
    inputs.forEach((input, index) => {
      if (!input.settings.fridayKahfEnabled) return;
      const fridays = (plans[index] ?? [])
        .filter((reminder) => reminder.kind === 'friday-kahf')
        .map((reminder) => daysBetween(TODAY, reminder.date));
      const expected = [3, 10, 17, 24].filter(
        (offset) => !isPaused(day(offset), input.garden.pauses),
      );
      expect(fridays).toEqual(expected);
    });
  });

  it('carries nothing in params', () => {
    for (const plan of plans) {
      for (const reminder of plan) expect(reminder.params).toEqual({});
    }
  });

  it('gives the same plan for the same input', () => {
    inputs.slice(0, 50).forEach((input, index) => {
      expect(planReminders(input)).toEqual(plans[index]);
    });
  });

  it('the plan of tomorrow morning continues the plan of today when nothing was read', () => {
    // What was announced for the coming days must still be there the next morning.
    inputs.forEach((input, index) => {
      const tomorrow: RemindersInput = {
        ...input,
        now: { date: day(1), time: at(0, 0) },
        pagesReadToday: 0,
      };
      // A reminder at midnight exactly is "not still to come" tomorrow at 00:00.
      const deliveredAtMidnight = (plans[index] ?? []).some(
        (reminder) => minutesOf(reminder.time) === 0,
      );
      if (deliveredAtMidnight) return;
      const stillAhead = (plans[index] ?? []).filter((reminder) => reminder.date > TODAY);
      const nextPlan = planReminders(tomorrow).filter((reminder) => reminder.date <= day(29));
      expect(nextPlan).toEqual(stillAhead);
    });
  });
});
