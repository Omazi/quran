/**
 * The garden on screen (docs/specs/ui-lot1.md, section B; decisions D12, D35, D40): the scene,
 * which shows the garden's picture, the garden in 3D (`GardenView3D`, which turns and zooms, and
 * falls back to the picture), the garden in plain words, and a way to get a garden to show
 * without a reading journal. Everything else in this folder is private.
 */

export { previewGardenState, type GardenPreview } from './garden-preview';
export { baseAsset, riseAsset, waterAsset } from './garden-images';
export { GARDEN_PICTURE_PIXELS } from './garden-images.generated';
export {
  GARDEN_PICTURE_ASPECT_RATIO,
  GARDEN_STEP_COUNT,
  HIZB_TONE,
  WATER_SYMBOLS,
  WATER_TONES,
} from './config';
export {
  GardenElementsSection,
  GardenStateSection,
  GardenWaterRow,
  type GardenReadoutProps,
} from './garden-readout';
export {
  LEVEL_1_ART,
  packedGardenArt,
  type GardenArt,
  type GardenImageSource,
  type GardenSpriteArt,
  type PackedGarden,
} from './garden-art';
export {
  GardenScene,
  type GardenSceneProps,
  type GardenSceneSize,
  type GardenSceneTint,
} from './garden-scene';
export {
  GardenView3D,
  type GardenHintPlacement,
  type GardenView3DProps,
} from './garden3d/garden-view-3d';
