/**
 * Public API of the garden module. Everything else in this folder is private.
 * See README.md for the model and the decisions taken on the specification.
 */
export {
  completedGardenState,
  computeGardenState,
  forecastGardenWithoutReading,
  MAX_FORECAST_DAYS,
} from './garden-state';
export { DEFAULT_GARDEN_CONFIG } from './config';
export {
  GROWTH_STAGE_STARTS,
  growthStageOf,
  hasSprouted,
  stageProgressOf,
  type GrowthStage,
} from './growth';
export {
  assertValidCatalog,
  displayableVerse,
  GARDEN_CATALOG,
  isTreeKind,
  TREE_SPECIES_CYCLE,
} from './catalog';
export {
  catalogForVariant,
  GARDEN_THEME_IDS,
  gardenVariant,
  REFERENCE_GARDEN_VARIANT,
} from './variant';
export type {
  GardenConfig,
  GardenElement,
  GardenElementKind,
  GardenForecastDay,
  GardenInput,
  GardenKhatmInput,
  GardenPause,
  GardenPhase,
  GardenState,
  GardenThemeId,
  GardenVariant,
  GardenVerse,
  GrowingElement,
  TreeSpecies,
  WaterState,
} from './types';
