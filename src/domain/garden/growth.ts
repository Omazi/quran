/**
 * How far the element of the hizb in progress has grown, in words a renderer can draw (owner's
 * requirement of 25 November 2026: "if I read 2 or 3 pages of a hizb of 10, I must see a small
 * sprout; the tree grows little by little, young first, then its leaves").
 *
 * The growth itself is `GrowingElement.growth`: the counted pages of the hizb over its pages
 * (`domain/khatm`, a page counts once it was read long enough). It is continuous; the stages only
 * name the stretch it is in, so that a renderer and the words agree on what is seen.
 */
import type { GrowingElement } from './types';

/** `none`: no page counted yet. `grown`: the hizb is complete, the element is unlocked. */
export type GrowthStage = 'none' | 'sprout' | 'sapling' | 'branches' | 'foliage' | 'grown';

/**
 * Where each stage starts, as a growth from 0 to 1: a sprout from the first counted page, a
 * young sapling with a thin trunk, then the trunk thickens and branches, then the leaves (and
 * the flowers or fruit last).
 */
export const GROWTH_STAGE_STARTS = Object.freeze({
  sprout: 0,
  sapling: 0.15,
  branches: 0.45,
  foliage: 0.75,
});

const ORDER = ['sprout', 'sapling', 'branches', 'foliage'] as const;

function assertGrowth(growth: number): void {
  if (!(typeof growth === 'number' && growth >= 0 && growth <= 1)) {
    throw new RangeError(`Garden: a growth is between 0 and 1, got ${growth}`);
  }
}

/** The stage of a plant that has grown `growth` (0 to 1). */
export function growthStageOf(growth: number): GrowthStage {
  return stageProgressOf(growth).stage;
}

/** The stage, and how far into it the plant is (0 at its start, 1 at the start of the next). */
export function stageProgressOf(growth: number): {
  readonly stage: GrowthStage;
  readonly progress: number;
} {
  assertGrowth(growth);
  if (growth === 0) return { stage: 'none', progress: 0 };
  if (growth === 1) return { stage: 'grown', progress: 1 };
  for (let index = ORDER.length - 1; index >= 0; index -= 1) {
    const stage = ORDER[index] as (typeof ORDER)[number];
    const start = GROWTH_STAGE_STARTS[stage];
    if (growth >= start) {
      const next = ORDER[index + 1];
      const end = next === undefined ? 1 : GROWTH_STAGE_STARTS[next];
      return { stage, progress: (growth - start) / (end - start) };
    }
  }
  return { stage: 'sprout', progress: 0 };
}

/** Whether the element of the hizb in progress exists yet: from its first counted page. */
export function hasSprouted(next: GrowingElement | null): boolean {
  return next !== null && next.growth > 0;
}
