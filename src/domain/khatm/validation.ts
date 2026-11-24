import { HIZB_COUNT, PAGE_COUNT } from '@/domain/quran/types';
import { compareLocalDates, isLocalDate } from '@/domain/shared/local-date';
import { FIRST_KHATM, FIRST_PAGE } from './config';
import type { HizbPageRange, KhatmConfig, Pause, ReadingEntry } from './types';

/**
 * Guards of the module. Invalid input always raises an explicit error; nothing is silently
 * corrected (see docs/CONTRIBUTING.md).
 */

export function assertPage(page: number): void {
  if (!Number.isInteger(page) || page < FIRST_PAGE || page > PAGE_COUNT) {
    throw new RangeError(`Invalid page: ${page} (expected a whole number from 1 to ${PAGE_COUNT})`);
  }
}

export function assertKhatmNumber(khatm: number): void {
  if (!Number.isInteger(khatm) || khatm < FIRST_KHATM) {
    throw new RangeError(`Invalid khatm number: ${khatm} (expected a whole number, at least 1)`);
  }
}

/** A LocalDate is a branded string: the brand can be forged by a cast, so we check the value. */
export function assertLocalDate(date: string, label: string): void {
  if (!isLocalDate(date)) {
    throw new RangeError(`Invalid ${label}: "${date}" (expected a real YYYY-MM-DD date)`);
  }
}

export function assertEntry(entry: ReadingEntry): void {
  assertKhatmNumber(entry.khatm);
  assertPage(entry.page);
  assertLocalDate(entry.date, 'entry date');
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`Invalid ${label}: ${value} (expected a whole number, at least 1)`);
  }
}

export function assertConfig(config: KhatmConfig): void {
  assertPositiveInteger(config.dailyGoalPages, 'dailyGoalPages');
  assertPositiveInteger(config.minPagesPerWateredDay, 'minPagesPerWateredDay');
  assertPositiveInteger(config.averagePaceWindowDays, 'averagePaceWindowDays');
}

export function assertPauses(pauses: readonly Pause[]): void {
  for (const pause of pauses) {
    assertLocalDate(pause.from, 'pause start');
    assertLocalDate(pause.to, 'pause end');
    if (compareLocalDates(pause.to, pause.from) < 0) {
      throw new RangeError(`Invalid pause: it ends (${pause.to}) before it starts (${pause.from})`);
    }
  }
}

/**
 * The 60 ranges must describe the whole mushaf: hizb 1..60 in order, from page 1 to page
 * 604, without a gap. Each hizb starts either on the page where the previous one ends
 * (shared page) or on the next page. This is what makes "604 pages read" and "60 hizb
 * completed" the same thing.
 */
export function assertHizbPageRanges(ranges: readonly HizbPageRange[]): void {
  if (ranges.length !== HIZB_COUNT) {
    throw new RangeError(`Expected ${HIZB_COUNT} hizb page ranges, got ${ranges.length}`);
  }

  let previousLastPage: number | null = null;
  for (const [index, range] of ranges.entries()) {
    const expectedHizb = index + 1;
    if (range.hizb !== expectedHizb) {
      throw new RangeError(
        `Hizb page ranges must be ordered 1..${HIZB_COUNT}: found hizb ${range.hizb} at position ${expectedHizb}`,
      );
    }
    assertPage(range.firstPage);
    assertPage(range.lastPage);
    if (range.firstPage > range.lastPage) {
      throw new RangeError(
        `Hizb ${range.hizb} ends (page ${range.lastPage}) before it starts (page ${range.firstPage})`,
      );
    }

    if (previousLastPage === null) {
      if (range.firstPage !== FIRST_PAGE) {
        throw new RangeError(`Hizb 1 must start on page ${FIRST_PAGE}, got ${range.firstPage}`);
      }
    } else {
      const startsOnSharedPage = range.firstPage === previousLastPage;
      const startsOnNextPage = range.firstPage === previousLastPage + 1;
      if (!startsOnSharedPage && !startsOnNextPage) {
        throw new RangeError(
          `Hizb ${range.hizb} starts on page ${range.firstPage} but the previous hizb ends on page ${previousLastPage}: gap or overlap of more than one page`,
        );
      }
    }
    previousLastPage = range.lastPage;
  }

  if (previousLastPage !== PAGE_COUNT) {
    throw new RangeError(
      `Hizb ${HIZB_COUNT} must end on page ${PAGE_COUNT}, got ${previousLastPage}`,
    );
  }
}
