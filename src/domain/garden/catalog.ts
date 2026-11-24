/**
 * The 60 steps of the garden: one element per finished hizb.
 *
 * PROVISIONAL CONTENT. The visual style of the garden is not final, and the verse
 * associations MUST be validated by a teacher before any of them is shown to a user:
 * that is what `validatedByTeacher` records, one association at a time. None is validated
 * yet. The garden is *inspired* by these verses; it does not claim to depict Paradise.
 *
 * Everything in the first half of this file is data. The engine (garden-state.ts) only
 * relies on the order and the length of a catalogue, so the content can be rewritten
 * without touching the rules.
 */
import { HIZB_COUNT, SURAH_COUNT, type VerseKey } from '@/domain/quran/types';

import { isList, isObject } from './checks';
import type { GardenElement, GardenElementKind, GardenVerse, TreeSpecies } from './types';

/** Elements that are not trees, by the number of finished hizb that unlocks them. */
const ELEMENTS_BY_HIZB: Readonly<
  Record<number, { readonly id: string; readonly kind: GardenElementKind }>
> = {
  1: { id: 'channels', kind: 'channels' },
  2: { id: 'paving', kind: 'paving' },
  3: { id: 'bed-1', kind: 'bed' },
  4: { id: 'bed-2', kind: 'bed' },
  6: { id: 'bed-3', kind: 'bed' },
  8: { id: 'bed-4', kind: 'bed' },
  10: { id: 'stepping-stones', kind: 'stepping-stones' },
  12: { id: 'flowers-1', kind: 'flowers' },
  15: { id: 'flowers-2', kind: 'flowers' },
  18: { id: 'flowers-3', kind: 'flowers' },
  20: { id: 'fountain', kind: 'fountain' },
  22: { id: 'flowers-4', kind: 'flowers' },
  24: { id: 'springs', kind: 'springs' },
  27: { id: 'birds-1', kind: 'birds' },
  30: { id: 'wall-north', kind: 'wall' },
  31: { id: 'wall-west', kind: 'wall' },
  34: { id: 'trellis', kind: 'trellis' },
  37: { id: 'birds-2', kind: 'birds' },
  40: { id: 'gate-north', kind: 'gate' },
  41: { id: 'gate-west', kind: 'gate' },
  44: { id: 'lanterns', kind: 'lanterns' },
  47: { id: 'butterflies', kind: 'butterflies' },
  50: { id: 'pavilion', kind: 'pavilion' },
  52: { id: 'carpets', kind: 'carpets' },
  54: { id: 'cushions', kind: 'cushions' },
  56: { id: 'lectern', kind: 'lectern' },
  57: { id: 'birds-3', kind: 'birds' },
  58: { id: 'roses', kind: 'roses' },
  59: { id: 'waterfall', kind: 'waterfall' },
  60: { id: 'full-bloom', kind: 'full-bloom' },
};

/**
 * Every other hizb unlocks a tree. Tree n takes the n-th species of this cycle; the garden
 * of each khatma starts the cycle at a different species (see `catalogForVariant`).
 */
export const TREE_SPECIES_CYCLE: readonly TreeSpecies[] = Object.freeze([
  'pomegranate',
  'date-palm',
  'olive',
  'fig',
  'cypress',
  'orange',
]);

/** A verse association waiting for a teacher: it exists as data, and is shown nowhere. */
function awaitingValidation(key: VerseKey): GardenVerse {
  return Object.freeze({ key, validatedByTeacher: false });
}

/**
 * Verse that inspired a kind of element. When a teacher has approved an association,
 * replace its line by `{ key: '...', validatedByTeacher: true }`: nothing else changes.
 */
const VERSE_BY_KIND: Readonly<Partial<Record<GardenElementKind, GardenVerse>>> = {
  channels: awaitingValidation('2:25'),
  springs: awaitingValidation('55:66'),
  pomegranate: awaitingValidation('55:68'),
  'date-palm': awaitingValidation('55:68'),
  olive: awaitingValidation('95:1'),
  fig: awaitingValidation('95:1'),
  trellis: awaitingValidation('56:30'),
  waterfall: awaitingValidation('56:31'),
  cushions: awaitingValidation('88:15'),
  carpets: awaitingValidation('88:16'),
};

// ---------------------------------------------------------------------------------------
// End of the data. Below: how the data becomes catalogues, and how a catalogue is checked.
// ---------------------------------------------------------------------------------------

const VERSE_KEY_PATTERN = /^(\d+):(\d+)$/;

export function isTreeKind(kind: GardenElementKind): kind is TreeSpecies {
  // Widening a readonly TreeSpecies[] to its element supertype, only to call includes().
  return (TREE_SPECIES_CYCLE as readonly GardenElementKind[]).includes(kind);
}

/**
 * The verse of an element when it may be shown to a user, otherwise null.
 * Interfaces must go through this function rather than read `element.verse.key`.
 */
export function displayableVerse(element: GardenElement): VerseKey | null {
  return element.verse?.validatedByTeacher === true ? element.verse.key : null;
}

