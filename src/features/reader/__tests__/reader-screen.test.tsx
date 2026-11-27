/**
 * The reader on screen, in continuous vertical scroll (docs/specs/reader.md, sections 2, 3 and 5;
 * D41): the text of the script chosen, exactly as the repository gives it; the 30-second rule on
 * page sections, driven by a fake clock and fake measures through the real store; the bar that
 * follows the reading; the script and text size controls; the pill; the states.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, AppState } from 'react-native';

import { quranRepository, quranStructure } from '@/data/quran';
import type { GardenElementKind } from '@/domain/garden';
import { recordPageRead, EMPTY_JOURNAL, type ReadingJournal } from '@/domain/khatm';
import { PAGE_COUNT } from '@/domain/quran';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { deviceLocalDate } from '@/features/home';
import { AppStoreProvider, READER_TEXT_SIZE_RANGE, type AppStore } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { appColors, backdropGradients, palette, readerShapes } from '@/ui/tokens';
import {
  changeReducedMotion,
  renderOnIOS,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
} from '@/ui/test-support/environment';

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { requiredReadingSeconds } from '@/domain/khatm';

import { READER_CONFIG } from '../config';
import { playFeedback } from '../feedback-events';
import { pageWordCounts } from '../page-words';
import { forgetReadingProgress } from '../reading-memory';
import { READER_KEEP_AWAKE_TAG } from '../use-keep-reader-awake';
import { ReaderNotFound, ReaderScreen } from '../reader-screen';
import { SIMPLE_SCRIPT_FONT_FAMILY } from '../script-fonts';
import { createThreadStore } from '../thread-store';
import { useReader, type ReaderActions, type ReaderModel } from '../use-reader';
import { useRecitationFollow, type RecitationFollow } from '../use-recitation-follow';
import type { QuranFontStatus } from '../use-quran-font';
import { useScriptTexts } from '../use-script-texts';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  impactAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../feedback-events', () => ({ playFeedback: jest.fn() }));

// The system status bar batches its updates on timers that fake ones would hold: a stand-in that
// shows the style asked.
jest.mock('expo-status-bar', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    StatusBar: ({ style }: { style: string }) => <View testID={`status-bar-${style}`} />,
  };
});

const WIDTH = 390;
/** The height of the scroll on screen, in points. */
const HEIGHT = 700;
const SECOND = 1000;

let now = 0;
const monotonicClock = () => now;
const clock = () => new Date('2026-11-24T10:00:00');
const TODAY = deviceLocalDate(clock());

function Reader({ page, fontStatus = 'ready' }: { page: number; fontStatus?: QuranFontStatus }) {
  const { model, actions } = useReader(page, { monotonicClock, clock });
  const texts = useScriptTexts(model.script);
  const follow = useRecitationFollow({
    createEngine: startFollowing,
    uthmaniTextOf: null,
    onPagesFollowed: actions.countPagesReadAloud,
  });
  return (
    <ReaderScreen
      model={model}
      actions={actions}
      fontStatus={fontStatus}
      texts={texts}
      openContents={openContents}
      close={close}
      follow={follow}
    />
  );
}

const openContents = jest.fn();
const close = jest.fn();
/** The microphone asks for an engine: here none, the following itself is tested elsewhere. */
const startFollowing = jest.fn((): null => null);
const IDLE_FOLLOW: RecitationFollow = {
  status: 'idle',
  track: [],
  state: { next: 0, current: null, reread: null },
  target: null,
  rereadWord: null,
  subscribeToLevel: null,
  isHearing: false,
  heardWords: [],
  failure: null,
  start: jest.fn(),
  stop: jest.fn(),
};

async function openReader(store: AppStore, page: number, fontStatus?: QuranFontStatus) {
  const view = await render(
    <AppStoreProvider store={store}>
      <Reader page={page} fontStatus={fontStatus} />
    </AppStoreProvider>,
  );
  if (fontStatus === undefined || fontStatus === 'ready') {
    await waitFor(() => expect(screen.getByTestId(`page-section-${page}`)).toBeOnTheScreen());
  }
  return view;
}

/**
 * Gives a page section its place in the scroll's content, and its surah segments their place in
 * the section, as the layout would on a phone. Segments default to one filling the section.
 */
async function layOutPage(page: number, top: number, height: number, segments = [height]) {
  await fireEvent(screen.getByTestId(`page-cell-${page}`), 'layout', {
    nativeEvent: { layout: { x: 0, y: top, width: WIDTH, height } },
  });
  let segmentTop = 0;
  for (const [index, segmentHeight] of segments.entries()) {
    await fireEvent(screen.getByTestId(`page-${page}-segment-${index}`), 'layout', {
      nativeEvent: { layout: { x: 0, y: segmentTop, width: WIDTH, height: segmentHeight } },
    });
    segmentTop += segmentHeight;
  }
}

/** The person scrolls the text to this offset. */
async function scrollTo(top: number) {
  await fireEvent.scroll(screen.getByTestId('reader-scroll'), {
    nativeEvent: {
      contentOffset: { x: 0, y: top },
      layoutMeasurement: { width: WIDTH, height: HEIGHT },
      contentSize: { width: WIDTH, height: 100_000 },
    },
  });
}

/** The app goes to the background or comes back: every listener of the screen hears it. */
async function appBecomes(state: 'active' | 'background') {
  const handlers = jest
    .mocked(AppState.addEventListener)
    .mock.calls.filter(([event]) => event === 'change')
    .map(([, handler]) => handler as (next: string) => void);
  await act(async () => {
    for (const handler of handlers) handler(state);
  });
}

