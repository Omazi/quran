/**
 * The module against the tester's own reference model (acceptance-kit.ts: `modelGarden`, a
 * dozen lines that replay the spec's drought rule day by day), over many generated
 * histories: missed, watered and paused days; pauses cut in overlapping pieces; today
 * watered or not; garden not yet born; garden complete.
 *
 * Also the two properties "drought stays in 0..14, health in [0, 1]" and "the number of
 * visible elements never exceeds the number unlocked", checked on every generated state.
 */
import {
  computeGardenState,
  GARDEN_CATALOG,
  type GardenInput,
  type GardenPause,
  type GardenState,
} from '@/domain/garden';
import { addDays, type LocalDate } from '@/domain/shared/local-date';

import {
  allHistories,
  FIRST_DAY,
  historyInput,
  modelGarden,
  randomHistory,
  randomInt,
  seededRandom,
  summaryOf,
  type PauseStyle,
} from './acceptance-kit';

const PAUSE_STYLES: readonly PauseStyle[] = ['one-per-run', 'one-per-day', 'overlapping'];

function pick<Item>(random: () => number, items: readonly Item[]): Item {
  const item = items[randomInt(random, 0, items.length - 1)];
  if (item === undefined) throw new Error('pick: empty list');
  return item;
}

/** Noise that must change nothing: reading and pauses before the first day or after today. */
function noiseAround(
  random: () => number,
  history: string,
): { readonly extraWateredDays: LocalDate[]; readonly extraPauses: GardenPause[] } {
  const today = addDays(FIRST_DAY, history.length - 1);
  const extraWateredDays: LocalDate[] = [];
  const extraPauses: GardenPause[] = [];
  for (let count = randomInt(random, 0, 4); count > 0; count -= 1) {
    extraWateredDays.push(addDays(FIRST_DAY, -randomInt(random, 1, 400)));
  }
  for (let count = randomInt(random, 0, 2); count > 0; count -= 1) {
    extraWateredDays.push(addDays(today, randomInt(random, 1, 3)));
  }
  if (random() < 0.4) {
    const end = -randomInt(random, 1, 50);
    extraPauses.push({
      from: addDays(FIRST_DAY, end - randomInt(random, 0, 30)),
      to: addDays(FIRST_DAY, end),
    });
  }
  if (random() < 0.4) {
    const start = randomInt(random, 1, 10);
    extraPauses.push({
      from: addDays(today, start),
      to: addDays(today, start + randomInt(random, 0, 30)),
    });
  }
  return { extraWateredDays, extraPauses };
}

function expectStateWithinBounds(state: GardenState, unlocked: number): void {
  expect(Number.isInteger(state.droughtDays)).toBe(true);
  expect(state.droughtDays).toBeGreaterThanOrEqual(0);
  expect(state.droughtDays).toBeLessThanOrEqual(14);
  expect(state.health).toBeGreaterThanOrEqual(0);
  expect(state.health).toBeLessThanOrEqual(1);
  expect(state.health).toBeCloseTo(1 - state.droughtDays / 14, 12);
  expect(state.visibleElements.length).toBeLessThanOrEqual(unlocked);
  expect(state.missedDaysInARow).toBeGreaterThanOrEqual(0);
  expect(state.hizbCompleted).toBe(unlocked);
}

