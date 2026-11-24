/**
 * Acceptance tests of docs/specs/garden.md, section "Un jardin par khatma" (and
 * docs/DECISIONS.md, D9 and D12): `gardenVariant(cycle, userSeed)` is deterministic,
 * different from one cycle to the next, and valid for extreme seeds.
 */
import {
  catalogForVariant,
  completedGardenState,
  computeGardenState,
  GARDEN_THEME_IDS,
  gardenVariant,
  REFERENCE_GARDEN_VARIANT,
  type GardenVariant,
} from '@/domain/garden';

import { errorThrownBy, expectExplicitError, historyInput } from './acceptance-kit';

const MAX_SEED = 4_294_967_295;

const USER_SEEDS = [
  0,
  1,
  2,
  7,
  1000,
  65_535,
  65_536,
  2_147_483_647,
  2_147_483_648,
  MAX_SEED,
  MAX_SEED + 1,
  Number.MAX_SAFE_INTEGER - 1,
  Number.MAX_SAFE_INTEGER,
];

const CYCLES = [
  1,
  2,
  3,
  4,
  5,
  59,
  60,
  61,
  1000,
  1_000_000,
  MAX_SEED,
  MAX_SEED + 1,
  Number.MAX_SAFE_INTEGER - 1,
];

function expectValidVariant(variant: GardenVariant, cycle: number): void {
  expect(Object.keys(variant).sort()).toEqual(['cycle', 'seed', 'themeId']);
  expect(variant.cycle).toBe(cycle);
  expect(GARDEN_THEME_IDS).toContain(variant.themeId);
  expect(Number.isInteger(variant.seed)).toBe(true);
  expect(variant.seed).toBeGreaterThanOrEqual(0);
  expect(variant.seed).toBeLessThanOrEqual(MAX_SEED);
}

describe('gardenVariant: shape', () => {
  it('gives { cycle, themeId, seed } with the cycle asked for', () => {
    expectValidVariant(gardenVariant(1, 42), 1);
    expectValidVariant(gardenVariant(17, 42), 17);
  });

  it('theme ids are neutral placeholders (D12: the style of the gardens is not decided)', () => {
    expect(GARDEN_THEME_IDS.length).toBeGreaterThanOrEqual(2);
    expect(new Set(GARDEN_THEME_IDS).size).toBe(GARDEN_THEME_IDS.length);
    for (const themeId of GARDEN_THEME_IDS) expect(themeId).toMatch(/^theme-\d+$/);
  });

  it('the reference variant is a valid variant of cycle 1 whose seed does not shift the trees', () => {
    expectValidVariant(REFERENCE_GARDEN_VARIANT, REFERENCE_GARDEN_VARIANT.cycle);
    expect(REFERENCE_GARDEN_VARIANT.seed % 6).toBe(0);
  });
});

describe('gardenVariant: deterministic', () => {
  it('the same cycle and user seed always give the same variant', () => {
    for (const userSeed of USER_SEEDS) {
      for (const cycle of CYCLES) {
        expect(gardenVariant(cycle, userSeed)).toEqual(gardenVariant(cycle, userSeed));
      }
    }
  });

  it('asking for other variants in between changes nothing', () => {
    const first = gardenVariant(3, 99);
    for (let cycle = 1; cycle <= 50; cycle += 1) gardenVariant(cycle, cycle * 31);
    expect(gardenVariant(3, 99)).toEqual(first);
  });

  it('a variant is plain data that survives JSON', () => {
    const variant = gardenVariant(5, 123_456_789);
    expect(JSON.parse(JSON.stringify(variant))).toEqual(variant);
  });
});

