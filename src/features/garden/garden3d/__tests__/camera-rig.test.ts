import {
  edgeFadeWidth,
  approachOrbit,
  cameraDirection,
  clampOrbit,
  decayVelocity,
  DEFAULT_ORBIT,
  frustumOf,
  isOrbitDefault,
  isSpinning,
  orbitAfterDrag,
  orbitAfterPinch,
  radiansPerPoint,
  rubberBand,
  type Orbit,
} from '../camera-rig';
import { GARDEN_3D } from '../config';

const PICTURE_ASPECT = 1170 / 816;
const degrees = (radians: number) => (radians * 180) / Math.PI;

describe('frustumOf: the default view is the pictures’ own', () => {
  it('frames exactly the box the pictures were cut to', () => {
    // 20.2 m of height for 900 pixels; box (15, 79)-(1185, 895) of the 1200 x 900 render.
    const unit = 20.2 / 900;
    const frame = frustumOf(DEFAULT_ORBIT, PICTURE_ASPECT);
    expect(frame.left).toBeCloseTo((15 - 600) * unit, 3);
    expect(frame.right).toBeCloseTo((1185 - 600) * unit, 3);
    expect(frame.top).toBeCloseTo((450 - 79) * unit, 3);
    expect(frame.bottom).toBeCloseTo((450 - 895) * unit, 3);
  });

  it('rests the garden on the bottom edge of a taller view, as the pictures do', () => {
    const band = frustumOf(DEFAULT_ORBIT, PICTURE_ASPECT);
    const tall = frustumOf(DEFAULT_ORBIT, 1);
    expect(tall.bottom).toBeCloseTo(band.bottom, 5);
    expect(tall.top).toBeGreaterThan(band.top);
    expect(tall.right - tall.left).toBeCloseTo(band.right - band.left, 5);
  });

  it('keeps the whole box in a wider view, centred', () => {
    const band = frustumOf(DEFAULT_ORBIT, PICTURE_ASPECT);
    const wide = frustumOf(DEFAULT_ORBIT, 3);
    expect(wide.top - wide.bottom).toBeCloseTo(band.top - band.bottom, 5);
    expect(wide.left + wide.right).toBeCloseTo(0, 5);
  });

  it('halves the frame around its centre at zoom 2', () => {
    const band = frustumOf(DEFAULT_ORBIT, PICTURE_ASPECT);
    const zoomed = frustumOf({ ...DEFAULT_ORBIT, zoom: 2 }, PICTURE_ASPECT);
    expect(zoomed.right - zoomed.left).toBeCloseTo((band.right - band.left) / 2, 5);
    expect(zoomed.top + zoomed.bottom).toBeCloseTo(band.top + band.bottom, 5);
  });

  it('widens the frame when the camera rises, so that the whole garden stays in view', () => {
    const band = frustumOf(DEFAULT_ORBIT, PICTURE_ASPECT);
    const high = frustumOf(
      { ...DEFAULT_ORBIT, elevation: GARDEN_3D.elevation.max },
      PICTURE_ASPECT,
    );
    const low = frustumOf({ ...DEFAULT_ORBIT, elevation: GARDEN_3D.elevation.min }, PICTURE_ASPECT);
    expect(high.right - high.left).toBeGreaterThan(band.right - band.left);
    expect(low.right - low.left).toBeCloseTo(band.right - band.left, 5);
  });

  it('moves the frame by the pan', () => {
    const band = frustumOf(DEFAULT_ORBIT, PICTURE_ASPECT);
    const moved = frustumOf({ ...DEFAULT_ORBIT, zoom: 2, panX: 1, panY: -0.5 }, PICTURE_ASPECT);
    expect((moved.left + moved.right) / 2).toBeCloseTo((band.left + band.right) / 2 + 1, 5);
    expect((moved.top + moved.bottom) / 2).toBeCloseTo((band.top + band.bottom) / 2 - 0.5, 5);
  });
});

describe('cameraDirection', () => {
  it('looks from the pictures’ corner: azimuth 45°, elevation 38°', () => {
    const [x, y, z] = cameraDirection(DEFAULT_ORBIT);
    expect(degrees(Math.asin(y))).toBeCloseTo(38, 5);
    expect(degrees(Math.atan2(x, z))).toBeCloseTo(45, 5);
  });

  it('turns around the vertical axis with the azimuth', () => {
    const [x, , z] = cameraDirection({ ...DEFAULT_ORBIT, azimuth: Math.PI / 2 });
    expect(degrees(Math.atan2(x, z))).toBeCloseTo(135, 5);
  });
});

