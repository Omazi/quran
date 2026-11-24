/**
 * The health of the garden: a day-by-day simulation from the garden's first day to today.
 *
 * This file knows nothing about dates: it receives the days already sorted into
 * "watered", "paused" or "missed" (see day-history.ts) and walks through them once.
 */
import { HEALTH_POINTS_AT_FULL_HEALTH, type GardenRules } from './config';

/** What happened on one day of the garden's life. */
export type DayKind = 'watered' | 'paused' | 'missed';

export interface HealthOutcome {
  /** 0..HEALTH_POINTS_AT_FULL_HEALTH. */
  readonly healthPoints: number;
  /** Length of the run of missed days still open after the last simulated day. */
  readonly missedDaysInARow: number;
}

/** Health points lost on the `missedDayRank`-th missed day in a row (1-based). */
export function missedDayCostPoints(missedDayRank: number, rules: GardenRules): number {
  let cost = 0;
  for (const tier of rules.missedDayCosts) {
    if (tier.fromMissedDay > missedDayRank) break;
    cost = tier.points;
  }
  return cost;
}

/**
 * Walks through `days` in order, starting from full health.
 * One pass, a few integer operations per day: ten years of history cost nothing.
 */
export function simulateHealth(days: readonly DayKind[], rules: GardenRules): HealthOutcome {
  let healthPoints = HEALTH_POINTS_AT_FULL_HEALTH;
  let missedDaysInARow = 0;

  for (const day of days) {
    if (day === 'watered') {
      healthPoints = Math.min(HEALTH_POINTS_AT_FULL_HEALTH, healthPoints + rules.recoveryPoints);
      missedDaysInARow = 0;
    } else if (day === 'missed') {
      missedDaysInARow += 1;
      healthPoints = Math.max(0, healthPoints - missedDayCostPoints(missedDaysInARow, rules));
    }
    // A paused day freezes the garden: neither the health nor the run of missed days moves.
  }

  return { healthPoints, missedDaysInARow };
}
