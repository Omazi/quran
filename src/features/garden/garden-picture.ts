/**
 * From a `GardenState` to the pictures that show it (docs/specs/garden-pictures.md, section 2).
 * Pure: no React, no image. The garden module decides what the garden is; this file only names
 * the pictures of the set that match. Nothing here is a rule of the garden.
 */

import { DEFAULT_GARDEN_CONFIG, type GardenConfig, type GardenState } from '@/domain/garden';

import { BARE_TREES_AFTER_WILTING_DAYS, GARDEN_STEP_COUNT, MAX_ELEMENT_STEPS } from './config';
import { SHIPPED_GARDEN_IMAGES } from './garden-images';

/** Leaf cover: 0 full leaf, 1 grass and flowers dull, 2 half of the trees bare, 3 all bare. */
export type FoliageStage = 0 | 1 | 2 | 3;

/** 0 no water (dry), 1 low water (still), 2 the water flows. */
export type WaterLevel = 0 | 1 | 2;

/** One picture of the dry garden, and the water that goes over it. */
export interface GardenStage {
  /** Elements shown: the first `count` of the catalogue, 0 to `GARDEN_STEP_COUNT`. */
  readonly count: number;
  readonly foliage: FoliageStage;
  readonly water: WaterLevel;
}

export interface GardenPicture {
  readonly stage: GardenStage;
  /**
   * How much of the element being earned is shown, above 0 up to 1, or null when it is not
   * shown. The picture of one more element is laid over the stage at that opacity.
   */
  readonly growth: number | null;
}

/** The names of the pictures that exist, without the pictures themselves. */
export interface GardenImageNames {
  readonly base: ReadonlySet<string>;
  readonly water: ReadonlySet<string>;
}

export interface GardenPictureOptions {
  /** Defaults to the settings of the garden module. */
  readonly config?: GardenConfig;
  /** Which pictures exist. Defaults to the set shipped with the app. */
  readonly images?: GardenImageNames;
}

const WATER_LEVEL: Readonly<Record<GardenState['water'], WaterLevel>> = {
  flowing: 2,
  still: 1,
  dry: 0,
};

/**
 * The foliage for a number of drought days. Every threshold comes from the garden settings; the
 * one the module does not have (all trees bare) is a distance from the start of wilting, and
 * never later than the start of dying, when the elements begin to disappear.
 */
export function foliageStageOf(droughtDays: number, config: GardenConfig): FoliageStage {
  const barePastDays = Math.min(
    config.wiltingMinDroughtDays + BARE_TREES_AFTER_WILTING_DAYS,
    config.dyingMinDroughtDays,
  );
  if (droughtDays >= barePastDays) return 3;
  if (droughtDays >= config.wiltingMinDroughtDays) return 2;
  if (droughtDays >= config.thirstyMinDroughtDays) return 1;
  return 0;
}

function twoDigits(count: number): string {
  return String(count).padStart(2, '0');
}

/** `h24-f0`: the dry garden with 24 elements and full leaf. */
export function baseName(stage: Pick<GardenStage, 'count' | 'foliage'>): string {
  return `h${twoDigits(stage.count)}-f${stage.foliage}`;
}

/** `h24-f0-w2`, or null when the stage has no water picture (dry, or no channel yet). */
export function waterName(stage: GardenStage): string | null {
  if (stage.water === 0 || stage.count === 0) return null;
  return `${baseName(stage)}-w${stage.water}`;
}

/** Whether every picture a stage needs is in the set. */
export function hasStage(stage: GardenStage, images: GardenImageNames): boolean {
  const water = waterName(stage);
  return images.base.has(baseName(stage)) && (water === null || images.water.has(water));
}

/**
 * The picture that shows a garden, or null when the set lacks one the state needs: the scene
 * then shows its neutral placeholder, never a broken image.
 */
