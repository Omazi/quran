import { HIZB_COUNT } from '@/domain/quran/types';

import { catalogForTreeSpeciesOffset } from '../catalog';
import {
  assertValidCatalog,
  displayableVerse,
  GARDEN_CATALOG,
  isTreeKind,
  TREE_SPECIES_CYCLE,
  type GardenElement,
  type GardenVerse,
} from '../index';

/** Written by hand from the specification, independently of catalog.ts. */
// prettier-ignore
const EXPECTED_IDS_IN_HIZB_ORDER = [
  'channels', 'paving', 'bed-1', 'bed-2', 'tree-1', 'bed-3', 'tree-2', 'bed-4', 'tree-3',
  'stepping-stones', 'tree-4', 'flowers-1', 'tree-5', 'tree-6', 'flowers-2', 'tree-7', 'tree-8',
  'flowers-3', 'tree-9', 'fountain', 'tree-10', 'flowers-4', 'tree-11', 'springs', 'tree-12',
  'tree-13', 'birds-1', 'tree-14', 'tree-15', 'wall-north', 'wall-west', 'tree-16', 'tree-17',
  'trellis', 'tree-18', 'tree-19', 'birds-2', 'tree-20', 'tree-21', 'gate-north', 'gate-west',
  'tree-22', 'tree-23', 'lanterns', 'tree-24', 'tree-25', 'butterflies', 'tree-26', 'tree-27',
  'pavilion', 'tree-28', 'carpets', 'tree-29', 'cushions', 'tree-30', 'lectern', 'birds-3',
  'roses', 'waterfall', 'full-bloom',
];

/** The six catalogues the module can serve: one per shift of the tree species cycle. */
const ALL_BUILT_IN_CATALOGS = TREE_SPECIES_CYCLE.map((_species, offset) =>
  catalogForTreeSpeciesOffset(offset),
);

function elementOfHizb(hizb: number): GardenElement {
  const element = GARDEN_CATALOG[hizb - 1];
  if (!element) throw new Error(`No element for hizb ${hizb}`);
  return element;
}

function elementWithId(id: string, catalog = GARDEN_CATALOG): GardenElement {
  const element = catalog.find((candidate) => candidate.id === id);
  if (!element) throw new Error(`No element with id ${id}`);
  return element;
}

describe('garden catalogue', () => {
  it('has exactly 60 elements, one per hizb', () => {
    expect(GARDEN_CATALOG).toHaveLength(HIZB_COUNT);
    expect(GARDEN_CATALOG).toHaveLength(60);
  });

  it('lists hizb 1 to 60 once each, in order', () => {
    expect(GARDEN_CATALOG.map((element) => element.hizb)).toEqual(
      Array.from({ length: 60 }, (_, index) => index + 1),
    );
  });

  it('gives every element a unique id', () => {
    expect(new Set(GARDEN_CATALOG.map((element) => element.id)).size).toBe(60);
  });

  it('matches the specification, element by element', () => {
    expect(GARDEN_CATALOG.map((element) => element.id)).toEqual(EXPECTED_IDS_IN_HIZB_ORDER);
  });

  it.each([
    [1, 'channels'],
    [2, 'paving'],
    [10, 'stepping-stones'],
    [20, 'fountain'],
    [24, 'springs'],
    [30, 'wall-north'],
    [31, 'wall-west'],
    [50, 'pavilion'],
    [59, 'waterfall'],
    [60, 'full-bloom'],
  ])('unlocks at hizb %i the element %s', (hizb, id) => {
    expect(elementOfHizb(hizb).id).toBe(id);
  });

  it('groups numbered elements under one kind', () => {
    expect(elementWithId('bed-3').kind).toBe('bed');
    expect(elementWithId('flowers-4').kind).toBe('flowers');
    expect(elementWithId('birds-2').kind).toBe('birds');
    expect(elementWithId('wall-west').kind).toBe('wall');
    expect(elementWithId('gate-north').kind).toBe('gate');
  });

  it('unlocks a tree at each of the 30 other hizb, tree-1 to tree-30 in order', () => {
    const trees = GARDEN_CATALOG.filter((element) => isTreeKind(element.kind));
    expect(trees.map((tree) => tree.id)).toEqual(
      Array.from({ length: 30 }, (_, index) => `tree-${index + 1}`),
    );
  });

  it('cycles tree species: pomegranate, date-palm, olive, fig, cypress, orange', () => {
    expect(TREE_SPECIES_CYCLE).toEqual([
      'pomegranate',
      'date-palm',
      'olive',
      'fig',
      'cypress',
      'orange',
    ]);
    expect(elementWithId('tree-1').kind).toBe('pomegranate');
    expect(elementWithId('tree-2').kind).toBe('date-palm');
    expect(elementWithId('tree-6').kind).toBe('orange');
    expect(elementWithId('tree-7').kind).toBe('pomegranate');
    expect(elementWithId('tree-13').kind).toBe('pomegranate');
    expect(elementWithId('tree-30').kind).toBe('orange');
  });

  // 13 of the non-tree elements come before hizb 25: it is the 12th tree.
  it('places tree-12 (orange) at hizb 25 and tree-13 (pomegranate) at hizb 26', () => {
    expect(elementOfHizb(25)).toEqual({ hizb: 25, id: 'tree-12', kind: 'orange' });
    expect(elementOfHizb(26)).toEqual({
      hizb: 26,
      id: 'tree-13',
      kind: 'pomegranate',
      verse: { key: '55:68', validatedByTeacher: false },
    });
  });

  it('cannot be modified by a caller', () => {
    for (const catalog of ALL_BUILT_IN_CATALOGS) {
      expect(Object.isFrozen(catalog)).toBe(true);
      expect(catalog.every((element) => Object.isFrozen(element))).toBe(true);
      expect(catalog.every((element) => !element.verse || Object.isFrozen(element.verse))).toBe(
        true,
      );
    }
  });

  it('tells trees from other elements', () => {
    expect(isTreeKind('olive')).toBe(true);
    expect(isTreeKind('roses')).toBe(false);
  });
});

