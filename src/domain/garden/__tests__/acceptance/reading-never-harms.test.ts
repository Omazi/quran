/**
 * Acceptance tests of the owner's hard requirement (docs/specs/garden.md, "Propriétés à
 * garantir par les tests"): READING NEVER HARMS.
 *
 * "Dans tout historique, remplacer un jour manqué par un jour arrosé (ou par une pause) ne
 * fait monter la sécheresse d'aucun jour suivant. À vérifier sur tous les historiques
 * possibles d'une longueur donnée, pas sur quelques exemples."
 *
 * How it is checked. A history is a string over M (missed), W (watered), P (paused); its
 * last letter is today. Every history of every length up to the limit is computed, so every
 * "later day" of a history is itself a history of the table. For each history and each of
 * its M days, the M is replaced by W, then by P, and the two gardens are compared ON THE
 * LAST DAY: drought, health, phase, water, run of missed days, visible elements, growing
 * element. Because all lengths are in the table, this covers the day of the change and every
 * day after it.
 *
 * A newborn garden cannot reach the cap of 14 in nine days, so the histories are also played
 * after a fixed past (a garden already thirsty, wilting, dying, dead, long dead): the cap
 * and the death boundary are exercised too.
 */
import { computeGardenState, type GardenState } from '@/domain/garden';

import { allHistories, historyInput, phaseRank, waterRank } from './acceptance-kit';

const LETTERS = 'MWP';

interface Facts {
  readonly droughtDays: number;
  readonly health: number;
  readonly phase: number;
  readonly water: number;
  readonly missedDaysInARow: number;
  readonly visibleCount: number;
  readonly isGrowingElementVisible: boolean;
}

function factsOf(state: GardenState): Facts {
  return {
    droughtDays: state.droughtDays,
    health: state.health,
    phase: phaseRank(state.phase),
    water: waterRank(state.water),
    missedDaysInARow: state.missedDaysInARow,
    visibleCount: state.visibleElements.length,
    isGrowingElementVisible: state.nextElement?.isVisible ?? false,
  };
}

/** What got worse from `before` to `after`, as text; empty when nothing did. */
function harmDone(before: Facts, after: Facts): string[] {
  const harm: string[] = [];
  if (after.droughtDays > before.droughtDays) harm.push('drought rose');
  if (after.health < before.health) harm.push('health fell');
  if (after.phase > before.phase) harm.push('phase got worse');
  if (after.water > before.water) harm.push('water got worse');
  if (after.missedDaysInARow > before.missedDaysInARow) harm.push('run of missed days grew');
  if (after.visibleCount < before.visibleCount) harm.push('an element was hidden');
  if (before.isGrowingElementVisible && !after.isGrowingElementVisible) {
    harm.push('the growing element was hidden');
  }
  return harm;
}

function replaceAt(history: string, index: number, letter: string): string {
  return history.slice(0, index) + letter + history.slice(index + 1);
}

/**
 * Checks the property on every history `past + tail`, for every tail of 1..maxTailLength
 * days. Returns the offending cases as text (an empty list is a pass) and the number of
 * comparisons made, so that a suite cannot pass by comparing nothing.
 */
function checkEveryHistory(
  past: string,
  maxTailLength: number,
  hizbCompleted: number,
): { readonly failures: string[]; readonly comparisons: number } {
  const table = new Map<string, Facts>();
  for (let length = 1; length <= maxTailLength; length += 1) {
    for (const tail of allHistories(LETTERS, length)) {
      const state = computeGardenState(historyInput(past + tail, { hizbCompleted }));
      table.set(tail, factsOf(state));
    }
  }

  const failures: string[] = [];
  let comparisons = 0;
  for (const [tail, before] of table) {
    for (let index = 0; index < tail.length; index += 1) {
      if (tail[index] !== 'M') continue;
      for (const replacement of ['W', 'P']) {
        const changedTail = replaceAt(tail, index, replacement);
        const after = table.get(changedTail);
        if (after === undefined) throw new Error(`History missing from the table: ${changedTail}`);
        comparisons += 1;
        const harm = harmDone(before, after);
        if (harm.length > 0 && failures.length < 20) {
          failures.push(
            `${past}|${tail} -> ${past}|${changedTail}: ${harm.join(', ')} ` +
              `(${JSON.stringify(before)} -> ${JSON.stringify(after)})`,
          );
        }
      }
    }
  }
  return { failures, comparisons };
}

