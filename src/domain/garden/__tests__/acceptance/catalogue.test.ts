/**
 * Acceptance tests of docs/specs/garden.md, section "Catalogue": 60 entries, one per hizb,
 * the elements and tree species the spec lists, and verses that are never displayable while
 * no teacher has validated them. Every expected value below is typed from the spec.
 */
import {
  assertValidCatalog,
  catalogForVariant,
  completedGardenState,
  computeGardenState,
  displayableVerse,
  GARDEN_CATALOG,
  gardenVariant,
  isTreeKind,
  REFERENCE_GARDEN_VARIANT,
  TREE_SPECIES_CYCLE,
  type GardenElement,
  type GardenElementKind,
} from '@/domain/garden';

import { errorThrownBy, expectExplicitError, historyInput } from './acceptance-kit';

/** Spec: "Éléments hors arbres (hizb → id)". */
const SPEC_NON_TREE_ELEMENTS: readonly (readonly [number, string, GardenElementKind])[] = [
  [1, 'channels', 'channels'],
  [2, 'paving', 'paving'],
  [3, 'bed-1', 'bed'],
  [4, 'bed-2', 'bed'],
  [6, 'bed-3', 'bed'],
  [8, 'bed-4', 'bed'],
  [10, 'stepping-stones', 'stepping-stones'],
  [12, 'flowers-1', 'flowers'],
  [15, 'flowers-2', 'flowers'],
  [18, 'flowers-3', 'flowers'],
  [20, 'fountain', 'fountain'],
  [22, 'flowers-4', 'flowers'],
  [24, 'springs', 'springs'],
  [27, 'birds-1', 'birds'],
  [30, 'wall-north', 'wall'],
  [31, 'wall-west', 'wall'],
  [34, 'trellis', 'trellis'],
  [37, 'birds-2', 'birds'],
  [40, 'gate-north', 'gate'],
  [41, 'gate-west', 'gate'],
  [44, 'lanterns', 'lanterns'],
  [47, 'butterflies', 'butterflies'],
  [50, 'pavilion', 'pavilion'],
  [52, 'carpets', 'carpets'],
  [54, 'cushions', 'cushions'],
  [56, 'lectern', 'lectern'],
  [57, 'birds-3', 'birds'],
  [58, 'roses', 'roses'],
  [59, 'waterfall', 'waterfall'],
  [60, 'full-bloom', 'full-bloom'],
];

/** Spec: "cycle pomegranate, date-palm, olive, fig, cypress, orange". */
const SPEC_TREE_SPECIES = ['pomegranate', 'date-palm', 'olive', 'fig', 'cypress', 'orange'];

/** The 30 hizb the spec gives to no other element, in order: tree-1 ... tree-30. */
const SPEC_TREE_HIZB = [
  5, 7, 9, 11, 13, 14, 16, 17, 19, 21, 23, 25, 26, 28, 29, 32, 33, 35, 36, 38, 39, 42, 43, 45, 46,
  48, 49, 51, 53, 55,
];

/** Spec: "Versets associés". By element id, or by tree species. */
const SPEC_VERSES_BY_ID: Readonly<Record<string, string>> = {
  channels: '2:25',
  springs: '55:66',
  trellis: '56:30',
  waterfall: '56:31',
  cushions: '88:15',
  carpets: '88:16',
};
const SPEC_VERSES_BY_SPECIES: Readonly<Record<string, string>> = {
  pomegranate: '55:68',
  'date-palm': '55:68',
  olive: '95:1',
  fig: '95:1',
};

function elementAtHizb(
  hizb: number,
  catalog: readonly GardenElement[] = GARDEN_CATALOG,
): GardenElement {
  const element = catalog[hizb - 1];
  if (element === undefined) throw new Error(`No element for hizb ${hizb}`);
  return element;
}

