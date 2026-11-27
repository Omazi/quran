import { DEFAULT_ORBIT, frustumOf, type Orbit } from '../camera-rig';
import { GARDEN_3D } from '../config';
import { focusOrbit, interpolateOrbit, shouldGlideOnGrowth, viewPlaneOffset } from '../glide';

const ASPECT = 393 / 852;

/** Where a world point lands in the view, as shares of its width and height from the top-left. */
function placeInView(orbit: Orbit, point: readonly [number, number, number]) {
  const frame = frustumOf(orbit, ASPECT, 'stage');
  const { x, y } = viewPlaneOffset(orbit, point);
  return {
    x: (x - frame.left) / (frame.right - frame.left),
    y: (frame.top - y) / (frame.top - frame.bottom),
  };
}

describe('the return glide is played only when the garden grew (owner, 27 November 2026)', () => {
  it('glides when a growth is to be played and the plant can be found', () => {
    expect(
      shouldGlideOnGrowth({ segments: 1, isMotionReduced: false, isEnabled: true, hasFocus: true }),
    ).toBe(true);
  });

  it('does not glide when nothing grew', () => {
    expect(
      shouldGlideOnGrowth({ segments: 0, isMotionReduced: false, isEnabled: true, hasFocus: true }),
    ).toBe(false);
  });

  it('does not glide with Reduce Motion: the plant takes its size at once', () => {
    expect(
      shouldGlideOnGrowth({ segments: 2, isMotionReduced: true, isEnabled: true, hasFocus: true }),
    ).toBe(false);
  });

  it('does not glide on a garden that does not ask for it (a friend’s), nor without a plant to go to', () => {
    expect(
      shouldGlideOnGrowth({
        segments: 1,
        isMotionReduced: false,
        isEnabled: false,
        hasFocus: true,
      }),
    ).toBe(false);
    expect(
      shouldGlideOnGrowth({
        segments: 1,
        isMotionReduced: false,
        isEnabled: true,
        hasFocus: false,
      }),
    ).toBe(false);
  });
});

describe('the camera goes to the growing plant', () => {
  it('puts the plant in the middle of the view, zoomed in', () => {
    const plant = [-4.2, 0, 5.1] as const;
    const target = focusOrbit(DEFAULT_ORBIT, plant, ASPECT, 'stage');
    expect(target.zoom).toBe(GARDEN_3D.glide.zoom);
    const place = placeInView(target, plant);
    expect(place.x).toBeCloseTo(0.5, 5);
    expect(place.y).toBeCloseTo(GARDEN_3D.glide.focusY, 5);
  });

  it('keeps the turn and the tilt the person left', () => {
    const turned: Orbit = { ...DEFAULT_ORBIT, azimuth: 1.1, elevation: 0.5 };
    const target = focusOrbit(turned, [3, 0, -2], ASPECT, 'stage');
    expect(target.azimuth).toBe(1.1);
    expect(target.elevation).toBe(0.5);
    const place = placeInView(target, [3, 0, -2]);
    expect(place.x).toBeCloseTo(0.5, 5);
  });

  it('sees the point the camera looks at in the middle of the camera plane', () => {
    const [x, y] = [0, 1.5];
    const offset = viewPlaneOffset(DEFAULT_ORBIT, [x, y, 0]);
    expect(offset.x).toBeCloseTo(0, 6);
    expect(offset.y).toBeCloseTo(0, 6);
  });
});

describe('the camera moves along an ease-in-out curve', () => {
  const from: Orbit = { ...DEFAULT_ORBIT, azimuth: 0.2 };
  const to: Orbit = { ...DEFAULT_ORBIT, azimuth: 0.2, zoom: 1.9, panX: 2, panY: -1 };

  it('starts where it was and arrives exactly', () => {
    expect(interpolateOrbit(from, to, 0)).toEqual(from);
    expect(interpolateOrbit(from, to, 1)).toEqual(to);
  });

  it('is about halfway at half the time, slow at both ends', () => {
    // The strong ease-in-out (0.77, 0, 0.175, 1) is not symmetric: 60 % of the way at mid-time.
    expect(interpolateOrbit(from, to, 0.5).panX).toBeGreaterThan(0.8);
    expect(interpolateOrbit(from, to, 0.5).panX).toBeLessThan(1.4);
    expect(interpolateOrbit(from, to, 0.1).panX).toBeLessThan(0.2);
    expect(interpolateOrbit(from, to, 0.9).panX).toBeGreaterThan(1.8);
  });

  it('turns the short way round', () => {
    const a: Orbit = { ...DEFAULT_ORBIT, azimuth: 0.1 };
    const b: Orbit = { ...DEFAULT_ORBIT, azimuth: 2 * Math.PI - 0.1 };
    // Through 0 (0.2 rad of turn), not through π (6.1 rad).
    const middle = interpolateOrbit(a, b, 0.5).azimuth;
    expect(Math.abs(middle)).toBeLessThan(0.1);
  });
});
