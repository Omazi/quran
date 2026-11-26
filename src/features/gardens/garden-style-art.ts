import type { GardenStyleId } from '@/domain/levels';
import type { PaletteRole } from '@/ui';

/**
 * PROVISIONAL (D46): how a garden style without pictures of its own is drawn until its art is
 * rendered (tools/garden-pictures, models of D22): the level-1 pictures, with a colour cast of the
 * charter laid over the garden only (`GardenScene`'s `tint`).
 */
export interface ProvisionalTint {
  /** A colour of the charter's palette, read in the current appearance. */
  readonly role: PaletteRole;
  /** From 0 to 1: a cast, so the garden is still read under it. */
  readonly opacity: number;
}

/** The pictures of one garden style. */
export interface GardenStyleArt {
  /** The set of rendered pictures that draws the style. Only level 1 has its own today. */
  readonly pictures: 'level-1';
  /** Null once the style has its own pictures. */
  readonly provisionalTint: ProvisionalTint | null;
}

/**
 * The style registry of the app: every style of `GARDEN_STYLES` has an entry (a test checks it),
 * so a new garden cannot ship without its pictures decided. When a style's art is rendered, give it
 * its own `pictures` and set `provisionalTint` to null: nothing else changes.
 *
 * TODO(D46): render the oasis, the waterside orchard, the mountain garden, the cherry blossoms,
 * the pine clearing and the night garden. Nobody sees them before completing a whole khatma.
 */
export const GARDEN_STYLE_ART: Readonly<Record<GardenStyleId, GardenStyleArt>> = Object.freeze({
  'fountain-courtyard': { pictures: 'level-1', provisionalTint: null },
  // Warm sand light.
  oasis: { pictures: 'level-1', provisionalTint: { role: 'goldLight', opacity: 0.3 } },
  // The water's blue-green.
  'waterside-orchard': {
    pictures: 'level-1',
    provisionalTint: { role: 'waterFill', opacity: 0.24 },
  },
  // Cool mountain air.
  'mountain-garden': {
    pictures: 'level-1',
    provisionalTint: { role: 'avatarBlue', opacity: 0.24 },
  },
  // Blossom pink.
  'cherry-blossoms': {
    pictures: 'level-1',
    provisionalTint: { role: 'avatarRose', opacity: 0.26 },
  },
  // Deep pine green.
  'pine-clearing': { pictures: 'level-1', provisionalTint: { role: 'avatarGreen', opacity: 0.28 } },
  // Night water.
  'night-garden': {
    pictures: 'level-1',
    provisionalTint: { role: 'launchWater', opacity: 0.38 },
  },
});

/** Whether a style is still drawn with borrowed, tinted pictures. */
export function isProvisionalArt(styleId: GardenStyleId): boolean {
  return GARDEN_STYLE_ART[styleId].provisionalTint !== null;
}