async function wait(seconds: number) {
  now += seconds * SECOND;
}

function readPages(pages: readonly number[]): ReadingJournal {
  return pages.reduce(
    (journal, page) => recordPageRead(journal, { page, date: TODAY }),
    EMPTY_JOURNAL,
  );
}

function pagesOf(store: AppStore): number[] {
  return store.getState().journal.map((entry) => entry.page);
}

/** Page `page` fits on screen with room to spare: both its edges are seen at once. */
async function showWholePage(page: number) {
  await layOutPage(page, 0, HEIGHT - 100);
  await scrollTo(0);
}

/** The longest a drop takes to form and fall (`dropTimings`). */
const LONGEST_DROP_MS =
  READER_CONFIG.drop.formMs +
  READER_CONFIG.drop.holdMs +
  READER_CONFIG.drop.fallBaseMs +
  READER_CONFIG.drop.fallExtraMaxMs;

/** Lets the drop that is falling land in the pill (the test runs on fake timers). */
async function letTheDropLand() {
  await act(async () => {
    jest.advanceTimersByTime(LONGEST_DROP_MS);
  });
}

/** Plays what the fake timers still hold (the pill leaving), then gives the real ones back. */
async function backToRealTimers() {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
}

/** The pages of hizb 1, where page 10 belongs: the pill counts them. */
const HIZB_1_PAGES =
  quranStructure.hizbPageRange(1).lastPage - quranStructure.hizbPageRange(1).firstPage + 1;

/** Words of each page, from the repository, for the time each page asks. */
let words: readonly number[] = [];
beforeAll(async () => {
  const bySurah = new Map<number, readonly string[]>();
  for (const { surah } of quranStructure.surahs) {
    bySurah.set(
      surah,
      (await quranRepository.getSurahVerses(surah)).map((verse) => verse.text),
    );
  }
  words = pageWordCounts(({ surah, verse }) => bySurah.get(surah)?.[verse - 1] ?? '');
});

/** The seconds a page asks before it counts (spec 3). */
function secondsAsked(page: number): number {
  return requiredReadingSeconds(words[page - 1] ?? 1, READER_CONFIG.readingTime);
}

beforeEach(async () => {
  now = 0;
  forgetReadingProgress();
  jest.mocked(AppState.addEventListener).mockClear();
  // React Native's Jest mock makes the state a function; on a device it is a string.
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  setDeviceConditions();
  await showLanguage('fr');
});

afterEach(resetDeviceConditions);

describe('a continuous vertical scroll, not a book (owner, 25 November 2026)', () => {
  it('opens with the page asked at the top, and remembers it as the page to resume', async () => {
    const store = createTestAppStore();
    await openReader(store, 293);
    const list = screen.getByTestId('reader-scroll');
    expect(list.props.horizontal).toBeFalsy();
    expect(list.props.pagingEnabled).toBeFalsy();
    expect(list.props.data[0].page).toBe(293);
    expect(store.getState().settings.lastOpenedPage).toBe(293);
  });

  it('is virtualised: it holds the pages from the one asked to the end, and draws a few', async () => {
    await openReader(createTestAppStore(), 293);
    const list = screen.getByTestId('reader-scroll');
    expect(list.props.data).toHaveLength(PAGE_COUNT - 293 + 1);
    expect(list.props.initialNumToRender).toBe(READER_CONFIG.list.initialSections);
    expect(list.props.windowSize).toBe(READER_CONFIG.list.windowSize);
    expect(screen.queryByTestId('page-section-400')).toBeNull();
  });

  it('adds the pages above when the reader nears the top, and keeps the place on a phone', async () => {
    await openReader(createTestAppStore(), 293);
    const list = screen.getByTestId('reader-scroll');
    expect(list.props.maintainVisibleContentPosition).toEqual({ minIndexForVisible: 0 });
    await layOutPage(293, 0, 1200);
    await scrollTo(10);
    expect(screen.getByTestId('reader-scroll').props.data[0].page).toBe(
      293 - READER_CONFIG.list.pagesAddedAbove,
    );
  });

  it('draws a surah header and the basmala where a surah begins, and the page number where a page ends', async () => {
    await openReader(createTestAppStore(), 293);
    const section = screen.getByTestId('page-section-293');
    expect(within(section).getByTestId('surah-header-18')).toBeOnTheScreen();
    expect(within(section).getByRole('header', { name: /سورة الكهف/ })).toBeOnTheScreen();
    const basmala = within(section).getByTestId('basmala');
    expect(basmala).toHaveTextContent((await quranRepository.getVerse('1:1')).text);
    // The mark between two pages names the page that comes (maquette-wow, `.pg-mark`).
    expect(within(section).getByTestId('page-footer-293')).toHaveTextContent('page 294');
    expect(within(section).getByTestId('page-footer-293')).toHaveProp(
      'accessibilityLabel',
      'Fin de la page 293',
    );
  });
});

