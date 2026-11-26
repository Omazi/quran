import { useSegments } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';

import { khatmaToCelebrate } from '@/domain/levels';
import { useToday, type Clock } from '@/features/home';
import { useAppStore } from '@/store';

import { useProgression } from './use-progression';

/** The route of the celebration (src/app/khatma-complete.tsx). */
export const CELEBRATION_PATH = '/khatma-complete';

/** The first segments of the routes the celebration never opens over. */
const QUIET_SEGMENTS: readonly string[] = ['onboarding', CELEBRATION_PATH.slice(1)];

/**
 * Whether the celebration may open over the screen of these route segments: not over the first
 * screen (no segment: it is about to send to the tabs or the introduction), the introduction, or
 * the celebration itself. Segments, not the path: the garden tab and the first screen share "/".
 */
export function mayCelebrateOver(segments: readonly string[]): boolean {
  const first = segments[0];
  return first !== undefined && !QUIET_SEGMENTS.includes(first);
}

export interface KhatmaCelebrationDependencies {
  /** Opens the celebration of khatma `khatm` (the route decides how). */
  readonly open: (khatm: number) => void;
  /** False in the iOS check, which opens its screens itself. */
  readonly isEnabled: boolean;
  /** Defaults to the device clock. */
  readonly clock?: Clock;
}

/**
 * Opens the celebration once, when a khatma is completed (D46): as soon as its last page is
 * counted (over the reader), or at the next opening when the khatma was completed on another phone
 * and came with the sync, as long as it is recent (`khatmaToCelebrate`). Never during the
 * introduction. The route marks it celebrated, on every phone.
 */
export function useKhatmaCelebration({ open, isEnabled, clock }: KhatmaCelebrationDependencies) {
  const progression = useProgression();
  const celebratedKhatm = useAppStore((state) => state.settings.celebratedKhatm);
  const onboardingCompleted = useAppStore((state) => state.settings.onboardingCompleted);
  const today = useToday(clock);
  const segments = useSegments();
  const due = useMemo(
    () =>
      progression === null
        ? null
        : khatmaToCelebrate({ completed: progression.completed, celebratedKhatm, today }),
    [progression, celebratedKhatm, today],
  );
  const opened = useRef<number | null>(null);
  const isQuiet = !mayCelebrateOver(segments);
  useEffect(() => {
    if (!isEnabled || !onboardingCompleted || isQuiet || due === null) return;
    if (opened.current === due.khatm) return;
    opened.current = due.khatm;
    open(due.khatm);
  }, [isEnabled, onboardingCompleted, isQuiet, due, open]);
}
