/**
 * The cracks of the dying garden's earth (the prototype's `#cracks`), drawn on the garden picture
 * in its own pixels so that they turn with it. Generated, never drawn by hand: random walks over
 * the five planting beds of the earth's top, with the prototype's seeded sequence, so every
 * launch cracks the same way. Each piece of crack appears once the earth has cracked past its
 * moment; pieces are bucketed by moment into the motion spec's eight layers (§5), each drawn once
 * and shown by its own opacity, so that the stage fades eight pictures instead of a hundred lines.
 */

import { CRACK_SEED, EARTH_TOP, STORY_MOTION } from './config';

/** The Park–Miller sequence the prototype draws its cracks with (`rnd`). */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** A point of the earth's top, from its two sides (0 to 1), in picture pixels (`isoPt`). */
export function earthPoint(u: number, v: number): readonly [number, number] {
  const { top, right, left } = EARTH_TOP;
  return [
    top[0] + u * (right[0] - top[0]) + v * (left[0] - top[0]),
    top[1] + u * (right[1] - top[1]) + v * (left[1] - top[1]),
  ];
}

/** A layer of crack pieces: its index (0 to 7, the order they appear in), and its path. */
export interface CrackGroup {
  readonly layer: number;
  readonly path: string;
}

/** The planting beds of the earth's top, as ranges of its two sides (`beds`). */
const BEDS = [
  [0.06, 0.42, 0.06, 0.42],
  [0.58, 0.94, 0.06, 0.42],
  [0.06, 0.42, 0.58, 0.94],
  [0.58, 0.94, 0.58, 0.94],
  [0.38, 0.62, 0.38, 0.62],
] as const;

const clampSide = (value: number) => Math.max(0.03, Math.min(0.97, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function crackGroups(): readonly CrackGroup[] {
  const random = seededRandom(CRACK_SEED);
  const pieces: { at: number; points: (readonly [number, number])[] }[] = [];
  const walk = (
    u0: number,
    v0: number,
    angle0: number,
    steps: number,
    delay: number,
    span: number,
  ) => {
    let u = u0;
    let v = v0;
    let angle = angle0;
    const points: [number, number][] = [[u, v]];
    for (let k = 0; k < steps; k += 1) {
      angle += (random() - 0.5) * 1.1;
      u = clampSide(u + Math.cos(angle) * (0.03 + random() * 0.03));
      v = clampSide(v + Math.sin(angle) * (0.03 + random() * 0.03));
      points.push([u, v]);
    }
    for (let k = 0; k < points.length - 1; k += 2) {
      pieces.push({
        at: delay + (k / (points.length - 1)) * span,
        points: points.slice(k, k + 3).map(([a, b]) => earthPoint(a, b)),
      });
    }
    return points;
  };
  BEDS.forEach(([u0, u1, v0, v1], bed) => {
    const count = bed === BEDS.length - 1 ? 2 : 4;
    for (let c = 0; c < count; c += 1) {
      const delay = random() * 0.45;
      const points = walk(
        mix(u0, u1, random()),
        mix(v0, v1, random()),
        random() * 6.28,
        7 + Math.floor(random() * 4),
        delay,
        0.45,
      );
      const branch = points[2 + Math.floor(random() * 4)] ?? points[0] ?? [0.5, 0.5];
      walk(branch[0], branch[1], random() * 6.28, 3, delay + 0.25, 0.25);
    }
  });
  const byGroup = new Map<number, string[]>();
  for (const piece of pieces) {
    const group = Math.min(
      STORY_MOTION.crackLayers - 1,
      Math.floor(piece.at / STORY_MOTION.crackLayerStep),
    );
    const path = piece.points
      .map(([x, y], k) => `${k === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(' ');
    byGroup.set(group, [...(byGroup.get(group) ?? []), path]);
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a - b)
    .map(([layer, paths]) => ({ layer, path: paths.join(' ') }));
}
