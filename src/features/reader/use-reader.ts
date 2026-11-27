import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { quranStructure } from '@/data/quran';
import {
  getCurrentKhatm,
  isPageRead,
  recordPageRead as addPageToJournal,
  requiredReadingSeconds,
  type ReadingJournal,
} from '@/domain/khatm';
import { assertPageNumber } from '@/domain/quran';
import { deviceLocalDate, type Clock, type HomeSettings } from '@/features/home';
import { useReaderPresence } from '@/features/profile';
import { READER_TEXT_SIZE_RANGE, useAppStore, type ReaderScript } from '@/store';

import { READER_CONFIG } from './config';
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
import { useKeepReaderAwake } from './use-keep-reader-awake';
import { useScreenReader } from './use-screen-reader';
import { useScriptTexts } from './use-script-texts';

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
  /** How far the page being read is from counting. */
  readonly pageProgress: PageCountProgress;
  /** The script shown (D41), remembered by the store. */
  readonly script: ReaderScript;
  /** The step of the reader's text size control, and the factor it applies. */
  readonly textSizeStep: number;
  readonly textScale: number;
  readonly canEnlargeText: boolean;
  readonly canShrinkText: boolean;
}

/**
 * How far the page being read is from counting (spec 3), for the water line under the title:
 * hidden for a page already read in the khatma or that just counted; filling while it gathers
 * time; ready (the drop) once its time is reached, before it counts.
 */
export type PageCountProgress =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'filling'; readonly share: number }
  | { readonly kind: 'ready' };

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
  /**
   * Pages a recitation followed from their first word to their last (spec 3b): they count, once,
   * without the reading time (the voice is the proof); the khatm module decides as for any page.
   */
  readonly countPagesReadAloud: (pages: readonly number[]) => void;
}

const SECOND_MS = 1000;
/** The water line moves by hundredths: finer would only render more often. */
const PROGRESS_STEPS = 100;
const HIDDEN: PageCountProgress = { kind: 'hidden' };
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
  const [pageProgress, setPageProgress] = useState<PageCountProgress>(HIDDEN);
  const isScreenReaderRunning = useScreenReader();
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

  /** Where the page being read stands, for the water line. */
  const progressOfPage = useCallback((page: number): PageCountProgress => {
    const current = tracker.current;
    if (current === null) return HIDDEN;
    const { journal: read } = latest.current;
    const progress = progressOf(current, page);
    if (progress.counted || isPageRead(read, getCurrentKhatm(read), page)) return HIDDEN;
    const requiredMs = latest.current.rules.requiredSecondsOf(page) * SECOND_MS;
    if (!Number.isFinite(requiredMs)) return HIDDEN;
    if (progress.creditedMs >= requiredMs) return { kind: 'ready' };
    const share = Math.floor((progress.creditedMs / requiredMs) * PROGRESS_STEPS) / PROGRESS_STEPS;
    return { kind: 'filling', share };
  }, []);

  const showProgressOf = useCallback(
    (page: number) => {
      const next = progressOfPage(page);
      setPageProgress((shown) =>
        shown.kind === next.kind &&
        (next.kind !== 'filling' || (shown.kind === 'filling' && shown.share === next.share))
          ? shown
          : next,
      );
    },
    [progressOfPage],
  );

  /** One look at the screen: credits the time, and records the pages that just counted. */
  const look = useCallback(
    (isAppInForeground: boolean): ReadingFeedback | null => {
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
      showProgressOf(next?.page ?? latest.current.place.page);
    },
    [look, showProgressOf, tell],
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
    const tick = setInterval(() => {
      tell(look(isForeground(AppState.currentState)));
      showProgressOf(latest.current.place.page);
    }, READER_CONFIG.trackingTickSeconds * SECOND_MS);
    return () => {
      subscription.remove();
      clearInterval(tick);
    };
  }, [look, showProgressOf, tell]);

  // Leaving the reader: the time until now counts, and the pages it completes are recorded.
  useEffect(
    () => () => {
      look(isForeground(AppState.currentState));
      tracker.current = createReadingTracker(keptReadingProgress());
    },
    [look],
  );

  // The watered pill is brief (spec 3, deviation 64): the title of the page comes back.
  useEffect(() => {
    if (feedback === null) return;
    const timer = setTimeout(() => setFeedback(null), READER_CONFIG.feedbackSeconds * SECOND_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  const isPlaceRead = useMemo(
    () => isPageRead(journal, getCurrentKhatm(journal), place.page),
    [journal, place.page],
  );

  const countPagesReadAloud = useCallback(
    (pages: readonly number[]) => {
      let told: ReadingFeedback | null = null;
      for (const page of pages) {
        const current = tracker.current;
        if (current !== null) {
          const progress = progressOf(current, page);
          if (progress.counted) continue;
          const marked = new Map(current.pages).set(page, { ...progress, counted: true });
          tracker.current = { ...current, pages: marked };
          keepReadingProgress(marked);
        }
        told = recordPage(page) ?? told;
      }
      tell(told);
    },
    [recordPage, tell],
  );

  const toggleBars = useCallback(() => setBarsShown((shown) => !shown), []);
  const toggleBookmark = useCallback(() => {
    toggleBookmarkInStore(place.page);
    // A light impact complements the bookmark filling or emptying (playing-haptics.md › Impact;
    // › Best practices: short haptics for discrete events, complementing visual feedback). iOS
    // plays nothing when the person turned system haptics off (› Make haptics optional).
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, [place.page, toggleBookmarkInStore]);
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
      // A page that counts, or that the journal already holds, hides the water line at once.
      pageProgress: isPlaceRead ? HIDDEN : pageProgress,
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
      countPagesReadAloud,
    },
  };
}
