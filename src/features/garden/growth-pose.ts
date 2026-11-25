/**
 * How a growing element looks for its growth (owner, 25 November 2026: "the tree must not appear
 * in one shot: it starts young, then grows, then its leaves appear, the way a tree really grows").
 * Pure numbers, shared by the 3D garden and the pictures: no three.js, no React.
 *
 * The growth is `GrowingElement.growth`, the counted pages of the hizb over its pages; the stages
 * are those of `GROWTH_STAGE_STARTS` (domain/garden). Every value here is continuous in the
 * growth, so one page more never makes anything jump, and only the sprout ever goes away.
 */

import { GROWTH_STAGE_STARTS, stageProgressOf } from '@/domain/garden';

/** How an element grows (garden3d/garden-model.ts `plantFormOf`). */
export type GrowthForm = 'tree' | 'plant' | 'structure';

/**
 * What to draw, each from 0 to 1. For a tree: the seed mound and its sprout, the size of the
 * tree, the thickness of its trunk, how far its branches, leaves and flowers or fruit have come
 * (each part staggered by the renderer with `staggered`); `sprout` is a share of the sprout's
 * size (`SPROUT_SHARE` of the tree), and `girth` a factor on the trunk's thickness, above 1 while
 * the tree is young. For a plant, `scale` is how far it has
 * come up; for a built element, how far it is built.
 */
export interface GrowthPose {
  readonly sprout: number;
  readonly scale: number;
  readonly girth: number;
  readonly branches: number;
  readonly foliage: number;
  readonly bloom: number;
}

const { sapling, branches: BRANCHES, foliage: FOLIAGE } = GROWTH_STAGE_STARTS;

