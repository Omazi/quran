/**
 * Properties the specification asks to guarantee.
 *
 * "Reading never harms" is checked on EVERY history of a given length, not on a sample.
 * The other properties are checked on many random histories, drawn from a seeded
 * generator: every run replays exactly the same cases.
 */
import { addDays } from '@/domain/shared/local-date';

import { NEW_GARDEN_VITALS, vitalsAfterDay, type Vitals } from '../drought';
import {
  computeGardenState,
  DEFAULT_GARDEN_CONFIG,
  GARDEN_CATALOG,
  type GardenConfig,
  type GardenInput,
  type GardenState,
} from '../index';
import {
  createSeededRandom,
  GARDEN_FIRST_DAY,
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
    // Mostly living gardens, sometimes a bare earth or a garden with its 60 hizb.
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

/**
 * The drought rules of the specification, written a second time in the most literal way:
 * calendar dates, one day after the other. Slow and naive on purpose, to cross-check the
 * real engine.
 */
function referenceDrought(input: GardenInput): number {
  if (input.firstHizbCompletedOn === null) return 0;
  let drought = 0;
  for (let day = input.firstHizbCompletedOn; day <= input.today; day = addDays(day, 1)) {
    const currentDay = day;
    const isWatered = input.wateredDays.has(currentDay);
    const isPaused = input.pauses.some(
      (pause) => pause.from <= currentDay && currentDay <= pause.to,
    );
    if (isWatered) drought = Math.max(0, drought - 3);
    else if (currentDay !== input.today && !isPaused) drought = Math.min(14, drought + 1);
  }
  return drought;
}

function randomConfig(random: () => number): GardenConfig {
  const thirstyMinDroughtDays = randomInteger(random, 1, 4);
  const wiltingMinDroughtDays = thirstyMinDroughtDays + randomInteger(random, 1, 4);
  const dyingMinDroughtDays = wiltingMinDroughtDays + randomInteger(random, 1, 4);
  return {
    droughtDaysToDeath: dyingMinDroughtDays + randomInteger(random, 1, 6),
    droughtDaysRecoveredPerWateredDay: randomInteger(random, 1, 8),
    thirstyMinDroughtDays,
    wiltingMinDroughtDays,
    dyingMinDroughtDays,
    dryWaterMinMissedDays: randomInteger(random, 1, 5),
  };
}

describe('property: drought stays within 0..14 and health within [0, 1], whatever the history', () => {
  it('holds with the default configuration, and health is 1 - droughtDays / 14', () => {
    forEachRandomHistory(2026, ({ input }) => {
      const { droughtDays, health } = computeGardenState(input);
      expect(Number.isInteger(droughtDays)).toBe(true);
      expect(droughtDays).toBeGreaterThanOrEqual(0);
      expect(droughtDays).toBeLessThanOrEqual(14);
      expect(health).toBeGreaterThanOrEqual(0);
      expect(health).toBeLessThanOrEqual(1);
      expect(health).toBe(1 - droughtDays / 14);
    });
  });

  it('holds with any coherent configuration', () => {
    const configRandom = createSeededRandom(7);
    forEachRandomHistory(11, ({ input }) => {
      const config = randomConfig(configRandom);
      const { droughtDays, health } = computeGardenState({ ...input, config });
      expect(droughtDays).toBeGreaterThanOrEqual(0);
      expect(droughtDays).toBeLessThanOrEqual(config.droughtDaysToDeath);
      expect(health).toBeGreaterThanOrEqual(0);
      expect(health).toBeLessThanOrEqual(1);
    });
  });

  it('matches a literal day-by-day reading of the specification', () => {
    forEachRandomHistory(60, ({ input }) => {
      expect(computeGardenState(input).droughtDays).toBe(referenceDrought(input));
    });
  });
});

describe('property: reading never harms', () => {
  const DAY_KINDS = ['W', 'M', 'P'] as const;
  const HISTORY_LENGTH = 8;
  /** Gardens the histories start from: just born, already wilting, dead earth. */
  const PREAMBLES = ['', 'M'.repeat(6), 'M'.repeat(14)];

  /** Every history of `length` days, each day being watered, missed or paused. */
  function everyHistory(length: number): string[] {
    let histories = [''];
    for (let day = 0; day < length; day += 1) {
      histories = histories.flatMap((history) => DAY_KINDS.map((kind) => history + kind));
    }
    return histories;
  }

  /**
   * The garden once every day of `history` is over, computed by the real engine.
   * Kept in a table: the same beginnings of history come back thousands of times.
   */
  const seenStates = new Map<string, GardenState>();
  function stateAfter(history: string): GardenState {
    const known = seenStates.get(history);
    if (known) return known;
    const state = computeGardenState(gardenInput(history, 'unread', { hizbCompleted: 60 }));
    seenStates.set(history, state);
    return state;
  }

  it('lists every history: 3 to the power of 8, three times', () => {
    expect(everyHistory(HISTORY_LENGTH)).toHaveLength(6561);
    expect(new Set(everyHistory(HISTORY_LENGTH)).size).toBe(6561);
  });

  // In every history, replacing a missed day by a watered day or by a pause never raises
  // the drought on that day nor on any later day. Nothing is sampled: every history of 8
  // days, every missed day in it, every later day, from three different starting gardens.
  it.each(PREAMBLES)(
    'replacing a missed day by a watered day or a pause never raises the drought of any later day (start: "%s")',
    (preamble) => {
      let comparisons = 0;
      for (const history of everyHistory(HISTORY_LENGTH)) {
        for (let changedDay = 0; changedDay < HISTORY_LENGTH; changedDay += 1) {
          if (history[changedDay] !== 'M') continue;
          for (const replacement of ['W', 'P']) {
            const improved =
              history.slice(0, changedDay) + replacement + history.slice(changedDay + 1);
            for (let daysOver = changedDay + 1; daysOver <= HISTORY_LENGTH; daysOver += 1) {
              const before = stateAfter(preamble + history.slice(0, daysOver));
              const after = stateAfter(preamble + improved.slice(0, daysOver));
              if (
                after.droughtDays > before.droughtDays ||
                after.health < before.health ||
                after.visibleElements.length < before.visibleElements.length ||
                after.missedDaysInARow > before.missedDaysInARow
              ) {
                throw new Error(
                  `Reading harmed: "${preamble}${history}" day ${changedDay} -> ${replacement}, seen after ${daysOver} days`,
                );
              }
              comparisons += 1;
            }
          }
        }
      }
      // 6561 histories x 8/3 missed days on average x 2 replacements x 4.5 later days.
      expect(comparisons).toBe(157_464);
    },
  );

  it('reading today never raises the drought of today, on every history', () => {
    for (const preamble of PREAMBLES) {
      for (const history of everyHistory(HISTORY_LENGTH - 1)) {
        const unread = stateAfter(preamble + history);
        const read = stateAfter(`${preamble}${history}W`);
        expect(read.droughtDays).toBeLessThanOrEqual(unread.droughtDays);
        expect(read.droughtDays).toBe(Math.max(0, unread.droughtDays - 3));
      }
    }
  });

  // Why it holds for histories of any length: each kind of day turns "more drought" into
  // "more drought or the same", and a watered day always gives less than a pause, which
  // gives less than a missed day. Checked on the 15 possible droughts and on every run.
  it('each kind of day keeps the order of two gardens, and watered <= paused <= missed', () => {
    const afterDay = (vitals: Vitals, kind: (typeof DAY_KINDS)[number]): Vitals =>
      vitalsAfterDay(
        vitals,
        { isWatered: kind === 'W', isPaused: kind === 'P' },
        DEFAULT_GARDEN_CONFIG,
      );
    for (let drought = 0; drought <= 14; drought += 1) {
      const vitals: Vitals = { droughtDays: drought, missedDaysInARow: drought };
      const watered = afterDay(vitals, 'W');
      const paused = afterDay(vitals, 'P');
      const missed = afterDay(vitals, 'M');
      expect(watered.droughtDays).toBeLessThanOrEqual(paused.droughtDays);
      expect(paused.droughtDays).toBeLessThanOrEqual(missed.droughtDays);
      expect(watered.missedDaysInARow).toBeLessThanOrEqual(paused.missedDaysInARow);
      expect(paused.missedDaysInARow).toBeLessThanOrEqual(missed.missedDaysInARow);

      for (let drier = drought; drier <= 14; drier += 1) {
        const drierVitals: Vitals = { droughtDays: drier, missedDaysInARow: drier };
        for (const kind of DAY_KINDS) {
          expect(afterDay(vitals, kind).droughtDays).toBeLessThanOrEqual(
            afterDay(drierVitals, kind).droughtDays,
          );
        }
      }
    }
    expect(NEW_GARDEN_VITALS).toEqual({ droughtDays: 0, missedDaysInARow: 0 });
  });

  it('reading today never hides an element nor dries the water, on random long histories', () => {
    forEachRandomHistory(25, ({ past, hizbCompleted }) => {
      const before = computeGardenState(gardenInput(past, 'unread', { hizbCompleted }));
      const after = computeGardenState(gardenInput(past, 'read', { hizbCompleted }));
      expect(after.droughtDays).toBeLessThanOrEqual(before.droughtDays);
      expect(after.visibleElements.length).toBeGreaterThanOrEqual(before.visibleElements.length);
      expect(after.missedDaysInARow).toBe(0);
      if (hizbCompleted > 0) expect(after.water).toBe('flowing');
    });
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

  it('shows all of them until the garden is dying, a share rounded up then, none when dead', () => {
    forEachRandomHistory(4, ({ input, hizbCompleted }) => {
      const state = computeGardenState(input);
      const { droughtDays } = state;
      const expected =
        droughtDays < 10 ? hizbCompleted : Math.ceil((hizbCompleted * (14 - droughtDays)) / 5);
      expect(state.visibleElements).toHaveLength(expected);
      if (droughtDays === 14) expect(state.visibleElements).toHaveLength(0);
      // Not dead, and something to show: at least one element is shown.
      if (droughtDays < 14 && hizbCompleted > 0) {
        expect(state.visibleElements.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

describe('property: the outputs agree with each other', () => {
  it('derives phase, water and visibility from drought and missed days, on every history', () => {
    forEachRandomHistory(5, ({ input, hizbCompleted }) => {
      const state = computeGardenState(input);
      const { droughtDays } = state;

      const expectedPhase =
        hizbCompleted === 0
          ? 'bare'
          : droughtDays <= 2
            ? 'thriving'
            : droughtDays <= 5
              ? 'thirsty'
              : droughtDays <= 9
                ? 'wilting'
                : droughtDays <= 13
                  ? 'dying'
                  : 'dead';
      expect(state.phase).toBe(expectedPhase);

      const expectedWater =
        hizbCompleted === 0
          ? 'dry'
          : state.missedDaysInARow === 0
            ? 'flowing'
            : state.missedDaysInARow < 3
              ? 'still'
              : 'dry';
      expect(state.water).toBe(expectedWater);

      // Three missed days in a row give at least three drought days: dry water, not thriving.
      if (state.water === 'dry' && hizbCompleted > 0) expect(state.phase).not.toBe('thriving');
      if (hizbCompleted === 0) expect(state.missedDaysInARow).toBe(0);
      if (state.daysSinceLastWatered === 0) expect(state.missedDaysInARow).toBe(0);
      expect(state.lastUnlocked?.hizb ?? 0).toBe(hizbCompleted);
      expect(state.nextElement?.element.hizb ?? 61).toBe(hizbCompleted + 1);
      if (state.nextElement) {
        expect(state.nextElement.isVisible).toBe(state.visibleElements.length === hizbCompleted);
      }
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

describe('property: no date is ever "too late" (time-zone change)', () => {
  it('never throws, wherever today falls around the life of the garden', () => {
    forEachRandomHistory(9, ({ input }) => {
      for (const shift of [-400, -30, -2, -1, 1, 2, 30, 400]) {
        const moved: GardenInput = { ...input, today: addDays(input.today, shift) };
        expect(() => computeGardenState(moved)).not.toThrow();
      }
      const beforeEverything: GardenInput = { ...input, today: addDays(GARDEN_FIRST_DAY, -1) };
      const state = computeGardenState(beforeEverything);
      expect(state.droughtDays).toBe(0);
      expect(state.missedDaysInARow).toBe(0);
      expect(state.daysSinceLastWatered).toBeNull();
    });
  });
});

describe('the default configuration is the one of the specification', () => {
  it('is what the engine uses when no configuration is given', () => {
    const input = gardenInput('MMMM W MM');
    expect(computeGardenState({ ...input, config: { ...DEFAULT_GARDEN_CONFIG } })).toEqual(
      computeGardenState(input),
    );
  });
});