describe('reading never harms: every history, every missed day replaced by a watered day or a pause', () => {
  it('every history of 1 to 9 days of a newborn garden (29 523 histories)', () => {
    const { failures, comparisons } = checkEveryHistory('', 9, 24);
    expect(failures).toEqual([]);
    // 2 replacements × number of M letters over all histories: 2 × Σ n·3^(n−1), n = 1..9
    // = 2 × (1 + 6 + 27 + 108 + 405 + 1458 + 5103 + 17496 + 59049) = 2 × 83 653.
    expect(comparisons).toBe(167_306);
  });

  it.each([
    ['thirsty (4 drought days)', 'W' + 'M'.repeat(4)],
    ['wilting (8)', 'W' + 'M'.repeat(8)],
    ['dying (11)', 'W' + 'M'.repeat(11)],
    ['about to die (13)', 'W' + 'M'.repeat(13)],
    ['just dead (14)', 'W' + 'M'.repeat(14)],
    ['long dead (40 missed days)', 'W' + 'M'.repeat(40)],
    ['dead, then paused', 'W' + 'M'.repeat(20) + 'PPP'],
    ['recovering from death (drought 8)', 'W' + 'M'.repeat(14) + 'WW'],
  ])('every history of 1 to 7 days after a garden that is %s', (_name, past) => {
    const { failures, comparisons } = checkEveryHistory(past, 7, 24);
    expect(failures).toEqual([]);
    // 2 × Σ n·3^(n−1), n = 1..7 = 2 × 7 108
    expect(comparisons).toBe(14_216);
  });

  it.each([1, 2, 5, 59])(
    'every history of 1 to 6 days, dying garden with %i unlocked element(s)',
    (hizbCompleted) => {
      const { failures } = checkEveryHistory('W' + 'M'.repeat(12), 6, hizbCompleted);
      expect(failures).toEqual([]);
    },
  );
});

