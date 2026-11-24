import { HIZB_COUNT } from '@/domain/quran/types';

import {
  assertValidCatalog,
  GARDEN_CATALOG,
  isTreeKind,
  TREE_SPECIES_CYCLE,
  type GardenElement,
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

function elementOfHizb(hizb: number): GardenElement {
  const element = GARDEN_CATALOG[hizb - 1];
  if (!element) throw new Error(`No element for hizb ${hizb}`);
  return element;
}

function elementWithId(id: string): GardenElement {
  const element = GARDEN_CATALOG.find((candidate) => candidate.id === id);
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

  // The specification says "tree 13, at hizb 25". With its own list of 30 non-tree
  // elements, 13 of them come before hizb 25, so hizb 25 is the 12th tree. The list wins
  // here; the contradiction is reported in README.md ("Points contestés").
  it('places tree-12 (orange) at hizb 25 and tree-13 (pomegranate) at hizb 26', () => {
    expect(elementOfHizb(25)).toEqual({ hizb: 25, id: 'tree-12', kind: 'orange' });
    expect(elementOfHizb(26)).toEqual({
      hizb: 26,
      id: 'tree-13',
      kind: 'pomegranate',
      verse: '55:68',
    });
  });

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
  ])('associates every %s with verse %s', (kind, verse) => {
    const elements = GARDEN_CATALOG.filter((element) => element.kind === kind);
    expect(elements.length).toBeGreaterThan(0);
    for (const element of elements) expect(element.verse).toBe(verse);
  });

  it('associates no verse with the other kinds', () => {
    const kindsWithVerse = new Set(
      GARDEN_CATALOG.filter((element) => element.verse !== undefined).map(
        (element) => element.kind,
      ),
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

  it('cannot be modified by a caller', () => {
    expect(Object.isFrozen(GARDEN_CATALOG)).toBe(true);
    expect(GARDEN_CATALOG.every((element) => Object.isFrozen(element))).toBe(true);
  });

  it('tells trees from other elements', () => {
    expect(isTreeKind('olive')).toBe(true);
    expect(isTreeKind('roses')).toBe(false);
  });
});

describe('assertValidCatalog', () => {
  const replaceAt = (index: number, element: GardenElement): GardenElement[] =>
    GARDEN_CATALOG.map((original, position) => (position === index ? element : original));

  it('accepts the built-in catalogue', () => {
    expect(() => assertValidCatalog(GARDEN_CATALOG)).not.toThrow();
  });

  it('rejects a catalogue that does not have exactly 60 elements', () => {
    expect(() => assertValidCatalog(GARDEN_CATALOG.slice(0, 59))).toThrow(RangeError);
    expect(() => assertValidCatalog([...GARDEN_CATALOG, elementOfHizb(60)])).toThrow(RangeError);
    expect(() => assertValidCatalog([])).toThrow(RangeError);
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

  it('rejects a malformed verse reference', () => {
    // `as` on purpose: these values cannot be written in typed code, but can arrive from JSON.
    const withVerse = (verse: string) =>
      replaceAt(0, { ...elementOfHizb(1), verse: verse as GardenElement['verse'] });
    expect(() => assertValidCatalog(withVerse('2-25'))).toThrow(/invalid verse reference/);
    expect(() => assertValidCatalog(withVerse('115:1'))).toThrow(RangeError);
    expect(() => assertValidCatalog(withVerse('0:1'))).toThrow(RangeError);
    expect(() => assertValidCatalog(withVerse('2:0'))).toThrow(RangeError);
  });
});
