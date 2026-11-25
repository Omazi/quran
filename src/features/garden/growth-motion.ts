/**
 * The growth seen happening: when the garden is shown after some reading, the plant grows from
 * the growth last shown to its growth now, once (owner, 25 November 2026: "the change must appear
 * little by little, and it must be animated"). Pure: the tween, its duration, what to play, and
 * the memory of what was shown, kept as text by the caller.
 */

import { hasSprouted, type GardenState } from '@/domain/garden';

/** A plant: the element of one hizb in the garden of one khatma. */
export type PlantKey = `${number}:${number}`;

export function plantKey(cycle: number, hizb: number): PlantKey {
  return `${cycle}:${hizb}`;
}

function hizbOf(plant: PlantKey): number {
  return Number(plant.split(':')[1]);
}

function cycleOf(plant: PlantKey): number {
  return Number(plant.split(':')[0]);
}

// ---------------------------------------------------------------------------------------------
// The tween
// ---------------------------------------------------------------------------------------------

/**
 * The animate skill's strong ease-out, `cubic-bezier(0.23, 1, 0.32, 1)`: the growth is quick at
 * first, then settles, as a thing that comes into view (entering: ease-out).
 */
const EASE_OUT = { x1: 0.23, y1: 1, x2: 0.32, y2: 1 } as const;

function bezier(a: number, b: number, t: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

export function easeOutStrong(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  // Find the curve's parameter for this time (x), by bisection: x grows with the parameter.
  let low = 0;
  let high = 1;
  for (let step = 0; step < 30; step += 1) {
    const middle = (low + high) / 2;
    if (bezier(EASE_OUT.x1, EASE_OUT.x2, middle) < t) low = middle;
    else high = middle;
  }
  return bezier(EASE_OUT.y1, EASE_OUT.y2, (low + high) / 2);
}

/** The growth shown at `t` (0 to 1) of the way from `from` to `to`. */
export function growthTween(from: number, to: number, t: number): number {
  return from + (to - from) * easeOutStrong(t);
}

/**
 * How long a growth takes: 1.2 s for a page, up to 2.5 s for a long reading. Longer than a UI
 * transition on purpose: it is the reward of the reading, seen rarely (animate skill: the delight
 * budget lives at the rare tier).
 */
export const GROWTH_DURATION_MS = { min: 1200, perGrowth: 1500, max: 2500 } as const;

export function growthDurationMs(from: number, to: number): number {
  const { min, perGrowth, max } = GROWTH_DURATION_MS;
  return Math.round(Math.min(max, min + perGrowth * Math.abs(to - from)));
}

// ---------------------------------------------------------------------------------------------
// What to play
// ---------------------------------------------------------------------------------------------

export interface ShownGrowth {
  readonly plant: PlantKey;
  readonly growth: number;
}

/** One growth to play: the element of `hizb` grows from `from` to `to`. */
export interface GrowthSegment {
  readonly plant: PlantKey;
  readonly hizb: number;
  readonly from: number;
  readonly to: number;
}

/**
 * What to play to go from the growth last shown to the growth now. The same plant grows from
 * where it was; a plant whose hizb was finished since ends its growth first, then the next one
 * starts from the ground; anything further (several hizb, another khatma, a plant never shown)
 * grows the plant of today from the ground. Nothing goes backwards: a lower growth (a journal
 * restored) is shown as it is.
 */
export function growthSegments(shown: ShownGrowth | null, target: ShownGrowth): GrowthSegment[] {
  const hizb = hizbOf(target.plant);
  const grow = (from: number): GrowthSegment[] =>
    target.growth > from ? [{ plant: target.plant, hizb, from, to: target.growth }] : [];
  if (shown === null) return grow(0);
  if (shown.plant === target.plant) return grow(shown.growth);
  const isPrevious =
    cycleOf(shown.plant) === cycleOf(target.plant) && hizbOf(shown.plant) === hizb - 1;
  if (!isPrevious) return grow(0);
  const ending: GrowthSegment[] =
    shown.growth < 1 ? [{ plant: shown.plant, hizb: hizb - 1, from: shown.growth, to: 1 }] : [];
  return [...ending, ...grow(0)];
}

// ---------------------------------------------------------------------------------------------
// The memory of what was shown
// ---------------------------------------------------------------------------------------------

/** Plants remembered, the most recent last. A few: only the last ones can still grow. */
export interface GrowthMemory {
  readonly plants: readonly (readonly [PlantKey, number])[];
}

const REMEMBERED_PLANTS = 6;
const PLANT_KEY = /^\d+:\d+$/;

/** The memory kept as `text`; empty when there is none or it is not ours. */
export function readGrowthMemory(text: string | null): GrowthMemory {
  if (text === null) return { plants: [] };
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return { plants: [] };
    const plants = (value as { plants?: unknown }).plants;
    if (typeof plants !== 'object' || plants === null || Array.isArray(plants)) {
      return { plants: [] };
    }
    const kept: [PlantKey, number][] = [];
    for (const [key, growth] of Object.entries(plants)) {
      if (!PLANT_KEY.test(key)) continue;
      if (typeof growth !== 'number' || !(growth >= 0 && growth <= 1)) continue;
      kept.push([key as PlantKey, growth]);
    }
    return { plants: kept.slice(-REMEMBERED_PLANTS) };
  } catch {
    return { plants: [] };
  }
}

export function writeGrowthMemory(memory: GrowthMemory): string {
  return JSON.stringify({ plants: Object.fromEntries(memory.plants) });
}

export function shownGrowth(memory: GrowthMemory, plant: PlantKey): number | null {
  return memory.plants.find(([key]) => key === plant)?.[1] ?? null;
}

/** The memory once `plant` was shown at `growth`. */
export function rememberGrowth(
  memory: GrowthMemory,
  plant: PlantKey,
  growth: number,
): GrowthMemory {
  const others = memory.plants.filter(([key]) => key !== plant);
  return { plants: [...others, [plant, growth] as const].slice(-REMEMBERED_PLANTS) };
}

/** The most recent plant remembered, and its growth: where the garden was last left. */
export function lastShownGrowth(memory: GrowthMemory): ShownGrowth | null {
  const last = memory.plants[memory.plants.length - 1];
  return last === undefined ? null : { plant: last[0], growth: last[1] };
}

// ---------------------------------------------------------------------------------------------
// The plant of a garden
// ---------------------------------------------------------------------------------------------

/** The plant growing in a garden and its growth, or null when nothing is drawn growing. */
export function growingTarget(
  state: GardenState,
): (ShownGrowth & { readonly hizb: number }) | null {
  const next = state.nextElement;
  // Hidden by the drought, or not sprouted yet (no page counted): nothing grows on screen.
  if (next === null || !next.isVisible || !hasSprouted(next)) return null;
  return {
    plant: plantKey(state.variant.cycle, next.element.hizb),
    hizb: next.element.hizb,
    growth: next.growth,
  };
}
