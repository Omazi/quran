import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { useSelfDisplayName } from '@/features/friends';
import { celebrationOf, KhatmaCelebrationScreen, useProgression } from '@/features/gardens';
import { useAppStore } from '@/store';

/**
 * The celebration of a completed khatma (D46), opened once by `useKhatmaCelebration` with the
 * khatma's number. It is marked celebrated as soon as it shows, on every phone (sync rule
 * `highest`), so closing the app on it never shows it a second time. A number that is not a
 * completed khatma leaves at once.
 */
export default function KhatmaCompleteRoute() {
  const { khatm } = useLocalSearchParams<{ khatm?: string }>();
  const progression = useProgression();
  const displayName = useSelfDisplayName();
  const markKhatmaCelebrated = useAppStore((state) => state.markKhatmaCelebrated);
  const number = Number(khatm);
  const completed = useMemo(
    () => progression?.completed.find((khatma) => khatma.khatm === number) ?? null,
    [progression, number],
  );
  // Kept from the first render: marking it celebrated must not take the screen away.
  const celebration = useMemo(
    () => (completed === null ? null : celebrationOf(completed)),
    [completed],
  );

  useEffect(() => {
    if (celebration === null) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
      return;
    }
    markKhatmaCelebrated(celebration.khatm);
  }, [celebration, markKhatmaCelebrated]);

  if (celebration === null) return null;
  return (
    <KhatmaCelebrationScreen
      celebration={celebration}
      displayName={displayName}
      onSeeGarden={() => router.replace('/my-gardens')}
      onClose={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
    />
  );
}
