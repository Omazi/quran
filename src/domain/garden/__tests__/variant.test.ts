/**
 * One garden per khatma (docs/DECISIONS.md, D9): the variant of a cycle, the catalogue it
 * selects, and the complete garden carried by the badge of a finished khatma.
 */
import {
  catalogForVariant,
  completedGardenState,
  computeGardenState,
  GARDEN_CATALOG,
  GARDEN_THEME_IDS,
  gardenVariant,
  isTreeKind,
  REFERENCE_GARDEN_VARIANT,
  TREE_SPECIES_CYCLE,
  type GardenVariant,
} from '../index';
import { gardenInput } from '../test-support/garden-test-kit';

const LARGEST_SEED = 4_294_967_295;
const SOME_USER_SEEDS = [0, 1, 2, 42, 2026, 123_456_789, LARGEST_SEED, Number.MAX_SAFE_INTEGER];

function speciesOfFirstTree(variant: GardenVariant): string {
  const firstTree = catalogForVariant(variant).find((element) => element.id === 'tree-1');
  if (!firstTree) throw new Error('No tree-1 in the catalogue');
  return firstTree.kind;
}

describe('gardenVariant: one garden per khatma', () => {
  it('returns the cycle, a theme and a seed, and nothing else', () => {
    const variant = gardenVariant(3, 2026);
    expect(Object.keys(variant).sort()).toEqual(['cycle', 'seed', 'themeId']);
    expect(variant.cycle).toBe(3);
    expect(GARDEN_THEME_IDS).toContain(variant.themeId);
    expect(Number.isInteger(variant.seed)).toBe(true);
  });

  it('is deterministic: the same cycle and user seed always give the same variant', () => {
    for (const userSeed of SOME_USER_SEEDS) {
      for (const cycle of [1, 2, 3, 60, 500]) {
        expect(gardenVariant(cycle, userSeed)).toEqual(gardenVariant(cycle, userSeed));
      }
    }
  });

  it('does not depend on the clock nor on the calls made before', () => {
    const first = gardenVariant(5, 77);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2099-12-31T23:59:59Z'));
    for (let cycle = 1; cycle <= 50; cycle += 1) gardenVariant(cycle, 78);
    const later = gardenVariant(5, 77);
    jest.useRealTimers();
    expect(later).toEqual(first);
  });

  // Pinned on purpose. These values were computed by hand-written code outside the
  // module (MurmurHash3 finaliser). If this test fails, the gardens and the badges that
  // users already earned have changed: that needs a decision, not a new expected value.
  it.each([
    [1, 0, 'theme-1', 1_364_076_727],
    [2, 0, 'theme-2', 821_347_078],
    [3, 0, 'theme-3', 2_247_144_487],
    [1, 1, 'theme-4', 2_726_825_882],
    [1, 2026, 'theme-3', 1_376_067_825],
    [7, 123_456, 'theme-2', 3_728_654_584],
    [500, Number.MAX_SAFE_INTEGER, 'theme-1', 4_110_052_026],
    [Number.MAX_SAFE_INTEGER, 42, 'theme-3', 749_553_351],
  ] as const)(
    'keeps the garden of cycle %i for user seed %i: %s, seed %i',
    (cycle, userSeed, themeId, seed) => {
      expect(gardenVariant(cycle, userSeed)).toEqual({ cycle, themeId, seed });
    },
  );

  describe('different from one cycle to the next', () => {
    it('never gives two consecutive cycles the same theme', () => {
      for (const userSeed of SOME_USER_SEEDS) {
        for (let cycle = 1; cycle <= 300; cycle += 1) {
          const current = gardenVariant(cycle, userSeed);
          const next = gardenVariant(cycle + 1, userSeed);
          expect(next.themeId).not.toBe(current.themeId);
          expect(next.seed).not.toBe(current.seed);
        }
      }
    });

    it('goes through every theme before one comes back', () => {
      const themeCount = GARDEN_THEME_IDS.length;
      for (const userSeed of SOME_USER_SEEDS) {
        for (let firstCycle = 1; firstCycle <= 20; firstCycle += 1) {
          const themes = Array.from(
            { length: themeCount },
            (_, index) => gardenVariant(firstCycle + index, userSeed).themeId,
          );
          expect(new Set(themes).size).toBe(themeCount);
          expect(gardenVariant(firstCycle + themeCount, userSeed).themeId).toBe(themes[0]);
        }
      }
    });

    it('gives every cycle of a user its own seed, even after thousands of khatmas', () => {
      for (const userSeed of SOME_USER_SEEDS) {
        const seeds = new Set<number>();
        for (let cycle = 1; cycle <= 3000; cycle += 1)
          seeds.add(gardenVariant(cycle, userSeed).seed);
        expect(seeds.size).toBe(3000);
      }
    });

    it('varies the species of the trees over the cycles of a user', () => {
      for (const userSeed of SOME_USER_SEEDS) {
        const species = new Set<string>();
        for (let cycle = 1; cycle <= 60; cycle += 1) {
          species.add(speciesOfFirstTree(gardenVariant(cycle, userSeed)));
        }
        expect([...species].sort()).toEqual([...TREE_SPECIES_CYCLE].sort());
      }
    });
  });

  it('gives different users different gardens for the same cycle', () => {
    const firstGardens = Array.from({ length: 1000 }, (_, userSeed) => gardenVariant(1, userSeed));
    expect(new Set(firstGardens.map((variant) => variant.seed)).size).toBe(1000);
    // Every theme is the first garden of some user: nobody is stuck behind a common first one.
    expect(new Set(firstGardens.map((variant) => variant.themeId)).size).toBe(
      GARDEN_THEME_IDS.length,
    );
  });

  it('always produces a seed that is a whole number from 0 to 4294967295', () => {
    for (const userSeed of SOME_USER_SEEDS) {
      for (const cycle of [1, 2, 59, 60, 61, 1000, 4_294_967_296, Number.MAX_SAFE_INTEGER]) {
        const { seed } = gardenVariant(cycle, userSeed);
        expect(Number.isInteger(seed)).toBe(true);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThanOrEqual(LARGEST_SEED);
      }
    }
  });

  it('produces variants the engine accepts', () => {
    for (const userSeed of SOME_USER_SEEDS) {
      for (let cycle = 1; cycle <= 40; cycle += 1) {
        const variant = gardenVariant(cycle, userSeed);
        expect(() => computeGardenState(gardenInput('WW M', 'read', { variant }))).not.toThrow();
      }
    }
  });

  it('cannot be modified by a caller', () => {
    expect(Object.isFrozen(gardenVariant(1, 1))).toBe(true);
    expect(Object.isFrozen(REFERENCE_GARDEN_VARIANT)).toBe(true);
    expect(Object.isFrozen(GARDEN_THEME_IDS)).toBe(true);
  });

  it('has at least two themes, all different: consecutive gardens can differ', () => {
    expect(GARDEN_THEME_IDS.length).toBeGreaterThanOrEqual(2);
    expect(new Set(GARDEN_THEME_IDS).size).toBe(GARDEN_THEME_IDS.length);
  });

  describe('invalid input: explicit error', () => {
    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
      'rejects cycle = %d (cycles are whole numbers from 1)',
      (cycle) => {
        expect(() => gardenVariant(cycle, 42)).toThrow(RangeError);
      },
    );

    it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
      'rejects userSeed = %d (user seeds are whole numbers from 0)',
      (userSeed) => {
        expect(() => gardenVariant(1, userSeed)).toThrow(RangeError);
      },
    );

    it('rejects numbers given as text', () => {
      // `as` on purpose: these values cannot be written in typed code, but can arrive from JSON.
      expect(() => gardenVariant('2' as unknown as number, 42)).toThrow(RangeError);
      expect(() => gardenVariant(2, '42' as unknown as number)).toThrow(RangeError);
    });

    it('accepts the first cycle, the seed 0 and the largest safe whole numbers', () => {
      expect(() => gardenVariant(1, 0)).not.toThrow();
      expect(() => gardenVariant(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).not.toThrow();
    });
  });
});

