/**
 * Acceptance tests of docs/specs/garden.md, sections "Phases" and "Éléments visibles", and
 * of the boundaries of the progress (hizb 0, 1, 59, 60; growth 0 and 1).
 * Histories use the notation of acceptance-kit.ts.
 */
import {
  computeGardenState,
  GARDEN_CATALOG,
  type GardenPhase,
  type GardenState,
} from '@/domain/garden';

import { bareEarthInput, day, FIRST_DAY, historyInput, visibleCountOf } from './acceptance-kit';

/** A garden with `hizbCompleted` hizb that reached exactly `droughtDays` drought days. */
function gardenAtDrought(droughtDays: number, hizbCompleted = 24): GardenState {
  const state = computeGardenState(
    historyInput('W' + 'M'.repeat(droughtDays) + '.', { hizbCompleted }),
  );
  // The premise of every test below; the drought rules have their own suite.
  expect(state.droughtDays).toBe(droughtDays);
  return state;
}

function idsOf(state: GardenState): string[] {
  return state.visibleElements.map((element) => element.id);
}

function firstCatalogIds(count: number): string[] {
  return GARDEN_CATALOG.slice(0, count).map((element) => element.id);
}

describe('phases: thriving 0-2, thirsty 3-5, wilting 6-9, dying 10-13, dead 14', () => {
  const expectedPhases: readonly (readonly [number, GardenPhase])[] = [
    [0, 'thriving'],
    [1, 'thriving'],
    [2, 'thriving'], // boundary 2 / 3
    [3, 'thirsty'],
    [4, 'thirsty'],
    [5, 'thirsty'], // boundary 5 / 6
    [6, 'wilting'],
    [7, 'wilting'],
    [8, 'wilting'],
    [9, 'wilting'], // boundary 9 / 10
    [10, 'dying'],
    [11, 'dying'],
    [12, 'dying'],
    [13, 'dying'], // boundary 13 / 14
    [14, 'dead'],
  ];

  it.each(expectedPhases)('drought %i: %s', (droughtDays, phase) => {
    expect(gardenAtDrought(droughtDays).phase).toBe(phase);
  });

  it.each(expectedPhases)('drought %i with a single hizb: %s', (droughtDays, phase) => {
    expect(gardenAtDrought(droughtDays, 1).phase).toBe(phase);
  });

  it('the same boundaries are crossed on the way back, when the drought recedes', () => {
    const dead = 'W' + 'M'.repeat(14);
    // 14 → 11 → 8 → 5 → 2 → 0 with one watered day each time.
    const phases = [0, 1, 2, 3, 4, 5].map(
      (wateredDays) => computeGardenState(historyInput(dead + 'W'.repeat(wateredDays) + '.')).phase,
    );
    expect(phases).toEqual(['dead', 'dying', 'wilting', 'thirsty', 'thriving', 'thriving']);
  });

  it('bare: no hizb at all, whatever was read', () => {
    const state = computeGardenState(
      bareEarthInput(day('2026-03-10'), [day('2026-03-09'), day('2026-03-10')]),
    );
    expect(state.phase).toBe('bare');
  });

  it('a garden with at least one hizb is never bare', () => {
    for (let droughtDays = 0; droughtDays <= 14; droughtDays += 1) {
      expect(gardenAtDrought(droughtDays, 1).phase).not.toBe('bare');
    }
  });
});

