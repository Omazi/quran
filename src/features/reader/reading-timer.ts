/**
 * The 30-second rule (docs/specs/reader.md, section 3), as pure functions of the time. The time
 * is a number of milliseconds from a monotonic clock, given by the caller: nothing here reads a
 * clock, so tests choose the time.
 *
 * Only the time spent with the app in the foreground counts, and it adds up across
 * interruptions: a phone call in the middle of a page does not start the page again.
 */

import { assertPageNumber } from '@/domain/quran';

import { READER_CONFIG } from './config';

const MILLISECONDS_PER_SECOND = 1000;

/** One stay on one page. Never mutated: each function returns a new visit. */
export interface PageVisit {
  readonly page: number;
  /** Foreground time already spent on the page, before `foregroundSince`. */
  readonly foregroundMs: number;
  /** When the app last came to the foreground on this page; null while it is in the background. */
  readonly foregroundSince: number | null;
}

export interface FinishedVisit {
  readonly page: number;
  /** Whole seconds spent on the page with the app in the foreground. */
  readonly secondsOnPage: number;
  /** True when the page counts as read. */
  readonly counts: boolean;
}

function elapsed(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    throw new RangeError(
      `The clock went from ${from} to ${to}: a monotonic clock never goes back.`,
    );
  }
  return to - from;
}

/** The person arrives on a page. `isForeground` is false when the app is in the background. */
export function startVisit(page: number, now: number, isForeground = true): PageVisit {
  assertPageNumber(page);
  return { page, foregroundMs: 0, foregroundSince: isForeground ? now : null };
}

/** The app goes to the background. A visit already paused is returned as it is. */
export function pauseVisit(visit: PageVisit, now: number): PageVisit {
  if (visit.foregroundSince === null) return visit;
  return {
    page: visit.page,
    foregroundMs: visit.foregroundMs + elapsed(visit.foregroundSince, now),
    foregroundSince: null,
  };
}

/** The app comes back to the foreground. A visit already running is returned as it is. */
export function resumeVisit(visit: PageVisit, now: number): PageVisit {
  if (visit.foregroundSince !== null) return visit;
  return { ...visit, foregroundSince: now };
}

/**
 * The person turns the page or leaves the reader: does the page count? Only foreground time
 * counts, so a visit that ends in the background keeps what it had when it was paused.
 */
export function finishVisit(
  visit: PageVisit,
  now: number,
  minimumSeconds: number = READER_CONFIG.minimumSecondsOnPage,
): FinishedVisit {
  const totalMs = pauseVisit(visit, now).foregroundMs;
  return {
    page: visit.page,
    secondsOnPage: Math.floor(totalMs / MILLISECONDS_PER_SECOND),
    counts: totalMs >= minimumSeconds * MILLISECONDS_PER_SECOND,
  };
}
