/**
 * The per-page table of the reading counters (`buildPageStatsTable`), built once from the pages
 * the reader shows (`quranRepository.getPage`), as the stats module asks of the screen lot
 * (src/domain/stats/README.md). It is kept in memory for as long as the app runs.
 *
 * Built after the first render of the screen that asks for it, never during it: the 604 pages
 * are read a few at a time, letting the interface breathe between two groups.
 */

import { useEffect, useState } from 'react';

import { quranRepository } from '@/data/quran';
import { PAGE_COUNT, type MushafPage, type QuranRepository } from '@/domain/quran';
import { buildPageStatsTable, type PageStatsTable } from '@/domain/stats';

/** Pages read from the repository at once, before giving the interface its turn again. */
const PAGES_PER_GROUP = 32;

const yieldToInterface = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Reads `pageCount` pages and builds their table. */
export async function loadPageStatsTable(
  repository: Pick<QuranRepository, 'getPage'>,
  pageCount: number = PAGE_COUNT,
): Promise<PageStatsTable> {
  const pages: MushafPage[] = [];
  for (let first = 1; first <= pageCount; first += PAGES_PER_GROUP) {
    const last = Math.min(pageCount, first + PAGES_PER_GROUP - 1);
    const group = await Promise.all(
      Array.from({ length: last - first + 1 }, (_, offset) => repository.getPage(first + offset)),
    );
    pages.push(...group);
    await yieldToInterface();
  }
  return buildPageStatsTable(pages);
}

let cached: Promise<PageStatsTable> | null = null;

/** The table of the app's mushaf, built on the first call and shared afterwards. */
export function getPageStatsTable(): Promise<PageStatsTable> {
  cached ??= loadPageStatsTable(quranRepository).catch((error: unknown) => {
    // Not kept: the next screen that asks tries again.
    cached = null;
    throw error;
  });
  return cached;
}

/** Forgets the table: for tests. */
export function forgetPageStatsTable(): void {
  cached = null;
}

export type PageStatsTableState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly table: PageStatsTable }
  | { readonly status: 'failed' };

/**
 * The table, once built. The first render always sees `loading` (or the table already in
 * memory); the work starts in an effect, after the screen is drawn.
 */
export function usePageStatsTable(
  load: () => Promise<PageStatsTable> = getPageStatsTable,
): PageStatsTableState {
  const [state, setState] = useState<PageStatsTableState>({ status: 'loading' });
  useEffect(() => {
    let isCurrent = true;
    load().then(
      (table) => {
        if (isCurrent) setState({ status: 'ready', table });
      },
      (error: unknown) => {
        console.error('The reading counters could not be prepared.', error);
        if (isCurrent) setState({ status: 'failed' });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [load]);
  return state;
}
