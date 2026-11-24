/**
 * Properties the specification asks to guarantee, checked on many random histories.
 * Histories come from a seeded generator: every run replays exactly the same cases.
 */
import { addDays } from '@/domain/shared/local-date';

import {
  computeGardenState,
  DEFAULT_GARDEN_CONFIG,
  GARDEN_CATALOG,
  type GardenConfig,
  type GardenInput,
  type MissedDayCostTier,
} from '../index';
import {
  createSeededRandom,
  gardenInput,
  randomInteger,
  randomTimeline,
  randomTodayKind,
  type TodayKind,
} from '../test-support/garden-test-kit';

const RANDOM_HISTORY_COUNT = 600;
const LONGEST_RANDOM_HISTORY_IN_DAYS = 400;

interface RandomHistory {
  readonly past: string;
  readonly today: TodayKind;
  readonly hizbCompleted: number;
  readonly input: GardenInput;
}

/** Runs `check` on many random histories; a failure names the history that broke it. */
function forEachRandomHistory(seed: number, check: (history: RandomHistory) => void): void {
  const random = createSeededRandom(seed);
  for (let index = 0; index < RANDOM_HISTORY_COUNT; index += 1) {
    const past = randomTimeline(random, LONGEST_RANDOM_HISTORY_IN_DAYS);
    const today = randomTodayKind(random);
    // Mostly gardens with something to damage, sometimes bare earth or a complete garden.
    const hizbCompleted = random() < 0.1 ? 0 : randomInteger(random, 1, 60);
    const currentHizbProgress = randomInteger(random, 0, 100) / 100;
    const input = gardenInput(past, today, { hizbCompleted, currentHizbProgress });
    try {
      check({ past, today, hizbCompleted, input });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Seed ${seed}, history #${index} (hizb ${hizbCompleted}, today ${today}, past "${past}"): ${reason}`,
      );
    }
  }
}

function hundredths(health: number): number {
  return Math.round(health * 100);
}

/**
 * The health rules of the specification, written a second time in the most literal way:
 * calendar dates, fractions, one day after the other. Slow and naive on purpose, to
 * cross-check the real engine.
 */
function referenceHealth(input: GardenInput): number {
  if (input.hizbCompleted === 0) return 1;
  let health = 1;
  let missedInARow = 0;
  for (let day = input.startDate; day <= input.today; day = addDays(day, 1)) {
    const currentDay = day;
    const isWatered = input.wateredDays.has(currentDay);
    const isPaused = input.pauses.some(
      (pause) => pause.from <= currentDay && currentDay <= pause.to,
    );
    if (isWatered) {
      health = Math.min(1, health + 0.2);
      missedInARow = 0;
    } else if (currentDay !== input.today && !isPaused) {
      missedInARow += 1;
      const cost =
        missedInARow === 1 ? 0.1 : missedInARow <= 3 ? 0.15 : missedInARow <= 6 ? 0.07 : 0.05;
      health = Math.max(0, health - cost);
    }
    health = Math.round(health * 100) / 100;
  }
  return health;
}

function randomConfig(random: () => number): GardenConfig {
  const missedDayCosts: MissedDayCostTier[] = [];
  let fromMissedDay = 1;
  const tierCount = randomInteger(random, 1, 5);
  for (let tier = 0; tier < tierCount; tier += 1) {
    missedDayCosts.push({ fromMissedDay, cost: randomInteger(random, 0, 100) / 100 });
    fromMissedDay += randomInteger(random, 1, 6);
  }
  return {
    ...DEFAULT_GARDEN_CONFIG,
    recoveryPerWateredDay: randomInteger(random, 1, 100) / 100,
    missedDayCosts,
  };
}

describe('property: health stays within [0, 1] whatever the history', () => {
  it('holds with the default configuration, in whole hundredths', () => {
    forEachRandomHistory(2026, ({ input }) => {
      const { health } = computeGardenState(input);
      expect(health).toBeGreaterThanOrEqual(0);
      expect(health).toBeLessThanOrEqual(1);
      expect(health).toBe(hundredths(health) / 100);
    });
  });

  it('holds with any coherent configuration', () => {
    const configRandom = createSeededRandom(7);
    forEachRandomHistory(11, ({ input }) => {
      const { health } = computeGardenState({ ...input, config: randomConfig(configRandom) });
      expect(health).toBeGreaterThanOrEqual(0);
      expect(health).toBeLessThanOrEqual(1);
    });
  });

  it('matches a literal day-by-day reading of the specification', () => {
    forEachRandomHistory(60, ({ input }) => {
      expect(computeGardenState(input).health).toBe(referenceHealth(input));
    });
  });
});