describe('catalogue: 60 entries, one per hizb, in order', () => {
  it('has 60 entries', () => {
    expect(GARDEN_CATALOG).toHaveLength(60);
  });

  it('entry n is the element of hizb n: hizb 1..60 once each, in order', () => {
    expect(GARDEN_CATALOG.map((element) => element.hizb)).toEqual(
      Array.from({ length: 60 }, (_, index) => index + 1),
    );
  });

  it('ids are unique', () => {
    expect(new Set(GARDEN_CATALOG.map((element) => element.id)).size).toBe(60);
  });

  it('the tester’s own tables cover the 60 hizb exactly once', () => {
    const hizb = [...SPEC_NON_TREE_ELEMENTS.map(([number]) => number), ...SPEC_TREE_HIZB];
    expect(hizb.sort((a, b) => a - b)).toEqual(Array.from({ length: 60 }, (_, index) => index + 1));
  });

  it('passes its own validity check', () => {
    expect(errorThrownBy(() => assertValidCatalog(GARDEN_CATALOG))).toBeUndefined();
  });
});

describe('catalogue: the elements the spec lists', () => {
  it.each(SPEC_NON_TREE_ELEMENTS)('hizb %i unlocks %s (kind %s)', (hizb, id, kind) => {
    const element = elementAtHizb(hizb);
    expect(element.id).toBe(id);
    expect(element.kind).toBe(kind);
    expect(isTreeKind(element.kind)).toBe(false);
  });

  it('there are exactly 30 elements that are not trees', () => {
    expect(SPEC_NON_TREE_ELEMENTS).toHaveLength(30);
    expect(GARDEN_CATALOG.filter((element) => !isTreeKind(element.kind))).toHaveLength(30);
  });
});

describe('catalogue: the 30 other hizb unlock tree-1 ... tree-30, in order', () => {
  it.each(SPEC_TREE_HIZB.map((hizb, index) => [hizb, index + 1] as const))(
    'hizb %i unlocks tree-%i',
    (hizb, treeNumber) => {
      const element = elementAtHizb(hizb);
      expect(element.id).toBe(`tree-${treeNumber}`);
      // Reference variant, no shift: tree n takes the n-th species of the cycle.
      expect(element.kind).toBe(SPEC_TREE_SPECIES[(treeNumber - 1) % 6]);
      expect(isTreeKind(element.kind)).toBe(true);
    },
  );

  it('the species cycle is pomegranate, date-palm, olive, fig, cypress, orange', () => {
    expect(TREE_SPECIES_CYCLE).toEqual(SPEC_TREE_SPECIES);
  });

  it('tree 1 is a pomegranate tree; tree 12, at hizb 25, an orange tree; tree 13, at hizb 26, a pomegranate tree', () => {
    expect(elementAtHizb(5)).toMatchObject({ id: 'tree-1', kind: 'pomegranate' });
    expect(elementAtHizb(25)).toMatchObject({ id: 'tree-12', kind: 'orange' });
    expect(elementAtHizb(26)).toMatchObject({ id: 'tree-13', kind: 'pomegranate' });
  });

  it('isTreeKind knows the six species and nothing else', () => {
    for (const species of TREE_SPECIES_CYCLE) expect(isTreeKind(species)).toBe(true);
    const otherKinds = new Set(SPEC_NON_TREE_ELEMENTS.map(([, , kind]) => kind));
    for (const kind of otherKinds) expect(isTreeKind(kind)).toBe(false);
  });
});

