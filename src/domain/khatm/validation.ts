import { HIZB_COUNT, PAGE_COUNT } from '@/domain/quran/types';
import { compareLocalDates, isLocalDate, type LocalDate } from '@/domain/shared/local-date';
import { FIRST_KHATM, FIRST_PAGE, MAX_AVERAGE_PACE_WINDOW_DAYS } from './config';
import type { HizbPageRange, KhatmConfig, Pause } from './types';

/**
 * Guards of the module. Invalid input always raises an explicit error; nothing is silently
 * corrected (see docs/CONTRIBUTING.md).
 *
 * The types cannot be trusted at run time: the journal, the pauses and the settings come
 * back from storage. A value of the wrong shape must be named by this module, not left to
 * fail somewhere inside the engine ("x is not iterable").
 */

function describeKind(value: unknown): string {
  return value === null ? 'null' : typeof value;
}

export function assertList(value: unknown, label: string): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Invalid ${label}: expected a list, got ${describeKind(value)}`);
  }
}

export function assertObject(value: unknown, label: string): asserts value is object {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`Invalid ${label}: expected an object, got ${describeKind(value)}`);
  }
}

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

/**
 * A LocalDate is a branded string: the brand can be forged by a cast (or by data loaded from
 * storage), so the value itself is checked, starting with its type.
 */
export function assertLocalDate(date: LocalDate, label: string): void {
  if (typeof date !== 'string' || !isLocalDate(date)) {
    throw new RangeError(`Invalid ${label}: "${String(date)}" (expected a real YYYY-MM-DD date)`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`Invalid ${label}: ${value} (expected a whole number, at least 1)`);
  }
}

/** The daily goal is chosen by the user: a whole number of pages, at least 1. */
export function assertDailyGoalPages(dailyGoalPages: number): void {
  assertPositiveInteger(dailyGoalPages, 'dailyGoalPages');
}

export function assertConfig(config: KhatmConfig): void {
  assertObject(config, 'configuration');
  assertPositiveInteger(config.minPagesPerWateredDay, 'minPagesPerWateredDay');
  assertPositiveInteger(config.averagePaceWindowDays, 'averagePaceWindowDays');
  if (config.averagePaceWindowDays > MAX_AVERAGE_PACE_WINDOW_DAYS) {
    throw new RangeError(
      `Invalid averagePaceWindowDays: ${config.averagePaceWindowDays} (expected a whole number from 1 to ${MAX_AVERAGE_PACE_WINDOW_DAYS})`,
    );
  }
}

export function assertPauses(pauses: readonly Pause[]): void {
  assertList(pauses, 'pauses');
  for (const pause of pauses) {
    assertObject(pause, 'pause');
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
  assertList(ranges, 'hizb page ranges');
  if (ranges.length !== HIZB_COUNT) {
    throw new RangeError(`Expected ${HIZB_COUNT} hizb page ranges, got ${ranges.length}`);
  }

  let previousLastPage: number | null = null;
  for (const [index, range] of ranges.entries()) {
    assertObject(range, 'hizb page range');
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
