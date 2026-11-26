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

import type { HizbPageRange, ReadingEntry } from '@/domain/khatm';
import { PAGE_COUNT } from '@/domain/quran';
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
  await waitUntilSaved(store);
}

async function waitUntilSaved(store: AppStore): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const gaveUp = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SAVE_WAIT_MS);
  });
  await Promise.race([store.whenSaved(), gaveUp]);
  clearTimeout(timer);
}

/** The gardens history (D46): its numbers, examples only. */
const GARDENS_HISTORY = {
  /** Pages a day of the completed khatma: it takes 31 days. */
  khatmaPagesPerDay: 20,
  /** Days between the end of the completed khatma and today. */
  completedDaysAgo: 30,
  /** Pages a day of the khatma under way, read every day up to today. */
  pagesPerDay: 10,
  /** Pages of the khatma under way: about nine hizb. */
  pagesRead: 91,
} as const;

/**
 * The journal of the gardens history, written as the khatm module would (one entry per page and
 * khatma, khatma 1 complete before khatma 2 starts): built directly, it needs no 700 calls.
 */
function gardensJournal(today: LocalDate): ReadingEntry[] {
  const { khatmaPagesPerDay, completedDaysAgo, pagesPerDay, pagesRead } = GARDENS_HISTORY;
  const khatmaDays = Math.ceil(PAGE_COUNT / khatmaPagesPerDay);
  const khatmaStart = addDays(today, -(completedDaysAgo + khatmaDays - 1));
  const entries: ReadingEntry[] = [];
  for (let page = 1; page <= PAGE_COUNT; page += 1) {
    entries.push({
      khatm: 1,
      page,
      date: addDays(khatmaStart, Math.floor((page - 1) / khatmaPagesPerDay)),
    });
  }
  const days = Math.ceil(pagesRead / pagesPerDay);
  const start = addDays(today, -(days - 1));
  for (let page = 1; page <= pagesRead; page += 1) {
    entries.push({ khatm: 2, page, date: addDays(start, Math.floor((page - 1) / pagesPerDay)) });
  }
  return entries;
}

/**
 * Puts the gardens history in the store, for the pictures of the level, the badges, "Mes
 * jardins" and the celebration (D46): khatma 1 completed a month ago (its celebration already
 * seen, so none opens by itself), khatma 2 at about hizb 9, read every day, 14 days of time, the
 * introduction done. One change, apart from the sync, like `seedDemo`. `hizbPageRanges` is
 * unused: the history is described in pages.
 */
export async function seedGardens(
  store: AppStore,
  today: LocalDate,
  _hizbPageRanges: readonly HizbPageRange[],
): Promise<void> {
  store.setState((state) => ({
    journal: gardensJournal(today),
    timeSpent: demoTimeSpent(today),
    settings: {
      ...state.settings,
      onboardingCompleted: true,
      celebratedKhatm: 1,
    },
  }));
  await waitUntilSaved(store);
}
