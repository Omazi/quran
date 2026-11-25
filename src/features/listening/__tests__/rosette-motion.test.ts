import { ROSETTE_MOTION, ROSETTE_OPACITY } from '../config';
import {
  heartTips,
  insidePath,
  petalPath,
  rosetteFrame,
  starPath,
} from '../rosette/rosette-geometry';
import {
  advance,
  createRosetteMotion,
  isGoldSlot,
  lineOpacities,
  petalAppearance,
  receiveLevel,
  rosetteScale,
  type RosetteMotion,
} from '../rosette/rosette-motion';

/** The points of a path, as numbers. */
function pointsOf(path: string): [number, number][] {
  const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const points: [number, number][] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push([numbers[index] ?? 0, numbers[index + 1] ?? 0]);
  }
  return points;
}

function distance([x, y]: [number, number], cx = 0, cy = 0): number {
  return Math.hypot(x - cx, y - cy);
}

describe('the geometry of the rosette (prototype: drawRosette)', () => {
  it('places the rosette at half the width and 38 % of the height, as large as the prototype', () => {
    // The prototype's frame: 393 × 852 points.
    expect(rosetteFrame(393, 852)).toEqual({ cx: 196.5, cy: 852 * 0.38, radius: 393 * 0.262 });
    // On a short screen the height decides.
    expect(rosetteFrame(393, 500).radius).toBeCloseTo(500 * 0.168);
  });

  it('draws the star from two squares: 8 tips on the radius, 8 hollows where the squares cross', () => {
    const points = pointsOf(starPath(0, 0, 100));
    expect(points).toHaveLength(16);
    points.forEach((point, index) => {
      expect(distance(point)).toBeCloseTo(index % 2 === 0 ? 100 : 76.537, 1);
    });
    // The first tip points up.
    expect(points[0]).toEqual([0, -100]);
  });

  it('draws the inside: two sides and a diagonal for each of the eight small squares', () => {
    const path = insidePath(0, 0, 100);
    expect(path.match(/M/g)).toHaveLength(16);
    // The small squares meet on the heart star, of radius √2 − 1.
    const heart = pointsOf(path)[1] ?? [0, 0];
    expect(distance(heart)).toBeCloseTo(41.42, 1);
  });

  it('turns the star into eight petals, sharp at first and round at the end', () => {
    const sharp = pointsOf(petalPath(0, 0, 100, 0));
    const round = pointsOf(petalPath(0, 0, 100, 1));
    // M, then for each petal its control point (the tip) and its end: 1 + 8 × 2 points.
    expect(sharp).toHaveLength(17);
    expect(distance(sharp[1] ?? [0, 0])).toBeCloseTo(116, 0);
    expect(distance(round[1] ?? [0, 0])).toBeCloseTo(100, 0);
  });

  it('gives the eight tips of the heart star', () => {
    const tips = heartTips(10, 20, 100);
    expect(tips).toHaveLength(8);
    for (const tip of tips) expect(distance([tip.x, tip.y], 10, 20)).toBeCloseTo(41.42, 1);
  });
});

/** Runs the motion for a number of seconds, one 60th of a second at a time. */
function run(motion: RosetteMotion, seconds: number, allowPetals = true): void {
  for (let frame = 0; frame < Math.round(seconds * 60); frame += 1) {
    advance(motion, 1 / 60, allowPetals);
  }
}

function livePetals(motion: RosetteMotion): number {
  return motion.slots.filter((slot) => petalAppearance(slot, motion.time).opacity > 0).length;
}

