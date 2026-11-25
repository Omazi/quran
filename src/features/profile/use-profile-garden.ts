import { useMemo } from 'react';

import { quranStructure } from '@/data/quran';
import type { GardenState } from '@/domain/garden';
import { buildHomeModelOrUnavailable, useToday, type Clock } from '@/features/home';
import { useAppStore } from '@/store';

import { usePreviewedStatsSource } from './state-preview';

export interface ProfileGardenDependencies {
  /** Defaults to the device clock. */
  readonly clock?: Clock;
}

/**
 * The person's garden as the home screen computes it, for the head of the profile: the garden
 * is how a level is recognised (D23), so it is who the person is in the app. It is built from
 * the same journal as the statistics, so the preview of the statistics shows a garden that
 * matches its numbers. Null when the garden cannot be computed: the profile then goes without
 * it, as the home screen says why.
 */
export function useProfileGarden({ clock }: ProfileGardenDependencies = {}): GardenState | null {
  const today = useToday(clock);
  const storedJournal = useAppStore((state) => state.journal);
  const storedTime = useAppStore((state) => state.timeSpent);
  const { journal } = usePreviewedStatsSource({ journal: storedJournal, timeSpent: storedTime });
  const dailyGoalPages = useAppStore((state) => state.settings.dailyGoalPages);
  const userSeed = useAppStore((state) => state.settings.userSeed);
  const pauses = useAppStore((state) => state.settings.pauses);
  const lastOpenedPage = useAppStore((state) => state.settings.lastOpenedPage);
  return useMemo(() => {
    const model = buildHomeModelOrUnavailable({
      journal,
      settings: { dailyGoalPages, userSeed, lastOpenedPage, pauses },
      today,
      hizbPageRanges: quranStructure.hizbPageRanges(),
    });
    return model.status === 'ready' ? model.garden : null;
  }, [journal, dailyGoalPages, userSeed, lastOpenedPage, pauses, today]);
}