describe('the text is exactly the source text (exigence absolue)', () => {
  it.each([1, 293, 604])('Uthmani, page %i: every verse is the repository text', async (page) => {
    await openReader(createTestAppStore(), page);
    const first = quranStructure.firstVerseOfPage(page);
    const last = quranStructure.lastVerseOfPage(page);
    for (let surah = first.surah; surah <= last.surah; surah += 1) {
      const verses = await quranRepository.getSurahVerses(surah);
      for (const verse of verses) {
        if (quranStructure.pageOfVerse(verse) !== page) continue;
        expect(screen.getByTestId(`verse-${verse.key}`).props.children).toBe(verse.text);
      }
    }
  });

  it('in the King Fahd font, with each verse mark in the ornament colour', async () => {
    await openReader(createTestAppStore(), 1);
    const paragraph = screen.getByTestId('verses-1-1');
    expect(styleOf(paragraph)).toMatchObject({ fontFamily: 'KFGQPCHafsUthmanic' });
    expect(paragraph.props.accessibilityLanguage).toBe('ar');
    expect(paragraph.props.dynamicTypeRamp).toBe('title1');
  });

  it('simple script, page 293: every verse is the imla’i text, in the simple font', async () => {
    const store = createTestAppStore({ settings: { readerScript: 'imlaei' } });
    await openReader(store, 293);
    const verses = await quranRepository.getSurahVerses(18, 'imlaei');
    for (const verse of verses.slice(0, 4)) {
      expect(screen.getByTestId(`verse-${verse.key}`).props.children).toBe(verse.text);
    }
    expect(styleOf(screen.getByTestId('verses-18-1'))).toMatchObject({
      fontFamily: SIMPLE_SCRIPT_FONT_FAMILY,
    });
    expect(screen.getByTestId('basmala')).toHaveTextContent(
      (await quranRepository.getVerse('1:1', 'imlaei')).text,
    );
  });
});

describe('a page counts once its section was seen long enough (spec 3, D8, D41)', () => {
  it('a page seen whole for 30 seconds is recorded on the local day, and the pill says so', async () => {
    const store = createTestAppStore();
    await openReader(store, 10);
    jest.useFakeTimers();
    try {
      await showWholePage(10);
      await wait(secondsAsked(10));
      await scrollTo(1);
      expect(store.getState().journal).toEqual([{ khatm: 1, page: 10, date: TODAY }]);
      // The drop falls: the pill names what it waters, with the count before the page.
      const pill = () => screen.getByTestId('reader-feedback-content');
      expect(pill()).toHaveProp(
        'accessibilityLabel',
        `Une goutte pour les canaux, 0 page sur ${HIZB_1_PAGES} du hizb 1`,
      );
      await letTheDropLand();
      expect(pill()).toHaveProp(
        'accessibilityLabel',
        `Les canaux ont avancé, 1 page sur ${HIZB_1_PAGES} du hizb 1`,
      );
      await act(async () => {
        jest.advanceTimersByTime(READER_CONFIG.dropPill.visibleSeconds * SECOND);
      });
    } finally {
      await backToRealTimers();
    }
  });

  it('tells VoiceOver too, once the drop has landed', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    // React Native's mock keeps the calls of earlier tests.
    announce.mockClear();
    await openReader(createTestAppStore(), 10);
    jest.useFakeTimers();
    try {
      await showWholePage(10);
      await wait(secondsAsked(10));
      await scrollTo(1);
      expect(announce).not.toHaveBeenCalled();
      await letTheDropLand();
      expect(announce).toHaveBeenLastCalledWith(
        `Les canaux ont avancé, 1 page sur ${HIZB_1_PAGES} du hizb 1`,
      );
    } finally {
      await backToRealTimers();
    }
  });

  it('pages flung past are not recorded, and nothing is said', async () => {
    const store = createTestAppStore();
    await openReader(store, 10);
    await layOutPage(10, 0, 900);
    await layOutPage(11, 900, 900);
    await layOutPage(12, 1800, 900);
    await scrollTo(0);
    await wait(5);
    // Past the end of page 10, all of page 11 and the top of page 12 in a tenth of a second.
    now += 100;
    await scrollTo(2000);
    await wait(60);
    await scrollTo(2000);
    expect(pagesOf(store)).toEqual([]);
    expect(screen.queryByTestId('reader-feedback', { includeHiddenElements: true })).toBeNull();
  });

  it('a page whose end never came on screen is not recorded, however long', async () => {
    const store = createTestAppStore();
    await openReader(store, 10);
    await layOutPage(10, 0, 3000);
    await scrollTo(0);
    await wait(600);
    await scrollTo(10);
    expect(pagesOf(store)).toEqual([]);
  });

  it('time in the background does not count', async () => {
    const store = createTestAppStore();
    await openReader(store, 10);
    await showWholePage(10);
    const half = secondsAsked(10) / 2 - 1;
    await wait(half);
    await appBecomes('background');
    await wait(600);
    await appBecomes('active');
    await wait(half);
    await scrollTo(1);
    expect(pagesOf(store)).toEqual([]);
  });

  it('records a page whose time is reached when the app goes to the background', async () => {
    const store = createTestAppStore();
    await openReader(store, 10);
    await showWholePage(10);
    await wait(secondsAsked(10));
    // iOS may end the app in the background without warning: no later look would record it.
    await appBecomes('background');
    expect(pagesOf(store)).toEqual([10]);
    await appBecomes('active');
    await wait(secondsAsked(10));
    await scrollTo(1);
    expect(pagesOf(store)).toEqual([10]);
  });

  it('adds up the time of a page across stays: leaving the reader and coming back', async () => {
    const store = createTestAppStore();
    const half = secondsAsked(10) / 2 + 1;
    const first = await openReader(store, 10);
    await showWholePage(10);
    await wait(half);
    await scrollTo(1);
    await first.unmount();
    expect(pagesOf(store)).toEqual([]);
    // Away from the reader for an hour: that time never counts.
    await wait(3600);
    await openReader(store, 10);
    await showWholePage(10);
    await wait(half);
    await scrollTo(1);
    expect(pagesOf(store)).toEqual([10]);
  });

  it('asks a short page less time than a long one, never less than the minimum', () => {
    const { minimumSeconds } = READER_CONFIG.readingTime;
    expect(secondsAsked(1)).toBe(minimumSeconds);
    expect(secondsAsked(10)).toBeGreaterThan(secondsAsked(604));
  });

  it('a page already read in the khatma changes nothing, and says nothing', async () => {
    const store = createTestAppStore({ journal: readPages([10]) });
    const journal = store.getState().journal;
    await openReader(store, 10);
    await showWholePage(10);
    await wait(60);
    await scrollTo(1);
    expect(store.getState().journal).toBe(journal);
    expect(screen.queryByTestId('reader-feedback')).toBeNull();
  });

  it('leaving the reader records a page seen long enough', async () => {
    const store = createTestAppStore();
    const view = await openReader(store, 604);
    await showWholePage(604);
    await wait(secondsAsked(604));
    await view.unmount();
    expect(pagesOf(store)).toEqual([604]);
  });

  it('names the new element of the garden when the page completes a hizb', async () => {
    const lastPage = quranStructure.hizbPageRange(1).lastPage;
    const firstPages = Array.from({ length: lastPage - 1 }, (_, index) => index + 1);
    const store = createTestAppStore({ journal: readPages(firstPages) });
    await openReader(store, lastPage);
    jest.useFakeTimers();
    try {
      await showWholePage(lastPage);
      await wait(secondsAsked(lastPage));
      await scrollTo(1);
      await letTheDropLand();
      expect(screen.getByTestId('reader-feedback-content').props.accessibilityLabel).toMatch(
        /^Hizb 1 terminé, Nouveau dans ton jardin : \S/,
      );
    } finally {
      await backToRealTimers();
    }
  });
});

