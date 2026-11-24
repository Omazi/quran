/**
 * Tunable numbers of the garden: the values of docs/specs/garden.md, and their checks.
 */
import { isObject } from './checks';
import type { GardenConfig } from './types';

export const DEFAULT_GARDEN_CONFIG: GardenConfig = Object.freeze({
  // Two weeks without reading turn the garden into a dead earth.
  droughtDaysToDeath: 14,
  // A watered day takes back three missed days: from a dead earth, five days of reading
  // bring the garden back to full health.
  droughtDaysRecoveredPerWateredDay: 3,
  thirstyMinDroughtDays: 3,
  wiltingMinDroughtDays: 6,
  dyingMinDroughtDays: 10,
  dryWaterMinMissedDays: 3,
});

function assertWholeDays(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(
      `Garden config: ${name} must be a whole number of at least 1, got ${value}`,
    );
  }
}

/**
 * Throws unless a configuration makes sense: whole numbers of days, and phases that
 * follow each other (thriving, thirsty, wilting, dying, dead).
 */
export function assertValidConfig(config: GardenConfig): void {
  if (!isObject(config)) {
    throw new TypeError('Garden config: expected a configuration object');
  }
  assertWholeDays(config.droughtDaysToDeath, 'droughtDaysToDeath');
  assertWholeDays(config.droughtDaysRecoveredPerWateredDay, 'droughtDaysRecoveredPerWateredDay');
  assertWholeDays(config.thirstyMinDroughtDays, 'thirstyMinDroughtDays');
  assertWholeDays(config.wiltingMinDroughtDays, 'wiltingMinDroughtDays');
  assertWholeDays(config.dyingMinDroughtDays, 'dyingMinDroughtDays');
  assertWholeDays(config.dryWaterMinMissedDays, 'dryWaterMinMissedDays');

  const phasesFollowEachOther =
    config.thirstyMinDroughtDays < config.wiltingMinDroughtDays &&
    config.wiltingMinDroughtDays < config.dyingMinDroughtDays &&
    config.dyingMinDroughtDays < config.droughtDaysToDeath;
  if (!phasesFollowEachOther) {
    throw new RangeError(
      'Garden config: expected thirstyMinDroughtDays < wiltingMinDroughtDays < dyingMinDroughtDays < droughtDaysToDeath',
    );
  }
}

// A broken default configuration must stop the app at start-up.
assertValidConfig(DEFAULT_GARDEN_CONFIG);

/** The configuration to apply: `config` once checked, or the default one when none is given. */
export function checkedConfig(config: GardenConfig | undefined): GardenConfig {
  if (config === undefined || config === DEFAULT_GARDEN_CONFIG) return DEFAULT_GARDEN_CONFIG;
  assertValidConfig(config);
  return config;
}

/** Health, from 1 (no drought) down to 0 (dead). */
export function healthOf(droughtDays: number, config: GardenConfig): number {
  return 1 - droughtDays / config.droughtDaysToDeath;
}

/**
 * Number of equal steps in which a dying garden loses its elements: with the default
 * values, 5 (drought 10, 11, 12, 13 leave 4, 3, 2, 1 fifths, rounded up; 14 leaves nothing).
 */
export function dyingStepCount(config: GardenConfig): number {
  return config.droughtDaysToDeath - config.dyingMinDroughtDays + 1;
}
