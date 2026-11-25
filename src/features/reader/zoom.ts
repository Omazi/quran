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
