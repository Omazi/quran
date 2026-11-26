import type { GardenStyleId, LevelsConfig } from './types';

/**
 * The gardens of the first version, one per level, in the order the owner chose on
 * 26 November 2026: level 1 is the fountain courtyard. The island on a lake waits for an update.
 *
 * WARNING: the order is what people's badges are made of. Add a style at the end only; never
 * reorder or remove one.
 */
export const GARDEN_STYLES: readonly GardenStyleId[] = Object.freeze([
  'fountain-courtyard',
  'oasis',
  'waterside-orchard',
  'mountain-garden',
  'cherry-blossoms',
  'pine-clearing',
  'night-garden',
]);

/**
 * - `celebrationWindowDays`: a week. A khatma completed on this phone is celebrated the same day;
 *   one completed on another phone shows up at the next sync, within days. Older than that, it
 *   comes from a restored copy or an old journal: celebrating it would surprise more than please.
 */
export const DEFAULT_LEVELS_CONFIG: LevelsConfig = Object.freeze({ celebrationWindowDays: 7 });

export const FIRST_LEVEL = 1;
