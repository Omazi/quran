/**
 * The garden on screen (docs/specs/ui-lot1.md, section B; decision D12): the scene, which is the
 * only entry point of the garden's picture, the garden in plain words, and a way to get a garden
 * to show without a reading journal. Everything else in this folder is private.
 */

export { previewGardenState, type GardenPreview } from './garden-preview';
export { WATER_SYMBOLS } from './config';
export {
  GardenElementsSection,
  GardenStateSection,
  GardenWaterRow,
  type GardenReadoutProps,
} from './garden-readout';
export { GardenScene, type GardenSceneProps, type GardenSceneSize } from './garden-scene';
