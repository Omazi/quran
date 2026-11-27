/**
 * The return glide of the home garden (maquette-wow, `growOnReturn`; owner, 27 November 2026):
 * back in the garden after some reading, the camera goes to the plant that grew, the plant grows
 * one step with a ripple of light, and the camera comes back. Only if the garden grew; a tap
 * interrupts it. Pure: when to glide, where to, and the camera on the way.
 */

import { baseFrame, cameraDirection, frustumOf, type FrameAnchor, type Orbit } from './camera-rig';
import { GARDEN_3D } from './config';

export interface GlideConditions {
  /** Segments of growth to play (`growthSegments`): 0 when nothing grew since last shown. */
  readonly segments: number;
  readonly isMotionReduced: boolean;
  /** The garden asks for it: the person's own garden on the home screen. */
  readonly isEnabled: boolean;
  /** The growing plant has a place in the garden the camera can go to. */
  readonly hasFocus: boolean;
}

/**
 * Only if the garden grew (owner's decision), never with Reduce Motion (motion.md › Make motion
 * optional: the plant then takes its size at once).
 */
export function shouldGlideOnGrowth({
  segments,
  isMotionReduced,
  isEnabled,
  hasFocus,
}: GlideConditions): boolean {
  return segments > 0 && !isMotionReduced && isEnabled && hasFocus;
}

/** Where a point of the garden is on the camera's plane, in metres from the point looked at. */
export function viewPlaneOffset(
  orbit: Orbit,
  point: readonly [number, number, number],
): { x: number; y: number } {
  const [dx, dy, dz] = cameraDirection(orbit);
  const [tx, ty, tz] = GARDEN_3D.picture.target;
  const p = [point[0] - tx, point[1] - ty, point[2] - tz] as const;
  // The camera's right: world up × towards the camera; its up: towards the camera × right.
  const rightLength = Math.hypot(dz, dx);
  const right = [dz / rightLength, 0, -dx / rightLength] as const;
  const up = [
    dy * right[2] - dz * right[1],
    dz * right[0] - dx * right[2],
    dx * right[1] - dy * right[0],
  ] as const;
  return {
    x: p[0] * right[0] + p[1] * right[1] + p[2] * right[2],
    y: p[0] * up[0] + p[1] * up[1] + p[2] * up[2],
  };
}

/**
 * The orbit that shows `point` at the middle of the view (`GARDEN_3D.glide.focusY` of its height),
 * zoomed in, from the turn and the tilt of `from`.
 */
export function focusOrbit(
  from: Orbit,
  point: readonly [number, number, number],
  aspect: number,
  anchor: FrameAnchor,
  zoom: number = GARDEN_3D.glide.zoom,
): Orbit {
  const oriented: Orbit = { ...from, zoom, panX: 0, panY: 0 };
  const base = baseFrame(aspect, anchor);
  const frame = frustumOf(oriented, aspect, anchor);
  const height = frame.top - frame.bottom;
  const offset = viewPlaneOffset(oriented, point);
  return {
    ...oriented,
    panX: offset.x - base.centerX,
    panY: offset.y + (GARDEN_3D.glide.focusY - 0.5) * height - base.centerY,
  };
}

type Curve = { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number };

function bezier(a: number, b: number, t: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

/** The value of a cubic-bezier easing at time `t` (0 to 1), solved by bisection. */
export function easeAlong(curve: Curve, t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 30; step += 1) {
    const middle = (low + high) / 2;
    if (bezier(curve.x1, curve.x2, middle) < t) low = middle;
    else high = middle;
  }
  return bezier(curve.y1, curve.y2, (low + high) / 2);
}

const TWO_PI = 2 * Math.PI;

function shortestTurn(from: number, to: number): number {
  const turn = (((to - from) % TWO_PI) + TWO_PI) % TWO_PI;
  return turn > Math.PI ? turn - TWO_PI : turn;
}

/** The camera `t` of the way from `from` to `to`, along `curve`; exactly `to` at the end. */
export function interpolateOrbit(
  from: Orbit,
  to: Orbit,
  t: number,
  curve: Curve = GARDEN_3D.glide.easeInOut,
): Orbit {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const k = easeAlong(curve, t);
  const lerp = (a: number, b: number) => a + (b - a) * k;
  return {
    azimuth: from.azimuth + shortestTurn(from.azimuth, to.azimuth) * k,
    elevation: lerp(from.elevation, to.elevation),
    zoom: lerp(from.zoom, to.zoom),
    panX: lerp(from.panX, to.panX),
    panY: lerp(from.panY, to.panY),
  };
}
