/**
 * The arithmetic of a pager driven by the finger (`SwipePager`). Pure functions, marked as
 * worklets so that the gesture can call them on the UI thread, and plain functions everywhere
 * else (tests, the web).
 *
 * A pager has one source of truth, its position: a number of pages, 2.4 being 40 % of the way
 * from the third page to the fourth. Everything that moves or fades as the pages pass is derived
 * from it, so that nothing drifts when a gesture is reversed or caught mid-flight (gestures skill,
 * "Linked values").
 */

export const SWIPE_PAGING = {
  /**
   * The share of a page a drag must cover for the next page to come: 16 %, the threshold of the
   * validated prototype (docs/design/premier-lancement-prototype.html, `SWIPE_MIN`).
   */
  distanceShare: 0.16,
  /**
   * The speed, in points per second, above which a flick turns the page however short it was:
   * 350, the prototype's 0.35 point per millisecond (gestures skill: distance OR velocity).
   */
  flickVelocity: 350,
  /**
   * What a drag past the first or the last page still moves the page: a fifth of the finger's
   * distance (gestures skill, "Rubber-band at the edges": about 0.2).
   */
  edgeResistance: 0.2,
  /** How far the finger must move sideways before the pages take it: a vertical scroll wins first. */
  activationDistance: 10,
  /** A vertical move this long first leaves the touch to what scrolls inside the page. */
  verticalFailDistance: 14,
  /**
   * After a drag: a spring seeded with the finger's speed, with a slight bounce (gestures skill,
   * "Release phase rules": bounce 0.1 to 0.3 only at the end of a drag).
   */
  releaseSpring: { duration: 520, dampingRatio: 0.86 },
  /**
   * After a tap on the page dots or a screen reader's step: no force was applied, so no bounce.
   * The iOS sheet curve, steep at the start (gestures skill, "the Vaul curve"), over the
   * prototype's 520 ms.
   */
  stepDurationMs: 520,
  stepCurve: [0.32, 0.72, 0, 1] as const,
  /** With "reduce motion", a drag still ends: briefly, without a spring (gestures skill). */
  reducedSettleMs: 160,
} as const;

function assertPager(width: number, pageCount: number): void {
  'worklet';
  if (!(width > 0)) throw new RangeError(`A pager needs a width above 0, received ${width}.`);
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new RangeError(`A pager needs at least one page, received ${pageCount}.`);
  }
}

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

export interface DragInput {
  /** The page the pager rested on, or was on its way to, when the finger came down. */
  readonly anchor: number;
  /**
   * The position when the finger came down. Defaults to the anchor; it differs when the finger
   * catches the pages while they still slide (gestures skill: interruptibility).
   */
  readonly start?: number;
  /** How far the finger has moved sideways, in points: negative to the left. */
  readonly translation: number;
  readonly width: number;
  readonly isRightToLeft: boolean;
  readonly pageCount: number;
}

/**
 * The position while the finger is down: the finger's distance over the width, one page at most
 * either side of the anchor, with resistance past the first and the last page. In left to right
 * the next page comes from the right, so a drag to the left moves forwards; right to left mirrors
 * it (right-to-left.md: the flow of the pages follows the reading direction).
 */
export function draggedPosition({
  anchor,
  start = anchor,
  translation,
  width,
  isRightToLeft,
  pageCount,
}: DragInput): number {
  'worklet';
  assertPager(width, pageCount);
  const forwards = isRightToLeft ? translation : -translation;
  const position = clamp(start + forwards / width, anchor - 1, anchor + 1);
  const last = pageCount - 1;
  if (position < 0) return position * SWIPE_PAGING.edgeResistance;
  if (position > last) return last + (position - last) * SWIPE_PAGING.edgeResistance;
  return position;
}

export interface ReleaseInput {
  readonly anchor: number;
  /** The position when the finger lifted. */
  readonly position: number;
  /** The finger's sideways speed when it lifted, in points per second: negative to the left. */
  readonly velocity: number;
  readonly width: number;
  readonly isRightToLeft: boolean;
  readonly pageCount: number;
}

