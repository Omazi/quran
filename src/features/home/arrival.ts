/**
 * The element to celebrate when a hizb is finished (docs/design/nouveau.png). Pure: it compares
 * two gardens the garden module computed, and decides nothing about the garden itself.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { GardenElement, GardenState } from '@/domain/garden';

export interface Arrival {
  /** The hizb just finished. */
  readonly hizb: number;
  readonly element: GardenElement;
  /** The element the next hizb grows, or null when none is left. */
  readonly next: GardenElement | null;
}

/**
 * What was earned between two gardens of the same khatma, seen one after the other: the element
 * of the last finished hizb, when more hizb are finished than before. Nothing the first time the
 * screen is seen (no hizb was finished in front of it), across two khatmas (a new garden), or for
 * the last hizb, whose completed khatma has a screen of its own (khatm.png).
 */
export function newArrival(previous: GardenState | null, current: GardenState): Arrival | null {
  if (previous === null) return null;
  if (previous.variant.cycle !== current.variant.cycle) return null;
  if (current.hizbCompleted <= previous.hizbCompleted) return null;
  if (current.isComplete || current.lastUnlocked === null) return null;
  return {
    hizb: current.hizbCompleted,
    element: current.lastUnlocked,
    next: current.nextElement?.element ?? null,
  };
}

/**
 * The arrival to show on the home screen, until the person dismisses it. The tab stays mounted
 * while the reader is pushed over it, so a hizb finished in the reader is seen here on the way
 * back. Kept in memory only: an arrival not seen before the app closes is not shown later (the
 * reader already named the element when the page was recorded).
 */
export function useArrival(garden: GardenState | null): {
  arrival: Arrival | null;
  dismiss: () => void;
} {
  const previous = useRef<GardenState | null>(null);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  useEffect(() => {
    if (garden === null) return;
    const earned = newArrival(previous.current, garden);
    previous.current = garden;
    if (earned !== null) setArrival(earned);
  }, [garden]);
  const dismiss = useCallback(() => setArrival(null), []);
  return { arrival, dismiss };
}
