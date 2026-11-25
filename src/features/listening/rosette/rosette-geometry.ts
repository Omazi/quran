/**
 * The lines of the rosette, as SVG paths: the eight-pointed star that marks the quarters of a
 * hizb in the mushaf. Two squares laid over one another make the star; each smaller star sits
 * exactly in the hollows of the one around it. A translation of `starPath`, `petalPath` and
 * `rosetteInside` of the validated prototype, point for point.
 *
 * These functions are worklets: the petals are recomputed on the UI thread at every frame.
 */
import { ROSETTE_GEOMETRY } from '../config';

/** Two decimals: a hundredth of a point is below what a screen shows. */
function n(value: number): string {
  'worklet';
  return (Math.round(value * 100) / 100).toString();
}

/** The point at `radius` from the centre, at `angle` (0 = to the right, clockwise on screen). */
function at(cx: number, cy: number, radius: number, angle: number): string {
  'worklet';
  return `${n(cx + Math.cos(angle) * radius)} ${n(cy + Math.sin(angle) * radius)}`;
}

/** The first tip points up. */
const TOP = -Math.PI / 2;

/** The eight-pointed star of radius `radius`: 16 points, tips and hollows in turn. */
export function starPath(cx: number, cy: number, radius: number): string {
  'worklet';
  const { hollow } = ROSETTE_GEOMETRY;
  let path = '';
  for (let index = 0; index < 16; index += 1) {
    const length = index % 2 === 0 ? radius : radius * hollow;
    path += `${index === 0 ? 'M' : 'L'}${at(cx, cy, length, (index * Math.PI) / 8 + TOP)}`;
  }
  return `${path}Z`;
}

/**
 * The same star with softened tips: eight petals. `roundness` goes from 0 (a sharp tip that
 * reaches a little past the star) to 1 (a round petal that stops at the star's radius).
 */
export function petalPath(cx: number, cy: number, radius: number, roundness: number): string {
  'worklet';
  const { hollow, petalTipReach } = ROSETTE_GEOMETRY;
  const tipRadius = radius * (1 + petalTipReach * (1 - roundness));
  let path = '';
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4 + TOP;
    if (index === 0) path += `M${at(cx, cy, radius * hollow, angle - Math.PI / 8)}`;
    path += `Q${at(cx, cy, tipRadius, angle)} ${at(cx, cy, radius * hollow, angle + Math.PI / 8)}`;
  }
  return `${path}Z`;
}

/**
 * The inside of the rosette: for each of the eight small squares around the heart star, its two
 * inner sides and its diagonal from the outer tip to the heart.
 */
export function insidePath(cx: number, cy: number, radius: number): string {
  'worklet';
  const { hollow, inner } = ROSETTE_GEOMETRY;
  let path = '';
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4 + TOP;
    const heart = at(cx, cy, radius * inner, angle);
    path +=
      `M${at(cx, cy, radius * hollow, angle - Math.PI / 8)}L${heart}` +
      `L${at(cx, cy, radius * hollow, angle + Math.PI / 8)}` +
      `M${at(cx, cy, radius, angle)}L${heart}`;
  }
  return path;
}

/** The eight tips of the heart star, where the night draws a quiet point of light. */
export function heartTips(cx: number, cy: number, radius: number): { x: number; y: number }[] {
  const tips: { x: number; y: number }[] = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4 + TOP;
    const length = radius * ROSETTE_GEOMETRY.inner;
    tips.push({ x: cx + Math.cos(angle) * length, y: cy + Math.sin(angle) * length });
  }
  return tips;
}

/** Centre and radius of the rosette on a screen of this size (`drawRosette`, without the voice). */
export function rosetteFrame(
  width: number,
  height: number,
): { cx: number; cy: number; radius: number } {
  const { centreX, centreY, radiusOfWidth, radiusOfHeight } = ROSETTE_GEOMETRY;
  return {
    cx: width * centreX,
    cy: height * centreY,
    radius: Math.min(width * radiusOfWidth, height * radiusOfHeight),
  };
}
