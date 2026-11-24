import { useMemo } from 'react';

import { quranStructure } from '@/data/quran';

import { buildHomeModel, type HomeModel, type HomeModelInput } from './home-model';
import { useHomeSource } from './home-source';
import { useToday, type Clock } from './use-today';

export interface HomeModelDependencies {
  /** Gives the present instant. Defaults to the device clock. */
  readonly clock?: Clock;
}

/**
 * Builds the model, or says the screen is unavailable when it cannot be built. The home screen
 * is where the app opens: a damaged journal must show an explanation there, never a crash and
 * never made-up numbers. The error is logged for whoever investigates.
 */
export function buildHomeModelOrUnavailable(input: HomeModelInput): HomeModel {
  try {
    return buildHomeModel(input);
  } catch (error) {
    console.error('The home screen could not be computed.', error);
    return { status: 'unavailable' };
  }
}

/**
 * The model of the home screen, rebuilt only when the data or the day changes: each build reads
 * the whole journal (see the khatm module's README, "Coût").
 */
export function useHomeModel({ clock }: HomeModelDependencies = {}): HomeModel {
  const today = useToday(clock);
  const { journal, settings } = useHomeSource(today);
  // The settings are compared one by one: a source may return a new object at every render.
  const { dailyGoalPages, userSeed, pauses } = settings;
  return useMemo(
    () =>
      buildHomeModelOrUnavailable({
        journal,
        settings: { dailyGoalPages, userSeed, pauses },
        today,
        hizbPageRanges: quranStructure.hizbPageRanges(),
      }),
    [journal, dailyGoalPages, userSeed, pauses, today],
  );
}
