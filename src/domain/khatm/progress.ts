import { PAGE_COUNT } from '@/domain/quran/types';
import { FIRST_PAGE } from './config';
import { getReadPages } from './journal';
import type { HizbPageRange, KhatmProgress, ReadingJournal } from './types';
import { assertHizbPageRanges } from './validation';

function countPagesInRange(range: HizbPageRange): number {
  return range.lastPage - range.firstPage + 1;
}

function countReadPagesInRange(readPages: ReadonlySet<number>, range: HizbPageRange): number {
  let count = 0;
  for (let page = range.firstPage; page <= range.lastPage; page += 1) {
    if (readPages.has(page)) count += 1;
  }
  return count;
}

function findFirstUnreadPage(readPages: ReadonlySet<number>): number | null {
  for (let page = FIRST_PAGE; page <= PAGE_COUNT; page += 1) {
    if (!readPages.has(page)) return page;
  }
  return null;
}

/**
 * Progress of a khatma from its set of read pages (spec rules 2 and 3). Internal: the
 * callers have already checked the khatma number, the pages and the hizb ranges.
 *
 * A hizb is completed when every page from its first to its last is read. A page shared by
 * two hizb counts for both, so finishing a hizb usually starts the next one.
 */
export function measureKhatmProgress(
  khatm: number,
  readPages: ReadonlySet<number>,
  hizbPageRanges: readonly HizbPageRange[],
): KhatmProgress {
  let hizbCompleted = 0;
  let currentHizb: number | null = null;
  let currentHizbProgress = 0;
  let currentHizbPagesRead = 0;
  let currentHizbPageCount = 0;
  for (const range of hizbPageRanges) {
    const pagesInHizb = countPagesInRange(range);
    const readPagesInHizb = countReadPagesInRange(readPages, range);
    if (readPagesInHizb === pagesInHizb) {
      hizbCompleted += 1;
    } else if (currentHizb === null) {
      // Pages can be read in any order: the current hizb is the first one left unfinished,
      // not necessarily the last one the user opened.
      currentHizb = range.hizb;
      currentHizbProgress = readPagesInHizb / pagesInHizb;
      currentHizbPagesRead = readPagesInHizb;
      currentHizbPageCount = pagesInHizb;
    }
  }

  const pagesRead = readPages.size;
  return {
    khatm,
    pagesRead,
    pagesRemaining: PAGE_COUNT - pagesRead,
    fraction: pagesRead / PAGE_COUNT,
    hizbCompleted,
    currentHizb,
    currentHizbProgress,
    currentHizbPagesRead,
    currentHizbPageCount,
    firstUnreadPage: findFirstUnreadPage(readPages),
    isComplete: pagesRead === PAGE_COUNT,
  };
}

/**
 * Progress of one khatma (spec rules 2, 3 and 4), derived from the journal alone.
 *
 * Each khatma is computed from its own entries only: starting khatma n + 1 never changes
 * the progress (nor the completed hizb) of khatma n. A khatma that has no entry yet has
 * nothing read.
 */
export function getKhatmProgress(
  journal: ReadingJournal,
  khatm: number,
  hizbPageRanges: readonly HizbPageRange[],
): KhatmProgress {
  assertHizbPageRanges(hizbPageRanges);
  return measureKhatmProgress(khatm, getReadPages(journal, khatm), hizbPageRanges);
}