describe('visible elements', () => {
  it('up to wilting included, every unlocked element is visible', () => {
    for (let droughtDays = 0; droughtDays <= 9; droughtDays += 1) {
      expect(idsOf(gardenAtDrought(droughtDays))).toEqual(firstCatalogIds(24));
    }
  });

  it.each([
    // 24 unlocked: 24 × 4 / 5 = 19.2 → 20 ; 24 × 3 / 5 = 14.4 → 15 ; 9.6 → 10 ; 4.8 → 5.
    [24, [20, 15, 10, 5]],
    // 5 unlocked: exactly 80 %, 60 %, 40 %, 20 %.
    [5, [4, 3, 2, 1]],
    [10, [8, 6, 4, 2]],
    // 59 unlocked: 47.2 → 48 ; 35.4 → 36 ; 23.6 → 24 ; 11.8 → 12.
    [59, [48, 36, 24, 12]],
    // 3 unlocked: 2.4 → 3 ; 1.8 → 2 ; 1.2 → 2 ; 0.6 → 1.
    [3, [3, 2, 2, 1]],
    [2, [2, 2, 1, 1]],
    [1, [1, 1, 1, 1]],
  ])('dying with %i unlocked: %j elements at drought 10, 11, 12, 13', (unlocked, expected) => {
    const counts = [10, 11, 12, 13].map(
      (droughtDays) => gardenAtDrought(droughtDays, unlocked).visibleElements.length,
    );
    expect(counts).toEqual(expected);
  });

  it('dead: none', () => {
    expect(gardenAtDrought(14).visibleElements).toEqual([]);
    expect(gardenAtDrought(14, 59).visibleElements).toEqual([]);
    expect(gardenAtDrought(14, 1).visibleElements).toEqual([]);
  });

  it('for every unlocked count 1..59 and every drought 0..14: the first elements of the catalogue, in order, as many as ceil(unlocked × (14 − drought) / 5) while dying', () => {
    for (let unlocked = 1; unlocked <= 59; unlocked += 1) {
      for (let droughtDays = 0; droughtDays <= 14; droughtDays += 1) {
        const state = gardenAtDrought(droughtDays, unlocked);
        const expectedCount = visibleCountOf(unlocked, droughtDays);
        expect([unlocked, droughtDays, idsOf(state)]).toEqual([
          unlocked,
          droughtDays,
          firstCatalogIds(expectedCount),
        ]);
      }
    }
  });

  it('the last arrived disappear first', () => {
    const state = gardenAtDrought(12); // 10 of 24 left
    expect(idsOf(state)).toEqual(firstCatalogIds(10));
    expect(idsOf(state)).not.toContain('springs');
    expect(idsOf(state)[0]).toBe('channels');
  });

  it('while the garden is not dead, at least one element stays; never more than unlocked', () => {
    for (let unlocked = 1; unlocked <= 59; unlocked += 1) {
      for (let droughtDays = 0; droughtDays <= 13; droughtDays += 1) {
        const count = gardenAtDrought(droughtDays, unlocked).visibleElements.length;
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(unlocked);
      }
    }
  });

  it('when the drought recedes, they come back by the same rule', () => {
    const dead = 'W' + 'M'.repeat(14);
    // 14 → 11 → 8: none, then ceil(24 × 3 / 5) = 15, then all of them.
    const counts = [0, 1, 2].map(
      (wateredDays) =>
        computeGardenState(historyInput(dead + 'W'.repeat(wateredDays) + '.')).visibleElements
          .length,
    );
    expect(counts).toEqual([0, 15, 24]);
  });

  it('visible elements are entries of the catalogue, with their hizb, id and kind', () => {
    const state = gardenAtDrought(0, 30);
    expect(state.visibleElements).toEqual(GARDEN_CATALOG.slice(0, 30));
  });
});

describe('one element and dying', () => {
  it.each([10, 11, 12, 13])('drought %i: the only element is still there', (droughtDays) => {
    const state = gardenAtDrought(droughtDays, 1);
    expect(state.phase).toBe('dying');
    expect(idsOf(state)).toEqual(['channels']);
  });

  it('drought 14: it is gone, but it is not lost', () => {
    const state = gardenAtDrought(14, 1);
    expect(state.visibleElements).toEqual([]);
    expect(state.hizbCompleted).toBe(1);
    expect(state.lastUnlocked?.id).toBe('channels');
  });
});

describe('the growing element is visible only if every unlocked element is', () => {
  it('visible while nothing is hidden', () => {
    for (let droughtDays = 0; droughtDays <= 9; droughtDays += 1) {
      expect(gardenAtDrought(droughtDays).nextElement?.isVisible).toBe(true);
    }
  });

  it('hidden as soon as one unlocked element is hidden, and on the dead earth', () => {
    for (let droughtDays = 10; droughtDays <= 14; droughtDays += 1) {
      expect(gardenAtDrought(droughtDays).nextElement?.isVisible).toBe(false);
    }
    expect(gardenAtDrought(14, 1).nextElement?.isVisible).toBe(false);
  });

  it('for every unlocked count and drought: never visible when an unlocked element is hidden', () => {
    for (let unlocked = 1; unlocked <= 59; unlocked += 1) {
      for (let droughtDays = 0; droughtDays <= 14; droughtDays += 1) {
        const state = gardenAtDrought(droughtDays, unlocked);
        const allVisible = state.visibleElements.length === unlocked;
        expect([unlocked, droughtDays, state.nextElement?.isVisible]).toEqual([
          unlocked,
          droughtDays,
          allVisible,
        ]);
      }
    }
  });

  it('on the bare earth the first element is growing and visible', () => {
    const state = computeGardenState(bareEarthInput(day('2026-03-10'), [day('2026-03-10')]));
    expect(state.nextElement).toEqual({
      element: GARDEN_CATALOG[0],
      growth: 0.5,
      isVisible: true,
    });
  });
});

