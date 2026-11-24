/**
 * The 60 steps of the garden: one element per hizb.
 *
 * PROVISIONAL CONTENT. The visual style of the garden is not final, and the verse
 * associations MUST be validated by a teacher before any of them is shown to a user.
 * The garden is *inspired* by these verses; it does not claim to depict Paradise.
 *
 * Everything here is data. The engine (garden-state.ts) only relies on the order and the
 * length of the list, so this file can be rewritten without touching the rules.
 */
import { HIZB_COUNT, SURAH_COUNT, type VerseKey } from '@/domain/quran/types';

import type { GardenElement, GardenElementKind, TreeSpecies } from './types';

/** Elements that are not trees, by the hizb that unlocks them. */
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

/** Every other hizb unlocks a tree. Tree n takes the next species of this cycle. */
export const TREE_SPECIES_CYCLE: readonly TreeSpecies[] = Object.freeze([
  'pomegranate',
  'date-palm',
  'olive',
  'fig',
  'cypress',
  'orange',
]);

/** Verse that inspired a kind of element. To be validated by a teacher before display. */
const VERSE_BY_KIND: Readonly<Partial<Record<GardenElementKind, VerseKey>>> = {
  channels: '2:25',
  springs: '55:66',
  pomegranate: '55:68',
  'date-palm': '55:68',
  olive: '95:1',
  fig: '95:1',
  trellis: '56:30',
  waterfall: '56:31',
  cushions: '88:15',
  carpets: '88:16',
};

const VERSE_KEY_PATTERN = /^(\d+):(\d+)$/;

export function isTreeKind(kind: GardenElementKind): kind is TreeSpecies {
  // Widening a readonly TreeSpecies[] to its element supertype, only to call includes().
  return (TREE_SPECIES_CYCLE as readonly GardenElementKind[]).includes(kind);
}

function withVerse(hizb: number, id: string, kind: GardenElementKind): GardenElement {
  const verse = VERSE_BY_KIND[kind];
  return Object.freeze(verse === undefined ? { hizb, id, kind } : { hizb, id, kind, verse });
}

function buildCatalog(): readonly GardenElement[] {
  const catalog: GardenElement[] = [];
  let treeCount = 0;
  for (let hizb = 1; hizb <= HIZB_COUNT; hizb += 1) {
    const element = ELEMENTS_BY_HIZB[hizb];
    if (element) {
      catalog.push(withVerse(hizb, element.id, element.kind));
      continue;
    }
    const species = TREE_SPECIES_CYCLE[treeCount % TREE_SPECIES_CYCLE.length];
    if (species === undefined) throw new RangeError('Garden catalogue: no tree species defined');
    treeCount += 1;
    catalog.push(withVerse(hizb, `tree-${treeCount}`, species));
  }
  return Object.freeze(catalog);
}

/**
 * Throws unless `catalog` is a usable garden: exactly one element per hizb, in hizb
 * order, with unique ids and well-formed verse references.
 */
export function assertValidCatalog(catalog: readonly GardenElement[]): void {
  if (catalog.length !== HIZB_COUNT) {
    throw new RangeError(
      `Garden catalogue: expected ${HIZB_COUNT} elements, got ${catalog.length}`,
    );
  }
  const seenIds = new Set<string>();
  catalog.forEach((element, index) => {
    const expectedHizb = index + 1;
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
    if (element.verse !== undefined && !isPlausibleVerseKey(element.verse)) {
      throw new RangeError(
        `Garden catalogue: "${element.id}" has an invalid verse reference "${element.verse}"`,
      );
    }
  });
}

/** Shape and surah range only: the garden does not know how many verses a surah has. */
function isPlausibleVerseKey(verse: string): boolean {
  const match = VERSE_KEY_PATTERN.exec(verse);
  if (!match) return false;
  const surah = Number(match[1]);
  const verseNumber = Number(match[2]);
  return surah >= 1 && surah <= SURAH_COUNT && verseNumber >= 1;
}

export const GARDEN_CATALOG: readonly GardenElement[] = buildCatalog();

// A broken catalogue must stop the app at start-up, not show a wrong garden later.
assertValidCatalog(GARDEN_CATALOG);
