/**
 * CHECK BUILD ONLY (loaded through `door.ts`; a published bundle does not contain it). Fills the
 * app with the made-up history the pictures are taken from.
 *
 * It is written in ONE change. Written page by page (244 calls of `recordPageRead`) it queued 259
 * saves, each rewriting the whole document and the growing list of changes to sync; the check ends
 * the app a few seconds after its picture, so the queue was only partly emptied and the next
 * launch found 75 pages: a dried garden of 7 hizb, "17 days without reading", no reading this week
 * (iOS check of 683ad8d). The history is also set, not added to what an earlier launch left, so
 * every launch of the check starts from the same state.
 */

import type { HizbPageRange } from '@/domain/khatm';
import { addDays, type LocalDate } from '@/domain/shared/local-date';
import type { SecondsByDay } from '@/domain/stats';
import { buildReadingHistory } from '@/features/home/dev-preview/reading-histories';
import type { AppStore } from '@/store';

/** Days of reading time written for the statistics, today included. */
export const DEMO_TIME_DAYS = 14;

/** The longest the check waits for the device to hold the history: the picture is taken anyway. */
const SAVE_WAIT_MS = 5000;

/** Time spent on `back` days before today: a little more each day further back, never over 25 hours. */
const DEMO_SECONDS = { appBase: 900, appStep: 60, readerBase: 600, readerStep: 40 } as const;

function demoTimeSpent(today: LocalDate): SecondsByDay {
  const days: [LocalDate, { app: number; reader: number }][] = [];
  for (let back = DEMO_TIME_DAYS - 1; back >= 0; back -= 1) {
    days.push([
      addDays(today, -back) as LocalDate,
      {
        app: DEMO_SECONDS.appBase + DEMO_SECONDS.appStep * back,
        reader: DEMO_SECONDS.readerBase + DEMO_SECONDS.readerStep * back,
      },
    ]);
  }
  // Oldest day first, as the store keeps them.
  return Object.fromEntries(days) as SecondsByDay;
}

/**
 * Puts the demonstration history in the store (the journal of a garden at hizb 24 read every day,
 * three pages today, 14 days of time, the introduction done) and resolves once it is on the
 * device. These are not changes of the person's own: they are set apart from the sync, as a
 * history coming from an account would be.
 */
export async function seedDemo(
  store: AppStore,
  today: LocalDate,
  hizbPageRanges: readonly HizbPageRange[],
): Promise<void> {
  const history = buildReadingHistory('thriving', today, hizbPageRanges);
  store.setState((state) => ({
    journal: history.journal,
    timeSpent: demoTimeSpent(today),
    settings: {
      ...state.settings,
      dailyGoalPages: history.settings.dailyGoalPages,
      onboardingCompleted: true,
    },
  }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const gaveUp = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SAVE_WAIT_MS);
  });
  await Promise.race([store.whenSaved(), gaveUp]);
  clearTimeout(timer);
}
