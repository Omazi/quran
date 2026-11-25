import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { quranStructure } from '@/data/quran';
import { recordPageRead as addPageToJournal, type ReadingJournal } from '@/domain/khatm';
import { assertPageNumber } from '@/domain/quran';
import { deviceLocalDate, type Clock, type HomeSettings } from '@/features/home';
import { useReaderPresence } from '@/features/profile';
import { READER_TEXT_SIZE_RANGE, useAppStore, type ReaderScript } from '@/store';

import { READER_CONFIG } from './config';
import { readingFeedback, type ReadingFeedback } from './reading-feedback';
import { readingPlace, type SegmentExtent, type Viewport } from './reading-place';
import {
  createReadingTracker,
  observeReading,
  type ReadingTracker,
  type SectionExtent,
} from './scroll-reading';
import { useScreenReader } from './use-screen-reader';

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
  /** What to tell the person about the page that just counted, or null. */
  readonly feedback: ReadingFeedback | null;
  /** The script shown (D41), remembered by the store. */
  readonly script: ReaderScript;
  /** The step of the reader's text size control, and the factor it applies. */
  readonly textSizeStep: number;
  readonly textScale: number;
  readonly canEnlargeText: boolean;
  readonly canShrinkText: boolean;
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
  { monotonicClock = systemMonotonicClock, clock = systemClock }: ReaderDependencies = {},
): { model: ReaderModel; actions: ReaderActions } {
  assertPageNumber(initialPage);
  const [place, setPlace] = useState(() => ({
    page: initialPage,
    surah: quranStructure.firstVerseOfPage(initialPage).surah,
  }));
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
  const lastOpenedPage = useAppStore((state) => state.settings.lastOpenedPage);
  const rememberOpenedPage = useAppStore((state) => state.setLastOpenedPage);
  const bookmarks = useAppStore((state) => state.settings.bookmarks);
  const toggleBookmarkInStore = useAppStore((state) => state.toggleBookmark);
  const script = useAppStore((state) => state.settings.readerScript);
  const setScriptInStore = useAppStore((state) => state.setReaderScript);
  const textSizeStep = useAppStore((state) => state.settings.readerTextSize);
  const setTextSizeInStore = useAppStore((state) => state.setReaderTextSize);

  // Read when an observation records a page, which can be after the last render (on closing).
  const settings: HomeSettings = { dailyGoalPages, userSeed, lastOpenedPage, pauses };
  const latest = useRef({ journal, recordInStore, settings, monotonicClock, clock });
  useEffect(() => {
    latest.current = { journal, recordInStore, settings, monotonicClock, clock };
  });

  const tracker = useRef<ReadingTracker>(createReadingTracker());
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

  /** One look at the screen: credits the time, and records the pages that just counted. */
  const look = useCallback(
    (isAppInForeground: boolean): ReadingFeedback | null => {
      const { viewport, extents } = screen.current;
      if (viewport === null) return null;
      const result = observeReading(tracker.current, {
        now: latest.current.monotonicClock(),
        viewport,
        extents: extents.sections,
        isForeground: isAppInForeground,
      });
      tracker.current = result.tracker;
      let told: ReadingFeedback | null = null;
      for (const page of result.counted) told = recordPage(page) ?? told;
      return told;
    },
    [recordPage],
  );

  const tell = useCallback((told: ReadingFeedback | null) => {
    if (told !== null) setFeedback(told);
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
    // The time until a change belongs to the state that ends (`observeReading`).
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

  // Leaving the reader: the time until now counts, and the pages it completes are recorded.
  useEffect(
    () => () => {
      look(isForeground(AppState.currentState));
      tracker.current = createReadingTracker();
    },
    [look],
  );

  // The watered pill is brief (spec 3, deviation 64): the title of the page comes back.
  useEffect(() => {
    if (feedback === null) return;
    const timer = setTimeout(() => setFeedback(null), READER_CONFIG.feedbackSeconds * SECOND_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  const toggleBars = useCallback(() => setBarsShown((shown) => !shown), []);
  const toggleBookmark = useCallback(
    () => toggleBookmarkInStore(place.page),
    [place.page, toggleBookmarkInStore],
  );
  const enlargeText = useCallback(() => {
    if (textSizeStep < READER_TEXT_SIZE_RANGE.max) setTextSizeInStore(textSizeStep + 1);
  }, [setTextSizeInStore, textSizeStep]);
  const shrinkText = useCallback(() => {
    if (textSizeStep > READER_TEXT_SIZE_RANGE.min) setTextSizeInStore(textSizeStep - 1);
  }, [setTextSizeInStore, textSizeStep]);

  return {
    model: {
      page: place.page,
      surah: place.surah,
      juz: quranStructure.juzOfPage(place.page),
      hizb: quranStructure.hizbOfPage(place.page),
      barsVisible: areBarsShown || isScreenReaderRunning,
      isBookmarked: bookmarks.includes(place.page),
      feedback,
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
    },
  };
}