describe('tree species shifted by the variant', () => {
  it('is the reference catalogue when the shift is 0', () => {
    expect(catalogForTreeSpeciesOffset(0)).toBe(GARDEN_CATALOG);
  });

  it.each([
    [0, 'pomegranate'],
    [1, 'date-palm'],
    [2, 'olive'],
    [3, 'fig'],
    [4, 'cypress'],
    [5, 'orange'],
  ] as const)('with a shift of %i, tree-1 is a %s tree', (offset, species) => {
    expect(elementWithId('tree-1', catalogForTreeSpeciesOffset(offset)).kind).toBe(species);
  });

  it('wraps around the cycle: with a shift of 5, tree-2 is a pomegranate tree again', () => {
    const catalog = catalogForTreeSpeciesOffset(5);
    expect(elementWithId('tree-2', catalog).kind).toBe('pomegranate');
    expect(elementWithId('tree-30', catalog).kind).toBe('cypress');
  });

  it('changes nothing but the species of the trees: same ids, same order, same other elements', () => {
    for (const catalog of ALL_BUILT_IN_CATALOGS) {
      expect(catalog.map((element) => element.id)).toEqual(EXPECTED_IDS_IN_HIZB_ORDER);
      catalog.forEach((element, index) => {
        const reference = GARDEN_CATALOG[index];
        if (!isTreeKind(element.kind)) expect(element).toEqual(reference);
        else expect(isTreeKind(reference?.kind ?? 'roses')).toBe(true);
      });
    }
  });

  it('keeps the six species evenly spread, five trees each, whatever the shift', () => {
    for (const catalog of ALL_BUILT_IN_CATALOGS) {
      for (const species of TREE_SPECIES_CYCLE) {
        expect(catalog.filter((element) => element.kind === species)).toHaveLength(5);
      }
    }
  });

  it.each([-1, 6, 1.5, Number.NaN])('rejects a shift of %d (outside 0..5)', (offset) => {
    expect(() => catalogForTreeSpeciesOffset(offset)).toThrow(RangeError);
  });
});

describe('associated verses', () => {
  it.each([
    ['channels', '2:25'],
    ['springs', '55:66'],
    ['pomegranate', '55:68'],
    ['date-palm', '55:68'],
    ['olive', '95:1'],
    ['fig', '95:1'],
    ['trellis', '56:30'],
    ['waterfall', '56:31'],
    ['cushions', '88:15'],
    ['carpets', '88:16'],
  ])('associates every %s with verse %s, in every variant', (kind, verse) => {
    for (const catalog of ALL_BUILT_IN_CATALOGS) {
      const elements = catalog.filter((element) => element.kind === kind);
      expect(elements.length).toBeGreaterThan(0);
      for (const element of elements) expect(element.verse?.key).toBe(verse);
    }
  });

  it('associates no verse with the other kinds', () => {
    const kindsWithVerse = new Set(
      ALL_BUILT_IN_CATALOGS.flat()
        .filter((element) => element.verse !== undefined)
        .map((element) => element.kind),
    );
    expect([...kindsWithVerse].sort()).toEqual([
      'carpets',
      'channels',
      'cushions',
      'date-palm',
      'fig',
      'olive',
      'pomegranate',
      'springs',
      'trellis',
      'waterfall',
    ]);
  });
});

