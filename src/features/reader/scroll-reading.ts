/**
 * The reading rule of the reader (docs/specs/reader.md, section 3), for a continuous scroll
 * (D41). Pure functions of what the screen observes: nothing here reads a clock or the screen, so
 * tests choose both.
 *
 * A page of the mushaf counts once when its section:
 *
 * 1. was on screen, app in the foreground, for the time the page asks in all
 *    (`requiredSecondsOf`: it grows with the words of the page, owner's decision of 25 November
 *    2026). The time adds up across stays: scrolling back and forth, leaving the reader and
 *    coming back (the tracker starts from the progress kept by `reading-memory.ts`). The time
 *    between two observations goes to the sections that were on screen, shared by the room each
 *    took: half a screen of a page gets half the time. Two pages on screen are not read twice as
 *    fast;
 * 2. had its first and its last line on screen at some point: its verses have been in view, not
 *    only its top;
 * 3. and neither counts while the text moves faster than a reader scrolls
 *    (`flingScreensPerSecond`): flinging past pages makes nothing grow.
 *
 * Whether the page is new to the khatma stays the khatm module's answer (D8): a page read again
 * changes nothing in the journal.
 */

import type { Viewport } from './reading-place';

const MILLISECONDS_PER_SECOND = 1000;

/** A page section measured in the scroll's content, in points. */
export interface SectionExtent {
  readonly page: number;
  readonly top: number;
  readonly bottom: number;
}

export interface ReadingObservation {
  /** Milliseconds from a monotonic clock. */
  readonly now: number;
  readonly viewport: Viewport;
  /** The sections measured so far; those off screen weigh nothing. */
  readonly extents: readonly SectionExtent[];
  readonly isForeground: boolean;
}

/** What is known of one page: its time so far, its edges seen, whether it counted. */
export interface PageProgress {
  readonly creditedMs: number;
  readonly sawTop: boolean;
  readonly sawBottom: boolean;
  readonly counted: boolean;
}

/** What one reading session knows. Never mutated: each observation returns a new tracker. */
export interface ReadingTracker {
  readonly last: ReadingObservation | null;
  readonly pages: ReadonlyMap<number, PageProgress>;
}

export interface ReadingRules {
  /** Seconds the page asks before it counts; `Infinity` while that is not known yet. */
  readonly requiredSecondsOf: (page: number) => number;
  readonly flingScreensPerSecond: number;
}

const NOTHING_YET: PageProgress = {
  creditedMs: 0,
  sawTop: false,
  sawBottom: false,
  counted: false,
};

/**
 * A new reading session. It starts from the progress kept from earlier sessions, so that the time
 * of a page adds up across stays; the time between two sessions never counts (no last
 * observation).
 */
export function createReadingTracker(
  pages: ReadonlyMap<number, PageProgress> = new Map(),
): ReadingTracker {
  return { last: null, pages: new Map(pages) };
}

/** What is known of a page so far. */
export function progressOf(tracker: ReadingTracker, page: number): PageProgress {
  return tracker.pages.get(page) ?? NOTHING_YET;
}

function visibleHeight(extent: SectionExtent, viewport: Viewport): number {
  const bottom = viewport.top + viewport.height;
  return Math.max(0, Math.min(extent.bottom, bottom) - Math.max(extent.top, viewport.top));
}

function isEdgeVisible(edge: number, viewport: Viewport): boolean {
  return edge >= viewport.top && edge <= viewport.top + viewport.height;
}

/**
 * Takes one observation of the screen: credits the time since the previous one to the sections
 * that were then on screen, notes which edges are now in view, and returns the pages that have
 * just counted, in the order of the pages.
 */
export function observeReading(
  tracker: ReadingTracker,
  observation: ReadingObservation,
  rules: ReadingRules,
): { tracker: ReadingTracker; counted: readonly number[] } {
  const { last } = tracker;
  if (!Number.isFinite(observation.now) || (last !== null && observation.now < last.now)) {
    throw new RangeError(
      `The clock went from ${String(last?.now)} to ${observation.now}: a monotonic clock never goes back.`,
    );
  }
  const pages = new Map(tracker.pages);
  const progressOf = (page: number) => pages.get(page) ?? NOTHING_YET;

  const elapsedMs = last === null ? 0 : observation.now - last.now;
  const moved = last === null ? 0 : Math.abs(observation.viewport.top - last.viewport.top);
  const flingLimit = rules.flingScreensPerSecond * observation.viewport.height;
  const isFling = elapsedMs > 0 && (moved * MILLISECONDS_PER_SECOND) / elapsedMs > flingLimit;

  if (last !== null && last.isForeground && elapsedMs > 0 && !isFling) {
    const shares = last.extents.map((extent) => ({
      page: extent.page,
      room: visibleHeight(extent, last.viewport),
    }));
    const total = shares.reduce((sum, share) => sum + share.room, 0);
    if (total > 0) {
      for (const { page, room } of shares) {
        if (room === 0) continue;
        const progress = progressOf(page);
        pages.set(page, {
          ...progress,
          creditedMs: progress.creditedMs + (elapsedMs * room) / total,
        });
      }
    }
  }

  if (observation.isForeground && !isFling) {
    for (const extent of observation.extents) {
      const sawTop = isEdgeVisible(extent.top, observation.viewport);
      const sawBottom = isEdgeVisible(extent.bottom, observation.viewport);
      if (!sawTop && !sawBottom) continue;
      const progress = progressOf(extent.page);
      pages.set(extent.page, {
        ...progress,
        sawTop: progress.sawTop || sawTop,
        sawBottom: progress.sawBottom || sawBottom,
      });
    }
  }

  const counted: number[] = [];
  for (const [page, progress] of pages) {
    if (progress.counted || !progress.sawTop || !progress.sawBottom) continue;
    if (progress.creditedMs < rules.requiredSecondsOf(page) * MILLISECONDS_PER_SECOND) continue;
    pages.set(page, { ...progress, counted: true });
    counted.push(page);
  }
  counted.sort((first, second) => first - second);
  return { tracker: { last: observation, pages }, counted };
}
