import {
  PROJECTED_PAGING,
  cappedReleaseVelocity,
  projectedDragPosition,
  projectedTarget,
  releaseVelocity,
  rubberBand,
} from '../components/swipe-paging';

const H = 800;

describe('the projected pager: the finger, 1:1', () => {
  it('follows the finger one for one between the first and the last page', () => {
    expect(
      projectedDragPosition({ start: 3, forwards: H * 0.4, length: H, pageCount: 16 }),
    ).toBeCloseTo(3.4);
    expect(
      projectedDragPosition({ start: 3, forwards: -H * 0.25, length: H, pageCount: 16 }),
    ).toBeCloseTo(2.75);
  });

  it('is not held to one page while the finger is down: only the release is', () => {
    expect(
      projectedDragPosition({ start: 3, forwards: H * 1.6, length: H, pageCount: 16 }),
    ).toBeCloseTo(4.6);
  });

  it('resists past the first and the last page with the rubber band x·d·c / (d + c·|x|)', () => {
    const past = projectedDragPosition({ start: 0, forwards: -H / 2, length: H, pageCount: 16 });
    expect(past).toBeCloseTo(-rubberBand(H / 2, H) / H);
    expect(past).toBeGreaterThan(-0.5 * PROJECTED_PAGING.rubberCoefficient);
    const end = projectedDragPosition({ start: 15, forwards: H / 4, length: H, pageCount: 16 });
    expect(end).toBeCloseTo(15 + rubberBand(H / 4, H) / H);
  });

  it('computes the rubber band of the spec exactly, and never reaches a whole page', () => {
    expect(rubberBand(100, 800)).toBeCloseTo((100 * 800 * 0.55) / (800 + 0.55 * 100));
    expect(rubberBand(1e9, 800)).toBeLessThan(800);
    expect(rubberBand(0, 800)).toBe(0);
  });
});

describe('the projected pager: where a release goes', () => {
  it('projects the flick with a deceleration of 0.998 (0.499 s of the speed)', () => {
    expect(PROJECTED_PAGING.projectionS).toBeCloseTo(0.499, 3);
  });

  it('turns the page with a short quick flick (90 pt at 900 pt/s)', () => {
    const position = 3 + 90 / H;
    expect(projectedTarget({ position, velocity: 900 / H, anchor: 3, pageCount: 16 })).toBe(4);
  });

  it('springs back after a slow short drag (120 pt, finger nearly still)', () => {
    const position = 3 + 120 / H;
    expect(projectedTarget({ position, velocity: 30 / H, anchor: 3, pageCount: 16 })).toBe(3);
  });

  it('goes to the nearest page of the projection: past half a page, the next one', () => {
    expect(projectedTarget({ position: 3.55, velocity: 0, anchor: 3, pageCount: 16 })).toBe(4);
    expect(projectedTarget({ position: 3.45, velocity: 0, anchor: 3, pageCount: 16 })).toBe(3);
  });

  it('turns one page at most, however hard the flick', () => {
    expect(projectedTarget({ position: 3.3, velocity: 20, anchor: 3, pageCount: 16 })).toBe(4);
    expect(projectedTarget({ position: 4.9, velocity: 5, anchor: 3, pageCount: 16 })).toBe(4);
    expect(projectedTarget({ position: 2.7, velocity: -20, anchor: 3, pageCount: 16 })).toBe(2);
  });

  it('a flick back against a long drag returns to the page it started from', () => {
    expect(projectedTarget({ position: 3.6, velocity: -1.2, anchor: 3, pageCount: 16 })).toBe(3);
  });

  it('stays within the pages', () => {
    expect(projectedTarget({ position: -0.1, velocity: -4, anchor: 0, pageCount: 16 })).toBe(0);
    expect(projectedTarget({ position: 15.1, velocity: 4, anchor: 15, pageCount: 16 })).toBe(15);
  });

  it('counts from the spring’s target when the pages were caught while moving', () => {
    // Caught on the way to page 5 at 4.8, pulled on: the next page is 6 at most, not 5.8 + 1.
    expect(projectedTarget({ position: 5.3, velocity: 6, anchor: 5, pageCount: 16 })).toBe(6);
  });
});

describe('the projected pager: the release speed', () => {
  const omega = Math.sqrt(PROJECTED_PAGING.spring.stiffness / PROJECTED_PAGING.spring.mass);

  it('is the critically damped spring of the spec: stiffness 195, damping 27.9, mass 1', () => {
    expect(PROJECTED_PAGING.spring).toEqual({ mass: 1, stiffness: 195, damping: 27.9 });
    // Damping ratio 1: no overshoot (damping = 2·√(k·m)).
    expect(PROJECTED_PAGING.spring.damping / (2 * Math.sqrt(195))).toBeCloseTo(1, 2);
  });

  it('caps a speed toward the target so the spring never crosses the page', () => {
    expect(cappedReleaseVelocity({ position: 3.8, target: 4, velocity: 30, omega })).toBeCloseTo(
      omega * 0.2,
    );
  });

  it('keeps a speed below the cap, and a speed away from the target (the spring turns it)', () => {
    expect(cappedReleaseVelocity({ position: 3.2, target: 4, velocity: 1, omega })).toBe(1);
    expect(cappedReleaseVelocity({ position: 3.2, target: 3, velocity: 3, omega })).toBe(3);
  });

  it('is zero when the finger rested more than 40 ms before lifting', () => {
    expect(releaseVelocity({ velocity: 1200, restedMs: 41, canceled: false })).toBe(0);
    expect(releaseVelocity({ velocity: 1200, restedMs: 12, canceled: false })).toBe(1200);
    expect(releaseVelocity({ velocity: 1200, restedMs: 0, canceled: true })).toBe(0);
  });
});
