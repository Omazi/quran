import { useCallback, useState } from 'react';

import { quranStructure } from '@/data/quran';

import {
  buildJuzEntries,
  buildSurahEntries,
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
  /** The page chosen in "Aller à la page". */
  readonly goToPage: number;
  readonly surahs: readonly SurahEntry[];
  readonly juz: readonly JuzEntry[];
}

export interface ContentsActions {
  readonly openPage: (page: number) => void;
  readonly setView: (view: ContentsView) => void;
  readonly setGoToPage: (page: number) => void;
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
  const [view, setView] = useState<ContentsView>('surahs');
  const [chosenPage, setGoToPage] = useState<number | null>(null);
  surahEntries ??= buildSurahEntries(quranStructure);
  juzEntries ??= buildJuzEntries(quranStructure);
  const open = useCallback((page: number) => openPage(page), [openPage]);
  return {
    model: {
      resume: { page: resumePage, surah: quranStructure.firstVerseOfPage(resumePage).surah },
      view,
      // Until the person moves the stepper, it stands on the page to resume.
      goToPage: chosenPage ?? resumePage,
      surahs: surahEntries,
      juz: juzEntries,
    },
    actions: { openPage: open, setView, setGoToPage },
  };
}
