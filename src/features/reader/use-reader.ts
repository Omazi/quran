import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { quranStructure } from '@/data/quran';
import {
  getCurrentKhatm,
  getTodayProgress,
  isPageRead,
  recordPageRead as addPageToJournal,
  requiredReadingSeconds,
  type ReadingJournal,
} from '@/domain/khatm';
import { assertPageNumber } from '@/domain/quran';
import { playHaptic } from '@/features/feedback';
import { deviceLocalDate, type Clock, type HomeSettings } from '@/features/home';
import { useReaderPresence } from '@/features/profile';
import { READER_TEXT_SIZE_RANGE, useAppStore, type ReaderScript } from '@/store';

import { READER_CONFIG } from './config';
import { threadStateOf, type ThreadState } from './page-thread';
import { pageWordCounts } from './page-words';
import { keepReadingProgress, keptReadingProgress } from './reading-memory';
import { readingFeedback, type ReadingFeedback } from './reading-feedback';
import { readingPlace, type SegmentExtent, type Viewport } from './reading-place';
import {
  createReadingTracker,
  observeReading,
  progressOf,
  type ReadingRules,
  type ReadingTracker,
  type SectionExtent,
} from './scroll-reading';
import { createThreadStore, type ThreadStore } from './thread-store';
import type { ReaderPaper } from './reader-paper';
import { useKeepReaderAwake } from './use-keep-reader-awake';
import { useReaderPaper } from './use-reader-paper';
import { useScreenReader } from './use-screen-reader';
import { useScriptTexts } from './use-script-texts';

/** What one look tells: the last page that counted in it, and where it ends on the screen. */
type Told = Omit<CountedPageEvent, 'sequence'>;

/** Milliseconds from a clock that never goes back, for the time spent on a page. */
export type MonotonicClock = () => number;

export interface ReaderDependencies {
  /** Defaults to `performance.now`. */
  readonly monotonicClock?: MonotonicClock;
  /** Gives the calendar day a page is recorded on. Defaults to the device clock. */
  readonly clock?: Clock;
}

/** Where the reader stands, and what the bars say about it. */
export interface ReaderModel {
  /** The page under the reading line (`reading-place.ts`). */
  readonly page: number;
  /** The surah under the reading line, then the juz and hizb of the page. */
  readonly surah: number;
  readonly juz: number;
  readonly hizb: number;
  readonly barsVisible: boolean;
  /** Whether the page under the reading line has a bookmark. */
  readonly isBookmarked: boolean;
  /** The last page that counted, for its drop and its pill; null before the first. */
  readonly counted: CountedPageEvent | null;
  /** The water threads of the pages, in the margin (`page-thread.ts`). */
  readonly threads: ThreadStore;
  /** The new pages of the day and the daily goal: the counter "5 / 8" of the bottom bar. */
  readonly today: { readonly pagesRead: number; readonly goalPages: number };
  /** The paper by day, the night page at night or in the dark appearance (`reader-paper.ts`). */
  readonly paper: ReaderPaper;
  /** The script shown (D41), remembered by the store. */
  readonly script: ReaderScript;
  /** The step of the reader's text size control, and the factor it applies. */
  readonly textSizeStep: number;
  readonly textScale: number;
  readonly canEnlargeText: boolean;
  readonly canShrinkText: boolean;
}

/**
 * A page that just counted (spec 3), told once: what to say about it, and where its page ends on
 * the screen, where its drop forms (null when its page is not on screen, as for pages followed by
 * the voice). Each has its own number, so the same words twice are two moments.
 */
export interface CountedPageEvent {
  readonly sequence: number;
  readonly feedback: ReadingFeedback;
  /** The end of the page, in points from the top of the scroll; null when off screen. */
  readonly pageEndOnScreen: number | null;
}

/** What the list of pages has measured, in the scroll's content, in points. */
export interface MeasuredExtents {
  readonly sections: readonly SectionExtent[];
  readonly segments: readonly SegmentExtent[];
}