describe('reading never harms: the day after is never worse for having read today', () => {
  it('for every history of 1 to 7 days, reading today leaves a garden at least as good today and tomorrow morning', () => {
    const failures: string[] = [];
    for (const past of ['', 'W' + 'M'.repeat(12), 'W' + 'M'.repeat(30)]) {
      for (let length = 0; length <= 6; length += 1) {
        for (const tail of allHistories(LETTERS, length)) {
          const history = past + tail;
          const unreadToday = factsOf(computeGardenState(historyInput(history + '.')));
          const readToday = factsOf(computeGardenState(historyInput(history + 'W')));
          const unreadTomorrow = factsOf(computeGardenState(historyInput(history + 'M.')));
          const readTomorrow = factsOf(computeGardenState(historyInput(history + 'W.')));
          const harm = [
            ...harmDone(unreadToday, readToday),
            ...harmDone(unreadTomorrow, readTomorrow),
          ];
          if (harm.length > 0 && failures.length < 20) failures.push(`${history}: ${harm}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('reading never harms: reading on a paused day', () => {
  // The spec has no rule for a day that is both paused and watered ("B"). Whatever the
  // module decides, the owner's requirement applies: having read cannot be worse than not.
  it('for every history of 1 to 7 days, reading on a paused day never makes any later day worse', () => {
    const failures: string[] = [];
    let comparisons = 0;
    for (const past of ['', 'W' + 'M'.repeat(12), 'W' + 'M'.repeat(30)]) {
      const table = new Map<string, Facts>();
      const factsFor = (tail: string): Facts => {
        const known = table.get(tail);
        if (known !== undefined) return known;
        const facts = factsOf(computeGardenState(historyInput(past + tail)));
        table.set(tail, facts);
        return facts;
      };
      for (let length = 1; length <= 7; length += 1) {
        for (const tail of allHistories(LETTERS, length)) {
          for (let index = 0; index < tail.length; index += 1) {
            if (tail[index] !== 'P') continue;
            comparisons += 1;
            const changedTail = replaceAt(tail, index, 'B');
            const harm = harmDone(factsFor(tail), factsFor(changedTail));
            if (harm.length > 0 && failures.length < 20) {
              failures.push(`${past}|${tail} -> ${past}|${changedTail}: ${harm.join(', ')}`);
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
    // 3 pasts × Σ n·3^(n−1), n = 1..7
    expect(comparisons).toBe(3 * 7108);
  });

  it('declaring a pause over a day already read never makes any later day worse than leaving the day missed', () => {
    // M (missed) -> B (paused and read): the user did strictly more than nothing.
    const failures: string[] = [];
    for (const past of ['', 'W' + 'M'.repeat(12)]) {
      for (let length = 1; length <= 6; length += 1) {
        for (const tail of allHistories(LETTERS, length)) {
          for (let index = 0; index < tail.length; index += 1) {
            if (tail[index] !== 'M') continue;
            const changedTail = replaceAt(tail, index, 'B');
            const before = factsOf(computeGardenState(historyInput(past + tail)));
            const after = factsOf(computeGardenState(historyInput(past + changedTail)));
            const harm = harmDone(before, after);
            if (harm.length > 0 && failures.length < 20) {
              failures.push(`${past}|${tail} -> ${past}|${changedTail}: ${harm.join(', ')}`);
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('reading never harms: finishing a hizb', () => {
  it('for every history of 1 to 4 days and every hizb count, one more hizb never hides an element', () => {
    const failures: string[] = [];
    for (const past of ['', 'W' + 'M'.repeat(9), 'W' + 'M'.repeat(13)]) {
      for (let length = 1; length <= 4; length += 1) {
        for (const tail of allHistories(LETTERS, length)) {
          let previousCount = 0;
          for (let hizbCompleted = 1; hizbCompleted <= 59; hizbCompleted += 1) {
            const state = computeGardenState(historyInput(past + tail, { hizbCompleted }));
            const count = state.visibleElements.length;
            if (count < previousCount && failures.length < 20) {
              failures.push(
                `${past}|${tail}: ${hizbCompleted} hizb show ${count} < ${previousCount}`,
              );
            }
            previousCount = count;
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('the day a hizb is finished, the element that was growing does not vanish', () => {
    // Yesterday: `unlocked` hizb, the next element was growing. Today the user reads and
    // finishes the hizb. If the growing element was drawn yesterday evening, the element it
    // became must be drawn today.
    const failures: string[] = [];
    for (let unlocked = 1; unlocked <= 58; unlocked += 1) {
      for (let missedDays = 0; missedDays <= 16; missedDays += 1) {
        const past = 'W' + 'M'.repeat(missedDays);
        const before = computeGardenState(
          historyInput(past + '.', { hizbCompleted: unlocked, currentHizbProgress: 0.95 }),
        );
        const after = computeGardenState(
          historyInput(past + 'W', { hizbCompleted: unlocked + 1, currentHizbProgress: 0 }),
        );
        const wasDrawn = before.nextElement?.isVisible === true;
        const isDrawn = after.visibleElements.length === unlocked + 1;
        if (wasDrawn && !isDrawn) failures.push(`${unlocked} hizb, ${missedDays} missed days`);
        if (after.visibleElements.length < before.visibleElements.length) {
          failures.push(`${unlocked} hizb, ${missedDays} missed days: fewer elements after`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
