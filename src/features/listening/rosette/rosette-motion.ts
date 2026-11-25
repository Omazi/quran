/**
 * How the rosette moves: the level of the voice as it is drawn, and the petals that leave the
 * star. A translation of the prototype's frame loop (`frame`, `syllable`, `drawRosette`).
 *
 * Worklets, run on the UI thread at every frame. The state is one object, changed in place by
 * `receiveLevel` and `advance` (a frame must not allocate a new list of petals sixty times a
 * second); everything else is a pure function of it.
 */
import { ROSETTE_GEOMETRY, ROSETTE_MOTION, ROSETTE_OPACITY } from '../config';

export interface PetalSlot {
  /** When the petal left, in seconds of the motion clock; never for an empty slot. */
  bornAt: number;
  /** How strong the breath of voice that sent it was, 0 to 1. */
  power: number;
}

export interface RosetteMotion {
  /** Seconds since the motion started. */
  time: number;
  /** The level as drawn: it follows `target`, fast up and slowly down. */
  level: number;
  /** The loudest recent level, falling back with time. */
  target: number;
  lastPetalAt: number;
  /**
   * A ring of petal slots, filled in turn. The petals alternate gold and water, starting with
   * gold, and the ring has an even length: slot `i` is gold when `i` is even, always.
   */
  slots: PetalSlot[];
  nextSlot: number;
}

export function createRosetteMotion(): RosetteMotion {
  return {
    time: 0,
    level: 0,
    target: 0,
    lastPetalAt: Number.NEGATIVE_INFINITY,
    slots: Array.from({ length: ROSETTE_MOTION.maxPetals }, () => ({
      bornAt: Number.NEGATIVE_INFINITY,
      power: 0,
    })),
    nextSlot: 0,
  };
}

/** Whether slot `index` draws a gold petal (otherwise water). */
export function isGoldSlot(index: number): boolean {
  'worklet';
  return index % 2 === 0;
}

function sendPetal(motion: RosetteMotion, power: number): void {
  'worklet';
  const slot = motion.slots[motion.nextSlot];
  if (slot === undefined) return;
  slot.bornAt = motion.time;
  slot.power = power;
  motion.lastPetalAt = motion.time;
  motion.nextSlot = (motion.nextSlot + 1) % motion.slots.length;
}

/**
 * A level heard from the engine. The level drawn rises towards it. With petals allowed, a sample
 * that rises clearly above the level drawn is a new breath of voice: a petal leaves, unless one
 * left less than `petalSpacing` ago.
 */
export function receiveLevel(motion: RosetteMotion, sample: number, allowPetals: boolean): void {
  'worklet';
  const level = Math.min(1, Math.max(0, sample));
  const isBreath =
    level >= ROSETTE_MOTION.syllableMinimum && level >= motion.level + ROSETTE_MOTION.syllableRise;
  motion.target = Math.max(motion.target, level);
  if (allowPetals && isBreath && motion.time - motion.lastPetalAt > ROSETTE_MOTION.petalSpacing) {
    sendPetal(motion, level);
  }
}

/**
 * One frame later, `seconds` after the previous one. The level falls back; in silence, a
 * discreet petal leaves every `silentPetalInterval`, so the screen says it listens.
 */
export function advance(motion: RosetteMotion, seconds: number, allowPetals: boolean): void {
  'worklet';
  const step = Math.min(ROSETTE_MOTION.maxFrameStep, Math.max(0, seconds));
  const { levelDecayPerFrame, framesPerSecond, levelRiseRate, levelFallRate } = ROSETTE_MOTION;
  motion.time += step;
  if (allowPetals && motion.time - motion.lastPetalAt > ROSETTE_MOTION.silentPetalInterval) {
    sendPetal(motion, ROSETTE_MOTION.silentPetalPower);
  }
  motion.target *= Math.pow(levelDecayPerFrame, step * framesPerSecond);
  const rate = motion.target > motion.level ? levelRiseRate : levelFallRate;
  motion.level += (motion.target - motion.level) * (1 - Math.exp(-step * rate));
}

export interface PetalAppearance {
  /** Radius of the petal, as a share of the star's radius. */
  scale: number;
  /** 0 to 1, before the colour's own opacity. 0 for an empty or finished slot. */
  opacity: number;
  /** Line width in points. */
  width: number;
  /** From 0 (sharp tips) to 1 (round petals). */
  roundness: number;
}

const HIDDEN_PETAL: PetalAppearance = { scale: 1, opacity: 0, width: 0, roundness: 1 };

/** How a petal looks at `time`: it grows, rounds and fades over its life. */
export function petalAppearance(slot: PetalSlot, time: number): PetalAppearance {
  'worklet';
  const motion = ROSETTE_MOTION;
  const age = (time - slot.bornAt) / motion.petalLife;
  if (!(age >= 0 && age <= 1)) return HIDDEN_PETAL;
  return {
    scale: motion.petalStart + age * (motion.petalGrowth + motion.petalGrowthByPower * slot.power),
    opacity:
      Math.pow(1 - age, motion.petalFadeExponent) *
      motion.petalOpacity *
      (motion.petalOpacityFloor + (1 - motion.petalOpacityFloor) * slot.power),
    width: ROSETTE_GEOMETRY.petalWidth - age * ROSETTE_GEOMETRY.petalWidthLoss,
    roundness: Math.min(1, age * motion.petalRounding),
  };
}

export type Appearance = 'light' | 'dark';

export interface LineOpacities {
  heart: number;
  outer: number;
  inside: number;
  /** Night only: the light on the lines, and the points at the tips. 0 by day. */
  glow: number;
  nodes: number;
}

/**
 * The opacity of each family of lines. By day the lines are steady, and the voice brightens the
 * gold. By night they breathe with the voice and never dim below their silent light; with
 * reduced motion they keep only what the voice gives, without the slow wave.
 */
export function lineOpacities(
  level: number,
  time: number,
  appearance: Appearance,
  reducedMotion: boolean,
): LineOpacities {
  'worklet';
  if (appearance === 'light') {
    const day = ROSETTE_OPACITY.light;
    return {
      heart: day.heart,
      outer: day.outer,
      inside: day.inside + day.insideByLevel * level,
      glow: 0,
      nodes: 0,
    };
  }
  const night = ROSETTE_OPACITY.dark;
  const motion = ROSETTE_MOTION;
  const wave = reducedMotion ? 0 : motion.breatheWave * Math.sin(time * motion.breatheSpeed);
  const breathe = motion.breatheBase + motion.breatheByLevel * level + wave;
  return {
    heart: Math.min(1, night.heart * breathe),
    outer: Math.min(1, night.outer * breathe),
    inside: Math.min(1, (night.inside + night.insideByLevel * level) * breathe),
    glow: Math.min(1, night.glowLayer * (night.glow + night.glowByLevel * level) * breathe),
    nodes: night.node * (night.nodeFloor + (1 - night.nodeFloor) * level),
  };
}

/**
 * How much the whole drawing grows: with the voice, and a faint breath in silence that the voice
 * replaces as it rises. Not at all with reduced motion.
 */
export function rosetteScale(level: number, reducedMotion: boolean, time = 0): number {
  'worklet';
  if (reducedMotion) return 1;
  const voice = Math.min(1, Math.max(0, level));
  const breath =
    ROSETTE_MOTION.idleBreath * (1 - voice) * Math.sin(time * ROSETTE_MOTION.breatheSpeed);
  return 1 + ROSETTE_GEOMETRY.levelGrowth * voice + breath;
}