export interface ReaderActions {
  /** The list reports what is on screen: on every scroll event, and when its layout changes. */
  readonly observe: (viewport: Viewport, extents: MeasuredExtents) => void;
  /** A tap on the text: hides or shows the bars. */
  readonly toggleBars: () => void;
  /** Bookmarks the page under the reading line, or removes its bookmark. */
  readonly toggleBookmark: () => void;
  readonly chooseScript: (script: ReaderScript) => void;
  readonly enlargeText: () => void;
  readonly shrinkText: () => void;
  /** Goes to a step of the text size directly (the track of the text size panel). */
  readonly chooseTextSize: (step: number) => void;
  /**
   * Pages a recitation followed from their first word to their last (spec 3b): they count, once,
   * without the reading time (the voice is the proof); the khatm module decides as for any page.
   */
  readonly countPagesReadAloud: (pages: readonly number[]) => void;
}

const SECOND_MS = 1000;
const NOTHING_MEASURED: MeasuredExtents = { sections: [], segments: [] };

const systemMonotonicClock: MonotonicClock = () => performance.now();
const systemClock: Clock = () => new Date();

function isForeground(state: AppStateStatus | string | null | undefined): boolean {
  return state === 'active';
}

function textScaleOf(step: number): number {
  const scale = READER_CONFIG.textSizeScales[step];
  if (scale === undefined) throw new RangeError(`No text size step ${step}.`);
  return scale;
}

/**
 * The reader's state and the 30-second rule for a continuous scroll (spec 3, D41). The list
 * reports what is on screen; `scroll-reading.ts` decides when a page section was seen long
 * enough; the page is then recorded through the store (`recordPageRead`) on the local day.
 * Whether the page was new to the khatma is the khatm module's answer (D8): the same pure
 * function tells the screen what the store will do, so the feedback names exactly what happened.
 */
