import { useCallback, useEffect, useMemo, useState } from 'react';

import { quranRepository, quranStructure } from '@/data/quran';
import { getTodayProgress, type TodayProgress } from '@/domain/khatm';
import type { QuranRepository } from '@/domain/quran';
import { useToday } from '@/features/home';
import { useAppStore } from '@/store';

import {
  buildJuzEntries,
  buildSurahEntries,
  filterSurahs,
  openingWords,
  parseGoToPage,
  type JuzEntry,
  type SurahEntry,
} from './contents-model';
import { READER_CONFIG } from './config';
import { pageSurah } from './page-surah';
import { useResumePage } from './use-resume-page';

/** The two lists the segmented choice switches between (spec 1). */
export type ContentsView = 'surahs' | 'juz';

export interface ContentsModel {
  /** The page to resume and the surah it is named after (`pageSurah`). */
  readonly resume: { readonly page: number; readonly surah: number };
  /** Today's new pages toward the daily goal: the water given today, shown under "Reprendre". */
  readonly today: TodayProgress;
  readonly view: ContentsView;
  /** What is typed in the search field: a surah's name or number, or a page's number. */
  readonly query: string;
  /**
   * The page the search text names, with its surah and juz, or null while it names none (not a
   * number from 1 to 604). It heads the results.
   */
  readonly goTo: { readonly page: number; readonly surah: number; readonly juz: number } | null;
  /** The surahs the search keeps, in order: all 114 for an empty search. */
  readonly surahs: readonly SurahEntry[];
  readonly juz: readonly JuzEntry[];
  /** The opening words of each juz, by juz number, once loaded: the header shows them then. */
  readonly juzOpenings: Readonly<Record<number, string>>;
}

export interface ContentsActions {
  readonly openPage: (page: number) => void;
  readonly setView: (view: ContentsView) => void;
  readonly setQuery: (query: string) => void;
}

// Computed once: the structure never changes while the app runs.
let surahEntries: readonly SurahEntry[] | undefined;
let juzEntries: readonly JuzEntry[] | undefined;

/**
 * The model of the table of contents. The page to resume follows the reader: the last page
 * opened there, otherwise the first unread page of the khatma (`resolveResumePage`).
 */
export function useContentsModel(
  openPage: (page: number) => void,
  repository: QuranRepository = quranRepository,
): {
  model: ContentsModel;
  actions: ContentsActions;
} {
  const resumePage = useResumePage();
  const today = useTodayProgress();
  const [view, setShownView] = useState<ContentsView>('surahs');
  const [query, setQuery] = useState('');
  surahEntries ??= buildSurahEntries(quranStructure);
  juzEntries ??= buildJuzEntries(quranStructure);
  const allSurahs = surahEntries;
  const surahs = useMemo(() => filterSurahs(allSurahs, query), [allSurahs, query]);
  const open = useCallback((page: number) => openPage(page), [openPage]);
  const setView = useCallback((next: ContentsView) => setShownView(next), []);
  const goToPage = parseGoToPage(query);
  const juzOpenings = useJuzOpenings(repository);
  return {
    model: {
      resume: { page: resumePage, surah: pageSurah(quranStructure, resumePage) },
      today,
      view,
      query,
      goTo:
        goToPage === null
          ? null
          : {
              page: goToPage,
              surah: pageSurah(quranStructure, goToPage),
              juz: quranStructure.juzOfPage(goToPage),
            },
      surahs,
      juz: juzEntries,
      juzOpenings,
    },
    actions: { openPage: open, setView, setQuery },
  };
}

/** Today's progress toward the daily goal, from the khatm module (the count is its answer). */
function useTodayProgress(): TodayProgress {
  const journal = useAppStore((state) => state.journal);
  const dailyGoalPages = useAppStore((state) => state.settings.dailyGoalPages);
  const today = useToday();
  return useMemo(
    () => getTodayProgress(journal, today, dailyGoalPages),
    [journal, today, dailyGoalPages],
  );
}

/**
 * The opening words of the 30 juz, read from the verse each starts with. They load once, after the
 * first draw; until then the headers show the juz number alone. A verse that cannot be read leaves
 * its header without words rather than with others.
 */
function useJuzOpenings(repository: QuranRepository): Readonly<Record<number, string>> {
  const [openings, setOpenings] = useState<Readonly<Record<number, string>>>({});
  useEffect(() => {
    let isCurrent = true;
    const entries = juzEntries ?? [];
    Promise.all(
      entries.map(async ({ juz, hizbs }) => {
        const start = hizbs[0]?.start;
        if (start === undefined) return null;
        const verse = await repository.getVerse(`${start.surah}:${start.verse}`);
        return [juz, openingWords(verse.text, READER_CONFIG.juzOpeningWords)] as const;
      }),
    ).then(
      (loaded) => {
        if (!isCurrent) return;
        const next: Record<number, string> = {};
        for (const entry of loaded) if (entry !== null) next[entry[0]] = entry[1];
        setOpenings(next);
      },
      (error: unknown) => console.error('The opening words of the juz cannot be read.', error),
    );
    return () => {
      isCurrent = false;
    };
  }, [repository]);
  return openings;
}
