import type { GardenStyleId } from '@/domain/levels';
import type { PaletteRole } from '@/ui';

/**
 * A colour cast laid over the level-1 pictures (`GardenScene`'s `tint`): how a level garden is
 * drawn while its pack is not on the device yet (downloading, offline, or a pack that failed its
 * check), so that the style is never shown with another garden's look without a hint of its own.
 */
export interface PlaceholderTint {
  /** A colour of the charter's palette, read in the current appearance. */
  readonly role: PaletteRole;
  /** From 0 to 1: a cast, so the garden is still read under it. */
  readonly opacity: number;
}

/** Where the art of a garden style comes from, and what stands in for it meanwhile. */
export interface GardenStyleArt {
  /**
   * `bundled`: the level-1 garden, in the app. A number: the level whose pack holds the style's
   * garden (src/data/garden-art, tools/garden-3d), downloaded when needed.
   */
  readonly source: 'bundled' | { readonly packLevel: number };
  /** Over the level-1 pictures while the pack is not there. Null for the bundled garden. */
  readonly placeholderTint: PlaceholderTint | null;
}

/**
 * The style registry of the app (D46): every style of `GARDEN_STYLES` has an entry (a test checks
 * it), so a new garden cannot ship without its art decided. Levels 2 to 7 have their own gardens
 * (tools/garden-3d/levels/make_levels.py), each in a pack of its level.
 */
export const GARDEN_STYLE_ART: Readonly<Record<GardenStyleId, GardenStyleArt>> = Object.freeze({
  'fountain-courtyard': { source: 'bundled', placeholderTint: null },
  // Warm sand light.
  oasis: { source: { packLevel: 2 }, placeholderTint: { role: 'goldLight', opacity: 0.3 } },
  // The water's blue-green.
  'waterside-orchard': {
    source: { packLevel: 3 },
    placeholderTint: { role: 'waterFill', opacity: 0.24 },
  },
  // Cool mountain air.
  'mountain-garden': {
    source: { packLevel: 4 },
    placeholderTint: { role: 'avatarBlue', opacity: 0.24 },
  },
  // Blossom pink.
  'cherry-blossoms': {
    source: { packLevel: 5 },
    placeholderTint: { role: 'avatarRose', opacity: 0.26 },
  },
  // Deep pine green.
  'pine-clearing': {
    source: { packLevel: 6 },
    placeholderTint: { role: 'avatarGreen', opacity: 0.28 },
  },
  // Night water.
  'night-garden': {
    source: { packLevel: 7 },
    placeholderTint: { role: 'launchWater', opacity: 0.38 },
  },
});

/** The level whose pack holds a style's garden, or null for the garden in the app. */
export function packLevelOf(styleId: GardenStyleId): number | null {
  const { source } = GARDEN_STYLE_ART[styleId];
  return source === 'bundled' ? null : source.packLevel;
}
