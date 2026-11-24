import { PAGE_COUNT } from '@/domain/quran/types';
import { addDays, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';
import { recordPageRead } from '../journal';
import type { ReadingEntry, ReadingJournal } from '../types';

/** Short alias: tests write `day('2026-11-23')`. */
export function day(value: string): LocalDate {
  return parseLocalDate(value);
}

/**
 * Records several pages on one day, through the public `recordPageRead`.
 *
 * The module chooses the khatma (always the one in progress); `expectedKhatm` only says
 * which khatma the test means to write to. A page filed anywhere else stops the test: its
 * setup would not describe what it claims to.
 */
export function readPages(
  journal: ReadingJournal,
  expectedKhatm: number,
  pages: readonly number[],
  date: LocalDate,
): ReadingJournal {
  return pages.reduce((current, page) => {
    const next = recordPageRead(current, { page, date });
    // A new page is appended at the end; a re-read returns the same journal.
    const added = next === current ? undefined : next[next.length - 1];
    if (added !== undefined && added.khatm !== expectedKhatm) {
      throw new Error(
        `Test setup: page ${page} was filed in khatm ${added.khatm}, the test expected khatm ${expectedKhatm}`,
      );
    }
    return next;
  }, journal);
}

/** The pages `first..last`, in order. */
export function pageRange(first: number, last: number): number[] {
  const pages: number[] = [];
  for (let page = first; page <= last; page += 1) pages.push(page);
  return pages;
}

/**
 * The 604 pages in a fixed scrambled order (1, 8, 15, ... wrapping around). 7 shares no
 * factor with 604, so stepping by 7 visits every page exactly once.
 */
const SCRAMBLE_STEP = 7;
export function allPagesOutOfOrder(): number[] {
  return pageRange(0, PAGE_COUNT - 1).map((index) => ((index * SCRAMBLE_STEP) % PAGE_COUNT) + 1);
}

/**
 * A journal of `count` completed khatmas, built directly (not through `recordPageRead`, which
 * re-checks the journal on every call and would make hundreds of khatmas slow to set up).
 * Khatma k is read at 100 pages a day, in mushaf order, and starts `daysBetweenStarts` days
 * after the previous one started.
 */
const PAGES_PER_DAY_IN_BUILT_KHATMAS = 100;
export function buildCompletedKhatmas(
  count: number,
  firstStart: LocalDate,
  daysBetweenStarts: number,
): ReadingJournal {
  const entries: ReadingEntry[] = [];
  for (let khatm = 1; khatm <= count; khatm += 1) {
    const khatmStart = addDays(firstStart, (khatm - 1) * daysBetweenStarts);
    for (let page = 1; page <= PAGE_COUNT; page += 1) {
      const dayOffset = Math.floor((page - 1) / PAGES_PER_DAY_IN_BUILT_KHATMAS);
      entries.push({ khatm, page, date: addDays(khatmStart, dayOffset) });
    }
  }
  return entries;
}