/**
 * The page to settle on when the finger lifts: the neighbour the person moved towards, once the
 * drag passed `distanceShare` of a page or the flick was faster than `flickVelocity`, otherwise the
 * page the drag started from. A fast flick decides over the distance: it is the last thing the
 * finger did.
 */
export function settledPage({
  anchor,
  position,
  velocity,
  width,
  isRightToLeft,
  pageCount,
}: ReleaseInput): number {
  'worklet';
  assertPager(width, pageCount);
  const forwardsVelocity = isRightToLeft ? velocity : -velocity;
  const moved = position - anchor;
  let step = 0;
  if (Math.abs(forwardsVelocity) > SWIPE_PAGING.flickVelocity) step = Math.sign(forwardsVelocity);
  else if (Math.abs(moved) > SWIPE_PAGING.distanceShare) step = Math.sign(moved);
  return clamp(anchor + step, 0, pageCount - 1);
}

/** The ease of the prototype's crossfades: slow at both ends, so a page rests clean. */
function smooth(fraction: number): number {
  'worklet';
  const value = clamp(fraction, 0, 1);
  return value * value * (3 - 2 * value);
}

/** The two pages around a position, and how far along the way from the first to the second. */
function between(pageCount: number, position: number): { from: number; to: number; along: number } {
  'worklet';
  const last = pageCount - 1;
  const clamped = clamp(position, 0, last);
  const from = Math.min(Math.floor(clamped), Math.max(0, last - 1));
  const to = Math.min(from + 1, last);
  return { from, to, along: from === to ? 0 : smooth(clamped - from) };
}

/**
 * A value that belongs to each page (how grey the sky is, how small the scene), at a position
 * between two pages: the two values mixed, with the prototype's ease. Past the ends, the value of
 * the end page.
 */
export function crossfade(values: readonly number[], position: number): number {
  'worklet';
  if (values.length === 0) throw new RangeError('crossfade needs one value per page.');
  const { from, to, along } = between(values.length, position);
  const start = values[from] ?? 0;
  const end = values[to] ?? 0;
  return start + (end - start) * along;
}

export interface StageLayerInput {
  /** For each page, the layer of the stage it shows, or -1 for none. */
  readonly pageLayers: readonly number[];
  /** For each page, whether its picture is a garden: two gardens lie one over the other. */
  readonly pageIsGarden: readonly boolean[];
  /** The layer whose opacity is asked. */
  readonly layer: number;
  readonly position: number;
}

/**
 * How visible a layer of the stage is at a position. Between two gardens the new one is laid over
 * the old one, which stays whole until halfway: the earth never shows through between two states
 * of the same garden. Between pictures of different kinds, a plain crossfade (the prototype's
 * `show`).
 */
export function stageLayerOpacity({
  pageLayers,
  pageIsGarden,
  layer,
  position,
}: StageLayerInput): number {
  'worklet';
  if (pageLayers.length === 0) throw new RangeError('stageLayerOpacity needs at least one page.');
  const { from, to, along } = between(pageLayers.length, position);
  const fromLayer = pageLayers[from];
  const toLayer = pageLayers[to];
  if (fromLayer === layer && toLayer === layer) return 1;
  const overlay = pageIsGarden[from] === true && pageIsGarden[to] === true;
  if (fromLayer === layer) return overlay ? (along < 0.5 ? 1 : 2 * (1 - along)) : 1 - along;
  if (toLayer === layer) return overlay ? (along < 0.5 ? 2 * along : 1) : along;
  return 0;
}

export interface SwapInput {
  /** The page the label belongs to. */
  readonly page: number;
  readonly pageCount: number;
  readonly position: number;
}

/**
 * How visible a page's label is (the caption under the garden): it fades out over the first half
 * of the way to the next page, and the next page's fades in over the second half, so the two never
 * overlap (the prototype's `.cap`).
 */
export function swapOpacity({ page, pageCount, position }: SwapInput): number {
  'worklet';
  const { from, to, along } = between(pageCount, position);
  if (page === from && from === to) return 1;
  if (page === from) return along < 0.5 ? 1 - 2 * along : 0;
  if (page === to) return along < 0.5 ? 0 : 2 * along - 1;
  return 0;
}