describe("property: adding a watered day never lowers that day's health", () => {
  // Every random history ends on a random day: "today" stands for any day of a history.
  it('reading today never lowers the health of the day, and gives +0.20 capped at 1', () => {
    forEachRandomHistory(24, ({ past, hizbCompleted }) => {
      if (hizbCompleted === 0) return;
      for (const [unread, read] of [
        ['unread', 'read'],
        ['paused-unread', 'paused-read'],
      ] as const) {
        const before = computeGardenState(gardenInput(past, unread, { hizbCompleted }));
        const after = computeGardenState(gardenInput(past, read, { hizbCompleted }));
        expect(after.health).toBeGreaterThanOrEqual(before.health);
        expect(hundredths(after.health)).toBe(Math.min(100, hundredths(before.health) + 20));
      }
    });
  });

  it('reading today never hides an element nor dries the water', () => {
    forEachRandomHistory(25, ({ past, hizbCompleted }) => {
      const before = computeGardenState(gardenInput(past, 'unread', { hizbCompleted }));
      const after = computeGardenState(gardenInput(past, 'read', { hizbCompleted }));
      expect(after.visibleElements.length).toBeGreaterThanOrEqual(before.visibleElements.length);
      expect(after.water).toBe('flowing');
      expect(after.missedDaysInARow).toBe(0);
    });
  });

  // CONTESTED in README.md. Read as "an extra watered day anywhere in the past never
  // lowers TODAY's health", the property contradicts the cost table of the specification:
  // a missed day costs less deep in a long run (0.05) than just after a watered day
  // (0.10 then 0.15). This test pins the behaviour of the rules as written, so that the
  // day the rules change, the change is noticed.
  it('KNOWN LIMIT of the specified costs: a watered day in the past can lower a later health', () => {
    const neverRead = computeGardenState(gardenInput('MMMMM M MMMMMM'));
    const readOnce = computeGardenState(gardenInput('MMMMM W MMMMMM'));
    expect(neverRead.health).toBe(0.09);
    expect(readOnce.health).toBe(0.05);

    // Same effect on the phase: the garden of the user who read once dies a day earlier.
    expect(computeGardenState(gardenInput('MMMMMM M MMMMMM')).phase).toBe('dying');
    expect(computeGardenState(gardenInput('MMMMMM W MMMMMM')).phase).toBe('dead');
  });
});

describe('property: visible elements never exceed unlocked elements', () => {
  it('shows at most hizbCompleted elements, always the first ones of the catalogue', () => {
    forEachRandomHistory(3, ({ input, hizbCompleted }) => {
      const state = computeGardenState(input);
      expect(state.visibleElements.length).toBeLessThanOrEqual(hizbCompleted);
      expect(state.visibleElements).toEqual(GARDEN_CATALOG.slice(0, state.visibleElements.length));
    });
  });

  it('shows all of them from a health of 0.25, fewer below, none at 0', () => {
    forEachRandomHistory(4, ({ input, hizbCompleted }) => {
      const state = computeGardenState(input);
      if (state.health >= 0.25) expect(state.visibleElements).toHaveLength(hizbCompleted);
      else expect(state.visibleElements.length).toBeLessThan(hizbCompleted);
      if (state.health === 0) expect(state.visibleElements).toHaveLength(0);
    });
  });
});

describe('property: the outputs agree with each other', () => {
  it('derives phase and water from health and missed days, on every history', () => {
    forEachRandomHistory(5, ({ input, hizbCompleted }) => {
      const state = computeGardenState(input);

      const expectedPhase =
        hizbCompleted === 0
          ? 'bare'
          : state.health >= 0.75
            ? 'thriving'
            : state.health >= 0.5
              ? 'thirsty'
              : state.health >= 0.25
                ? 'wilting'
                : state.health > 0
                  ? 'dying'
                  : 'dead';
      expect(state.phase).toBe(expectedPhase);

      const expectedWater =
        state.missedDaysInARow === 0 ? 'flowing' : state.missedDaysInARow < 3 ? 'still' : 'dry';
      expect(state.water).toBe(expectedWater);

      // Three missed days in a row cost 0.40: a garden with dry water cannot be thriving.
      if (state.water === 'dry' && hizbCompleted > 0) expect(state.health).toBeLessThanOrEqual(0.6);
      if (state.daysSinceLastWatered === 0) expect(state.missedDaysInARow).toBe(0);
      expect(state.lastUnlocked?.hizb ?? 0).toBe(hizbCompleted);
      expect(state.nextElement?.element.hizb ?? 61).toBe(hizbCompleted + 1);
    });
  });
});

describe('property: same input, same output (no dependency on the clock)', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns equal states for equal inputs', () => {
    forEachRandomHistory(6, ({ past, today, input }) => {
      const first = computeGardenState(input);
      const second = computeGardenState(input);
      const rebuilt = computeGardenState(
        gardenInput(past, today, {
          hizbCompleted: input.hizbCompleted,
          currentHizbProgress: input.currentHizbProgress,
        }),
      );
      expect(second).toEqual(first);
      expect(rebuilt).toEqual(first);
    });
  });

  it('does not depend on the order in which watered days and pauses are given', () => {
    forEachRandomHistory(8, ({ input }) => {
      const reversed: GardenInput = {
        ...input,
        wateredDays: new Set([...input.wateredDays].reverse()),
        pauses: [...input.pauses].reverse(),
      };
      expect(computeGardenState(reversed)).toEqual(computeGardenState(input));
    });
  });

  it('gives the same state whatever the system clock says', () => {
    const input = gardenInput('WW MMM PP W MMMM', 'unread', { currentHizbProgress: 0.3 });

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2001-01-01T00:00:00Z'));
    const inThePast = computeGardenState(input);
    jest.setSystemTime(new Date('2099-12-31T23:59:59Z'));
    const inTheFuture = computeGardenState(input);

    expect(inTheFuture).toEqual(inThePast);
  });

  it('never asks the clock for the current time', () => {
    const now = jest.spyOn(Date, 'now');
    computeGardenState(gardenInput('WW MMM PP W MMMM', 'read'));
    expect(now).not.toHaveBeenCalled();
  });
});