describe('boundaries of the progress', () => {
  it('hizb 0: bare earth, nothing unlocked, "channels" is growing', () => {
    const state = computeGardenState(bareEarthInput(day('2026-03-10')));
    expect(state.hizbCompleted).toBe(0);
    expect(state.phase).toBe('bare');
    expect(state.visibleElements).toEqual([]);
    expect(state.lastUnlocked).toBeNull();
    expect(state.nextElement?.element.id).toBe('channels');
    expect(state.nextElement?.element.hizb).toBe(1);
    expect(state.isComplete).toBe(false);
  });

  it('hizb 1: "channels" is unlocked, "paving" is growing', () => {
    const state = computeGardenState(historyInput('W', { hizbCompleted: 1 }));
    expect(state.hizbCompleted).toBe(1);
    expect(idsOf(state)).toEqual(['channels']);
    expect(state.lastUnlocked?.id).toBe('channels');
    expect(state.nextElement?.element.id).toBe('paving');
    expect(state.isComplete).toBe(false);
  });

  it('hizb 59: "waterfall" is the last unlocked, "full-bloom" is growing', () => {
    const state = computeGardenState(historyInput('W', { hizbCompleted: 59 }));
    expect(state.hizbCompleted).toBe(59);
    expect(state.visibleElements).toHaveLength(59);
    expect(state.lastUnlocked?.id).toBe('waterfall');
    expect(state.nextElement?.element.id).toBe('full-bloom');
    expect(state.nextElement?.element.hizb).toBe(60);
    expect(state.isComplete).toBe(false);
  });

  it('hizb 60: complete, "full-bloom" is the last unlocked, nothing is growing', () => {
    const state = computeGardenState(
      historyInput('W', { hizbCompleted: 60, currentHizbProgress: 0, completedOn: FIRST_DAY }),
    );
    expect(state.hizbCompleted).toBe(60);
    expect(state.isComplete).toBe(true);
    expect(state.visibleElements).toHaveLength(60);
    expect(state.lastUnlocked?.id).toBe('full-bloom');
    expect(state.nextElement).toBeNull();
  });

  it.each([0, 1, 23, 24, 58, 59])(
    'hizb %i: lastUnlocked and nextElement follow the catalogue',
    (hizbCompleted) => {
      const input =
        hizbCompleted === 0
          ? bareEarthInput(day('2026-03-10'))
          : historyInput('W', { hizbCompleted });
      const state = computeGardenState(input);
      expect(state.lastUnlocked).toEqual(
        hizbCompleted === 0 ? null : GARDEN_CATALOG[hizbCompleted - 1],
      );
      expect(state.nextElement?.element).toEqual(GARDEN_CATALOG[hizbCompleted]);
    },
  );

  it.each([0, 1, 0.25, 0.999999, Number.MIN_VALUE, 1 - Number.EPSILON])(
    'growth %d is passed on as it is',
    (currentHizbProgress) => {
      const state = computeGardenState(historyInput('W', { currentHizbProgress }));
      expect(state.nextElement?.growth).toBe(currentHizbProgress);
    },
  );

  it('growth 0 and growth 1 on the bare earth and at hizb 59', () => {
    for (const currentHizbProgress of [0, 1]) {
      const bare = computeGardenState({
        ...bareEarthInput(day('2026-03-10')),
        currentHizbProgress,
      });
      expect(bare.nextElement?.growth).toBe(currentHizbProgress);
      const last = computeGardenState(
        historyInput('W', { hizbCompleted: 59, currentHizbProgress }),
      );
      expect(last.nextElement?.growth).toBe(currentHizbProgress);
      // Reading all the pages of a hizb does not complete the garden by itself.
      expect(last.isComplete).toBe(false);
    }
  });

  it('lastUnlocked stays known when the drought hides it', () => {
    expect(gardenAtDrought(13).lastUnlocked?.id).toBe('springs');
    expect(gardenAtDrought(14).lastUnlocked?.id).toBe('springs');
    expect(gardenAtDrought(14).hizbCompleted).toBe(24);
  });
});
