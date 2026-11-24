/**
 * The garden, day by day, as the plan needs it: what changes on each day of the plan if
 * nothing more is read, and how long ago the garden died.
 *
 * No garden rule is written here. Every state comes from the garden module; this file
 * only compares the garden of a day with the garden of the day before and the day after.
 */
import {
  forecastGardenWithoutReading,
  type GardenForecastDay,
  type GardenPhase,
  type GardenState,
} from '@/domain/garden';
import { addDays, compareLocalDates, type LocalDate } from '@/domain/shared/local-date';

import { DAYS_PER_WEEK } from './calendar';
import { REMINDERS_CONFIG } from './config';
import type { GardenReminderKind, ReminderGardenInput } from './types';

/**
 * Days looked at before today. The `come-back` weeks are counted from the day the garden
 * died, which can lie that far back; one more day tells "died exactly that long ago" from
 * "died earlier".
 */
const DAYS_LOOKED_BACK = REMINDERS_CONFIG.comeBackWeeks * DAYS_PER_WEEK + 1;

/** `last-chance` is sent on the eve of a change: one day is looked at after the plan. */
const DAYS_LOOKED_AFTER_PLAN = 1;

/**
 * Stands for "the garden was already dead on the first day looked at": it died longer ago
 * than the `come-back` weeks, how long exactly no longer matters.
 */
const DIED_BEFORE_DAYS_LOOKED_AT = Number.POSITIVE_INFINITY;

/** A garden reminder that announces a change of state (all of them but `come-back`). */
export type GardenChangeKind = Exclude<GardenReminderKind, 'come-back'>;

/** What the garden does on one day of the plan. */
export interface GardenDay {
  readonly date: LocalDate;
  /** The changes of state this day announces, before the "one a day" rule. Often none. */
  readonly changes: readonly GardenChangeKind[];
  /** `null` while the garden is not dead, 0 on the day it dies, then the days since. */
  readonly daysSinceDeath: number | null;
}

/**
 * The garden on every day from `DAYS_LOOKED_BACK` days ago to the day after the plan.
 *
 * A forecast started in the past is the real story up to today: the garden module counts
 * a day that was read when its turn comes, and each entry is exactly the garden computed
 * on that day. After today it is the garden "if nothing more is read".
 */
function gardenAroundThePlan(
  garden: ReminderGardenInput,
  today: LocalDate,
): readonly GardenForecastDay[] {
  // The forecast starts on the day after its `today`.
  const dayBeforeFirstDay = addDays(today, -(DAYS_LOOKED_BACK + 1));
  const dayCount = DAYS_LOOKED_BACK + REMINDERS_CONFIG.planHorizonDays + DAYS_LOOKED_AFTER_PLAN;
  return forecastGardenWithoutReading({ ...garden, today: dayBeforeFirstDay }, dayCount);
}

/** The garden enters `phase` because it got drier, not because reading brought it back. */
function hasDriedInto(phase: GardenPhase, before: GardenState, after: GardenState): boolean {
  return after.phase === phase && before.phase !== phase && after.droughtDays > before.droughtDays;
}

/** The garden reminders of a day, from the garden of the day before, that day and the next. */
function gardenChanges(
  dayBefore: GardenState,
  day: GardenState,
  dayAfter: GardenState,
): GardenChangeKind[] {
  const changes: GardenChangeKind[] = [];
  if (hasDriedInto('dead', day, dayAfter)) changes.push('last-chance');
  if (hasDriedInto('dead', dayBefore, day)) changes.push('dead');
  if (hasDriedInto('dying', dayBefore, day)) changes.push('dying');
  if (hasDriedInto('wilting', dayBefore, day)) changes.push('wilting');
  if (hasDriedInto('thirsty', dayBefore, day)) changes.push('thirsty');
  if (dayBefore.water === 'flowing' && day.water !== 'flowing') changes.push('water-stopped');
  return changes;
}

/** For each day looked at: how long the garden has been dead on that day, if it is. */
function daysSinceDeathEachDay(days: readonly GardenForecastDay[]): (number | null)[] {
  const counts: (number | null)[] = [];
  let daysSinceDeath: number | null = null;
  for (const [index, day] of days.entries()) {
    if (day.state.phase !== 'dead') daysSinceDeath = null;
    else if (index === 0) daysSinceDeath = DIED_BEFORE_DAYS_LOOKED_AT;
    else if (daysSinceDeath === null) daysSinceDeath = 0;
    else daysSinceDeath += 1;
    counts.push(daysSinceDeath);
  }
  return counts;
}

/**
 * One entry per day of the plan, from `today` on. Throws what the garden module throws on
 * an invalid garden input.
 */
export function describeGardenDays(garden: ReminderGardenInput, today: LocalDate): GardenDay[] {
  const days = gardenAroundThePlan(garden, today);
  const daysSinceDeath = daysSinceDeathEachDay(days);

  const planDays: GardenDay[] = [];
  for (const [index, day] of days.entries()) {
    const dayBefore = days[index - 1];
    const dayAfter = days[index + 1];
    const isBeforeThePlan = compareLocalDates(day.date, today) < 0;
    // The last day looked at has no day after: it is only the "day after" of the plan's last day.
    if (isBeforeThePlan || dayBefore === undefined || dayAfter === undefined) continue;
    planDays.push({
      date: day.date,
      changes: gardenChanges(dayBefore.state, day.state, dayAfter.state),
      daysSinceDeath: daysSinceDeath[index] ?? null,
    });
  }
  return planDays;
}