describe('the reference variant of the tests', () => {
  it('does not shift the tree species: tree-1 is a pomegranate tree, and so is tree-13', () => {
    const catalog = catalogForVariant(REFERENCE_GARDEN_VARIANT);
    expect(catalog).toBe(GARDEN_CATALOG);
    expect(catalog.find((element) => element.id === 'tree-1')?.kind).toBe('pomegranate');
    expect(catalog.find((element) => element.id === 'tree-13')?.kind).toBe('pomegranate');
  });
});

describe('catalogForVariant', () => {
  it.each([
    [0, 'pomegranate'],
    [1, 'date-palm'],
    [2, 'olive'],
    [3, 'fig'],
    [4, 'cypress'],
    [5, 'orange'],
    [6, 'pomegranate'],
    [LARGEST_SEED, 'fig'], // 4294967295 = 6 * 715827882 + 3
  ])(
    'starts the species cycle "seed modulo 6" further: seed %i, tree-1 is a %s tree',
    (seed, kind) => {
      expect(speciesOfFirstTree({ cycle: 1, themeId: 'theme-1', seed })).toBe(kind);
    },
  );

  it('does not depend on the theme nor on the cycle number', () => {
    const catalog = catalogForVariant({ cycle: 1, themeId: 'theme-1', seed: 8 });
    expect(catalogForVariant({ cycle: 9, themeId: 'theme-3', seed: 8 })).toBe(catalog);
  });

  it('always has the 60 elements of the specification, whatever the variant', () => {
    for (let cycle = 1; cycle <= 30; cycle += 1) {
      const catalog = catalogForVariant(gardenVariant(cycle, 5));
      expect(catalog.map((element) => element.id)).toEqual(GARDEN_CATALOG.map(({ id }) => id));
      expect(catalog.filter((element) => isTreeKind(element.kind))).toHaveLength(30);
    }
  });

  it('rejects an invalid variant', () => {
    // `as` on purpose: these variants cannot be written in typed code.
    const broken = (variant: unknown): GardenVariant => variant as GardenVariant;
    expect(() => catalogForVariant(broken(null))).toThrow(TypeError);
    expect(() => catalogForVariant(broken({ cycle: 1, themeId: 'theme-1' }))).toThrow(RangeError);
    expect(() => catalogForVariant(broken({ cycle: 0, themeId: 'theme-1', seed: 0 }))).toThrow(
      RangeError,
    );
    expect(() => catalogForVariant(broken({ cycle: 1, themeId: 'sand', seed: 0 }))).toThrow(
      RangeError,
    );
    expect(() => catalogForVariant(broken({ cycle: 1, themeId: 'theme-1', seed: -6 }))).toThrow(
      RangeError,
    );
  });
});

