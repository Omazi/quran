/**
 * The garden engine: from reading progress to the state a renderer displays.
 *
 * Two independent ideas meet here:
 * - what the user has EARNED: one element per finished hizb, never lost;
 * - how ALIVE the garden is: a drought that grows on missed days and recedes with
 *   reading, and that decides how much of what was earned is currently visible.
 */
import { HIZB_COUNT } from '@/domain/quran/types';
import { addDays } from '@/domain/shared/local-date';

import { assertValidCatalog } from './catalog';
import { isObject } from './checks';
import { checkedConfig, DEFAULT_GARDEN_CONFIG, dyingStepCount, healthOf } from './config';
import { buildDayHistory, type ViewDay } from './day-history';
import { NEW_GARDEN_VITALS, vitalsSeenEachDay, type Vitals } from './drought';
import type {
  GardenConfig,
  GardenElement,
  GardenForecastDay,
  GardenInput,
  GardenPhase,
  GardenState,
  GardenVariant,
  WaterState,
} from './types';
import { assertValidVariant, catalogForVariant } from './variant';

/**
 * Longest forecast accepted, in days. The reminders need 30; the limit only stops a
 * horizon given in the wrong unit from building a gigantic list.
 */
export const MAX_FORECAST_DAYS = 366;

/** The part of the input that does not depend on the calendar, once checked. */
interface CheckedGarden {
  readonly hizbCompleted: number;
  readonly currentHizbProgress: number;
  readonly variant: GardenVariant;
  readonly catalog: readonly GardenElement[];
  readonly config: GardenConfig;
}

/** What the calendar says about the day being described. */
interface DayFacts {
  readonly vitals: Vitals;
  readonly daysSinceLastWatered: number | null;
  readonly isPaused: boolean;
}

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

/** The two dates of the garden's life must tell the same story as the number of hizb. */
function assertLifeDatesMatchProgress(input: GardenInput): void {
  const { hizbCompleted, firstHizbCompletedOn, completedOn } = input;
  if (hizbCompleted > 0 && firstHizbCompletedOn === null) {
    throw new RangeError('Garden: firstHizbCompletedOn is required once a hizb is finished');
  }
  if (hizbCompleted === 0 && firstHizbCompletedOn !== null) {
    throw new RangeError('Garden: firstHizbCompletedOn must be null while no hizb is finished');
  }
  if (hizbCompleted < HIZB_COUNT && completedOn !== null) {
    throw new RangeError(
      `Garden: completedOn must be null until the ${HIZB_COUNT} hizb are finished`,
    );
  }
}

function checkGarden(input: GardenInput): CheckedGarden {
  if (!isObject(input)) throw new TypeError('Garden: expected an input object');
  const { hizbCompleted, currentHizbProgress, variant } = input;
  assertHizbCompleted(hizbCompleted);
  assertHizbProgress(currentHizbProgress);
  assertLifeDatesMatchProgress(input);
  assertValidVariant(variant);
  const config = checkedConfig(input.config);
  // The built-in catalogues were already checked when the module loaded.
  if (input.catalog !== undefined) assertValidCatalog(input.catalog);
  const catalog = input.catalog ?? catalogForVariant(variant);
  return { hizbCompleted, currentHizbProgress, variant, catalog, config };
}

function phaseOf(hizbCompleted: number, droughtDays: number, config: GardenConfig): GardenPhase {
  if (hizbCompleted === 0) return 'bare';
  if (droughtDays >= config.droughtDaysToDeath) return 'dead';
  if (droughtDays >= config.dyingMinDroughtDays) return 'dying';
  if (droughtDays >= config.wiltingMinDroughtDays) return 'wilting';
  if (droughtDays >= config.thirstyMinDroughtDays) return 'thirsty';
  return 'thriving';
}

/** A day read today resets the run of missed days, so the water flows again the same day. */
function waterOf(
  hizbCompleted: number,
  missedDaysInARow: number,
  config: GardenConfig,
): WaterState {
  // The channels come with the first hizb: a bare earth has no water yet.
  if (hizbCompleted === 0) return 'dry';
  if (missedDaysInARow === 0) return 'flowing';
  if (missedDaysInARow < config.dryWaterMinMissedDays) return 'still';
  return 'dry';
}

/**
 * How many of the unlocked elements are drawn: all of them until the garden is dying,
 * then one equal share less with each drought day (4, 3, 2, 1 fifths), none once dead.
 *
 * Rounded up on purpose: a garden that is not dead always shows at least one element, so
 * the first reading after its death always brings something back.
 */
function visibleElementCount(
  unlockedCount: number,
  droughtDays: number,
  config: GardenConfig,
): number {
  if (droughtDays < config.dyingMinDroughtDays) return unlockedCount;
  const droughtDaysLeft = config.droughtDaysToDeath - droughtDays;
  return Math.ceil((unlockedCount * droughtDaysLeft) / dyingStepCount(config));
}