describe('catalogue of a variant: only the tree species shift', () => {
  const variants = Array.from({ length: 40 }, (_, index) => gardenVariant(index + 1, 2026));

  it('the reference variant has the reference catalogue (no shift)', () => {
    expect(catalogForVariant(REFERENCE_GARDEN_VARIANT)).toEqual(GARDEN_CATALOG);
    expect(REFERENCE_GARDEN_VARIANT.seed % 6).toBe(0);
  });

  it('every variant keeps the 60 hizb, the ids, the order and the elements that are not trees', () => {
    for (const variant of variants) {
      const catalog = catalogForVariant(variant);
      expect(errorThrownBy(() => assertValidCatalog(catalog))).toBeUndefined();
      expect(catalog.map((element) => [element.hizb, element.id])).toEqual(
        GARDEN_CATALOG.map((element) => [element.hizb, element.id]),
      );
      for (const [hizb] of SPEC_NON_TREE_ELEMENTS) {
        expect(elementAtHizb(hizb, catalog)).toEqual(elementAtHizb(hizb));
      }
    }
  });

  it('in every variant the trees follow the species cycle, started `seed % 6` species further', () => {
    for (const variant of variants) {
      const catalog = catalogForVariant(variant);
      const shift = variant.seed % 6;
      SPEC_TREE_HIZB.forEach((hizb, index) => {
        expect(elementAtHizb(hizb, catalog).kind).toBe(SPEC_TREE_SPECIES[(index + shift) % 6]);
      });
    }
  });

  it('the six shifts all happen over the first khatmas of a user', () => {
    expect(new Set(variants.map((variant) => variant.seed % 6)).size).toBe(6);
  });

  it('the garden shown uses the catalogue of its variant', () => {
    const variant = variants.find((candidate) => candidate.seed % 6 === 2);
    if (variant === undefined) throw new Error('No variant with a shift of 2 among the 40');
    const state = computeGardenState(historyInput('W', { variant, hizbCompleted: 24 }));
    expect(state.visibleElements).toEqual(catalogForVariant(variant).slice(0, 24));
    // tree-1 (hizb 5): two species after pomegranate. tree-12 (hizb 25): two after orange.
    expect(state.visibleElements[4]).toMatchObject({ id: 'tree-1', kind: 'olive' });
    expect(state.nextElement?.element).toMatchObject({ id: 'tree-12', kind: 'date-palm' });
    expect(completedGardenState(variant).visibleElements).toEqual(catalogForVariant(variant));
  });

  it('a catalogue given as input is used as it is, whatever the variant', () => {
    const variant = variants.find((candidate) => candidate.seed % 6 === 3);
    if (variant === undefined) throw new Error('No variant with a shift of 3 among the 40');
    const state = computeGardenState(
      historyInput('W', { variant, hizbCompleted: 24, catalog: GARDEN_CATALOG }),
    );
    expect(state.visibleElements).toEqual(GARDEN_CATALOG.slice(0, 24));
    expect(state.nextElement?.element).toMatchObject({ id: 'tree-12', kind: 'orange' });
  });
});

