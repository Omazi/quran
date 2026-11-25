/**
 * Where the camera of the 3D garden is, and how gestures move it. Pure: numbers in, numbers out.
 *
 * The default orbit is the camera of the pictures: same corner, same height, same frame, so that
 * the garden at rest is the picture (D40). A drag turns the garden around its vertical axis and
 * tilts it a little; a pinch zooms, around the point between the fingers; the camera never goes
 * under the plot nor further than the picture.
 */

import { GARDEN_3D } from './config';

export interface Orbit {
  /** Turn around the vertical axis from the pictures' corner, in radians. Any value. */
  readonly azimuth: number;
  /** Height of the camera above the horizon, in radians. */
  readonly elevation: number;
  /** 1 is the picture's frame; 2 shows half of it. */
  readonly zoom: number;
  /** Shift of the frame, in metres of the view plane, once zoomed. */
  readonly panX: number;
  readonly panY: number;
}

export const DEFAULT_ORBIT: Orbit = {
  azimuth: 0,
  elevation: GARDEN_3D.picture.elevation,
  zoom: 1,
  panX: 0,
  panY: 0,
};

/** Where the picture's frame rests in a view taller than itself. */
export type FrameAnchor = 'bottom' | 'center';

export interface Frustum {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

const TWO_PI = 2 * Math.PI;

/** Past a limit, the value moves less and less, up to `overshoot` beyond it (iOS's rubber band). */
export function rubberBand(value: number, min: number, max: number, overshoot: number): number {
  const band = (excess: number) => overshoot * (1 - 1 / (excess / overshoot + 1));
  if (value > max) return max + band(value - max);
  if (value < min) return min - band(min - value);
  return value;
}

function depthInView(elevation: number): number {
  const { depth, height } = GARDEN_3D.fit;
  return depth * Math.sin(elevation) + height * Math.cos(elevation);
}

/** How much wider the frame is than the picture's, so that a raised camera sees the whole plot. */
function elevationFit(elevation: number): number {
  return Math.max(1, depthInView(elevation) / depthInView(GARDEN_3D.picture.elevation));
}

/**
 * The frame at zoom 1 for a view of this aspect (width over height): the picture's box, whole,
 * resting on the bottom edge of a taller view and centred in a wider one, as the pictures sit in
 * `GardenScene`.
 */
function baseFrame(
  aspect: number,
  anchor: FrameAnchor,
): {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
} {
  const { width, height, centerX, centerY } = GARDEN_3D.frame;
  if (aspect >= width / height) {
    return { centerX, centerY, width: height * aspect, height };
  }
  const tallHeight = width / aspect;
  if (anchor === 'center') return { centerX, centerY, width, height: tallHeight };
  const bottom = centerY - height / 2;
  return { centerX, centerY: bottom + tallHeight / 2, width, height: tallHeight };
}

/** The orthographic frame, in metres around the point the camera looks at. */
export function frustumOf(orbit: Orbit, aspect: number, anchor: FrameAnchor = 'bottom'): Frustum {
  const base = baseFrame(aspect, anchor);
  const scale = elevationFit(orbit.elevation) / orbit.zoom;
  const halfWidth = (base.width * scale) / 2;
  const halfHeight = (base.height * scale) / 2;
  const centerX = base.centerX + orbit.panX;
  const centerY = base.centerY + orbit.panY;
  return {
    left: centerX - halfWidth,
    right: centerX + halfWidth,
    top: centerY + halfHeight,
    bottom: centerY - halfHeight,
  };
}

/** The unit vector from the point looked at to the camera. */
export function cameraDirection(orbit: Orbit): [number, number, number] {
  const azimuth = GARDEN_3D.picture.azimuth + orbit.azimuth;
  const { elevation } = orbit;
  return [
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ];
}

/** Radians per point of drag, so that the rim of the garden moves exactly with the finger. */
export function radiansPerPoint(
  orbit: Orbit,
  viewWidth: number,
  aspect: number,
  anchor: FrameAnchor = 'bottom',
): number {
  const frame = frustumOf(orbit, aspect, anchor);
  const rimPoints = (GARDEN_3D.rimRadius / (frame.right - frame.left)) * viewWidth;
  return 1 / rimPoints;
}

/**
 * The orbit after a drag of (dx, dy) points from `start`. Horizontal turns the garden toward the
 * finger; vertical tilts it, a downward drag showing more of the top, with resistance past the
 * limits.
 */
export function orbitAfterDrag(
  start: Orbit,
  drag: { dx: number; dy: number },
  viewWidth: number,
  aspect: number,
  anchor: FrameAnchor = 'bottom',
): Orbit {
  const perPoint = radiansPerPoint(start, viewWidth, aspect, anchor);
  const { min, max, overshoot } = GARDEN_3D.elevation;
  return {
    ...start,
    azimuth: start.azimuth - drag.dx * perPoint,
    elevation: rubberBand(start.elevation + drag.dy * perPoint, min, max, overshoot),
  };
}

/** Where a point of the view is, in metres from the centre of the frame (y up). */
export function viewOffset(
  orbit: Orbit,
  aspect: number,
  view: { width: number; height: number },
  point: { x: number; y: number },
  anchor: FrameAnchor = 'bottom',
): { x: number; y: number } {
  const frame = frustumOf(orbit, aspect, anchor);
  return {
    x: (point.x / view.width - 0.5) * (frame.right - frame.left),
    y: (0.5 - point.y / view.height) * (frame.top - frame.bottom),
  };
}

/**
 * The orbit after a pinch of `scale` from `start`. `focalStart` is where the fingers met, and
 * `focalNow` where they are, in metres from the centre of the start frame: the point that was
 * between the fingers stays between them. Resistance past the zoom limits.
 */
export function orbitAfterPinch(
  start: Orbit,
  scale: number,
  focalStart: { x: number; y: number },
  focalNow: { x: number; y: number } = focalStart,
): Orbit {
  const { min, max, overshoot } = GARDEN_3D.zoom;
  const raw = start.zoom * scale;
  // The resistance works on ratios: a zoom twice past the limit feels the same in and out.
  const ratio = Math.log(raw);
  const zoom = Math.exp(rubberBand(ratio, Math.log(min), Math.log(max), Math.log(overshoot)));
  const shrink = start.zoom / zoom;
  return clampPan({
    ...start,
    zoom,
    panX: start.panX + focalStart.x - focalNow.x * shrink,
    panY: start.panY + focalStart.y - focalNow.y * shrink,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The frame stays within `panReach` of the picture's frame: at zoom 1 there is no pan at all. */
function clampPan(orbit: Orbit): Orbit {
  const { width, height } = GARDEN_3D.frame;
  // Only part of the room: the garden's centre stays well inside the view, never at its edge.
  const room = Math.max(0, 1 - 1 / orbit.zoom) * elevationFit(orbit.elevation) * GARDEN_3D.panReach;
  const maxX = (width / 2) * room;
  const maxY = (height / 2) * room;
  return { ...orbit, panX: clamp(orbit.panX, -maxX, maxX), panY: clamp(orbit.panY, -maxY, maxY) };
}

/** The same orbit, inside every limit. The azimuth is free: the garden turns all the way. */
export function clampOrbit(orbit: Orbit): Orbit {
  const { elevation, zoom } = GARDEN_3D;
  return clampPan({
    ...orbit,
    elevation: clamp(orbit.elevation, elevation.min, elevation.max),
    zoom: clamp(orbit.zoom, zoom.min, zoom.max),
  });
}

/** The spin speed after `elapsedMs` without a finger (radians per millisecond). */
export function decayVelocity(velocity: number, elapsedMs: number): number {
  return velocity * GARDEN_3D.spin.deceleration ** elapsedMs;
}

export function isSpinning(velocity: number): boolean {
  return Math.abs(velocity) >= GARDEN_3D.spin.restVelocity;
}

/** An angle brought into (-π, π]. */
function wrapAngle(angle: number): number {
  const wrapped = angle - TWO_PI * Math.floor((angle + Math.PI) / TWO_PI);
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/** Whether two orbits look the same: a whole turn is no turn. */
export function sameOrbit(a: Orbit, b: Orbit): boolean {
  const { epsilon } = GARDEN_3D.settle;
  return (
    Math.abs(wrapAngle(a.azimuth - b.azimuth)) < epsilon &&
    Math.abs(a.elevation - b.elevation) < epsilon &&
    Math.abs(a.zoom - b.zoom) < epsilon &&
    Math.abs(a.panX - b.panX) < epsilon &&
    Math.abs(a.panY - b.panY) < epsilon
  );
}

export function isOrbitDefault(orbit: Orbit): boolean {
  return sameOrbit(orbit, DEFAULT_ORBIT);
}

/**
 * One frame of the way from `orbit` to `target`, `elapsedMs` later: an exponential approach (no
 * bounce: nothing was thrown), by the shortest way round. Arrives exactly on `target`.
 */
export function approachOrbit(orbit: Orbit, target: Orbit, elapsedMs: number): Orbit {
  const keep = Math.exp(-elapsedMs / GARDEN_3D.settle.timeConstantMs);
  const towards = (from: number, to: number) => to + (from - to) * keep;
  // The target azimuth closest to the current one, so that the garden turns the short way.
  const nearTarget = orbit.azimuth + wrapAngle(target.azimuth - orbit.azimuth);
  const next: Orbit = {
    azimuth: towards(orbit.azimuth, nearTarget),
    elevation: towards(orbit.elevation, target.elevation),
    zoom: towards(orbit.zoom, target.zoom),
    panX: towards(orbit.panX, target.panX),
    panY: towards(orbit.panY, target.panY),
  };
  return sameOrbit(next, target) ? { ...target, azimuth: nearTarget } : next;
}

/**
 * How much of its width each edge of the view dissolves into the page, at this zoom (0 to
 * `edgeFade.width`, as a share of the view's smaller side). At rest the garden is the picture, whole,
 * and nothing fades; once zoomed, the garden is cut by the view, and the cut must not show as a line.
 */
export function edgeFadeWidth(zoom: number): number {
  const { width, fromZoom, fullAtZoom } = GARDEN_3D.edgeFade;
  const t = clamp((zoom - fromZoom) / (fullAtZoom - fromZoom), 0, 1);
  return width * t * t * (3 - 2 * t);
}
