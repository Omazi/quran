/**
 * The art of one garden: its pictures (the picture fallback and the thumbnails) and its baked 3D
 * model, as the scene and the 3D view read them. Level 1 ships with the app; the gardens of levels
 * 2 to 7 come from a downloaded pack (src/data/garden-art, docs/specs/garden-levels.md), whose
 * files are on the device: same names, same picture size, same model format.
 */
import type { GardenImageNames } from './garden-picture';
import { baseAsset, SHIPPED_GARDEN_IMAGES, waterAsset } from './garden-images';
import { GARDEN_PICTURE_PIXELS } from './garden-images.generated';
import { GARDEN_SPRITES } from './garden-sprites.generated';
import { loadGardenModelBytes } from './garden3d/load-garden-model';

/** An image the image view can show: a bundled asset, or a file on the device. */
export type GardenImageSource = number | { readonly uri: string };

/** The element of a hizb alone, cut from the pictures, and where it sits (picture pixels). */
export interface GardenSpriteArt {
  readonly source: GardenImageSource;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly footX: number;
  readonly footY: number;
}

export interface GardenArt {
  /** One per garden: 'level-1', 'level-2'... */
  readonly key: string;
  /** The names of the pictures the set has. */
  readonly images: GardenImageNames;
  base(name: string): GardenImageSource | undefined;
  water(name: string): GardenImageSource | undefined;
  sprite(hizb: number): GardenSpriteArt | undefined;
  /** The bytes of the baked 3D garden (tools/garden-3d). */
  loadModel(): Promise<ArrayBuffer>;
}

/** The level-1 garden, bundled with the app. */
export const LEVEL_1_ART: GardenArt = Object.freeze({
  key: 'level-1',
  images: SHIPPED_GARDEN_IMAGES,
  base: baseAsset,
  water: waterAsset,
  sprite(hizb: number): GardenSpriteArt | undefined {
    const sprite = GARDEN_SPRITES[hizb];
    return sprite === undefined ? undefined : { ...sprite, source: sprite.asset };
  },
  // Read when called, so that the loader can be replaced (tests).
  loadModel: () => loadGardenModelBytes(),
});

/** What a downloaded level garden gives (src/data/garden-art `GardenArtFiles`). */
export interface PackedGarden {
  readonly level: number;
  readonly index: {
    readonly size: { readonly width: number; readonly height: number };
    readonly base: readonly string[];
    readonly water: readonly string[];
    readonly sprites: Readonly<
      Record<
        string,
        {
          readonly name: string;
          readonly x: number;
          readonly y: number;
          readonly width: number;
          readonly height: number;
          readonly footX: number;
          readonly footY: number;
        }
      >
    >;
  };
  uri(path: string): string;
  modelBytes(): Promise<ArrayBuffer>;
}

/**
 * The art of a downloaded level garden. Null when its pictures do not have the size of level 1's:
 * the scene, the 3D frame and the thumbnails are laid out for that size only.
 */
export function packedGardenArt(garden: PackedGarden): GardenArt | null {
  const { size, base, water, sprites } = garden.index;
  if (size.width !== GARDEN_PICTURE_PIXELS.width || size.height !== GARDEN_PICTURE_PIXELS.height) {
    return null;
  }
  const baseNames = new Set(base);
  const waterNames = new Set(water);
  const sources = new Map<string, GardenImageSource>();
  const source = (path: string): GardenImageSource => {
    let found = sources.get(path);
    if (found === undefined) {
      found = { uri: garden.uri(path) };
      sources.set(path, found);
    }
    return found;
  };
  return {
    key: `level-${garden.level}`,
    images: { base: baseNames, water: waterNames },
    base: (name) => (baseNames.has(name) ? source(`base/${name}.webp`) : undefined),
    water: (name) => (waterNames.has(name) ? source(`water/${name}.webp`) : undefined),
    sprite(hizb) {
      const sprite = sprites[String(hizb)];
      if (sprite === undefined) return undefined;
      const { name, ...place } = sprite;
      return { ...place, source: source(`grow/${name}.webp`) };
    },
    loadModel: () => garden.modelBytes(),
  };
}
