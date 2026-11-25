/**
 * The reading time of pages that have not counted yet, kept while the app runs (spec 3; owner's
 * decision of 25 November 2026: the time of a page adds up across several stays, leaving the
 * reader and coming back included). Each reading session starts from it and writes back to it.
 *
 * Kept in memory only, not on the device: a restart of the app starts the time of an unfinished
 * page again. Pages that counted are dropped from it; the khatm module decides whether a page
 * read again counts (D8).
 */

import type { PageProgress } from './scroll-reading';

let kept: ReadonlyMap<number, PageProgress> = new Map();

/** The progress kept from earlier reading sessions. */
export function keptReadingProgress(): ReadonlyMap<number, PageProgress> {
  return kept;
}

/** Keeps the progress of the pages that have not counted. */
export function keepReadingProgress(pages: ReadonlyMap<number, PageProgress>): void {
  const next = new Map<number, PageProgress>();
  for (const [page, progress] of pages) if (!progress.counted) next.set(page, progress);
  kept = next;
}

/** Forgets everything: for tests, which each start from a fresh app. */
export function forgetReadingProgress(): void {
  kept = new Map();
}
