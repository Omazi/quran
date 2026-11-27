/**
 * What lives in the home garden (owner, 27 November 2026, docs/design/maquette-wow/README.md): from
 * the start, fireflies at night and a few leaves drifting in the wind; the birds are earned with
 * the birds of the garden (hizb 27, 37, 57), the butterflies with its butterflies (hizb 47). Pure:
 * the elements the garden shows in, the counts out. What the drought hides takes its life away.
 */

import { isTreeKind, type GardenElement } from '@/domain/garden';

export const LIFE = {
  /** Fireflies, from the start; they show at night only. */
  fireflies: 34,
  /** Leaves drifting from the crowns, once a tree stands. */
  leaves: 9,
  /** Butterflies, earned at hizb 47 (the mockup's four). */
  butterflies: 4,
  /** Birds by the number of the garden's bird elements shown: none, then one flock that grows. */
  birdsByFlocks: [0, 3, 4, 5] as const,
  /** Low Power Mode: what remains of each (motion.md › Leveraging platform capabilities). */
  lowPower: { fireflies: 12, leaves: 4, butterflies: 2 },
  /** Below this night, no firefly shows. */
  fireflyFromNight: 0.05,
} as const;

export interface GardenLife {
  readonly fireflies: number;
  readonly leaves: number;
  readonly butterflies: number;
  readonly birds: number;
}

export interface LifeConditions {
  readonly isLowPower: boolean;
  /** Reduce Motion: nothing flies or falls (motion.md › Make motion optional). */
  readonly isMotionReduced: boolean;
}

export function gardenLifeOf(
  visibleElements: readonly GardenElement[],
  { isLowPower, isMotionReduced }: LifeConditions,
): GardenLife {
  const flocks = Math.min(
    LIFE.birdsByFlocks.length - 1,
    visibleElements.filter((element) => element.kind === 'birds').length,
  );
  const hasButterflies = visibleElements.some((element) => element.kind === 'butterflies');
  const hasTree = visibleElements.some((element) => isTreeKind(element.kind));
  const moving = !isMotionReduced;
  return {
    fireflies: isLowPower ? LIFE.lowPower.fireflies : LIFE.fireflies,
    leaves: moving && hasTree ? (isLowPower ? LIFE.lowPower.leaves : LIFE.leaves) : 0,
    butterflies:
      moving && hasButterflies ? (isLowPower ? LIFE.lowPower.butterflies : LIFE.butterflies) : 0,
    birds: moving ? (LIFE.birdsByFlocks[flocks] ?? 0) : 0,
  };
}

function assertNight(night: number): void {
  if (!(night >= 0 && night <= 1)) throw new RangeError(`Night goes from 0 to 1, not ${night}.`);
}

/** How visible the fireflies are under a sky this much night. */
export function fireflyOpacity(night: number): number {
  assertNight(night);
  return night < LIFE.fireflyFromNight ? 0 : night;
}

/** How visible the birds and the butterflies are: by day only. */
export function dayLifeOpacity(night: number): number {
  assertNight(night);
  return 1 - night;
}
