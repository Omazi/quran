/**
 * Where the person is reading, for the bar (surah, juz, hizb, page) and the page to resume: the
 * segment under the reading line, a fixed share down the visible text (`READER_CONFIG
 * .readingLineRatio`), the way reading sites follow the verse a reader's eyes are on rather than
 * the first pixel of the list (docs/specs/reader.md, comparison).
 */

import { READER_CONFIG } from './config';

/** A surah segment of a page section, measured in the scroll's content, in points. */
export interface SegmentExtent {
  readonly page: number;
  readonly surah: number;
  readonly top: number;
  readonly bottom: number;
}

/** The visible part of the scroll's content, in points. */
export interface Viewport {
  readonly top: number;
  readonly height: number;
}

export interface ReadingPlace {
  readonly page: number;
  readonly surah: number;
}

/**
 * The segment under the reading line; when the line falls between or after the measured
 * segments, the last one above it; null before any segment is measured.
 */
export function readingPlace(
  segments: readonly SegmentExtent[],
  viewport: Viewport,
): ReadingPlace | null {
  const line = viewport.top + viewport.height * READER_CONFIG.readingLineRatio;
  let above: SegmentExtent | null = null;
  let first: SegmentExtent | null = null;
  for (const segment of segments) {
    if (line >= segment.top && line < segment.bottom) {
      return { page: segment.page, surah: segment.surah };
    }
    if (segment.top <= line && (above === null || segment.top > above.top)) above = segment;
    if (first === null || segment.top < first.top) first = segment;
  }
  const chosen = above ?? first;
  return chosen === null ? null : { page: chosen.page, surah: chosen.surah };
}
