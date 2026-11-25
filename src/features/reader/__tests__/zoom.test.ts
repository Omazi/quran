/**
 * The arithmetic of the page zoom (spec 2, deviation 34): the scale stays between the page's size
 * and its maximum, the point under the fingers stays under them, the enlarged page never leaves
 * the screen, and a double tap goes in, then back out.
 */

import { READER_CONFIG } from '../config';
import { clampOffset, clampScale, offsetAfterZoom, toggledScale } from '../zoom';

describe('the zoom of the page', () => {
  it('keeps the scale between the page size and the maximum', () => {
    const max = READER_CONFIG.zoom.maximumScale;
    expect(clampScale(0.5, max)).toBe(1);
    expect(clampScale(1.7, max)).toBe(1.7);
    expect(clampScale(9, max)).toBe(max);
  });

  it('keeps the point under the fingers where it is', () => {
    // A point 100 points right of the centre, page at scale 1, zoomed to 2: the page moves left
    // by 100 points, so the point stays at +100 on screen.
    const offset = offsetAfterZoom(0, 100, 2);
    const pointInPage = 100;
    expect(offset + 2 * pointInPage).toBe(100);
    // From an already zoomed and moved page.
    const start = -40;
    const startScale = 2;
    const focal = 60;
    const inPage = (focal - start) / startScale;
    const next = offsetAfterZoom(start, focal, 1.5);
    expect(next + startScale * 1.5 * inPage).toBeCloseTo(focal, 10);
  });

  it('never lets the enlarged page leave the screen', () => {
    // At scale 2, a page 200 points wide (half 100) can move 100 points each way.
    expect(clampOffset(150, 2, 100)).toBe(100);
    expect(clampOffset(-150, 2, 100)).toBe(-100);
    expect(clampOffset(30, 2, 100)).toBe(30);
    // At its own size, it does not move.
    expect(clampOffset(30, 1, 100)).toBe(0);
  });

  it('zooms in with a double tap, and back out with the next', () => {
    const level = READER_CONFIG.zoom.doubleTapScale;
    expect(toggledScale(1, level)).toBe(level);
    expect(toggledScale(level, level)).toBe(1);
    // A page enlarged by a pinch goes back to its size.
    expect(toggledScale(2.6, level)).toBe(1);
  });
});
