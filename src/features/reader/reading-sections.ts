/**
 * The sections of the continuous scroll (docs/specs/reader.md, D41): one section per page of the
 * mushaf, holding exactly the verses printed on that page. In the Medina mushaf of the app, a page
 * always begins with a new verse (checked for the 604 pages by the data tests), so the verses of a
 * section are those whose page is that page: nothing is cut, nothing is shared between two pages.
 * A page read keeps meaning the same thing for the khatma, the garden and the stats.
 */

import { assertPageNumber, PAGE_COUNT, type QuranStructure } from '@/domain/quran';

/** The verses of one surah on a page. */
export interface SurahSegment {
  readonly surah: number;
  readonly firstVerse: number;
  readonly lastVerse: number;
  /** True when the segment begins with verse 1: the surah's header is drawn above it. */
  readonly startsSurah: boolean;
}

export interface PageSection {
  readonly page: number;
  /** One segment per surah on the page, in reading order. */
  readonly segments: readonly SurahSegment[];
}

/** The section of one page. Throws a `RangeError` for anything but a page from 1 to 604. */
export function pageSection(structure: QuranStructure, page: number): PageSection {
  assertPageNumber(page);
  const first = structure.firstVerseOfPage(page);
  const last = structure.lastVerseOfPage(page);
  const segments: SurahSegment[] = [];
  for (let surah = first.surah; surah <= last.surah; surah += 1) {
    const firstVerse = surah === first.surah ? first.verse : 1;
    const lastVerse = surah === last.surah ? last.verse : structure.surah(surah).verseCount;
    segments.push({ surah, firstVerse, lastVerse, startsSurah: firstVerse === 1 });
  }
  return { page, segments };
}

/** The 604 sections, in the order of the pages. */
export function pageSections(structure: QuranStructure): readonly PageSection[] {
  return Array.from({ length: PAGE_COUNT }, (_, index) => pageSection(structure, index + 1));
}
