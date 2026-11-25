/**
 * Where the home screen gets the reading journal and the settings it shows: the store of the
 * app, that is, what this person really read and chose. A person who has read nothing sees a
 * bare earth; nothing here is made up.
 */

import { useAppStore } from '@/store';

import type { HomeSource } from './home-model';

/** The journal and the settings of the person. */
export function useHomeSource(): HomeSource {
  const journal = useAppStore((state) => state.journal);
  const dailyGoalPages = useAppStore((state) => state.settings.dailyGoalPages);
  const userSeed = useAppStore((state) => state.settings.userSeed);
  const pauses = useAppStore((state) => state.settings.pauses);
  const lastOpenedPage = useAppStore((state) => state.settings.lastOpenedPage);
  return { journal, settings: { dailyGoalPages, userSeed, lastOpenedPage, pauses } };
}
