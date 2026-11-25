/**
 * The pictures of the level-1 garden that ship with the app, by name. The table itself is
 * written by `tools/garden-pictures`; this file only reads it.
 */

import type { GardenImageNames } from './garden-picture';
import { GARDEN_BASE_ASSETS, GARDEN_WATER_ASSETS } from './garden-images.generated';

/** The names of the shipped pictures, for `gardenPicture`. */
export const SHIPPED_GARDEN_IMAGES: GardenImageNames = {
  base: new Set(Object.keys(GARDEN_BASE_ASSETS)),
  water: new Set(Object.keys(GARDEN_WATER_ASSETS)),
};

/** The asset of a dry-garden picture, or undefined when the set has no such picture. */
export function baseAsset(name: string): number | undefined {
  return GARDEN_BASE_ASSETS[name];
}

/** The asset of a water picture, or undefined when the set has no such picture. */
export function waterAsset(name: string): number | undefined {
  return GARDEN_WATER_ASSETS[name];
}
