import { HIZB_COUNT, PAGE_COUNT } from '@/domain/quran/types';
import type { HizbPageRange } from '../types';

/**
 * Test data only: 60 synthetic hizb ranges shaped like the real mushaf (about ten pages
 * each, covering pages 1..604, each hizb starting on the page where the previous one ends).
 *
 *   hizb 1 = 1..11, hizb 2 = 11..21, hizb 3 = 21..31, ... hizb 59 = 581..591, hizb 60 = 591..604
 *
 * The shared pages are therefore 11, 21, 31, ... 591. These are NOT the real boundaries:
 * the real ranges come from the Quran data module and are injected by the app.
 */
const PAGES_BETWEEN_BOUNDARIES = 10;

export function buildHizbPageRanges(): HizbPageRange[] {
  const ranges: HizbPageRange[] = [];
  for (let hizb = 1; hizb <= HIZB_COUNT; hizb += 1) {
    const firstPage = hizb === 1 ? 1 : 1 + PAGES_BETWEEN_BOUNDARIES * (hizb - 1);
    const lastPage = hizb === HIZB_COUNT ? PAGE_COUNT : 1 + PAGES_BETWEEN_BOUNDARIES * hizb;
    ranges.push({ hizb, firstPage, lastPage });
  }
  return ranges;
}

export const HIZB_PAGE_RANGES: readonly HizbPageRange[] = buildHizbPageRanges();

/** The fixture with one hizb replaced, to hand-make edge cases and invalid data. */
export function withHizbRange(replacement: HizbPageRange): HizbPageRange[] {
  return buildHizbPageRanges().map((range) =>
    range.hizb === replacement.hizb ? replacement : range,
  );
}