function clamp01(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

function smoothstep(from: number, to: number, value: number): number {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

/** Straight lines between the given points, flat before the first and after the last. */
function through(points: readonly (readonly [number, number])[], x: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return 0;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let k = 1; k < points.length; k += 1) {
    const [x1, y1] = points[k] as readonly [number, number];
    const [x0, y0] = points[k - 1] as readonly [number, number];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

/**
 * The sprout's height, as a share of the tree it becomes: the renderer sizes the seed mound and
 * its leaves to it, so that the sprout and the young tree compare the same way for every tree.
 */
export const SPROUT_SHARE = 0.27;

/**
 * The tree. Nothing ever looks smaller or barer than a page before (coordinator's check of the
 * renders, 25 November 2026): the sprout comes with the first page (whole at 5 % of the hizb) and
 * keeps growing a little; the sapling rises out of it from 10 %, with its first leaves at its top,
 * and is already taller than the sprout at 30 %; the sprout only gives way between 35 % and 45 %,
 * once the young tree is clearly taller (1.7 times at 35 %) and has leaves. The trunk is drawn thicker than its
 * share while the tree is young (`girth` above 1), so that a sapling reads on the whole garden,
 * and its drawn thickness (`scale * girth`) only grows. The branches grow from 45 % to 75 %; most
 * of the leaves come from 75 % (a few before, so that the young tree never looks like the bare
 * trees of a drying garden), the flowers or fruit over the last tenth.
 */
const TREE = {
  sproutRise: 0.05,
  sproutGrowth: [
    [0.05, 0.85],
    [0.35, 1],
  ] as const,
  sproutFade: [0.35, 0.45] as const,
  scale: [
    [0.1, 0],
    [sapling, 0.2],
    [0.3, 0.42],
    [BRANCHES, 0.55],
    [FOLIAGE, 0.82],
    [1, 1],
  ] as const,
  girth: [
    [0.1, 1.8],
    [BRANCHES, 1.25],
    [FOLIAGE, 1],
  ] as const,
  foliage: [
    [sapling + 0.01, 0],
    [0.3, 0.2],
    [BRANCHES, 0.28],
    [FOLIAGE, 0.4],
    [1, 1],
  ] as const,
  bloomFrom: 0.9,
} as const;

/** A plant (flowers, bushes) comes up from its first page; its flowers open over the last quarter. */
const PLANT = {
  scale: [
    [0, 0],
    [0.02, 0.3],
    [0.85, 1],
  ] as const,
  foliageUntil: 0.85,
  bloomFrom: 0.75,
} as const;

export function growthPose(growth: number, form: GrowthForm): GrowthPose {
  const g = clamp01(growth);
  if (form === 'structure') {
    return { sprout: 0, scale: g, girth: 1, branches: 1, foliage: g, bloom: g };
  }
  if (form === 'plant') {
    return {
      sprout: 0,
      scale: through(PLANT.scale, g),
      girth: 1,
      branches: 1,
      foliage: clamp01(g / PLANT.foliageUntil),
      bloom: clamp01((g - PLANT.bloomFrom) / (1 - PLANT.bloomFrom)),
    };
  }
  const rise = g <= 0 ? 0 : smoothstep(0, TREE.sproutRise, g);
  return {
    sprout:
      rise *
      through(TREE.sproutGrowth, g) *
      (1 - smoothstep(TREE.sproutFade[0], TREE.sproutFade[1], g)),
    scale: through(TREE.scale, g),
    girth: through(TREE.girth, g),
    branches: smoothstep(BRANCHES, FOLIAGE, g),
    foliage: through(TREE.foliage, g),
    bloom: clamp01((g - TREE.bloomFrom) / (1 - TREE.bloomFrom)),
  };
}

/**
 * How far one piece (a branch, a cluster of leaves, a stone of a wall) has come when its part is
 * at `progress`: it starts at its own `delay` and takes `window`, so that the pieces appear one
 * after another, never all at once (animate skill, stagger).
 */
export function staggered(progress: number, delay: number, window: number): number {
  return clamp01((progress - delay) / window);
}

/**
 * The pop of a piece as it comes, 0 to 1 with a slight overshoot: the response of a spring a
 * little under-damped (apple-design: damping about 0.7, "momentum spring, slight bounce"; animate
 * skill: bounce 0.1 to 0.3). Settled at 1.
 */
export const POP_SPRING = { damping: 0.7, decay: 5 } as const;

export function popScale(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const { damping, decay } = POP_SPRING;
  const omega = decay / damping;
  const damped = omega * Math.sqrt(1 - damping * damping);
  const envelope = Math.exp(-decay * t);
  return (
    1 -
    envelope *
      (Math.cos(damped * t) + (damping / Math.sqrt(1 - damping * damping)) * Math.sin(damped * t))
  );
}

// ---------------------------------------------------------------------------------------------
// The picture fallback (no GL): the element in steps
// ---------------------------------------------------------------------------------------------

/**
 * The size of the element in the pictures, one step per stage of its growth: the pictures hold
 * the grown element only (its sprite, `garden-sprites.generated.ts`), so it is drawn smaller,
 * from its foot, while it grows. Null: nothing to draw yet.
 */
const PICTURE_STEPS = { sprout: 0.2, sapling: 0.4, branches: 0.62, foliage: 0.84 } as const;

export function pictureStep(growth: number): { readonly scale: number } | null {
  const { stage } = stageProgressOf(clamp01(growth));
  if (stage === 'none') return null;
  if (stage === 'grown') return { scale: 1 };
  return { scale: PICTURE_STEPS[stage] };
}

/**
 * Where a picture of `aspect` (width over height) sits in a box, shown whole: as wide or as tall
 * as the box, on its bottom edge (`bottom`) or in its middle, centred across.
 */
export function pictureRect(
  box: { readonly width: number; readonly height: number },
  aspect: number,
  anchor: 'bottom' | 'center',
): { x: number; y: number; width: number; height: number } {
  const width = Math.min(box.width, box.height * aspect);
  const height = width / aspect;
  const spare = box.height - height;
  return {
    x: (box.width - width) / 2,
    y: anchor === 'bottom' ? spare : spare / 2,
    width,
    height,
  };
}