/** The single place where a `GardenState` is put together. */
function describeGarden(garden: CheckedGarden, day: DayFacts): GardenState {
  const { hizbCompleted, catalog, config } = garden;
  const { droughtDays, missedDaysInARow } = day.vitals;
  const visibleCount = visibleElementCount(hizbCompleted, droughtDays, config);
  // Elements are stored in hizb order: the element of hizb n sits at index n - 1.
  const lastUnlocked = catalog[hizbCompleted - 1] ?? null;
  const growingElement = catalog[hizbCompleted] ?? null;

  return {
    hizbCompleted,
    droughtDays,
    health: healthOf(droughtDays, config),
    phase: phaseOf(hizbCompleted, droughtDays, config),
    water: waterOf(hizbCompleted, missedDaysInARow, config),
    missedDaysInARow,
    daysSinceLastWatered: day.daysSinceLastWatered,
    visibleElements: catalog.slice(0, visibleCount),
    lastUnlocked,
    nextElement:
      growingElement === null
        ? null
        : {
            element: growingElement,
            growth: garden.currentHizbProgress,
            // The newest arrival goes first: drawn only while no unlocked element is hidden.
            isVisible: visibleCount === hizbCompleted,
          },
    isComplete: hizbCompleted === HIZB_COUNT,
    isPausedToday: day.isPaused,
    variant: garden.variant,
  };
}

/** The garden today, then on each of the following days if nothing more is read. */
interface GardenOutlook {
  readonly today: GardenState;
  readonly comingDays: readonly GardenState[];
}

function describeFromToday(input: GardenInput, daysAhead: number): GardenOutlook {
  const garden = checkGarden(input);
  const history = buildDayHistory({
    firstHizbCompletedOn: input.firstHizbCompletedOn,
    completedOn: input.completedOn,
    today: input.today,
    daysAhead,
    wateredDays: input.wateredDays,
    pauses: input.pauses,
  });

  // One pass over the life of the garden, whatever the number of days described.
  const vitalsSeen = vitalsSeenEachDay(history.lifeDays, garden.config);
  const describe = (viewDay: ViewDay): GardenState => {
    const lifeVitals = viewDay.lifeDayIndex === null ? undefined : vitalsSeen[viewDay.lifeDayIndex];
    return describeGarden(garden, {
      // Outside its life (before its first hizb, or once complete) the garden is intact.
      vitals: lifeVitals ?? NEW_GARDEN_VITALS,
      daysSinceLastWatered: viewDay.daysSinceLastWatered,
      isPaused: viewDay.isPaused,
    });
  };

  return { today: describe(history.today), comingDays: history.comingDays.map(describe) };
}

/**
 * Computes the garden to display today.
 *
 * Pure: the same input always gives the same state, and nothing reads the clock.
 * Throws a RangeError or a TypeError on invalid input; never because a date is later
 * than today (see day-history.ts).
 */
export function computeGardenState(input: GardenInput): GardenState {
  return describeFromToday(input, 0).today;
}

/**
 * The garden on each of the next `dayCount` days if the user reads nothing more: entry 0
 * is tomorrow, entry `dayCount - 1` is `dayCount` days from today.
 *
 * Each state is exactly what `computeGardenState` returns for the same input when that
 * day is today. The whole forecast costs a single pass over the life of the garden,
 * whatever `dayCount`.
 */
export function forecastGardenWithoutReading(
  input: GardenInput,
  dayCount: number,
): readonly GardenForecastDay[] {
  if (!Number.isInteger(dayCount) || dayCount < 0 || dayCount > MAX_FORECAST_DAYS) {
    throw new RangeError(
      `Garden: dayCount must be a whole number from 0 to ${MAX_FORECAST_DAYS}, got ${dayCount}`,
    );
  }
  return describeFromToday(input, dayCount).comingDays.map((state, index) => ({
    date: addDays(input.today, index + 1),
    state,
  }));
}

/**
 * The garden of a finished khatma: the 60 elements, no drought, flowing water. It is the
 * picture carried by the badge of that khatma, so it needs no history and never changes
 * afterwards. It is also what `computeGardenState` shows from the completion day on.
 */
export function completedGardenState(variant: GardenVariant): GardenState {
  const garden: CheckedGarden = {
    hizbCompleted: HIZB_COUNT,
    currentHizbProgress: 0,
    variant,
    // Checks the variant too.
    catalog: catalogForVariant(variant),
    config: DEFAULT_GARDEN_CONFIG,
  };
  // As on a day the user has read: the last page was read on the day the khatma ended.
  return describeGarden(garden, {
    vitals: NEW_GARDEN_VITALS,
    daysSinceLastWatered: 0,
    isPaused: false,
  });
}