export function useReader(
  initialPage: number,
  { monotonicClock = systemMonotonicClock, clock: givenClock }: ReaderDependencies = {},
): { model: ReaderModel; actions: ReaderActions } {
  assertPageNumber(initialPage);
  const clock = givenClock ?? systemClock;
  const [place, setPlace] = useState(() => ({
    page: initialPage,
    surah: quranStructure.firstVerseOfPage(initialPage).surah,
  }));
  const [areBarsShown, setBarsShown] = useState(true);
  const [counted, setCounted] = useState<CountedPageEvent | null>(null);
  const isScreenReaderRunning = useScreenReader();
  // The paper alone follows the check's pinned hour; the day a page is recorded on stays real.
  const paper = useReaderPaper(givenClock);
  // The time with the reader open is reading time (D37), counted at the root of the app.
  useReaderPresence();
  useKeepReaderAwake();

  const journal = useAppStore((state) => state.journal);
  const recordInStore = useAppStore((state) => state.recordPageRead);
  const dailyGoalPages = useAppStore((state) => state.settings.dailyGoalPages);
  const userSeed = useAppStore((state) => state.settings.userSeed);
  const pauses = useAppStore((state) => state.settings.pauses);
  const lastOpenedPage = useAppStore((state) => state.settings.lastOpenedPage);
  const rememberOpenedPage = useAppStore((state) => state.setLastOpenedPage);
  const bookmarks = useAppStore((state) => state.settings.bookmarks);
  const toggleBookmarkInStore = useAppStore((state) => state.toggleBookmark);
  const script = useAppStore((state) => state.settings.readerScript);
  const setScriptInStore = useAppStore((state) => state.setReaderScript);
  const textSizeStep = useAppStore((state) => state.settings.readerTextSize);
  const setTextSizeInStore = useAppStore((state) => state.setReaderTextSize);

  // The time a page asks grows with its words (spec 3), counted in the Uthmani text of the
  // mushaf's pages. Until they are known, no page counts.
  const uthmani = useScriptTexts('uthmani');
  const wordsOfPages = useMemo(
    () => (uthmani.status === 'ready' ? pageWordCounts(uthmani.textOf) : null),
    [uthmani],
  );
  const rules = useMemo<ReadingRules>(
    () => ({
      requiredSecondsOf: (page) => {
        const words = wordsOfPages?.[page - 1];
        return words === undefined
          ? Number.POSITIVE_INFINITY
          : requiredReadingSeconds(words, READER_CONFIG.readingTime);
      },
      flingScreensPerSecond: READER_CONFIG.flingScreensPerSecond,
    }),
    [wordsOfPages],
  );

  // Read when an observation records a page, which can be after the last render (on closing).
  const settings: HomeSettings = { dailyGoalPages, userSeed, lastOpenedPage, pauses };
  const latest = useRef({ journal, recordInStore, settings, monotonicClock, clock, rules, place });
  useEffect(() => {
    latest.current = { journal, recordInStore, settings, monotonicClock, clock, rules, place };
  });

  // The session starts from the time kept from earlier stays (`reading-memory.ts`).
  const tracker = useRef<ReadingTracker | null>(null);
  tracker.current ??= createReadingTracker(keptReadingProgress());
  const screen = useRef<{ viewport: Viewport | null; extents: MeasuredExtents }>({
    viewport: null,
    extents: NOTHING_MEASURED,
  });

  /** Records one page that just counted. Returns what to tell the person. */
  const recordPage = useCallback((page: number): ReadingFeedback | null => {
    const before: ReadingJournal = latest.current.journal;
    const pageRead = { page, date: deviceLocalDate(latest.current.clock()) };
    try {
      const after = addPageToJournal(before, pageRead);
      latest.current.recordInStore(pageRead);
      latest.current.journal = after;
      return readingFeedback({
        page,
        before,
        after,
        settings: latest.current.settings,
        today: pageRead.date,
        hizbPageRanges: quranStructure.hizbPageRanges(),
      });
    } catch (error) {
      // A clock far off, or a damaged journal: the page is not recorded, the reading goes on.
      console.error(`Page ${page} could not be recorded.`, error);
      return null;
    }
  }, []);

  /** Where the thread of a page stands (`page-thread.ts`), from the session and the journal. */
  const threadOf = useCallback((page: number): ThreadState => {
    const { journal: read, rules: current } = latest.current;
    const progress = tracker.current === null ? undefined : progressOf(tracker.current, page);
    return threadStateOf({
      isRead: isPageRead(read, getCurrentKhatm(read), page),
      progress,
      requiredMs: current.requiredSecondsOf(page) * SECOND_MS,
    });
  }, []);
  const [threads] = useState<ThreadStore>(() => createThreadStore());
  useEffect(() => threads.setSource(threadOf), [threadOf, threads]);

  /** One look at the screen: credits the time, and records the pages that just counted. */
  const look = useCallback(
    (isAppInForeground: boolean): Told | null => {
      const { viewport, extents } = screen.current;
      const current = tracker.current;
      if (viewport === null || current === null) return null;
      const result = observeReading(
        current,
        {
          now: latest.current.monotonicClock(),
          viewport,
          extents: extents.sections,
          isForeground: isAppInForeground,
        },
        latest.current.rules,
      );
      tracker.current = result.tracker;
      keepReadingProgress(result.tracker.pages);
      let told: Told | null = null;
      for (const page of result.counted) {
        const feedback = recordPage(page);
        if (feedback === null) continue;
        const section = extents.sections.find((extent) => extent.page === page);
        told = {
          feedback,
          pageEndOnScreen: section === undefined ? null : section.bottom - viewport.top,
        };
      }
      threads.refresh();
      return told;
    },
    [recordPage, threads],
  );

  const sequence = useRef(0);
  const tell = useCallback((told: Told | null) => {
    if (told === null) return;
    sequence.current += 1;
    setCounted({ sequence: sequence.current, ...told });
  }, []);

  const observe = useCallback(
    (viewport: Viewport, extents: MeasuredExtents) => {
      screen.current = { viewport, extents };
      tell(look(isForeground(AppState.currentState)));
      const next = readingPlace(extents.segments, viewport);
      if (next !== null) {
        setPlace((current) =>
          current.page === next.page && current.surah === next.surah ? current : next,
        );
      }
    },
    [look, tell],
  );

  // The page to resume is the page being read.
  useEffect(() => {
    rememberOpenedPage(place.page);
  }, [place.page, rememberOpenedPage]);

  // Only the time with the app in the foreground counts; a page read without scrolling counts
  // when its time is up.
  useEffect(() => {
    // The time until a change belongs to the state that ends (`observeReading`). A page whose
    // time is reached is recorded when the app leaves: iOS may end it there without warning.
    const subscription = AppState.addEventListener('change', (state) =>
      tell(look(isForeground(state))),
    );
    const tick = setInterval(
      () => tell(look(isForeground(AppState.currentState))),
      READER_CONFIG.trackingTickSeconds * SECOND_MS,
    );
    return () => {
      subscription.remove();
      clearInterval(tick);
    };
  }, [look, tell]);

  // The threads follow the journal (a page read elsewhere) and the time each page asks, once known.
  useEffect(() => {
    threads.refresh();
  }, [journal, rules, threads]);

  // Leaving the reader: the time until now counts, and the pages it completes are recorded.
  useEffect(
    () => () => {
      look(isForeground(AppState.currentState));
      tracker.current = createReadingTracker(keptReadingProgress());
    },
    [look],
  );

  const today = useMemo(() => {
    const progress = getTodayProgress(journal, deviceLocalDate(clock()), dailyGoalPages);
    return { pagesRead: progress.pagesRead, goalPages: progress.goalPages };
  }, [clock, dailyGoalPages, journal]);

  const countPagesReadAloud = useCallback(
    (pages: readonly number[]) => {
      let told: Told | null = null;
      for (const page of pages) {
        const current = tracker.current;
        if (current !== null) {
          const progress = progressOf(current, page);
          if (progress.counted) continue;
          const marked = new Map(current.pages).set(page, { ...progress, counted: true });
          tracker.current = { ...current, pages: marked };
          keepReadingProgress(marked);
        }
        const feedback = recordPage(page);
        // Followed by the voice, the page may be off screen: its drop starts in the clear text.
        if (feedback !== null) told = { feedback, pageEndOnScreen: null };
      }
      threads.refresh();
      tell(told);
    },
    [recordPage, tell, threads],
  );

  const toggleBars = useCallback(() => setBarsShown((shown) => !shown), []);
  const toggleBookmark = useCallback(() => {
    toggleBookmarkInStore(place.page);
    // A light impact complements the bookmark filling or emptying (playing-haptics.md › Impact;
    // › Best practices: short haptics for discrete events, complementing visual feedback). iOS
    // plays nothing when the person turned system haptics off (› Make haptics optional).
    playHaptic('light');
  }, [place.page, toggleBookmarkInStore]);
  const enlargeText = useCallback(() => {
    if (textSizeStep < READER_TEXT_SIZE_RANGE.max) setTextSizeInStore(textSizeStep + 1);
  }, [setTextSizeInStore, textSizeStep]);
  const shrinkText = useCallback(() => {
    if (textSizeStep > READER_TEXT_SIZE_RANGE.min) setTextSizeInStore(textSizeStep - 1);
  }, [setTextSizeInStore, textSizeStep]);
  const chooseTextSize = useCallback(
    (step: number) => {
      const bounded = Math.min(
        READER_TEXT_SIZE_RANGE.max,
        Math.max(READER_TEXT_SIZE_RANGE.min, step),
      );
      if (bounded !== textSizeStep) setTextSizeInStore(bounded);
    },
    [setTextSizeInStore, textSizeStep],
  );

  return {
    model: {
      page: place.page,
      surah: place.surah,
      juz: quranStructure.juzOfPage(place.page),
      hizb: quranStructure.hizbOfPage(place.page),
      barsVisible: areBarsShown || isScreenReaderRunning,
      isBookmarked: bookmarks.includes(place.page),
      counted,
      threads,
      today,
      paper,
      script,
      textSizeStep,
      textScale: textScaleOf(textSizeStep),
      canEnlargeText: textSizeStep < READER_TEXT_SIZE_RANGE.max,
      canShrinkText: textSizeStep > READER_TEXT_SIZE_RANGE.min,
    },
    actions: {
      observe,
      toggleBars,
      toggleBookmark,
      chooseScript: setScriptInStore,
      enlargeText,
      shrinkText,
      chooseTextSize,
      countPagesReadAloud,
    },
  };
}
