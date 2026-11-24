/**
 * The drought of the garden, one day at a time.
 *
 * This file knows nothing about dates: it receives days already sorted into watered,
 * paused or missed (see day-history.ts) and says what each of them does to the garden.
 *
 * Reading can never harm: each kind of day turns "more drought" into "more drought or the
 * same", and a watered day always leaves less drought than a paused day, which leaves
 * less than a missed day. Replacing a missed day by a watered one therefore cannot make
 * any later day worse.
 */
import type { GardenDay } from './day-history';
import type { GardenConfig } from './types';

/** What the simulation carries from one day to the next. */
export interface Vitals {
  /** 0..droughtDaysToDeath. */
  readonly droughtDays: number;
  /** Length of the run of missed days still open. It drives the water. */
  readonly missedDaysInARow: number;
}

/** A garden starts without drought and without missed day. */
export const NEW_GARDEN_VITALS: Vitals = Object.freeze({ droughtDays: 0, missedDaysInARow: 0 });

/** The garden once `day` is over. */
export function vitalsAfterDay(vitals: Vitals, day: GardenDay, config: GardenConfig): Vitals {
  // Checked first on purpose: a day read during a pause is a watered day.
  if (day.isWatered) {
    return {
      droughtDays: Math.max(0, vitals.droughtDays - config.droughtDaysRecoveredPerWateredDay),
      missedDaysInARow: 0,
    };
  }
  // A paused day freezes the garden: neither the drought nor the run of missed days moves.
  if (day.isPaused) return vitals;

  return {
    droughtDays: Math.min(config.droughtDaysToDeath, vitals.droughtDays + 1),
    missedDaysInARow: vitals.missedDaysInARow + 1,
  };
}

/**
 * The garden while `day` is still in progress. A day in progress never penalises: it
 * counts as soon as it is watered, and only becomes a missed day once it is over.
 */
export function vitalsDuringDay(vitals: Vitals, day: GardenDay, config: GardenConfig): Vitals {
  return day.isWatered ? vitalsAfterDay(vitals, day, config) : vitals;
}

/**
 * Walks through the life of the garden once and returns, for each of its days, the garden
 * as it is seen during that day. A few integer operations per day.
 */
export function vitalsSeenEachDay(lifeDays: readonly GardenDay[], config: GardenConfig): Vitals[] {
  const seen: Vitals[] = [];
  let vitals = NEW_GARDEN_VITALS;
  for (const day of lifeDays) {
    seen.push(vitalsDuringDay(vitals, day, config));
    vitals = vitalsAfterDay(vitals, day, config);
  }
  return seen;
}