describe('orbitAfterDrag: the garden follows the finger', () => {
  const width = 390;

  it('moves the rim of the garden by as many points as the finger', () => {
    const perPoint = radiansPerPoint(DEFAULT_ORBIT, width, PICTURE_ASPECT);
    const frame = frustumOf(DEFAULT_ORBIT, PICTURE_ASPECT);
    const rimPoints = (GARDEN_3D.rimRadius / (frame.right - frame.left)) * width;
    expect(perPoint * rimPoints).toBeCloseTo(1, 5);
  });

  it('turns half as much per point at zoom 2, where the garden is twice as large', () => {
    const atOne = radiansPerPoint(DEFAULT_ORBIT, width, PICTURE_ASPECT);
    const atTwo = radiansPerPoint({ ...DEFAULT_ORBIT, zoom: 2 }, width, PICTURE_ASPECT);
    expect(atTwo).toBeCloseTo(atOne / 2, 5);
  });

  it('turns the front of the garden the way the finger goes', () => {
    const turned = orbitAfterDrag(DEFAULT_ORBIT, { dx: 50, dy: 0 }, width, PICTURE_ASPECT);
    // The camera goes the other way round: the garden turns towards the finger.
    expect(turned.azimuth).toBeLessThan(0);
    expect(turned.elevation).toBe(DEFAULT_ORBIT.elevation);
  });

  it('tilts with a vertical drag, a downward drag showing more of the top', () => {
    const tilted = orbitAfterDrag(DEFAULT_ORBIT, { dx: 0, dy: 40 }, width, PICTURE_ASPECT);
    expect(tilted.elevation).toBeGreaterThan(DEFAULT_ORBIT.elevation);
  });

  it('resists past the tilt limits instead of stopping dead', () => {
    const far = orbitAfterDrag(DEFAULT_ORBIT, { dx: 0, dy: 2000 }, width, PICTURE_ASPECT);
    expect(far.elevation).toBeGreaterThan(GARDEN_3D.elevation.max);
    expect(far.elevation).toBeLessThan(
      GARDEN_3D.elevation.max + GARDEN_3D.elevation.overshoot + 1e-9,
    );
  });
});

describe('orbitAfterPinch', () => {
  it('zooms by the pinch scale', () => {
    expect(orbitAfterPinch(DEFAULT_ORBIT, 1.5, { x: 0, y: 0 }).zoom).toBeCloseTo(1.5, 5);
  });

  it('keeps the point between the fingers under the fingers', () => {
    // A point 2 m right of the centre: after zoom 2 the centre must move 1 m towards it.
    const zoomed = orbitAfterPinch(DEFAULT_ORBIT, 2, { x: 2, y: 0 });
    expect(zoomed.panX).toBeCloseTo(1, 5);
  });

  it('resists past the zoom limits', () => {
    const tooFar = orbitAfterPinch(DEFAULT_ORBIT, 10, { x: 0, y: 0 });
    expect(tooFar.zoom).toBeGreaterThan(GARDEN_3D.zoom.max);
    expect(tooFar.zoom).toBeLessThan(GARDEN_3D.zoom.max * 1.5);
    const tooClose = orbitAfterPinch(DEFAULT_ORBIT, 0.2, { x: 0, y: 0 });
    expect(tooClose.zoom).toBeLessThan(1);
    expect(tooClose.zoom).toBeGreaterThan(0.7);
  });
});

describe('clampOrbit', () => {
  it('brings tilt and zoom back inside their limits', () => {
    const clamped = clampOrbit({ ...DEFAULT_ORBIT, elevation: 2, zoom: 9 });
    expect(clamped.elevation).toBe(GARDEN_3D.elevation.max);
    expect(clamped.zoom).toBe(GARDEN_3D.zoom.max);
  });

  it('allows no pan at zoom 1: the garden stays where the picture has it', () => {
    expect(clampOrbit({ ...DEFAULT_ORBIT, panX: 3, panY: 3 })).toEqual(DEFAULT_ORBIT);
  });

  it('allows some pan once zoomed, never past the edge of the default frame', () => {
    const clamped = clampOrbit({ ...DEFAULT_ORBIT, zoom: 2, panX: 100, panY: -100 });
    expect(clamped.panX).toBeGreaterThan(0);
    expect(clamped.panX).toBeLessThan(10);
    expect(clamped.panY).toBeLessThan(0);
  });

  it('keeps any azimuth: the garden turns all the way round', () => {
    expect(clampOrbit({ ...DEFAULT_ORBIT, azimuth: 7 }).azimuth).toBe(7);
  });
});