describe('gardenVariant: different from one cycle to the next for the same user', () => {
  it.each(USER_SEEDS)(
    'user seed %d: cycles 1 to 400 never repeat the previous garden',
    (userSeed) => {
      let previous = gardenVariant(1, userSeed);
      for (let cycle = 2; cycle <= 400; cycle += 1) {
        const current = gardenVariant(cycle, userSeed);
        // The whole look changes: another theme AND another seed.
        expect([cycle, current.themeId === previous.themeId]).toEqual([cycle, false]);
        expect([cycle, current.seed === previous.seed]).toEqual([cycle, false]);
        previous = current;
      }
    },
  );

  it.each(USER_SEEDS)(
    'user seed %d: the seeds of cycles 1 to 2000 are all different',
    (userSeed) => {
      const seeds = new Set<number>();
      for (let cycle = 1; cycle <= 2000; cycle += 1) seeds.add(gardenVariant(cycle, userSeed).seed);
      expect(seeds.size).toBe(2000);
    },
  );

  it('for 500 users, the second garden never looks like the first', () => {
    for (let userSeed = 0; userSeed < 500; userSeed += 1) {
      const first = gardenVariant(1, userSeed);
      const second = gardenVariant(2, userSeed);
      expect([userSeed, second.themeId === first.themeId]).toEqual([userSeed, false]);
      expect([userSeed, second.seed === first.seed]).toEqual([userSeed, false]);
    }
  });

  it('a user goes through every theme', () => {
    const themes = new Set<string>();
    for (let cycle = 1; cycle <= GARDEN_THEME_IDS.length * 3; cycle += 1) {
      themes.add(gardenVariant(cycle, 77).themeId);
    }
    expect(themes.size).toBe(GARDEN_THEME_IDS.length);
  });

  it('two users do not all get the same first garden', () => {
    const firstGardens = Array.from({ length: 200 }, (_, userSeed) => gardenVariant(1, userSeed));
    expect(new Set(firstGardens.map((variant) => variant.themeId)).size).toBeGreaterThan(1);
    expect(new Set(firstGardens.map((variant) => variant.seed)).size).toBeGreaterThan(190);
  });
});

describe('gardenVariant: valid for extreme seeds and cycles', () => {
  it('every extreme pair gives a valid variant', () => {
    for (const userSeed of USER_SEEDS) {
      for (const cycle of CYCLES) expectValidVariant(gardenVariant(cycle, userSeed), cycle);
    }
  });

  it('every extreme pair gives a garden the module accepts, with a valid catalogue', () => {
    for (const userSeed of USER_SEEDS) {
      for (const cycle of [1, 2, Number.MAX_SAFE_INTEGER - 1]) {
        const variant = gardenVariant(cycle, userSeed);
        const state = computeGardenState(historyInput('WMM.', { variant }));
        expect(state.variant).toEqual(variant);
        expect(state.visibleElements).toEqual(catalogForVariant(variant).slice(0, 24));
        expect(completedGardenState(variant).visibleElements).toEqual(catalogForVariant(variant));
      }
    }
  });

  it('is constant-time: a million-th khatma costs no more than the first', () => {
    const start = Date.now();
    for (let run = 0; run < 2000; run += 1) gardenVariant(1_000_000 + run, 123);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

describe('gardenVariant: invalid arguments', () => {
  it.each([0, -1, -400, 1.5, 0.999, Number.NaN, Number.POSITIVE_INFINITY, -Infinity])(
    'cycle %d is refused (cycles are whole numbers from 1)',
    (cycle) => {
      expectExplicitError(() => gardenVariant(cycle, 1), /cycle/i);
    },
  );

  it.each([-1, -0.5, 0.5, 12.25, Number.NaN, Number.POSITIVE_INFINITY, -Infinity])(
    'user seed %d is refused (seeds are whole numbers from 0)',
    (userSeed) => {
      expectExplicitError(() => gardenVariant(1, userSeed), /seed/i);
    },
  );
});

// docs/CONTRIBUTING.md: "Entrées invalides : erreur explicite, jamais de valeur
// silencieusement corrigée". A seed that is not a whole number cannot pick a tree species.
describe('a variant given to the garden must be one the module can draw', () => {
  it.each([
    ['cycle 0', { ...REFERENCE_GARDEN_VARIANT, cycle: 0 }],
    ['a seed that is not whole', { ...REFERENCE_GARDEN_VARIANT, seed: 1.5 }],
    ['a negative seed', { ...REFERENCE_GARDEN_VARIANT, seed: -6 }],
    ['a NaN seed', { ...REFERENCE_GARDEN_VARIANT, seed: Number.NaN }],
  ])('%s is refused, not drawn wrongly', (_name, variant) => {
    expect(errorThrownBy(() => computeGardenState(historyInput('W', { variant })))).toBeInstanceOf(
      Error,
    );
    expect(errorThrownBy(() => completedGardenState(variant))).toBeInstanceOf(Error);
  });
});
