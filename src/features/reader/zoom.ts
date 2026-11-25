/**
 * The arithmetic of the page zoom (docs/specs/reader.md, section 2; deviation 34 of the design
 * register). Pure functions, marked as worklets so the gestures can call them on the UI thread.
 * Offsets are measured from the centre of the page, which is the origin of its scale.
 */

/** Below this much above 1, a scale counts as the page's own size. */
const OWN_SIZE_EPSILON = 0.01;

/** The scale a pinch asks for, kept between the page's size and `maximum`. */
export function clampScale(scale: number, maximum: number): number {
  'worklet';
  return Math.min(Math.max(scale, 1), maximum);
}

/**
 * The offset that keeps the point under the fingers (`focal`, from the centre) in place when the
 * scale is multiplied by `ratio`, from the offset `start`.
 */
export function offsetAfterZoom(start: number, focal: number, ratio: number): number {
  'worklet';
  return focal - (focal - start) * ratio;
}

/**
 * The offset kept inside the room an enlarged page has: at scale `scale`, a page whose half size
 * is `half` can move `(scale - 1) * half` each way, so its edge never comes inside the screen.
 */
export function clampOffset(offset: number, scale: number, half: number): number {
  'worklet';
  const room = Math.max(scale - 1, 0) * half;
  return Math.min(Math.max(offset, -room), room);
}

/** A double tap: from the page's size to `level`, from any enlarged size back to the page's. */
export function toggledScale(current: number, level: number): number {
  'worklet';
  return current > 1 + OWN_SIZE_EPSILON ? 1 : level;
}

/** Where a drag stands against the edges of an enlarged page. */
export interface PanPosition {
  /** The offset of the page, kept inside the screen. */
  offset: number;
  /** What the finger went beyond the edge: positive past the left edge, negative past the right. */
  overscroll: number;
}

/** The page's offset for a drag, and how far the finger went beyond the page's edge. */
export function panWithOverscroll(raw: number, scale: number, half: number): PanPosition {
  'worklet';
  const offset = clampOffset(raw, scale, half);
  return { offset, overscroll: raw - offset };
}

/** The part of the overscroll the page shows: it follows the finger, but with resistance. */
export function resistedOverscroll(overscroll: number, resistance: number): number {
  'worklet';
  return overscroll * resistance;
}

export type PageTurnDirection = 'next' | 'previous';

/**
 * The page turned by a drag that ends beyond an edge, or null if the finger did not go far
 * enough. Past the left edge the next page comes in from the left, as in the pager
 * (`BookPager`); past the right edge, the previous one from the right.
 */
export function pageTurnAtEdge(overscroll: number, distance: number): PageTurnDirection | null {
  'worklet';
  if (overscroll >= distance) return 'next';
  if (overscroll <= -distance) return 'previous';
  return null;
}

/**
 * The offset a page has when it arrives by a turn, at scale `scale`: the next page shows its
 * right edge first (the reader goes on reading from where the line starts), the previous one its
 * left edge.
 */
export function arrivalOffset(direction: PageTurnDirection, scale: number, half: number): number {
  'worklet';
  const room = Math.max(scale - 1, 0) * half;
  return direction === 'next' ? 0 - room : room;
}