describe('the module agrees with the reference model', () => {
  it('on every history of 1 to 8 days (9 840 histories)', () => {
    const disagreements: string[] = [];
    for (let length = 1; length <= 8; length += 1) {
      for (const history of allHistories('MWP', length)) {
        const actual = summaryOf(computeGardenState(historyInput(history)));
        const expected = modelGarden(history, 24);
        if (JSON.stringify(actual) !== JSON.stringify(expected) && disagreements.length < 10) {
          disagreements.push(
            `${history}: ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
          );
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('on 4 000 generated histories of up to 150 days, with noise around and pauses cut in every way', () => {
    const random = seededRandom(20_261_124);
    for (let run = 0; run < 4000; run += 1) {
      const history = randomHistory(random, randomInt(random, 1, random() < 0.2 ? 150 : 40));
      const hizbCompleted = randomInt(random, 1, 59);
      const currentHizbProgress = pick(random, [0, 1, random()]);
      const input = historyInput(history, {
        hizbCompleted,
        currentHizbProgress,
        pauseStyle: pick(random, PAUSE_STYLES),
        ...noiseAround(random, history),
      });

      const state = computeGardenState(input);
      const expected = modelGarden(history, hizbCompleted);

      expect({ history, hizbCompleted, ...summaryOf(state) }).toEqual({
        history,
        hizbCompleted,
        ...expected,
      });
      expectStateWithinBounds(state, hizbCompleted);
      expect(state.visibleElements).toEqual(GARDEN_CATALOG.slice(0, expected.visibleCount));
      expect(state.lastUnlocked).toEqual(GARDEN_CATALOG[hizbCompleted - 1]);
      expect(state.nextElement).toEqual({
        element: GARDEN_CATALOG[hizbCompleted],
        growth: currentHizbProgress,
        isVisible: expected.visibleCount === hizbCompleted,
      });
      expect(state.isComplete).toBe(false);
      expect(state.isPausedToday).toBe(history.endsWith('P'));
    }
  });

  it('on 300 long generated histories (1 to 4 years)', () => {
    const random = seededRandom(1447);
    for (let run = 0; run < 300; run += 1) {
      const history = randomHistory(random, randomInt(random, 365, 1461));
      const hizbCompleted = randomInt(random, 1, 59);
      const state = computeGardenState(
        historyInput(history, { hizbCompleted, pauseStyle: pick(random, PAUSE_STYLES) }),
      );
      expect({ run, ...summaryOf(state) }).toEqual({ run, ...modelGarden(history, hizbCompleted) });
      expectStateWithinBounds(state, hizbCompleted);
    }
  });

  it('garden not yet born: 500 generated journals give the same bare earth', () => {
    const random = seededRandom(99);
    for (let run = 0; run < 500; run += 1) {
      const history = randomHistory(random, randomInt(random, 1, 120));
      const born = historyInput(history, {
        pauseStyle: pick(random, PAUSE_STYLES),
        ...noiseAround(random, history),
      });
      const currentHizbProgress = random();
      const input: GardenInput = {
        ...born,
        hizbCompleted: 0,
        currentHizbProgress,
        firstHizbCompletedOn: null,
      };
      const state = computeGardenState(input);
      expect(state).toMatchObject({
        hizbCompleted: 0,
        droughtDays: 0,
        health: 1,
        phase: 'bare',
        water: 'dry',
        missedDaysInARow: 0,
        visibleElements: [],
        lastUnlocked: null,
        nextElement: { element: GARDEN_CATALOG[0], growth: currentHizbProgress, isVisible: true },
        isComplete: false,
        isPausedToday: history.endsWith('P'),
      });
    }
  });

  it('garden complete: 500 generated journals give the same full garden', () => {
    const random = seededRandom(60);
    for (let run = 0; run < 500; run += 1) {
      const history = randomHistory(random, randomInt(random, 1, 120));
      // The khatma was finished on any day of the history, today included.
      const completedOn = addDays(FIRST_DAY, randomInt(random, 0, history.length - 1));
      const state = computeGardenState(
        historyInput(history, {
          hizbCompleted: 60,
          currentHizbProgress: 0,
          completedOn,
          pauseStyle: pick(random, PAUSE_STYLES),
          ...noiseAround(random, history),
        }),
      );
      expect({ history, state }).toMatchObject({
        history,
        state: {
          hizbCompleted: 60,
          droughtDays: 0,
          health: 1,
          phase: 'thriving',
          water: 'flowing',
          lastUnlocked: GARDEN_CATALOG[59],
          nextElement: null,
          isComplete: true,
        },
      });
      expect(state.visibleElements).toEqual(GARDEN_CATALOG);
    }
  });
});

describe('same input, same output', () => {
  it('computing twice, and in any order, gives equal states', () => {
    const random = seededRandom(5);
    const inputs = Array.from({ length: 200 }, () =>
      historyInput(randomHistory(random, randomInt(random, 1, 60)), {
        hizbCompleted: randomInt(random, 1, 59),
      }),
    );
    const firstPass = inputs.map((input) => computeGardenState(input));
    const secondPass = [...inputs].reverse().map((input) => computeGardenState(input));
    expect(secondPass.reverse()).toEqual(firstPass);
  });

  it('the order in which the watered days and the pauses were recorded does not matter', () => {
    const random = seededRandom(11);
    for (let run = 0; run < 200; run += 1) {
      const history = randomHistory(random, randomInt(random, 2, 60));
      const input = historyInput(history, { pauseStyle: 'overlapping' });
      const shuffled: GardenInput = {
        ...input,
        wateredDays: new Set([...input.wateredDays].reverse()),
        pauses: [...input.pauses].reverse(),
      };
      expect(computeGardenState(shuffled)).toEqual(computeGardenState(input));
    }
  });
});
