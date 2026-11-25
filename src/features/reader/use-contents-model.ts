import { useCallback, useMemo, useState } from 'react';

import { quranStructure } from '@/data/quran';

import {
  buildJuzEntries,
  buildSurahEntries,
  filterSurahs,
  parseGoToPage,
  type JuzEntry,
  type SurahEntry,
} from './contents-model';
import { useResumePage } from './use-resume-page';

/** The two lists the segmented choice switches between (spec 1). */
export type ContentsView = 'surahs' | 'juz';

export interface ContentsModel {
  /** The page to resume and the surah of its first verse. */
  readonly resume: { readonly page: number; readonly surah: number };
  readonly view: ContentsView;
  /** What is typed in "Aller à la page". */
  readonly goToText: string;
  /** The page it names, or null while it names none (empty, or outside 1 to 604). */
  readonly goToPage: number | null;
  /** What is typed in the search field. */
  readonly query: string;
  /** The surahs the search keeps, in order: all 114 for an empty search. */
  readonly surahs: readonly SurahEntry[];
  readonly juz: readonly JuzEntry[];
}

export interface ContentsActions {
  readonly openPage: (page: number) => void;
  readonly setView: (view: ContentsView) => void;
  readonly setGoToText: (text: string) => void;
  readonly setQuery: (query: string) => void;
}

// Computed once: the structure never changes while the app runs.
let surahEntries: readonly SurahEntry[] | undefined;
let juzEntries: readonly JuzEntry[] | undefined;

/**
 * The model of the table of contents. The page to resume follows the reader: the last page
 * opened there, otherwise the first unread page of the khatma (`resolveResumePage`).
 */
export function useContentsModel(openPage: (page: number) => void): {
  model: ContentsModel;
  actions: ContentsActions;
} {
  const resumePage = useResumePage();
  const [view, setShownView] = useState<ContentsView>('surahs');
  const [goToText, setGoToText] = useState('');
  const [query, setQuery] = useState('');
  surahEntries ??= buildSurahEntries(quranStructure);
  juzEntries ??= buildJuzEntries(quranStructure);
  const allSurahs = surahEntries;
  const surahs = useMemo(() => filterSurahs(allSurahs, query), [allSurahs, query]);
  const open = useCallback((page: number) => openPage(page), [openPage]);
  // The search field belongs to the surahs: leaving them empties it, as the field does.
  const setView = useCallback((next: ContentsView) => {
    setShownView(next);
    setQuery('');
  }, []);
  return {
    model: {
      resume: { page: resumePage, surah: quranStructure.firstVerseOfPage(resumePage).surah },
      view,
      goToText,
      goToPage: parseGoToPage(goToText),
      query,
      surahs,
      juz: juzEntries,
    },
    actions: { openPage: open, setView, setGoToText, setQuery },
  };
}
