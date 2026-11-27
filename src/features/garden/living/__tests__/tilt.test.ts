import { TILT, gravityTilt, nextTilt, type TiltState } from '../tilt';

const REST: TiltState = { baseline: null, tilt: { x: 0, y: 0 } };
const FRAME_MS = 1000 / 60;

/** `ms` of frames with the phone held at `raw`. */
function hold(state: TiltState, raw: { x: number; y: number } | null, ms: number): TiltState {
  let next = state;
  for (let t = 0; t < ms; t += FRAME_MS) next = nextTilt(next, raw, FRAME_MS);
  return next;
}

describe('the light follows the phone in the hand (maquette-wow; owner, 27 November 2026)', () => {
  it('reads the tilt from gravity, the same unit on every platform', () => {
    expect(gravityTilt({ x: 0, y: -9.81, z: 0 })).toEqual({ x: 0, y: -1 });
    const tilted = gravityTilt({ x: 4.9, y: -8.5, z: 0 });
    expect(tilted.x).toBeCloseTo(0.5, 1);
    // Free fall or a sensor that says nothing: no tilt rather than a division by zero.
    expect(gravityTilt({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('takes the way the phone is held as its rest: holding it still shows no shift', () => {
    const held = hold(REST, { x: 0.2, y: -0.7 }, 1000);
    expect(Math.abs(held.tilt.x)).toBeLessThan(0.02);
    expect(Math.abs(held.tilt.y)).toBeLessThan(0.02);
  });

  it('shifts when the phone turns from its rest, smoothly, never past the limit', () => {
    const rested = hold(REST, { x: 0, y: -0.7 }, 1000);
    const soon = hold(rested, { x: 0.3, y: -0.7 }, 50);
    const later = hold(rested, { x: 0.3, y: -0.7 }, 400);
    expect(soon.tilt.x).toBeGreaterThan(0);
    expect(later.tilt.x).toBeGreaterThan(soon.tilt.x);
    const far = hold(rested, { x: 1, y: 1 }, 400);
    expect(Math.abs(far.tilt.x)).toBeLessThanOrEqual(TILT.limit);
    expect(Math.abs(far.tilt.y)).toBeLessThanOrEqual(TILT.limit);
  });

  it('comes back to rest when the phone stays in its new position', () => {
    const rested = hold(REST, { x: 0, y: -0.7 }, 1000);
    const moved = hold(rested, { x: 0.3, y: -0.7 }, 400);
    const settled = hold(moved, { x: 0.3, y: -0.7 }, 15000);
    expect(Math.abs(settled.tilt.x)).toBeLessThan(0.05);
  });

  it('goes back to rest without a sensor (Reduce Motion, paused, no motion data)', () => {
    const rested = hold(REST, { x: 0, y: -0.7 }, 1000);
    const moved = hold(rested, { x: 0.3, y: -0.7 }, 400);
    const without = hold(moved, null, 1500);
    expect(Math.abs(without.tilt.x)).toBeLessThan(0.02);
  });

  it('ignores a sample that is not a number', () => {
    const rested = hold(REST, { x: 0, y: -0.7 }, 500);
    const next = nextTilt(rested, { x: Number.NaN, y: -0.7 }, FRAME_MS);
    expect(Number.isFinite(next.tilt.x)).toBe(true);
  });
});