describe('verses: the associations of the spec, none of them displayable yet', () => {
  it.each(Object.entries(SPEC_VERSES_BY_ID))('%s is inspired by %s', (id, verseKey) => {
    const element = GARDEN_CATALOG.find((candidate) => candidate.id === id);
    expect(element?.verse?.key).toBe(verseKey);
  });

  it.each(Object.entries(SPEC_VERSES_BY_SPECIES))(
    'every %s tree is inspired by %s',
    (species, verseKey) => {
      const trees = GARDEN_CATALOG.filter((element) => element.kind === species);
      expect(trees).toHaveLength(5);
      for (const tree of trees) expect(tree.verse?.key).toBe(verseKey);
    },
  );

  it('no other element carries a verse (cypress and orange trees included)', () => {
    const expectedIds = GARDEN_CATALOG.filter(
      (element) => element.id in SPEC_VERSES_BY_ID || element.kind in SPEC_VERSES_BY_SPECIES,
    ).map((element) => element.id);
    const actualIds = GARDEN_CATALOG.filter((element) => element.verse !== undefined).map(
      (element) => element.id,
    );
    expect(actualIds).toEqual(expectedIds);
    // 6 named elements + 4 species × 5 trees.
    expect(actualIds).toHaveLength(26);
  });

  it('in a shifted variant the verse follows the species, not the tree number', () => {
    for (let cycle = 1; cycle <= 12; cycle += 1) {
      for (const element of catalogForVariant(gardenVariant(cycle, 5))) {
        if (!isTreeKind(element.kind)) continue;
        expect([element.kind, element.verse?.key]).toEqual([
          element.kind,
          SPEC_VERSES_BY_SPECIES[element.kind],
        ]);
      }
    }
  });

  it('no association is validated by a teacher yet', () => {
    for (const element of GARDEN_CATALOG) {
      if (element.verse !== undefined) expect(element.verse.validatedByTeacher).toBe(false);
    }
  });

  it('no verse is displayable: not in the catalogue, not in any variant', () => {
    for (const element of GARDEN_CATALOG) expect(displayableVerse(element)).toBeNull();
    for (let cycle = 1; cycle <= 24; cycle += 1) {
      for (const element of catalogForVariant(gardenVariant(cycle, 31))) {
        expect(displayableVerse(element)).toBeNull();
      }
    }
  });

  it('no verse is displayable from a state: visible elements, last unlocked, growing element', () => {
    const states = [
      computeGardenState(historyInput('W', { hizbCompleted: 59 })),
      computeGardenState(historyInput('W' + 'M'.repeat(11) + '.', { hizbCompleted: 34 })),
      completedGardenState(REFERENCE_GARDEN_VARIANT),
      completedGardenState(gardenVariant(9, 1234)),
    ];
    for (const state of states) {
      for (const element of state.visibleElements) expect(displayableVerse(element)).toBeNull();
      if (state.lastUnlocked !== null) expect(displayableVerse(state.lastUnlocked)).toBeNull();
      if (state.nextElement !== null) {
        expect(displayableVerse(state.nextElement.element)).toBeNull();
      }
    }
  });

  it('displayableVerse gives the verse only once a teacher validated it', () => {
    const base = { hizb: 1, id: 'channels', kind: 'channels' } as const;
    expect(displayableVerse(base)).toBeNull();
    expect(
      displayableVerse({ ...base, verse: { key: '2:25', validatedByTeacher: false } }),
    ).toBeNull();
    expect(displayableVerse({ ...base, verse: { key: '2:25', validatedByTeacher: true } })).toBe(
      '2:25',
    );
  });

  it('displayableVerse does not take a truthy value for a validation', () => {
    // `as`: what a careless JSON payload could carry instead of the boolean.
    const verse = { key: '2:25', validatedByTeacher: 'no' as unknown as boolean } as const;
    expect(displayableVerse({ hizb: 1, id: 'channels', kind: 'channels', verse })).toBeNull();
  });
});

describe('assertValidCatalog refuses what is not a garden of 60 steps', () => {
  const copy = (): GardenElement[] => GARDEN_CATALOG.map((element) => ({ ...element }));

  it('59 or 61 entries', () => {
    expectExplicitError(() => assertValidCatalog(copy().slice(0, 59)));
    expectExplicitError(() =>
      assertValidCatalog([...copy(), { hizb: 61, id: 'extra', kind: 'roses' }]),
    );
    expectExplicitError(() => assertValidCatalog([]));
  });

  it('entries out of hizb order', () => {
    const catalog = copy();
    const first = catalog[0];
    const second = catalog[1];
    if (first === undefined || second === undefined) throw new Error('Catalogue too short');
    catalog[0] = second;
    catalog[1] = first;
    expectExplicitError(() => assertValidCatalog(catalog));
  });

  it('the same hizb twice', () => {
    const catalog = copy();
    catalog[10] = { hizb: 10, id: 'twice', kind: 'roses' };
    expectExplicitError(() => assertValidCatalog(catalog));
  });

  it('the same id twice', () => {
    const catalog = copy();
    catalog[10] = { hizb: 11, id: 'channels', kind: 'channels' };
    expectExplicitError(() => assertValidCatalog(catalog));
  });

  it('an invalid catalogue given to computeGardenState is refused too', () => {
    const catalog = copy().slice(0, 59);
    expectExplicitError(() => computeGardenState(historyInput('W', { catalog })));
  });
});
