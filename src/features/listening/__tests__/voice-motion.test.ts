import { ROSETTE_MOTION } from '../config';
import {
  advance,
  createRosetteMotion,
  isGoldSlot,
  petalAppearance,
  receiveLevel,
  ringsLight,
  rosetteScale,
  type RosetteMotion,
} from '../scene/voice-motion';

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

  it('with reduced motion, no ripple leaves and nothing grows; the voice still lights the rings', () => {
    const motion = createRosetteMotion();
    run(motion, 5, false);
    receiveLevel(motion, 1, false);
    run(motion, 0.1, false);
    expect(livePetals(motion)).toBe(0);
    expect(rosetteScale(1, true)).toBe(1);
    expect(motion.level).toBeGreaterThan(0.5);
    // The rings around the microphone still brighten with the voice.
    expect(ringsLight(1)).toBeGreaterThan(ringsLight(0));
    expect(ringsLight(1)).toBeLessThanOrEqual(1);
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
