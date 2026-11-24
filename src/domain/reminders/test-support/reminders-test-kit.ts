/**
 * Helpers shared by the reminders tests. Not part of the module's API.
 *
 * Every test is written around one fixed "today", a Tuesday, so that the Fridays of the
 * plan are known: days 3, 10, 17 and 24.
 */
import { REFERENCE_GARDEN_VARIANT, type GardenPause } from '@/domain/garden';
import { addDays, daysBetween, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

import type {
  ReadingReminderKind,
  ReminderGardenInput,
  ReminderKind,
  ReminderPlan,
  ReminderSettings,
  RemindersInput,
  TimeOfDay,
} from '../types';

/** A Tuesday. */
export const TODAY = parseLocalDate('2026-11-24');

/** The last day of a 30-day plan that starts on `TODAY`. */
export const LAST_PLAN_DAY_OFFSET = 29;

/** The garden of the tests was born long before any day a test looks at. */
const GARDEN_AGE_IN_DAYS = 120;

/** The day `offset` days after `TODAY` (before it when negative). */
export function day(offset: number): LocalDate {
  return addDays(TODAY, offset);
}

export function at(hour: number, minute: number): TimeOfDay {
  return { hour, minute };
}

export const EARLY_MORNING = at(8, 0);
export const DAILY_TIME = at(20, 30);
export const FRIDAY_TIME = at(9, 0);

/** Every reminder on: reading reminders at 20:30, Friday at 09:00, no quiet hours. */
export const ALL_REMINDERS_ON: ReminderSettings = {
  dailyEnabled: true,
  dailyTime: DAILY_TIME,
  thirstyGardenEnabled: true,
  fridayKahfEnabled: true,
  fridayTime: FRIDAY_TIME,
  quietHours: null,
};

export const GARDEN_REMINDERS_ONLY: ReminderSettings = {
  ...ALL_REMINDERS_ON,
  dailyEnabled: false,
  fridayKahfEnabled: false,
};

export const DAILY_REMINDER_ONLY: ReminderSettings = {
  ...ALL_REMINDERS_ON,
  thirstyGardenEnabled: false,
  fridayKahfEnabled: false,
};

export const FRIDAY_REMINDER_ONLY: ReminderSettings = {
  ...ALL_REMINDERS_ON,
  dailyEnabled: false,
  thirstyGardenEnabled: false,
};

export const ALL_REMINDERS_OFF: ReminderSettings = {
  ...ALL_REMINDERS_ON,
  dailyEnabled: false,
  thirstyGardenEnabled: false,
  fridayKahfEnabled: false,
};

/**
 * A garden input from a "timeline": one letter per day that is over, the last letter
 * being yesterday. Spaces are ignored.
 *   W  the user read
 *   M  missed
 *   P  paused, and the user did not read
 * Before the timeline, the user read every day since the garden was born. Today is
 * described by `readToday`.
 *
 * 20 hizb finished, khatma in progress, reference variant, unless `overrides` says otherwise.
 */
export function gardenFromTimeline(
  recentDays: string,
  readToday: boolean,
  overrides: Partial<ReminderGardenInput> = {},
): ReminderGardenInput {
  const letters = [...recentDays.replace(/\s/g, '')];
  const wateredDays = new Set<LocalDate>();
  const pauses: GardenPause[] = [];

  const firstTimelineOffset = -letters.length;
  for (let offset = -GARDEN_AGE_IN_DAYS; offset < firstTimelineOffset; offset += 1) {
    wateredDays.add(day(offset));
  }
  letters.forEach((letter, index) => {
    const date = day(firstTimelineOffset + index);
    if (letter === 'W') wateredDays.add(date);
    else if (letter === 'P') pauses.push({ from: date, to: date });
    else if (letter !== 'M') throw new Error(`Unknown timeline letter "${letter}"`);
  });
  if (readToday) wateredDays.add(TODAY);

  return {
    hizbCompleted: 20,
    currentHizbProgress: 0.5,
    wateredDays,
    firstHizbCompletedOn: day(-GARDEN_AGE_IN_DAYS),
    completedOn: null,
    pauses,
    variant: REFERENCE_GARDEN_VARIANT,
    ...overrides,
  };
}

/**
 * A healthy garden last read `daysAgo` days ago (0: read today), and not since.
 *
 * Counting from the last day read, R, the garden module gives: water stopped on R+2,
 * thirsty on R+4, wilting on R+7, dying on R+11, dead on R+15 (so `come-back` on R+22,
 * R+29, R+36 and R+43).
 */
export function gardenLastReadDaysAgo(
  daysAgo: number,
  overrides: Partial<ReminderGardenInput> = {},
): ReminderGardenInput {
  if (daysAgo === 0) return gardenFromTimeline('', true, overrides);
  return gardenFromTimeline('M'.repeat(daysAgo - 1), false, overrides);
}

/** A bare earth: no hizb finished yet. `readOn` lists the days the user read. */
export function bareEarth(readOn: readonly LocalDate[] = []): ReminderGardenInput {
  return {
    hizbCompleted: 0,
    currentHizbProgress: 0.4,
    wateredDays: new Set(readOn),
    firstHizbCompletedOn: null,
    completedOn: null,
    pauses: [],
    variant: REFERENCE_GARDEN_VARIANT,
  };
}

/**
 * A plan input: it is 08:00 on `TODAY`, the goal is 5 pages and nothing is read yet today,
 * every reminder is on, and the garden was last read yesterday.
 */
export function remindersInput(overrides: Partial<RemindersInput> = {}): RemindersInput {
  return {
    garden: gardenLastReadDaysAgo(1),
    now: { date: TODAY, time: EARLY_MORNING },
    dailyGoalPages: 5,
    pagesReadToday: 0,
    settings: ALL_REMINDERS_ON,
    ...overrides,
  };
}

/** The reading reminder planned on each day, keyed by day offset from `TODAY`. */
export function readingKindsByOffset(plan: ReminderPlan): Record<number, ReadingReminderKind> {
  const kinds: Record<number, ReadingReminderKind> = {};
  for (const reminder of plan) {
    if (reminder.kind !== 'friday-kahf') kinds[daysBetween(TODAY, reminder.date)] = reminder.kind;
  }
  return kinds;
}

/** Day offsets, from `TODAY`, of the reminders of the given kinds, in the order of the plan. */
export function offsetsOf(plan: ReminderPlan, ...kinds: ReminderKind[]): number[] {
  return plan
    .filter((reminder) => kinds.includes(reminder.kind))
    .map((reminder) => daysBetween(TODAY, reminder.date));
}

/** Every reminder that depends on `thirstyGardenEnabled`. */
export const GARDEN_KINDS: readonly ReminderKind[] = [
  'water-stopped',
  'thirsty',
  'wilting',
  'dying',
  'last-chance',
  'dead',
  'come-back',
];

/** A reminder as it appears in the plan. */
export function planned(date: LocalDate, time: TimeOfDay, kind: ReminderKind) {
  return { date, time, kind, params: {} };
}

/**
 * Small deterministic random generator (mulberry32): the same seed always gives the same
 * sequence, so a failing random case can be replayed. Returns numbers in [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function randomInteger(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}