export function gardenPicture(
  state: GardenState,
  { config = DEFAULT_GARDEN_CONFIG, images = SHIPPED_GARDEN_IMAGES }: GardenPictureOptions = {},
): GardenPicture | null {
  const count = state.visibleElements.length;
  const stage: GardenStage = {
    count,
    foliage: foliageStageOf(state.droughtDays, config),
    // The bare earth and the dead earth have no channel: no water picture exists for them.
    water: count === 0 ? 0 : WATER_LEVEL[state.water],
  };
  if (!hasStage(stage, images)) return null;

  const next = state.nextElement;
  const grows =
    next !== null && next.isVisible && next.growth > 0 && count + 1 <= GARDEN_STEP_COUNT;
  const growing: GardenStage = { ...stage, count: count + 1 };
  const growth = grows && hasStage(growing, images) ? Math.min(1, next.growth) : null;
  return { stage, growth };
}

export interface PictureNames {
  readonly base: string;
  readonly water: string | null;
  readonly growing: {
    readonly base: string;
    readonly water: string | null;
    readonly opacity: number;
  } | null;
}

/** The files a picture is made of. */
export function pictureNames({ stage, growth }: GardenPicture): PictureNames {
  const next: GardenStage = { ...stage, count: stage.count + 1 };
  return {
    base: baseName(stage),
    water: waterName(stage),
    growing:
      growth === null ? null : { base: baseName(next), water: waterName(next), opacity: growth },
  };
}

// ---------------------------------------------------------------------------------------------
// Steps between two stages (decision D26)
// ---------------------------------------------------------------------------------------------

/** A picture to pass through, and whether the garden is drying or coming back on the way. */
export interface PictureStep {
  readonly stage: GardenStage;
  readonly direction: 'decay' | 'recovery';
}

/** The values from `from` (excluded) to `to` (included), at most `limit` of them, evenly spread. */
function spread(from: number, to: number, limit: number): number[] {
  const distance = Math.abs(to - from);
  const steps = Math.min(distance, limit);
  const sign = Math.sign(to - from);
  const values: number[] = [];
  for (let step = 1; step <= steps; step += 1) {
    values.push(from + sign * Math.round((distance * step) / steps));
  }
  return values;
}

/**
 * The pictures to pass through to go from one stage to another, the first excluded and the last
 * included, in the order the garden dries: the water leaves first, then the leaves fall, then
 * the elements disappear. Coming back, the same steps run the other way round: the elements
 * return, then the leaves, then the water (docs/specs/garden.md, "Ce qu'on voit, étape par
 * étape"). When some things get worse and others better, the worse come first.
 *
 * Empty when the two stages are the same. Never goes through a stage the set lacks.
 */
export function pictureSteps(
  from: GardenStage,
  to: GardenStage,
  images: GardenImageNames,
): PictureStep[] {
  const steps: PictureStep[] = [];
  let current = from;
  const go = (next: Partial<GardenStage>, direction: PictureStep['direction']): void => {
    const stage: GardenStage = { ...current, ...next };
    // The water of a garden with no element does not exist: it is only a number in the path.
    const shown = stage.count === 0 ? { ...stage, water: 0 as WaterLevel } : stage;
    if (hasStage(shown, images)) steps.push({ stage: shown, direction });
    current = shown;
  };

  // Worse first: water, then foliage, then fewer elements.
  for (let water = from.water - 1; water >= to.water; water -= 1) {
    go({ water: water as WaterLevel }, 'decay');
  }
  for (let foliage = from.foliage + 1; foliage <= to.foliage; foliage += 1) {
    go({ foliage: foliage as FoliageStage }, 'decay');
  }
  if (to.count < from.count) {
    for (const count of spread(from.count, to.count, MAX_ELEMENT_STEPS)) {
      go({ count }, 'decay');
    }
  }
  // Then better, the other way round: elements, foliage, water.
  if (to.count > from.count) {
    for (const count of spread(from.count, to.count, MAX_ELEMENT_STEPS)) {
      go({ count }, 'recovery');
    }
  }
  for (let foliage = from.foliage - 1; foliage >= to.foliage; foliage -= 1) {
    go({ foliage: foliage as FoliageStage }, 'recovery');
  }
  for (let water = from.water + 1; water <= to.water; water += 1) {
    go({ water: water as WaterLevel }, 'recovery');
  }
  return steps;
}
