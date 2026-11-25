import { useCallback, useMemo, useState } from 'react';

import { quranStructure } from '@/data/quran';

import { buildHomeModel, type HomeModel, type HomeModelInput } from './home-model';
import { useHomeSource } from './home-source';
import { usePreviewedSource } from './state-preview';
import { useToday, type Clock } from './use-today';

export interface HomeModelDependencies {
  /** Gives the present instant. Defaults to the device clock. */
  readonly clock?: Clock;
}

export interface HomeModelResult {
  readonly model: HomeModel;
  /** Builds the model again from the data as it is now: the action of the unavailable state. */
  readonly retry: () => void;
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
 * The model of the home screen, rebuilt only when the data or the day changes, or when the
 * person asks to try again: each build reads the whole journal (see the khatm module's README,
 * "Coût").
 */
export function useHomeModel({ clock }: HomeModelDependencies = {}): HomeModelResult {
  const today = useToday(clock);
  const { journal, settings } = usePreviewedSource(useHomeSource(), today);
  // The settings are compared one by one: a source may return a new object at every render.
  const { dailyGoalPages, userSeed, pauses, lastOpenedPage } = settings;
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  const model = useMemo(
    () =>
      buildHomeModelOrUnavailable({
        journal,
        settings: { dailyGoalPages, userSeed, lastOpenedPage, pauses },
        today,
        hizbPageRanges: quranStructure.hizbPageRanges(),
      }),
    // `attempt` is not read: a new attempt is what asks for a new build.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [journal, dailyGoalPages, userSeed, lastOpenedPage, pauses, today, attempt],
  );
  return { model, retry };
}
