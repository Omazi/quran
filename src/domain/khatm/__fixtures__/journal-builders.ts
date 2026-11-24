import { PAGE_COUNT } from '@/domain/quran/types';
import { parseLocalDate, type LocalDate } from '@/domain/shared/local-date';
import { recordPageRead } from '../journal';
import type { ReadingJournal } from '../types';

/** Short alias: tests write `day('2026-11-23')`. */
export function day(value: string): LocalDate {
  return parseLocalDate(value);
}

/** Records several pages of one khatma on one day, through the public `recordPageRead`. */
export function readPages(
  journal: ReadingJournal,
  khatm: number,
  pages: readonly number[],
  date: LocalDate,
): ReadingJournal {
  return pages.reduce((current, page) => recordPageRead(current, { khatm, page, date }), journal);
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