describe('the glass title follows the reading (maquette-wow, shots 14 to 16)', () => {
  it('names the surah under the reading line and its page; VoiceOver hears the juz and hizb', async () => {
    await openReader(createTestAppStore(), 293);
    // Page 293: the end of Al-Isra (400 points), then Al-Kahf (800 points).
    await layOutPage(293, 0, 1200, [400, 800]);
    await scrollTo(0);
    const title = () => within(screen.getByTestId('reader-header')).getByRole('header');
    expect(within(title()).getByText('Al-Isra')).toBeOnTheScreen();
    expect(within(title()).getByText('page 293')).toBeOnTheScreen();
    expect(title()).toHaveProp('accessibilityLabel', 'Al-Isra, juz 15, hizb 30, page 293');
    await scrollTo(400);
    expect(within(title()).getByText('Al-Kahf')).toBeOnTheScreen();
  });

  it('remembers the page being read as the page to resume', async () => {
    const store = createTestAppStore();
    await openReader(store, 293);
    await layOutPage(293, 0, 1200);
    await layOutPage(294, 1200, 1200);
    await scrollTo(1200);
    expect(store.getState().settings.lastOpenedPage).toBe(294);
  });

  it('goes back with the leading button', async () => {
    close.mockClear();
    await openReader(createTestAppStore(), 293);
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('bookmarks the page being read, and says so to VoiceOver', async () => {
    const store = createTestAppStore();
    await openReader(store, 293);
    const bookmark = () => screen.getByRole('button', { name: 'Marque-page' });
    expect(bookmark().props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(bookmark());
    expect(store.getState().settings.bookmarks).toEqual([293]);
    expect(bookmark().props.accessibilityState).toMatchObject({ selected: true });
    expect(
      screen.getByTestId('reader-bookmark-symbol-filled', { includeHiddenElements: true }),
    ).toBeTruthy();
    await fireEvent.press(bookmark());
    expect(store.getState().settings.bookmarks).toEqual([]);
  });

  it('answers each bookmark toggle with a light tap', async () => {
    jest.mocked(Haptics.impactAsync).mockClear();
    const store = createTestAppStore();
    await openReader(store, 293);
    await fireEvent.press(screen.getByRole('button', { name: 'Marque-page' }));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith(Haptics.ImpactFeedbackStyle.Light);
    await fireEvent.press(screen.getByRole('button', { name: 'Marque-page' }));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
  });

  it('floats its controls in glass over the paper, each 44 points to touch', async () => {
    setDeviceConditions({ os: 'android' });
    await openReader(createTestAppStore(), 293);
    expect(styleOf(screen.getByTestId('reader-page'))).toMatchObject({
      backgroundColor: backdropGradients.readerPage.light[1]?.[1],
    });
    for (const name of ['Retour', 'Marque-page', 'Taille du texte']) {
      const button = screen.getByRole('button', { name });
      expect(Number(styleOf(button).width)).toBeGreaterThanOrEqual(44);
      expect(Number(styleOf(button).height)).toBeGreaterThanOrEqual(44);
    }
    // The text runs the full height of the screen, under the controls, and fades under them.
    expect(screen.getByTestId('reader-fade-top')).toBeTruthy();
    expect(screen.getByTestId('reader-fade-bottom')).toBeTruthy();
  });

  it('a tap on the text hides the bars and keeps their room; another shows them again', async () => {
    await openReader(createTestAppStore(), 20);
    await fireEvent.press(screen.getByTestId('page-section-20'));
    const header = screen.getByTestId('reader-header', { includeHiddenElements: true });
    expect(within(header).queryByRole('button', { name: 'Retour' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Réciter, suivi par l’appli' })).toBeNull();
    expect(styleOf(header)).toMatchObject({ opacity: 0 });
    expect(styleOf(header).minHeight).toBeGreaterThan(0);
    // The bottom bar hides with it; the text does not move: the controls float over it.
    expect(
      styleOf(screen.getByTestId('reader-bottom-bar', { includeHiddenElements: true })),
    ).toMatchObject({ opacity: 0 });
    await fireEvent.press(screen.getByTestId('page-section-20'));
    expect(screen.getByRole('button', { name: 'Retour' })).toBeOnTheScreen();
  });
});

describe('the bottom bar: today’s water, script, microphone (maquette-wow, shots 14, 15)', () => {
  it('counts the new pages of the day toward the goal, the drop beside the number', async () => {
    const store = createTestAppStore({
      journal: readPages([1, 2, 3, 4, 5]),
      settings: { dailyGoalPages: 8 },
    });
    await openReader(store, 293);
    const today = screen.getByTestId('reader-today');
    expect(within(today).getByText('5', { includeHiddenElements: true })).toBeTruthy();
    expect(within(today).getByText('/8', { includeHiddenElements: true })).toBeTruthy();
    expect(today).toHaveProp('accessibilityLabel', 'Arrosage du jour : 5 pages sur 8');
  });

  it('starts following the recitation from the big green microphone (owner, 25 November 2026)', async () => {
    setDeviceConditions({ os: 'android' });
    await openReader(createTestAppStore(), 293);
    const microphone = screen.getByRole('button', { name: 'Réciter, suivi par l’appli' });
    expect(styleOf(microphone)).toMatchObject({ backgroundColor: palette.action.light });
    expect(Number(styleOf(microphone).width)).toBeGreaterThanOrEqual(44);
    // The Uthmani words are not given here: nothing starts (the following has its own tests).
    await fireEvent.press(microphone);
    expect(screen.queryByTestId('follow-bar')).toBeNull();
  });

  it('switches between Uthmani and Simple, remembers the choice, and shows the simple text', async () => {
    const store = createTestAppStore();
    await openReader(store, 293);
    const group = screen.getByTestId('reader-script');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe('Écriture');
    const uthmani = within(group).getByRole('radio', { name: 'Uthmani' });
    expect(uthmani.props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(within(group).getByRole('radio', { name: 'Simple' }));
    expect(store.getState().settings.readerScript).toBe('imlaei');
    const simple = (await quranRepository.getVerse('18:1', 'imlaei')).text;
    await waitFor(() => expect(screen.getByTestId('verse-18:1').props.children).toBe(simple));
    await fireEvent.press(screen.getByRole('radio', { name: 'Uthmani' }));
    expect(store.getState().settings.readerScript).toBe('uthmani');
  });

  it('keeps the page being read when the script changes, instead of going back to the page opened', async () => {
    const store = createTestAppStore();
    await openReader(store, 293);
    await layOutPage(293, 0, 1200);
    await layOutPage(294, 1200, 1200);
    await scrollTo(1200);
    expect(store.getState().settings.lastOpenedPage).toBe(294);

    await fireEvent.press(screen.getByRole('radio', { name: 'Simple' }));
    const simple = (await quranRepository.getVerse('18:10', 'imlaei')).text;
    await waitFor(() => expect(screen.getByTestId('page-section-294')).toBeOnTheScreen());
    // The scroll starts again at the page being read, in the simple text.
    expect(screen.queryByTestId('page-cell-293')).toBeNull();
    expect(screen.getByTestId('verse-18:10').props.children).toBe(simple);
  });

  it('names the two scripts in Arabic too', async () => {
    await showLanguage('ar');
    await openReader(createTestAppStore(), 293);
    expect(screen.getByRole('radio', { name: 'عثماني' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'إملائي' })).toBeOnTheScreen();
  });

  it('opens the text size under the "Aa" button, and closes it with a tap on the text', async () => {
    await openReader(createTestAppStore(), 1);
    expect(screen.queryByTestId('reader-text-size-panel')).toBeNull();
    const aa = screen.getByRole('button', { name: 'Taille du texte' });
    await fireEvent.press(aa);
    expect(screen.getByTestId('reader-text-size-panel')).toBeOnTheScreen();
    expect(aa.props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByTestId('page-section-1'));
    expect(screen.queryByTestId('reader-text-size-panel')).toBeNull();
    // That tap only closed the panel: the controls are still there.
    expect(screen.getByRole('button', { name: 'Retour' })).toBeOnTheScreen();
  });

  it('goes to the step touched on the track', async () => {
    const store = createTestAppStore();
    await openReader(store, 1);
    await fireEvent.press(screen.getByRole('button', { name: 'Taille du texte' }));
    const track = screen.getByTestId('reader-text-size-track', { includeHiddenElements: true });
    await act(async () => {
      track.props.onResponderGrant({ nativeEvent: { locationX: readerShapes.sizeTrackWidth } });
    });
    expect(store.getState().settings.readerTextSize).toBe(READER_TEXT_SIZE_RANGE.max);
    await act(async () => {
      track.props.onResponderMove({ nativeEvent: { locationX: 0 } });
    });
    expect(store.getState().settings.readerTextSize).toBe(READER_TEXT_SIZE_RANGE.min);
  });

  it('makes the text larger and smaller within its range, and remembers it', async () => {
    const store = createTestAppStore();
    await openReader(store, 1);
    await fireEvent.press(screen.getByRole('button', { name: 'Taille du texte' }));
    const size = () => Number(styleOf(screen.getByTestId('verses-1-1')).fontSize);
    const before = size();
    await fireEvent.press(screen.getByRole('button', { name: 'Texte plus grand' }));
    expect(store.getState().settings.readerTextSize).toBe(2);
    expect(size()).toBeGreaterThan(before);
    expect(
      screen.getByRole('button', { name: 'Texte plus grand' }).props.accessibilityValue,
    ).toEqual({ text: 'Taille 3 sur 5' });
    await fireEvent.press(screen.getByRole('button', { name: 'Texte plus petit' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Texte plus petit' }));
    expect(store.getState().settings.readerTextSize).toBe(READER_TEXT_SIZE_RANGE.min);
    expect(size()).toBeLessThan(before);
  });

  it('dims the button at the end of the range, and it does nothing', async () => {
    const store = createTestAppStore({ settings: { readerTextSize: READER_TEXT_SIZE_RANGE.max } });
    await openReader(store, 1);
    await fireEvent.press(screen.getByRole('button', { name: 'Taille du texte' }));
    const larger = screen.getByRole('button', { name: 'Texte plus grand' });
    expect(larger.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(larger);
    expect(store.getState().settings.readerTextSize).toBe(READER_TEXT_SIZE_RANGE.max);
  });

  it('has one factor per step of the store', () => {
    expect(READER_CONFIG.textSizeScales).toHaveLength(
      READER_TEXT_SIZE_RANGE.max - READER_TEXT_SIZE_RANGE.min + 1,
    );
    expect(READER_CONFIG.textSizeScales[1]).toBe(1);
  });
});

describe('the drop and the glass pill: the moment a page counts (maquette-wow, shots 21, 22)', () => {
  /** Page 10 counts, its end on screen. */
  async function countPage10() {
    await showWholePage(10);
    await wait(secondsAsked(10));
    await scrollTo(1);
  }

  beforeEach(() => jest.mocked(playFeedback).mockClear());

  it('shows the pill at the bottom while one drop falls from the page, then says it was received', async () => {
    const store = createTestAppStore({ journal: readPages([1, 2, 3, 4]) });
    await openReader(store, 10);
    jest.useFakeTimers();
    try {
      await countPage10();
      // The drop forms at the end of the page's thread and falls; the counter still says 4.
      expect(screen.getByTestId('reader-drop')).toBeTruthy();
      expect(
        within(screen.getByTestId('reader-today')).getByText('4', { includeHiddenElements: true }),
      ).toBeTruthy();
      expect(playFeedback).toHaveBeenCalledTimes(1);
      expect(playFeedback).toHaveBeenLastCalledWith('drop');
      await letTheDropLand();
      expect(screen.queryByTestId('reader-drop')).toBeNull();
      expect(
        within(screen.getByTestId('reader-today')).getByText('5', { includeHiddenElements: true }),
      ).toBeTruthy();
      expect(screen.getByTestId('reader-feedback-content')).toHaveProp(
        'accessibilityLabel',
        `Les canaux ont avancé, 5 pages sur ${HIZB_1_PAGES} du hizb 1`,
      );
      expect(playFeedback).toHaveBeenCalledTimes(2);
      expect(playFeedback).toHaveBeenLastCalledWith('drop-received');
    } finally {
      await backToRealTimers();
    }
  });

  it('puts the pill above the bottom bar (owner’s decision, 27 November 2026)', async () => {
    await openReader(createTestAppStore(), 10);
    jest.useFakeTimers();
    try {
      await countPage10();
      const room = styleOf(screen.getByTestId('reader-feedback-room'));
      expect(room.bottom).toBeGreaterThan(0);
      expect(room.top).toBeUndefined();
    } finally {
      await backToRealTimers();
    }
  });

  it('is brief: it leaves a few seconds after the drop landed', async () => {
    await openReader(createTestAppStore(), 10);
    jest.useFakeTimers();
    try {
      await countPage10();
      await letTheDropLand();
      expect(screen.getByTestId('reader-feedback')).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(READER_CONFIG.dropPill.visibleSeconds * SECOND - 1);
      });
      expect(screen.getByTestId('reader-feedback')).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.queryByTestId('reader-feedback')).toBeNull();
    } finally {
      await backToRealTimers();
    }
  });

  it('has no drop with Reduce Motion: the pill says at once what was received, without moving', async () => {
    // The setting is read when the pill first asks for it, as on a phone where it is already on.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await openReader(createTestAppStore(), 10);
    await changeReducedMotion(true);
    await countPage10();
    expect(screen.queryByTestId('reader-drop')).toBeNull();
    expect(screen.getByTestId('reader-feedback-content')).toHaveProp(
      'accessibilityLabel',
      `Les canaux ont avancé, 1 page sur ${HIZB_1_PAGES} du hizb 1`,
    );
    expect(styleOf(screen.getByTestId('reader-feedback-motion')).transform).toBeUndefined();
    expect(playFeedback).toHaveBeenCalledTimes(1);
    expect(playFeedback).toHaveBeenLastCalledWith('drop-received');
  });

  it('floats in glass and takes no touch', async () => {
    await openReader(createTestAppStore(), 10);
    jest.useFakeTimers();
    try {
      await countPage10();
      expect(screen.getByTestId('reader-feedback-room').props.pointerEvents).toBe('none');
    } finally {
      await backToRealTimers();
    }
  });
});

describe('the water thread in the margin: this page is being counted (maquette-wow, shots 20 to 22)', () => {
  const thread = (page: number) =>
    screen.getByTestId(`page-thread-${page}`, { includeHiddenElements: true });
  const fill = (page: number) =>
    styleOf(screen.getByTestId(`page-thread-${page}-fill`, { includeHiddenElements: true }));
  const bead = (page: number) =>
    screen.queryByTestId(`page-thread-${page}-bead`, { includeHiddenElements: true });

  /** With Reduce Motion the thread is drawn as it is: its share can be read from its style. */
  async function openStill(store: AppStore, page: number) {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await openReader(store, page);
    await changeReducedMotion(true);
  }

  it('runs along each page, empty with its bead at the top before the page is read', async () => {
    await openStill(createTestAppStore(), 10);
    await layOutPage(10, 0, 3000);
    await scrollTo(0);
    expect(thread(10)).toBeTruthy();
    expect(fill(10).height).toBe('0%');
    expect(bead(10)).toBeTruthy();
  });

  it('fills by three still steps with Reduce Motion as the page gathers its time', async () => {
    await openStill(createTestAppStore(), 10);
    await layOutPage(10, 0, 3000);
    await scrollTo(0);
    await wait(secondsAsked(10) * 0.5);
    await scrollTo(1);
    await waitFor(() => expect(fill(10).height).toBe(`${(1 / 3) * 100}%`));
  });

  it('is full, its bead at the end, once the time is reached and before the page counts', async () => {
    const store = createTestAppStore();
    await openStill(store, 10);
    await layOutPage(10, 0, 3000);
    await scrollTo(0);
    await wait(secondsAsked(10) + 1);
    await scrollTo(2);
    // Its end not seen yet: nothing is recorded; the thread waits, full.
    expect(pagesOf(store)).toEqual([]);
    await waitFor(() => expect(fill(10).height).toBe('100%'));
    expect(bead(10)).toBeTruthy();
  });

  it('stays full, pale and still once the page counted, or for a page the khatma holds', async () => {
    await openStill(createTestAppStore({ journal: readPages([10]) }), 10);
    await showWholePage(10);
    expect(fill(10)).toMatchObject({ height: '100%', opacity: READER_CONFIG.thread.doneOpacity });
    expect(bead(10)).toBeNull();
  });

  it('follows the page that counts: done as soon as it is recorded', async () => {
    await openStill(createTestAppStore(), 10);
    await showWholePage(10);
    await wait(secondsAsked(10));
    await scrollTo(1);
    await waitFor(() => expect(bead(10)).toBeNull());
    expect(fill(10).opacity).toBe(READER_CONFIG.thread.doneOpacity);
  });

  it('says nothing to VoiceOver and takes no touch', async () => {
    await openReader(createTestAppStore(), 10);
    expect(thread(10).props.accessibilityElementsHidden).toBe(true);
    expect(thread(10).props.pointerEvents).toBe('none');
  });

  it('lies on the left, the outer margin of the Arabic lines, in every interface language', async () => {
    await showLanguage('ar');
    await openReader(createTestAppStore(), 10);
    expect(styleOf(screen.getByTestId('page-section-10'))).toMatchObject({ direction: 'ltr' });
    expect(Number(styleOf(thread(10)).left)).toBeLessThan(0);
  });
});

describe('the paper by day, the night page at night (owner, 27 November 2026)', () => {
  function ReaderAt({ hour }: { hour: number }) {
    const at = useCallback(() => new Date(2026, 10, 24, hour, 0), [hour]);
    const { model, actions } = useReader(10, { monotonicClock, clock: at });
    const texts = useScriptTexts(model.script);
    const follow = useRecitationFollow({
      createEngine: startFollowing,
      uthmaniTextOf: null,
      onPagesFollowed: actions.countPagesReadAloud,
    });
    return (
      <ReaderScreen
        model={model}
        actions={actions}
        fontStatus="ready"
        texts={texts}
        openContents={openContents}
        close={close}
        follow={follow}
      />
    );
  }

  async function openAt(hour: number) {
    await render(
      <AppStoreProvider store={createTestAppStore()}>
        <ReaderAt hour={hour} />
      </AppStoreProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('page-section-10')).toBeOnTheScreen());
  }

  const pageColor = () => styleOf(screen.getByTestId('reader-page')).backgroundColor;
  const firstVerse = quranStructure.firstVerseOfPage(10);
  const ink = () =>
    styleOf(screen.getByTestId(`verses-${firstVerse.surah}-${firstVerse.verse}`)).color;

  it('is the cream paper by day, the phone in its light appearance', async () => {
    setDeviceConditions({ os: 'android' });
    await openAt(10);
    expect(pageColor()).toBe(backdropGradients.readerPage.light[1]?.[1]);
    expect(ink()).toBe(appColors.ink.light);
    expect(screen.getByTestId('status-bar-dark')).toBeTruthy();
  });

  it('is the warm night page in the evening, even with the phone light', async () => {
    setDeviceConditions({ os: 'android' });
    await openAt(20);
    expect(pageColor()).toBe(backdropGradients.readerPage.dark[1]?.[1]);
    expect(ink()).toBe(appColors.ink.dark);
    // Light status bar text on the night page.
    expect(screen.getByTestId('status-bar-light')).toBeTruthy();
  });

  it('is the night page whenever the phone is dark', async () => {
    setDeviceConditions({ os: 'android', scheme: 'dark' });
    await openAt(10);
    expect(pageColor()).toBe(backdropGradients.readerPage.dark[1]?.[1]);
  });

  it('keeps every word of the night page in its night colour on an iPhone too', async () => {
    await openAt(20);
    // The phone is light: the reader fixes its own appearance, so the night ink is given as it is.
    expect(ink()).toBe(appColors.ink.dark);
  });
});

describe('the screen stays awake while reading (owner, 25 November 2026)', () => {
  it('holds the screen awake while the reader is open, and lets it go on leaving', async () => {
    jest.mocked(activateKeepAwakeAsync).mockClear();
    jest.mocked(deactivateKeepAwake).mockClear();
    const view = await openReader(createTestAppStore(), 10);
    await waitFor(() => expect(activateKeepAwakeAsync).toHaveBeenCalledWith(READER_KEEP_AWAKE_TAG));
    await view.unmount();
    await waitFor(() => expect(deactivateKeepAwake).toHaveBeenCalledWith(READER_KEEP_AWAKE_TAG));
  });

  it('lets it go in the background, and holds it again on coming back', async () => {
    await openReader(createTestAppStore(), 10);
    jest.mocked(activateKeepAwakeAsync).mockClear();
    jest.mocked(deactivateKeepAwake).mockClear();
    await appBecomes('background');
    await waitFor(() => expect(deactivateKeepAwake).toHaveBeenCalledTimes(1));
    await appBecomes('active');
    await waitFor(() => expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1));
  });
});

describe('what the pill names (owner, 25 November 2026; maquette-wow)', () => {
  const noActions: ReaderActions = {
    observe: jest.fn(),
    toggleBars: jest.fn(),
    toggleBookmark: jest.fn(),
    chooseScript: jest.fn(),
    enlargeText: jest.fn(),
    shrinkText: jest.fn(),
    chooseTextSize: jest.fn(),
    countPagesReadAloud: jest.fn(),
  };

  function pillFor(growingKind: GardenElementKind | null) {
    const model: ReaderModel = {
      page: 20,
      surah: 2,
      juz: 1,
      hizb: 2,
      barsVisible: true,
      isBookmarked: false,
      counted: {
        sequence: 1,
        pageEndOnScreen: null,
        feedback: {
          kind: 'page-counted',
          page: 20,
          growingKind,
          growth:
            growingKind === null ? null : { hizb: 3, pagesBefore: 3, pagesAfter: 4, pageCount: 10 },
          todayBefore: 1,
          todayAfter: 2,
        },
      },
      threads: createThreadStore(),
      today: { pagesRead: 2, goalPages: 5 },
      paper: 'day',
      script: 'uthmani',
      textSizeStep: 1,
      textScale: 1,
      canEnlargeText: true,
      canShrinkText: true,
    };
    return render(
      <AppStoreProvider store={createTestAppStore()}>
        <ReaderScreen
          model={model}
          actions={noActions}
          fontStatus="ready"
          texts={{ status: 'error' }}
          openContents={openContents}
          close={close}
          follow={IDLE_FOLLOW}
        />
      </AppStoreProvider>,
    );
  }

  const pill = () => screen.getByTestId('reader-feedback-content').props.accessibilityLabel;

  it.each([
    [
      'fr',
      'pomegranate',
      'Une goutte pour le grenadier, 3 pages sur 10 du hizb 3',
      'Le grenadier a grandi, 4 pages sur 10 du hizb 3',
    ],
    [
      'fr',
      'olive',
      'Une goutte pour l’olivier, 3 pages sur 10 du hizb 3',
      'L’olivier a grandi, 4 pages sur 10 du hizb 3',
    ],
    [
      'fr',
      'channels',
      'Une goutte pour les canaux, 3 pages sur 10 du hizb 3',
      'Les canaux ont avancé, 4 pages sur 10 du hizb 3',
    ],
    [
      'en',
      'roses',
      'A drop for the roses, 3 pages of 10 in hizb 3',
      'The roses grew, 4 pages of 10 in hizb 3',
    ],
    [
      'ar',
      'date-palm',
      'قطرة للنخلة، الصفحات: 3 من 10 · الحزب 3',
      'كبرت النخلة، الصفحات: 4 من 10 · الحزب 3',
    ],
  ] as const)(
    'in %s, names the %s with its own grammar',
    async (language, kind, falling, received) => {
      await showLanguage(language);
      // While the drop falls.
      const view = await pillFor(kind);
      expect(pill()).toBe(falling);
      await view.unmount();
      // Once it landed: with Reduce Motion the pill says it at once.
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await changeReducedMotion(true);
      await pillFor(kind);
      expect(pill()).toBe(received);
    },
  );

  it('waters the garden when nothing grows any more', async () => {
    await pillFor(null);
    expect(pill()).toBe('Une goutte pour ton jardin, 1 page aujourd’hui');
  });
});

describe('the states', () => {
  it('shows no text before the font of the script is ready', async () => {
    await openReader(createTestAppStore(), 12, 'loading');
    expect(screen.queryByTestId('reader-scroll')).toBeNull();
  });

  it('says the text is unavailable when the font cannot be loaded, and leads to the contents', async () => {
    await render(
      <AppStoreProvider store={createTestAppStore()}>
        <Reader page={12} fontStatus="failed" />
      </AppStoreProvider>,
    );
    expect(screen.getByText('Texte indisponible')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir le sommaire' }));
    expect(openContents).toHaveBeenCalled();
  });

  it('says a page that does not exist was not found', async () => {
    await render(<ReaderNotFound openContents={openContents} />);
    expect(screen.getByRole('header', { name: 'Page introuvable' })).toBeOnTheScreen();
    expect(
      screen.getByText('Le mushaf compte 604 pages. Choisis une page entre 1 et 604.'),
    ).toBeOnTheScreen();
  });

  it('gives every SwiftUI view a host on an iPhone', async () => {
    await renderOnIOS(<ReaderNotFound openContents={openContents} />);
  });
});