describe('the motion of the rosette (prototype: frame, syllable)', () => {
  it('in silence, a discreet petal leaves at once and then about every two seconds', () => {
    const motion = createRosetteMotion();
    run(motion, 1 / 60);
    expect(livePetals(motion)).toBe(1);
    expect(motion.slots[0]?.power).toBe(ROSETTE_MOTION.silentPetalPower);
    run(motion, ROSETTE_MOTION.silentPetalInterval + 0.05);
    expect(livePetals(motion)).toBe(2);
  });

  it('a breath of voice sends a petal, but not two within 0.85 s', () => {
    const motion = createRosetteMotion();
    run(motion, 1);
    receiveLevel(motion, 0.9, true);
    expect(motion.slots[1]?.power).toBe(0.9);
    run(motion, 0.3);
    receiveLevel(motion, 1, true);
    expect(motion.slots[2]?.bornAt).toBe(Number.NEGATIVE_INFINITY);
    run(motion, 0.6);
    receiveLevel(motion, 1, true);
    expect(motion.slots[2]?.power).toBe(1);
  });

  it('a steady voice is not a new breath: only a clear rise sends a petal', () => {
    const motion = createRosetteMotion();
    receiveLevel(motion, 0.6, true);
    run(motion, 1);
    const sent = motion.nextSlot;
    receiveLevel(motion, motion.level + 0.05, true);
    expect(motion.nextSlot).toBe(sent);
  });

  it('a whisper below the threshold sends no petal of voice', () => {
    const motion = createRosetteMotion();
    run(motion, 0.5);
    receiveLevel(motion, ROSETTE_MOTION.syllableMinimum - 0.01, true);
    expect(motion.nextSlot).toBe(1);
  });

  it('never keeps more than six petals, and they alternate gold and water', () => {
    const motion = createRosetteMotion();
    for (let breath = 0; breath < 10; breath += 1) {
      run(motion, 0.9);
      receiveLevel(motion, 1, true);
    }
    expect(motion.slots).toHaveLength(6);
    expect([0, 1, 2, 3].map(isGoldSlot)).toEqual([true, false, true, false]);
  });

  it('the level drawn rises fast towards the voice, then falls back slowly', () => {
    const motion = createRosetteMotion();
    receiveLevel(motion, 1, true);
    run(motion, 0.1);
    const risen = motion.level;
    expect(risen).toBeGreaterThan(0.5);
    run(motion, 2);
    expect(motion.level).toBeLessThan(risen / 4);
  });

  it('a long pause between frames is one short step, not a jump', () => {
    const motion = createRosetteMotion();
    advance(motion, 3, true);
    expect(motion.time).toBe(ROSETTE_MOTION.maxFrameStep);
  });

  it('with reduced motion, no petal leaves and nothing grows; the voice still lights the lines', () => {
    const motion = createRosetteMotion();
    run(motion, 5, false);
    receiveLevel(motion, 1, false);
    run(motion, 0.1, false);
    expect(livePetals(motion)).toBe(0);
    expect(rosetteScale(1, true)).toBe(1);
    expect(motion.level).toBeGreaterThan(0.5);
    const silent = lineOpacities(0, 0, 'light', true).inside;
    expect(lineOpacities(1, 0, 'light', true).inside).toBeGreaterThan(silent);
  });
});

describe('a petal over its life (prototype: 4.6 s)', () => {
  const slot = { bornAt: 0, power: 1 };

  it('starts just outside the star, sharp, at its strongest', () => {
    expect(petalAppearance(slot, 0)).toEqual({
      scale: 1.04,
      opacity: 0.5,
      width: 1.25,
      roundness: 0,
    });
  });

  it('grows, rounds and fades, then disappears', () => {
    const middle = petalAppearance(slot, 2.3);
    expect(middle.scale).toBeCloseTo(1.04 + 0.5 * 1.3);
    expect(middle.roundness).toBeCloseTo(0.75);
    expect(petalAppearance(slot, 3.1).roundness).toBe(1);
    expect(middle.opacity).toBeCloseTo(Math.pow(0.5, 1.6) * 0.5);
    expect(petalAppearance(slot, 4.7).opacity).toBe(0);
  });

  it('an empty slot draws nothing', () => {
    expect(petalAppearance({ bornAt: Number.NEGATIVE_INFINITY, power: 0 }, 10).opacity).toBe(0);
  });
});

describe('the light of the lines', () => {
  it('by day, has the opacities of the validated prototype (heart 0.94, outer 0.88, inside 0.78 + 0.22 * level)', () => {
    expect(lineOpacities(0, 0, 'light', false)).toMatchObject({ heart: 0.94, outer: 0.88 });
    expect(lineOpacities(0, 0, 'light', false).inside).toBeCloseTo(0.78);
    expect(lineOpacities(1, 0, 'light', false).inside).toBeCloseTo(1);
  });

  it('by day, takes its opacities from the settings', () => {
    expect(lineOpacities(0, 0, 'light', false)).toEqual({
      heart: ROSETTE_OPACITY.light.heart,
      outer: ROSETTE_OPACITY.light.outer,
      inside: ROSETTE_OPACITY.light.inside,
      glow: 0,
      nodes: 0,
    });
  });

  it('by night, breathes with the voice and is brightest at full voice (D29)', () => {
    const silent = lineOpacities(0, 0, 'dark', true);
    const loud = lineOpacities(1, 0, 'dark', true);
    expect(silent.heart).toBeCloseTo(0.94 * 0.84);
    expect(loud.heart).toBeCloseTo(0.94);
    expect(loud.glow).toBeGreaterThan(silent.glow);
    expect(loud.nodes).toBeGreaterThan(silent.nodes);
  });

  it('by night without reduced motion, a slow wave is added to the breath', () => {
    const peak = Math.PI / 2 / ROSETTE_MOTION.breatheSpeed;
    expect(lineOpacities(0, peak, 'dark', false).heart).toBeGreaterThan(
      lineOpacities(0, peak, 'dark', true).heart,
    );
  });
});
