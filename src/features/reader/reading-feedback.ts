/**
 * What to tell the person after a page was recorded (docs/specs/reader.md, section 3; validated
 * mockup of 27 November 2026, shots 21 and 22): nothing when the page did not count; when it did,
 * what its drop grows and the pages of the hizb in progress before and after it ("3 pages sur 10
 * du hizb 25", then 4), the pages of the day before and after it (the counter "5 / 8", then 6), and
 * the name of the new element of the garden when it completed a hizb. Every fact comes from the
 * khatm and garden modules; this file only compares the journal before and after.
 */

import type { GardenElementKind } from '@/domain/garden';
import {
  getCurrentKhatm,
  getGardenFeed,
  getKhatmProgress,
  getTodayProgress,
  type HizbPageRange,
  type ReadingJournal,
} from '@/domain/khatm';
import type { LocalDate } from '@/domain/shared/local-date';
import { buildHomeModel, type HomeSettings } from '@/features/home';

/** The hizb in progress before the page, and its pages counted before and after it. */
export interface HizbGrowth {
  readonly hizb: number;
  readonly pagesBefore: number;
  readonly pagesAfter: number;
  readonly pageCount: number;
}

interface CountedPage {
  /** The page that counted: its drop falls from the end of its thread. */
  readonly page: number;
  /** The hizb in progress (the first unfinished one); null once the khatma is complete. */
  readonly growth: HizbGrowth | null;
  /** New pages of the day before and after this one. */
  readonly todayBefore: number;
  readonly todayAfter: number;
}

export type ReadingFeedback =
  | (CountedPage & {
      readonly kind: 'page-counted';
      /**
       * The element the pages of the hizb in progress grow (`GardenState.nextElement`), named in
       * the pill ("Une goutte pour le grenadier"); null when nothing grows any more.
       */
      readonly growingKind: GardenElementKind | null;
    })
  | (CountedPage & {
      readonly kind: 'hizb-completed';
      /** The kind of the element that just appeared: the garden's locale files name it. */
      readonly elementKind: GardenElementKind;
    });

export interface ReadingFeedbackInput {
  readonly page: number;
  readonly before: ReadingJournal;
  readonly after: ReadingJournal;
  readonly settings: HomeSettings;
  readonly today: LocalDate;
  readonly hizbPageRanges: readonly HizbPageRange[];
}

export function readingFeedback({
  page,
  before,
  after,
  settings,
  today,
  hizbPageRanges,
}: ReadingFeedbackInput): ReadingFeedback | null {
  // The khatm module returns the very same journal for a page that does not count (D8).
  if (after === before) return null;
  const previous = getGardenFeed(before, hizbPageRanges);
  const current = getGardenFeed(after, hizbPageRanges);
  const completedHizb =
    current.khatm === previous.khatm && current.hizbCompleted > previous.hizbCompleted;
  const { garden } = buildHomeModel({ journal: after, settings, today, hizbPageRanges });
  const counted: CountedPage = {
    page,
    growth: hizbGrowth(before, after, hizbPageRanges),
    todayBefore: getTodayProgress(before, today, settings.dailyGoalPages).pagesRead,
    todayAfter: getTodayProgress(after, today, settings.dailyGoalPages).pagesRead,
  };
  if (!completedHizb || garden.lastUnlocked === null) {
    return {
      ...counted,
      kind: 'page-counted',
      growingKind: garden.nextElement?.element.kind ?? null,
    };
  }
  return { ...counted, kind: 'hizb-completed', elementKind: garden.lastUnlocked.kind };
}

/**
 * The hizb that was in progress before the page, in the khatma the page went to: its pages before
 * the page and after it. When the page completed it, its pages after are all its pages.
 */
function hizbGrowth(
  before: ReadingJournal,
  after: ReadingJournal,
  hizbPageRanges: readonly HizbPageRange[],
): HizbGrowth | null {
  const khatm = getCurrentKhatm(after);
  const then = getKhatmProgress(before, khatm, hizbPageRanges);
  const now = getKhatmProgress(after, khatm, hizbPageRanges);
  if (then.currentHizb === null) return null;
  const pagesAfter =
    now.currentHizb === then.currentHizb ? now.currentHizbPagesRead : then.currentHizbPageCount;
  return {
    hizb: then.currentHizb,
    pagesBefore: then.currentHizbPagesRead,
    pagesAfter,
    pageCount: then.currentHizbPageCount,
  };
}