describe('verses are shown only once validated by a teacher', () => {
  const withVerse = (verse: GardenVerse): GardenElement => ({ ...elementOfHizb(1), verse });

  it('gives every verse of the catalogue a validation flag', () => {
    const verses = ALL_BUILT_IN_CATALOGS.flat().flatMap((element) =>
      element.verse ? [element.verse] : [],
    );
    expect(verses.length).toBeGreaterThan(0);
    for (const verse of verses) expect(typeof verse.validatedByTeacher).toBe('boolean');
  });

  // This test is meant to fail the day a verse is marked as validated: the list below
  // must then be updated by hand, with the name of the teacher in the commit message.
  it('has no validated verse yet: nothing religious can be displayed', () => {
    const validated = ALL_BUILT_IN_CATALOGS.flat().filter(
      (element) => element.verse?.validatedByTeacher === true,
    );
    expect(validated).toEqual([]);
    for (const element of ALL_BUILT_IN_CATALOGS.flat()) {
      expect(displayableVerse(element)).toBeNull();
    }
  });

  it('hides a verse that is not validated', () => {
    expect(displayableVerse(withVerse({ key: '2:25', validatedByTeacher: false }))).toBeNull();
  });

  it('shows a verse once it is validated', () => {
    expect(displayableVerse(withVerse({ key: '2:25', validatedByTeacher: true }))).toBe('2:25');
  });

  it('shows nothing for an element without verse', () => {
    expect(displayableVerse(elementOfHizb(2))).toBeNull();
  });

  it('hides a verse whose flag is anything but true', () => {
    // `as` on purpose: these values cannot be written in typed code, but can arrive from JSON.
    const flaggedWith = (flag: unknown): GardenElement =>
      withVerse({ key: '2:25', validatedByTeacher: flag as boolean });
    expect(displayableVerse(flaggedWith(undefined))).toBeNull();
    expect(displayableVerse(flaggedWith('true'))).toBeNull();
    expect(displayableVerse(flaggedWith(1))).toBeNull();
  });
});

describe('assertValidCatalog', () => {
  const replaceAt = (index: number, element: GardenElement): GardenElement[] =>
    GARDEN_CATALOG.map((original, position) => (position === index ? element : original));
  // `as` on purpose in this block: these values cannot be written in typed code, but can
  // arrive from JSON.
  const withVerse = (verse: unknown): GardenElement[] =>
    replaceAt(0, { ...elementOfHizb(1), verse: verse as GardenVerse });

  it('accepts the built-in catalogues', () => {
    for (const catalog of ALL_BUILT_IN_CATALOGS) {
      expect(() => assertValidCatalog(catalog)).not.toThrow();
    }
  });

  it('rejects a catalogue that does not have exactly 60 elements', () => {
    expect(() => assertValidCatalog(GARDEN_CATALOG.slice(0, 59))).toThrow(RangeError);
    expect(() => assertValidCatalog([...GARDEN_CATALOG, elementOfHizb(60)])).toThrow(RangeError);
    expect(() => assertValidCatalog([])).toThrow(RangeError);
  });

  it('rejects what is not a list of elements', () => {
    expect(() => assertValidCatalog(null as unknown as GardenElement[])).toThrow(TypeError);
    expect(() => assertValidCatalog('catalogue' as unknown as GardenElement[])).toThrow(TypeError);
    expect(() => assertValidCatalog(replaceAt(3, null as unknown as GardenElement))).toThrow(
      TypeError,
    );
  });

  it('rejects a hizb that is missing, repeated or out of order', () => {
    expect(() => assertValidCatalog(replaceAt(4, { ...elementOfHizb(5), hizb: 6 }))).toThrow(
      /hizb 5/,
    );
    const swapped = [...GARDEN_CATALOG];
    swapped[0] = elementOfHizb(2);
    swapped[1] = elementOfHizb(1);
    expect(() => assertValidCatalog(swapped)).toThrow(RangeError);
  });

  it('rejects a duplicated or empty id', () => {
    expect(() =>
      assertValidCatalog(replaceAt(9, { ...elementOfHizb(10), id: 'channels' })),
    ).toThrow(/"channels" is used more than once/);
    expect(() => assertValidCatalog(replaceAt(9, { ...elementOfHizb(10), id: '' }))).toThrow(
      RangeError,
    );
  });

  it('rejects an element without kind', () => {
    const noKind = { ...elementOfHizb(10), kind: '' as GardenElement['kind'] };
    expect(() => assertValidCatalog(replaceAt(9, noKind))).toThrow(/has no kind/);
  });

  it('rejects a malformed verse reference', () => {
    const referring = (key: string) => withVerse({ key, validatedByTeacher: false });
    expect(() => assertValidCatalog(referring('2-25'))).toThrow(/invalid verse reference "2-25"/);
    expect(() => assertValidCatalog(referring('115:1'))).toThrow(RangeError);
    expect(() => assertValidCatalog(referring('0:1'))).toThrow(RangeError);
    expect(() => assertValidCatalog(referring('2:0'))).toThrow(RangeError);
    expect(() => assertValidCatalog(withVerse({ validatedByTeacher: false }))).toThrow(RangeError);
  });

  it('rejects a verse without validation flag: a bare reference could be shown by mistake', () => {
    expect(() => assertValidCatalog(withVerse('2:25'))).toThrow(/invalid verse reference "2:25"/);
    expect(() => assertValidCatalog(withVerse({ key: '2:25' }))).toThrow(
      /must say whether a teacher validated it/,
    );
    expect(() => assertValidCatalog(withVerse({ key: '2:25', validatedByTeacher: 'yes' }))).toThrow(
      RangeError,
    );
    expect(() => assertValidCatalog(withVerse(null))).toThrow(RangeError);
  });

  it('accepts a validated verse', () => {
    expect(() =>
      assertValidCatalog(withVerse({ key: '2:25', validatedByTeacher: true })),
    ).not.toThrow();
  });
});