/** Species of the `treeNumber`-th tree (1-based) when the cycle is shifted by `offset`. */
function treeSpeciesAt(treeNumber: number, treeSpeciesOffset: number): TreeSpecies {
  const position = (treeNumber - 1 + treeSpeciesOffset) % TREE_SPECIES_CYCLE.length;
  const species = TREE_SPECIES_CYCLE[position];
  if (species === undefined) {
    throw new RangeError(`Garden catalogue: no tree species at position ${position}`);
  }
  return species;
}

function elementOf(hizb: number, id: string, kind: GardenElementKind): GardenElement {
  const verse = VERSE_BY_KIND[kind];
  return Object.freeze(verse === undefined ? { hizb, id, kind } : { hizb, id, kind, verse });
}

function buildCatalog(treeSpeciesOffset: number): readonly GardenElement[] {
  const catalog: GardenElement[] = [];
  let treeCount = 0;
  for (let hizb = 1; hizb <= HIZB_COUNT; hizb += 1) {
    const element = ELEMENTS_BY_HIZB[hizb];
    if (element) {
      catalog.push(elementOf(hizb, element.id, element.kind));
      continue;
    }
    treeCount += 1;
    catalog.push(elementOf(hizb, `tree-${treeCount}`, treeSpeciesAt(treeCount, treeSpeciesOffset)));
  }
  return Object.freeze(catalog);
}

/** Shape and surah range only: the garden does not know how many verses a surah has. */
function isPlausibleVerseKey(verse: unknown): boolean {
  if (typeof verse !== 'string') return false;
  const match = VERSE_KEY_PATTERN.exec(verse);
  if (!match) return false;
  const surah = Number(match[1]);
  const verseNumber = Number(match[2]);
  return surah >= 1 && surah <= SURAH_COUNT && verseNumber >= 1;
}

function assertValidVerse(verse: GardenVerse, elementId: string): void {
  // A verse written as a bare "2:25" has no validation flag: it must not slip through.
  if (!isObject(verse) || !isPlausibleVerseKey(verse.key)) {
    const received = isObject(verse) ? verse.key : verse;
    throw new RangeError(
      `Garden catalogue: "${elementId}" has an invalid verse reference "${String(received)}"`,
    );
  }
  if (typeof verse.validatedByTeacher !== 'boolean') {
    throw new RangeError(
      `Garden catalogue: the verse of "${elementId}" must say whether a teacher validated it`,
    );
  }
}

/**
 * Throws unless `catalog` is a usable garden: exactly one element per hizb, in hizb
 * order, with unique ids and well-formed verse associations.
 */
export function assertValidCatalog(catalog: readonly GardenElement[]): void {
  if (!isList(catalog)) {
    throw new TypeError('Garden catalogue: expected a list of elements');
  }
  if (catalog.length !== HIZB_COUNT) {
    throw new RangeError(
      `Garden catalogue: expected ${HIZB_COUNT} elements, got ${catalog.length}`,
    );
  }
  const seenIds = new Set<string>();
  catalog.forEach((element, index) => {
    const expectedHizb = index + 1;
    if (!isObject(element)) {
      throw new TypeError(`Garden catalogue: position ${expectedHizb} does not hold an element`);
    }
    if (element.hizb !== expectedHizb) {
      throw new RangeError(
        `Garden catalogue: element at position ${expectedHizb} must belong to hizb ${expectedHizb}, got hizb ${element.hizb}`,
      );
    }
    if (typeof element.id !== 'string' || element.id.length === 0) {
      throw new RangeError(`Garden catalogue: hizb ${expectedHizb} has no id`);
    }
    if (seenIds.has(element.id)) {
      throw new RangeError(`Garden catalogue: id "${element.id}" is used more than once`);
    }
    seenIds.add(element.id);
    if (typeof element.kind !== 'string' || element.kind.length === 0) {
      throw new RangeError(`Garden catalogue: "${element.id}" has no kind`);
    }
    if (element.verse !== undefined) assertValidVerse(element.verse, element.id);
  });
}

/**
 * One catalogue per shift of the tree species cycle, built once. A variant only changes
 * the species of the trees, so the gardens of thousands of khatmas share these six lists.
 */
const CATALOG_BY_TREE_SPECIES_OFFSET: readonly (readonly GardenElement[])[] = Object.freeze(
  TREE_SPECIES_CYCLE.map((_species, treeSpeciesOffset) => {
    const catalog = buildCatalog(treeSpeciesOffset);
    // A broken catalogue must stop the app at start-up, not show a wrong garden later.
    assertValidCatalog(catalog);
    return catalog;
  }),
);

/**
 * The 60 elements of a garden whose tree species cycle is shifted by `treeSpeciesOffset`
 * (0..5). Ids, order and non-tree elements are the same for every shift.
 */
export function catalogForTreeSpeciesOffset(treeSpeciesOffset: number): readonly GardenElement[] {
  const catalog = CATALOG_BY_TREE_SPECIES_OFFSET[treeSpeciesOffset];
  if (catalog === undefined) {
    throw new RangeError(
      `Garden catalogue: treeSpeciesOffset must be a whole number from 0 to ${TREE_SPECIES_CYCLE.length - 1}, got ${treeSpeciesOffset}`,
    );
  }
  return catalog;
}

/** The catalogue of the reference variant: no shift, tree-1 is a pomegranate tree. */
export const GARDEN_CATALOG: readonly GardenElement[] = catalogForTreeSpeciesOffset(0);
