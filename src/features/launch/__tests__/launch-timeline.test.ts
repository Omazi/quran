import {
  fadeOutDuration,
  LAUNCH_TIMELINE,
  REDUCED_TIMELINE,
  settledAt,
  shortestLaunch,
} from '../launch-timeline';

describe('the launch timeline', () => {
  it('lasts between 1.2 and 1.6 seconds when the app is ready at once', () => {
    expect(shortestLaunch('full')).toBeGreaterThanOrEqual(1200);
    expect(shortestLaunch('full')).toBeLessThanOrEqual(1600);
  });

  it('has every part of the mark in place before the overlay may leave', () => {
    const { word, drops, leaf, settled } = LAUNCH_TIMELINE;
    const lastDropEnd = drops.start + (drops.count - 1) * drops.stagger + drops.duration;
    expect(word.start + word.duration).toBeLessThanOrEqual(settled);
    expect(lastDropEnd).toBeLessThanOrEqual(settled);
    expect(leaf.start + leaf.duration).toBeLessThanOrEqual(settled);
  });

  it('writes the letters first, then the drops and the leaf', () => {
    const { word, drops, leaf } = LAUNCH_TIMELINE;
    expect(word.start).toBeLessThan(drops.start);
    expect(word.start).toBeLessThan(leaf.start);
    // The leaf waits for the stroke to nearly reach its tip.
    expect(leaf.start).toBeGreaterThanOrEqual(word.start + word.duration * 0.8);
  });

  it('staggers the drops by 30 to 80 milliseconds', () => {
    expect(LAUNCH_TIMELINE.drops.stagger).toBeGreaterThanOrEqual(30);
    expect(LAUNCH_TIMELINE.drops.stagger).toBeLessThanOrEqual(80);
  });

  it('is much shorter with Reduce Motion, and only fades', () => {
    expect(shortestLaunch('reduced')).toBeLessThan(shortestLaunch('full') / 2);
    expect(shortestLaunch('reduced')).toBeLessThanOrEqual(500);
    expect(settledAt('reduced')).toBe(REDUCED_TIMELINE.fadeIn);
    expect(fadeOutDuration('reduced')).toBe(REDUCED_TIMELINE.fadeOut);
  });
});
