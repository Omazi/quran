/**
 * Public API of the garden module. Everything else in this folder is private.
 * See README.md for the model and the decisions taken on the specification.
 */
export { computeGardenState } from './garden-state';
export { DEFAULT_GARDEN_CONFIG } from './config';
export { assertValidCatalog, GARDEN_CATALOG, isTreeKind, TREE_SPECIES_CYCLE } from './catalog';
export type {
  GardenConfig,
  GardenElement,
  GardenElementKind,
  GardenInput,
  GardenPause,
  GardenPhase,
  GardenState,
  GrowingElement,
  MissedDayCostTier,
  TreeSpecies,
  WaterState,
} from './types';