describe('completedGardenState: the garden of a finished khatma, for its badge', () => {
  const variant = gardenVariant(4, 2026);
  const badge = completedGardenState(variant);

  it('is the complete garden: 60 hizb, 60 visible elements, nothing left to grow', () => {
    expect(badge.hizbCompleted).toBe(60);
    expect(badge.isComplete).toBe(true);
    expect(badge.visibleElements).toHaveLength(60);
    expect(badge.lastUnlocked?.id).toBe('full-bloom');
    expect(badge.nextElement).toBeNull();
  });

  it('is at full health, thriving, with flowing water', () => {
    expect(badge.health).toBe(1);
    expect(badge.phase).toBe('thriving');
    expect(badge.water).toBe('flowing');
    expect(badge.missedDaysInARow).toBe(0);
    expect(badge.daysSinceLastWatered).toBe(0);
    expect(badge.isPausedToday).toBe(false);
  });

  it('is the garden of its variant: same theme, same seed, same trees', () => {
    expect(badge.variant).toEqual(variant);
    expect(badge.visibleElements).toEqual(catalogForVariant(variant));
  });

  it('is what the engine shows on the day the last page is read', () => {
    const lastDay = computeGardenState(
      gardenInput('WWW', 'read', { hizbCompleted: 60, currentHizbProgress: 0, variant }),
    );
    expect(badge).toEqual(lastDay);
  });

  it('never changes: no date, no history, same variant, same badge', () => {
    expect(completedGardenState(variant)).toEqual(badge);
    expect(completedGardenState(gardenVariant(4, 2026))).toEqual(badge);
    expect(JSON.parse(JSON.stringify(badge))).toStrictEqual(badge);
  });

  it('gives each of hundreds of khatmas a badge different from the previous one', () => {
    const userSeed = 31_337;
    let previous = completedGardenState(gardenVariant(1, userSeed));
    for (let cycle = 2; cycle <= 400; cycle += 1) {
      const current = completedGardenState(gardenVariant(cycle, userSeed));
      expect(current.variant.cycle).toBe(cycle);
      expect(current.variant.themeId).not.toBe(previous.variant.themeId);
      expect(current.variant.seed).not.toBe(previous.variant.seed);
      expect(current.visibleElements).toHaveLength(60);
      previous = current;
    }
  });

  it('rejects an invalid variant', () => {
    // `as` on purpose: these variants cannot be written in typed code.
    expect(() => completedGardenState(undefined as unknown as GardenVariant)).toThrow(TypeError);
    expect(() =>
      completedGardenState({ ...variant, themeId: 'marble' } as unknown as GardenVariant),
    ).toThrow(RangeError);
    expect(() => completedGardenState({ ...variant, cycle: 0 })).toThrow(RangeError);
  });
});
