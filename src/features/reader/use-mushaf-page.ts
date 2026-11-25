import { useEffect, useState } from 'react';

import { quranRepository } from '@/data/quran';
import type { QuranRepository } from '@/domain/quran';

import { buildPageLines, type PageLine } from './page-content';

export type MushafPageState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly lines: readonly PageLine[] };

/** The basmala line holds no text in the layout: it is the text of verse 1:1 (see page-content). */
const BASMALA_VERSE = '1:1';

const LOADING: MushafPageState = { status: 'loading' };

/**
 * One page of the mushaf, loaded when it is first shown. The repository reads the pages by files
 * of 20 and keeps three files in memory, so a page and its neighbours come from the same load
 * (spec 2: data loaded by slices, on demand). Data that cannot be trusted gives the error state,
 * never part of a page.
 */
export function useMushafPage(
  page: number,
  repository: QuranRepository = quranRepository,
): MushafPageState {
  const [state, setState] = useState<{ page: number; value: MushafPageState }>({
    page,
    value: LOADING,
  });
  useEffect(() => {
    let isCurrent = true;
    Promise.all([repository.getPage(page), repository.getVerse(BASMALA_VERSE)])
      .then(([mushafPage, basmala]) => buildPageLines(mushafPage, basmala.text))
      .then(
        (lines) => {
          if (isCurrent) setState({ page, value: { status: 'ready', lines } });
        },
        (error: unknown) => {
          console.error(`Page ${page} of the mushaf cannot be shown.`, error);
          if (isCurrent) setState({ page, value: { status: 'error' } });
        },
      );
    return () => {
      isCurrent = false;
    };
  }, [page, repository]);
  // A new page shows its own loading state, never the lines of the previous one.
  return state.page === page ? state.value : LOADING;
}