describe('rubberBand', () => {
  it('leaves a value inside the limits as it is', () => {
    expect(rubberBand(0.5, 0, 1, 0.2)).toBe(0.5);
  });

  it('gives less than the raw value past the limit, never more than the overshoot', () => {
    const banded = rubberBand(3, 0, 1, 0.2);
    expect(banded).toBeGreaterThan(1);
    expect(banded).toBeLessThan(1.2);
    expect(rubberBand(1.5, 0, 1, 0.2)).toBeLessThan(banded);
  });

  it('works below the lower limit too', () => {
    const banded = rubberBand(-2, 0, 1, 0.2);
    expect(banded).toBeLessThan(0);
    expect(banded).toBeGreaterThan(-0.2);
  });
});

describe('the spin after release', () => {
  it('slows down like a scroll view (0.998 per millisecond)', () => {
    expect(decayVelocity(1, 100)).toBeCloseTo(0.998 ** 100, 10);
  });

  it('stops below a small speed', () => {
    expect(isSpinning(1e-3)).toBe(true);
    expect(isSpinning(GARDEN_3D.spin.restVelocity / 2)).toBe(false);
  });
});

describe('going back to the default view', () => {
  it('knows the default view', () => {
    expect(isOrbitDefault(DEFAULT_ORBIT)).toBe(true);
    expect(isOrbitDefault({ ...DEFAULT_ORBIT, azimuth: 2 * Math.PI })).toBe(true);
    expect(isOrbitDefault({ ...DEFAULT_ORBIT, zoom: 1.2 })).toBe(false);
  });

  it('reaches the default view, by the shortest way round', () => {
    let orbit: Orbit = {
      azimuth: (350 * Math.PI) / 180,
      elevation: 0.9,
      zoom: 2,
      panX: 1,
      panY: 1,
    };
    const azimuths: number[] = [];
    for (let frame = 0; frame < 120; frame += 1) {
      orbit = approachOrbit(orbit, DEFAULT_ORBIT, 16);
      azimuths.push(orbit.azimuth);
    }
    expect(isOrbitDefault(orbit)).toBe(true);
    // From 350° it goes up to 360°, not down to 0°.
    expect(azimuths[1]).toBeGreaterThan(azimuths[0] ?? 0);
  });
});

describe('zoom and pan stay where the garden is in view', () => {
  it('never zooms in so far that the garden fills the view', () => {
    expect(GARDEN_3D.zoom.max).toBeLessThanOrEqual(2);
    expect(clampOrbit({ ...DEFAULT_ORBIT, zoom: 50 }).zoom).toBe(GARDEN_3D.zoom.max);
  });

  it('keeps the garden centre inside the middle of the view, at any zoom and pan', () => {
    for (const zoom of [1.5, GARDEN_3D.zoom.max]) {
      for (const sign of [-1, 1]) {
        const o = clampOrbit({ ...DEFAULT_ORBIT, zoom, panX: sign * 100, panY: sign * 100 });
        const f = frustumOf(o, PICTURE_ASPECT);
        const centre = { x: 0, y: 0 }; /* the point the camera looks at */
        const across = (centre.x - f.left) / (f.right - f.left);
        const up = (centre.y - f.bottom) / (f.top - f.bottom);
        expect(across).toBeGreaterThan(0.1);
        expect(across).toBeLessThan(0.9);
        expect(up).toBeGreaterThan(0.1);
        expect(up).toBeLessThan(0.9);
      }
    }
  });

  it('centres the picture in a taller view when asked, and rests it on the bottom otherwise', () => {
    const tall = 0.5;
    const bottom = frustumOf(DEFAULT_ORBIT, tall);
    const centre = frustumOf(DEFAULT_ORBIT, tall, 'center');
    expect(centre.right - centre.left).toBeCloseTo(bottom.right - bottom.left, 5);
    expect((centre.top + centre.bottom) / 2).toBeCloseTo(GARDEN_3D.frame.centerY, 5);
  });
});

describe('edgeFadeWidth: the cut of a zoomed view dissolves, the picture at rest does not', () => {
  it('is nothing at rest, so the garden is the picture', () => {
    expect(edgeFadeWidth(1)).toBe(0);
  });
  it('grows with the zoom up to the configured width, and no more', () => {
    expect(edgeFadeWidth(1.25)).toBeGreaterThan(0);
    expect(edgeFadeWidth(1.25)).toBeLessThan(edgeFadeWidth(1.4));
    expect(edgeFadeWidth(GARDEN_3D.zoom.max)).toBeCloseTo(GARDEN_3D.edgeFade.width, 8);
  });
});
