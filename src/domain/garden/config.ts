/**
 * Tunable numbers of the garden, and their conversion to exact integer arithmetic.
 */
import type { GardenConfig } from './types';

export const DEFAULT_GARDEN_CONFIG: GardenConfig = Object.freeze({
  recoveryPerWateredDay: 0.2,
  // A missed day hurts quickly at first, then the garden declines slowly.
  // From full health the garden is dead on the 14th missed day in a row.
  missedDayCosts: Object.freeze([
    Object.freeze({ fromMissedDay: 1, cost: 0.1 }),
    Object.freeze({ fromMissedDay: 2, cost: 0.15 }),
    Object.freeze({ fromMissedDay: 4, cost: 0.07 }),
    Object.freeze({ fromMissedDay: 7, cost: 0.05 }),
  ]),
  thrivingMinHealth: 0.75,
  thirstyMinHealth: 0.5,
  wiltingMinHealth: 0.25,
  allElementsVisibleMinHealth: 0.25,
  dryWaterMinMissedDays: 3,
});

/**
 * Health is simulated in whole points, 100 points being full health.
 *
 * Adding 0.1 and 0.15 day after day in floating point drifts (0.1 + 0.2 !== 0.3), and a
 * health of "0.25" could then land just under the 0.25 threshold. Integers do not drift:
 * comparisons with the thresholds are exact.
 */
export const HEALTH_POINTS_AT_FULL_HEALTH = 100;

/** Float noise tolerated when checking that `value * 100` is a whole number. */
const WHOLE_POINTS_TOLERANCE = 1e-9;

/** The configuration, validated and converted to health points. */
export interface GardenRules {
  readonly recoveryPoints: number;
  readonly missedDayCosts: readonly { readonly fromMissedDay: number; readonly points: number }[];
  readonly thrivingMinPoints: number;
  readonly thirstyMinPoints: number;
  readonly wiltingMinPoints: number;
  readonly allElementsVisibleMinPoints: number;
  readonly dryWaterMinMissedDays: number;
}

export function healthFromPoints(points: number): number {
  return points / HEALTH_POINTS_AT_FULL_HEALTH;
}

/** Converts a 0..1 health fraction to points. Throws unless it is a whole number of points. */
function toHealthPoints(value: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`Garden config: ${name} must be between 0 and 1, got ${value}`);
  }
  const scaled = value * HEALTH_POINTS_AT_FULL_HEALTH;
  const points = Math.round(scaled);
  if (Math.abs(scaled - points) > WHOLE_POINTS_TOLERANCE) {
    throw new RangeError(
      `Garden config: ${name} must be a whole number of hundredths, got ${value}`,
    );
  }
  return points;
}

/**
 * Checks that a configuration makes sense and converts it to health points.
 * Throws a RangeError naming the first incoherent value.
 */
export function resolveGardenConfig(config: GardenConfig): GardenRules {
  const recoveryPoints = toHealthPoints(config.recoveryPerWateredDay, 'recoveryPerWateredDay');
  if (recoveryPoints === 0) {
    throw new RangeError('Garden config: recoveryPerWateredDay must be above 0');
  }

  if (!Array.isArray(config.missedDayCosts) || config.missedDayCosts.length === 0) {
    throw new RangeError('Garden config: missedDayCosts must list at least one tier');
  }
  let previousFromMissedDay = 0;
  const missedDayCosts = config.missedDayCosts.map((tier, index) => {
    const name = `missedDayCosts[${index}]`;
    const expectedStart = index === 0 ? 'exactly 1' : `above ${previousFromMissedDay}`;
    const startsWhereExpected =
      Number.isInteger(tier.fromMissedDay) &&
      (index === 0 ? tier.fromMissedDay === 1 : tier.fromMissedDay > previousFromMissedDay);
    if (!startsWhereExpected) {
      throw new RangeError(
        `Garden config: ${name}.fromMissedDay must be a whole number ${expectedStart}, got ${tier.fromMissedDay}`,
      );
    }
    previousFromMissedDay = tier.fromMissedDay;
    return { fromMissedDay: tier.fromMissedDay, points: toHealthPoints(tier.cost, `${name}.cost`) };
  });

  const thrivingMinPoints = toHealthPoints(config.thrivingMinHealth, 'thrivingMinHealth');
  const thirstyMinPoints = toHealthPoints(config.thirstyMinHealth, 'thirstyMinHealth');
  const wiltingMinPoints = toHealthPoints(config.wiltingMinHealth, 'wiltingMinHealth');
  const phasesAreOrdered =
    0 < wiltingMinPoints &&
    wiltingMinPoints < thirstyMinPoints &&
    thirstyMinPoints < thrivingMinPoints;
  if (!phasesAreOrdered) {
    throw new RangeError(
      'Garden config: expected 0 < wiltingMinHealth < thirstyMinHealth < thrivingMinHealth',
    );
  }

  const allElementsVisibleMinPoints = toHealthPoints(
    config.allElementsVisibleMinHealth,
    'allElementsVisibleMinHealth',
  );
  if (allElementsVisibleMinPoints === 0) {
    throw new RangeError('Garden config: allElementsVisibleMinHealth must be above 0');
  }

  if (!Number.isInteger(config.dryWaterMinMissedDays) || config.dryWaterMinMissedDays < 1) {
    throw new RangeError(
      `Garden config: dryWaterMinMissedDays must be a whole number of at least 1, got ${config.dryWaterMinMissedDays}`,
    );
  }

  return {
    recoveryPoints,
    missedDayCosts,
    thrivingMinPoints,
    thirstyMinPoints,
    wiltingMinPoints,
    allElementsVisibleMinPoints,
    dryWaterMinMissedDays: config.dryWaterMinMissedDays,
  };
}
