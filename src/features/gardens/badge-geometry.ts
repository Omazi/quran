/**
 * The shape of the badge (D46, validated by the owner): the eight-pointed star of the quarter-hizb
 * marks of the mushaf, two squares turned 45° from each other. Pure: numbers in, points out.
 */

/** The badge is drawn in a 100 × 100 box and scaled to its size. */
export const BADGE_BOX = 100;

/**
 * Where the inner corners of the star are, against its points: two equal squares turned 45°
 * cross at cos 45° / cos 22.5° of their half-diagonal.
 */
export const STAR_INNER_RATIO = Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8);

const POINTS = 8;

/** The 16 corners of the star outline, as an SVG `points` list, its first point at the top. */
export function starPoints(centre: number, radius: number): string {
  const corners: string[] = [];
  for (let index = 0; index < POINTS * 2; index += 1) {
    const angle = (index * Math.PI) / POINTS - Math.PI / 2;
    const distance = index % 2 === 0 ? radius : radius * STAR_INNER_RATIO;
    const x = centre + distance * Math.cos(angle);
    const y = centre + distance * Math.sin(angle);
    corners.push(`${round(x)},${round(y)}`);
  }
  return corners.join(' ');
}

/**
 * An arc of a circle from the top, clockwise, as an SVG path: the progress of a garden in its
 * badge. `fraction` from 0 to 1; a whole circle is drawn as two halves (an arc cannot end where
 * it starts).
 */
export function progressArc(centre: number, radius: number, fraction: number): string {
  if (!(fraction >= 0 && fraction <= 1)) {
    throw new RangeError(`progressArc: fraction must be from 0 to 1, got ${fraction}`);
  }
  const top = `M ${round(centre)} ${round(centre - radius)}`;
  if (fraction === 0) return top;
  if (fraction === 1) {
    const bottom = round(centre + radius);
    return `${top} A ${radius} ${radius} 0 1 1 ${round(centre)} ${bottom} A ${radius} ${radius} 0 1 1 ${round(centre)} ${round(centre - radius)}`;
  }
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  const x = centre + radius * Math.cos(angle);
  const y = centre + radius * Math.sin(angle);
  const largeArc = fraction > 0.5 ? 1 : 0;
  return `${top} A ${radius} ${radius} 0 ${largeArc} 1 ${round(x)} ${round(y)}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
