import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { quranStructure } from '@/data/quran';
import { recordPageRead as addPageToJournal, type ReadingJournal } from '@/domain/khatm';
import { assertPageNumber } from '@/domain/quran';
import { deviceLocalDate, type Clock, type HomeSettings } from '@/features/home';
import { useReaderPresence } from '@/features/profile';
import { useAppStore } from '@/store';

import { rememberOpenedPage } from './reader-session';
import { readingFeedback, type ReadingFeedback } from './reading-feedback';
import { finishVisit, pauseVisit, resumeVisit, startVisit, type PageVisit } from './reading-timer';
import { useScreenReader } from './use-screen-reader';

/** Milliseconds from a clock that never goes back, for the time spent on a page. */
export type MonotonicClock = () => number;

export interface ReaderDependencies {
  /** Defaults to `performance.now`. */
  readonly monotonicClock?: MonotonicClock;
  /** Gives the calendar day a page is recorded on. Defaults to the device clock. */
  readonly clock?: Clock;
}

/** Where the reader stands: the page shown and what the bars say about it. */
export interface ReaderModel {
  readonly page: number;
  /** The surah of the first verse of the page, like its juz and hizb. */
  readonly surah: number;
  readonly juz: number;
  readonly hizb: number;
  readonly barsVisible: boolean;
  /** What to tell the person about the page they just left, or null. */
  readonly feedback: ReadingFeedback | null;
}

export interface ReaderActions {
  /** The person reached another page, by a swipe or a VoiceOver action. */
  readonly changePage: (page: number) => void;
  /** A tap on the page: hides or shows the bars. */
  readonly toggleBars: () => void;
}

const systemMonotonicClock: MonotonicClock = () => performance.now();
const systemClock: Clock = () => new Date();

function isForeground(state: AppStateStatus | string | null | undefined): boolean {
  return state === 'active';
}

/**
 * The reader's state and the 30-second rule (spec 3). Each page shown starts a visit; turning the
 * page or leaving the reader ends it, and a visit long enough records the page through the store
 * (`recordPageRead`) on the local day. Whether the page was new to the khatma is the khatm
 * module's answer (D8): the same pure function tells the screen what the store will do, so the
 * feedback names exactly what happened.
 */
export function useReader(
  initialPage: number,
  { monotonicClock = systemMonotonicClock, clock = systemClock }: ReaderDependencies = {},
): { model: ReaderModel; actions: ReaderActions } {
  assertPageNumber(initialPage);
  const [page, setPage] = useState(initialPage);
  const [areBarsShown, setBarsShown] = useState(true);
  const [feedback, setFeedback] = useState<ReadingFeedback | null>(null);
  const isScreenReaderRunning = useScreenReader();
  // The time with the reader open is reading time (D37), counted at the root of the app.
  useReaderPresence();

  const journal = useAppStore((state) => state.journal);
  const recordInStore = useAppStore((state) => state.recordPageRead);
  const dailyGoalPages = useAppStore((state) => state.settings.dailyGoalPages);
  const userSeed = useAppStore((state) => state.settings.userSeed);
  const pauses = useAppStore((state) => state.settings.pauses);

  // Read when a visit ends, which can be after the last render (when the reader closes).
  const settings: HomeSettings = { dailyGoalPages, userSeed, pauses };
  const latest = useRef({ journal, recordInStore, settings, monotonicClock, clock, page });
  useEffect(() => {
    latest.current = { journal, recordInStore, settings, monotonicClock, clock, page };
  });
  const visit = useRef<PageVisit | null>(null);

  /** Ends the current visit and records its page when it counts. Returns what to tell. */
  const endVisit = useCallback((): ReadingFeedback | null => {
    const current = visit.current;
    if (current === null) return null;
    const finished = finishVisit(current, latest.current.monotonicClock());
    if (!finished.counts) return null;
    const before: ReadingJournal = latest.current.journal;
    const pageRead = { page: finished.page, date: deviceLocalDate(latest.current.clock()) };
    try {
      const after = addPageToJournal(before, pageRead);
      latest.current.recordInStore(pageRead);
      latest.current.journal = after;
      return readingFeedback({
        before,
        after,
        settings: latest.current.settings,
        today: pageRead.date,
        hizbPageRanges: quranStructure.hizbPageRanges(),
      });
    } catch (error) {
      // A clock far off, or a damaged journal: the page is not recorded, the reading goes on.
      console.error(`Page ${finished.page} could not be recorded.`, error);
      return null;
    }
  }, []);

  const changePage = useCallback(
    (next: number) => {
      assertPageNumber(next);
      if (visit.current?.page === next) return;
      const told = endVisit();
      visit.current = startVisit(
        next,
        latest.current.monotonicClock(),
        isForeground(AppState.currentState),
      );
      setFeedback(told);
      setPage(next);
    },
    [endVisit],
  );

  useEffect(() => {
    rememberOpenedPage(page);
  }, [page]);

  // Only the time with the app in the foreground counts.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const current = visit.current;
      if (current === null) return;
      const now = latest.current.monotonicClock();
      visit.current = isForeground(state) ? resumeVisit(current, now) : pauseVisit(current, now);
    });
    return () => subscription.remove();
  }, []);

  // Leaving the reader ends the visit of the page on screen. A remount (React's strict mode
  // does one in development) starts a new visit of the same page.
  useEffect(() => {
    visit.current ??= startVisit(
      latest.current.page,
      latest.current.monotonicClock(),
      isForeground(AppState.currentState),
    );
    return () => {
      endVisit();
      visit.current = null;
    };
  }, [endVisit]);

  const toggleBars = useCallback(() => setBarsShown((shown) => !shown), []);

  return {
    model: {
      page,
      surah: quranStructure.firstVerseOfPage(page).surah,
      juz: quranStructure.juzOfPage(page),
      hizb: quranStructure.hizbOfPage(page),
      barsVisible: areBarsShown || isScreenReaderRunning,
      feedback,
    },
    actions: { changePage, toggleBars },
  };
}
