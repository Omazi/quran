/**
 * The garden engine: from reading progress to the state a renderer displays.
 *
 * Two independent ideas meet here:
 * - what the user has EARNED: one element per finished hizb, never lost;
 * - how ALIVE the garden is: a health that falls on missed days and comes back with
 *   reading, and that decides how much of what was earned is currently visible.
 */
import { HIZB_COUNT } from '@/domain/quran/types';

import { assertValidCatalog, GARDEN_CATALOG } from './catalog';
import {
  DEFAULT_GARDEN_CONFIG,
  healthFromPoints,
  HEALTH_POINTS_AT_FULL_HEALTH,
  resolveGardenConfig,
  type GardenRules,
} from './config';
import { buildDayHistory } from './day-history';
import { simulateHealth } from './health';
import type { GardenInput, GardenPhase, GardenState, WaterState } from './types';

function assertHizbCompleted(hizbCompleted: number): void {
  if (!Number.isInteger(hizbCompleted) || hizbCompleted < 0 || hizbCompleted > HIZB_COUNT) {
    throw new RangeError(
      `Garden: hizbCompleted must be a whole number from 0 to ${HIZB_COUNT}, got ${hizbCompleted}`,
    );
  }
}

function assertHizbProgress(currentHizbProgress: number): void {
  const isFraction =
    typeof currentHizbProgress === 'number' && currentHizbProgress >= 0 && currentHizbProgress <= 1;
  if (!isFraction) {
    throw new RangeError(
      `Garden: currentHizbProgress must be between 0 and 1, got ${currentHizbProgress}`,
    );
  }
}

function phaseOf(hizbCompleted: number, healthPoints: number, rules: GardenRules): GardenPhase {
  if (hizbCompleted === 0) return 'bare';
  if (healthPoints >= rules.thrivingMinPoints) return 'thriving';
  if (healthPoints >= rules.thirstyMinPoints) return 'thirsty';
  if (healthPoints >= rules.wiltingMinPoints) return 'wilting';
  if (healthPoints > 0) return 'dying';
  return 'dead';
}

function waterOf(missedDaysInARow: number, rules: GardenRules): WaterState {
  if (missedDaysInARow === 0) return 'flowing';
  if (missedDaysInARow < rules.dryWaterMinMissedDays) return 'still';
  return 'dry';
}

/** How many of the unlocked elements are drawn: all of them, or fewer as the garden dies. */
function visibleElementCount(
  unlockedCount: number,
  healthPoints: number,
  rules: GardenRules,
): number {
  if (healthPoints >= rules.allElementsVisibleMinPoints) return unlockedCount;
  return Math.floor((unlockedCount * healthPoints) / rules.allElementsVisibleMinPoints);
}

/**
 * Computes the garden to display today.
 *
 * Pure: the same input always gives the same state, and nothing reads the clock.
 * Throws a RangeError on invalid input (see README).
 */
export function computeGardenState(input: GardenInput): GardenState {
  const { hizbCompleted, currentHizbProgress } = input;
  assertHizbCompleted(hizbCompleted);
  assertHizbProgress(currentHizbProgress);
  const rules = resolveGardenConfig(input.config ?? DEFAULT_GARDEN_CONFIG);
  const catalog = input.catalog ?? GARDEN_CATALOG;
  // The built-in catalogue was already checked when the module loaded.
  if (catalog !== GARDEN_CATALOG) assertValidCatalog(catalog);

  const history = buildDayHistory(input.startDate, input.today, input.wateredDays, input.pauses);
  const simulation = simulateHealth(history.days, rules);
  // With no hizb finished there is nothing to damage yet: bare earth stays at full health.
  const healthPoints = hizbCompleted === 0 ? HEALTH_POINTS_AT_FULL_HEALTH : simulation.healthPoints;

  const isComplete = hizbCompleted === HIZB_COUNT;
  // Elements are stored in hizb order: the element of hizb n sits at index n - 1.
  const lastUnlocked = catalog[hizbCompleted - 1] ?? null;
  const nextElement = catalog[hizbCompleted] ?? null;

  return {
    hizbCompleted,
    health: healthFromPoints(healthPoints),
    phase: phaseOf(hizbCompleted, healthPoints, rules),
    water: waterOf(simulation.missedDaysInARow, rules),
    missedDaysInARow: simulation.missedDaysInARow,
    daysSinceLastWatered: history.daysSinceLastWatered,
    visibleElements: catalog.slice(0, visibleElementCount(hizbCompleted, healthPoints, rules)),
    lastUnlocked,
    nextElement: nextElement ? { element: nextElement, growth: currentHizbProgress } : null,
    isComplete,
    isPausedToday: history.isPausedToday,
  };
}
