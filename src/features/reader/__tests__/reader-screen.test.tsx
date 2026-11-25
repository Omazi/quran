/**
 * The reader on screen, in continuous vertical scroll (docs/specs/reader.md, sections 2, 3 and 5;
 * D41): the text of the script chosen, exactly as the repository gives it; the 30-second rule on
 * page sections, driven by a fake clock and fake measures through the real store; the bar that
 * follows the reading; the script and text size controls; the pill; the states.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
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
import { palette } from '@/ui/tokens';
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
import { pageWordCounts } from '../page-words';
import { forgetReadingProgress } from '../reading-memory';
import { READER_KEEP_AWAKE_TAG } from '../use-keep-reader-awake';
import { ReaderNotFound, ReaderScreen } from '../reader-screen';
import { SIMPLE_SCRIPT_FONT_FAMILY } from '../script-fonts';
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
      initialPage={page}
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
    expect(within(section).getByTestId('page-footer-293')).toHaveTextContent('293');
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
    await showWholePage(10);
    await wait(secondsAsked(10));
    await scrollTo(1);
    expect(store.getState().journal).toEqual([{ khatm: 1, page: 10, date: TODAY }]);
    expect(screen.getByTestId('reader-feedback')).toHaveTextContent(
      /^\+1 page, tes canaux avancent$/,
    );
  });

  it('tells VoiceOver too', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await openReader(createTestAppStore(), 10);
    await showWholePage(10);
    await wait(secondsAsked(10));
    await scrollTo(1);
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^\+1 page, tes canaux avancent$/));
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
    expect(screen.queryByText(/^\+1 page/)).toBeNull();
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
    await showWholePage(lastPage);
    await wait(secondsAsked(lastPage));
    await scrollTo(1);
    expect(screen.getByTestId('reader-feedback')).toHaveTextContent(
      /^Hizb terminé\. Nouveau dans ton jardin : \S/,
    );
  });
});

describe('the bar follows the reading (docs/design/mushaf.png)', () => {
  it('names the surah under the reading line, then the juz, the hizb and the page', async () => {
    await openReader(createTestAppStore(), 293);
    // Page 293: the end of Al-Isra (400 points), then Al-Kahf (800 points).
    await layOutPage(293, 0, 1200, [400, 800]);
    await scrollTo(0);
    const title = () => within(screen.getByTestId('reader-header')).getByRole('header');
    expect(within(title()).getByText('Al-Isra')).toBeOnTheScreen();
    expect(within(title()).getByText('Juz 15, Hizb 30 · Page 293')).toBeOnTheScreen();
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

  it('draws its round buttons white on the warm ground, 44 points to touch, the text on paper', async () => {
    setDeviceConditions({ os: 'android' });
    await openReader(createTestAppStore(), 293);
    expect(styleOf(screen.getByTestId('reader'))).toMatchObject({
      backgroundColor: palette.pageGround.light,
    });
    const back = screen.getByTestId('reader-back');
    expect(styleOf(back)).toMatchObject({ backgroundColor: palette.surface.light });
    const drawn = Number(styleOf(back).width);
    const slop = back.props.hitSlop as { top: number; bottom: number };
    expect(drawn + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
  });

  it('a tap on the text hides the bars and keeps their room; another shows them again', async () => {
    await openReader(createTestAppStore(), 20);
    await fireEvent.press(screen.getByTestId('page-section-20'));
    const header = screen.getByTestId('reader-header', { includeHiddenElements: true });
    expect(within(header).queryByRole('button', { name: 'Retour' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Réciter, suivi par l’appli' })).toBeNull();
    expect(styleOf(header)).toMatchObject({ opacity: 0 });
    expect(styleOf(header).minHeight).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('page-section-20'));
    expect(screen.getByRole('button', { name: 'Retour' })).toBeOnTheScreen();
  });
});

describe('the bottom bar: script, microphone, text size (mockup, D41)', () => {
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

  it('names the two scripts in Arabic too', async () => {
    await showLanguage('ar');
    await openReader(createTestAppStore(), 293);
    expect(screen.getByRole('radio', { name: 'عثماني' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'إملائي' })).toBeOnTheScreen();
  });

  it('makes the text larger and smaller within its range, and remembers it', async () => {
    const store = createTestAppStore();
    await openReader(store, 1);
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

describe('the watered pill, the moment of the reader (spec 3)', () => {
  it('shows under the title, white with words of water, never over the text', async () => {
    setDeviceConditions({ os: 'android' });
    await openReader(createTestAppStore(), 10);
    await showWholePage(10);
    await wait(secondsAsked(10));
    await scrollTo(1);
    const row = screen.getByTestId('reader-pill-row');
    const pill = within(row).getByTestId('reader-feedback');
    expect(within(screen.getByTestId('reader-header')).getByText('Al-Baqarah')).toBeOnTheScreen();
    expect(
      within(pill).getByTestId('reader-feedback-drop', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(styleOf(pill)).toMatchObject({ backgroundColor: palette.surface.light });
    expect(within(screen.getByTestId('reader-text')).queryByTestId('reader-feedback')).toBeNull();
  });

  it('keeps its row when there is nothing to say, so the text does not move when it comes', async () => {
    await openReader(createTestAppStore(), 10);
    expect(screen.queryByTestId('reader-feedback')).toBeNull();
    expect(styleOf(screen.getByTestId('reader-pill-row')).minHeight).toBeGreaterThan(0);
  });

  it('is brief: it leaves after a few seconds', async () => {
    await openReader(createTestAppStore(), 10);
    jest.useFakeTimers();
    try {
      await showWholePage(10);
      await wait(secondsAsked(10));
      await scrollTo(1);
      expect(screen.getByTestId('reader-feedback')).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(READER_CONFIG.feedbackSeconds * SECOND - 1);
      });
      expect(screen.getByTestId('reader-feedback')).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.queryByTestId('reader-feedback')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('appears without movement with Reduce Motion', async () => {
    // The setting is read when the pill first asks for it, as on a phone where it is already on.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await openReader(createTestAppStore(), 10);
    await changeReducedMotion(true);
    await showWholePage(10);
    await wait(secondsAsked(10));
    await scrollTo(1);
    await waitFor(() =>
      expect(styleOf(screen.getByTestId('reader-feedback-motion')).transform).toBeUndefined(),
    );
    expect(styleOf(screen.getByTestId('reader-feedback-motion')).opacity ?? 1).toBe(1);
  });
});

describe('the water line: this page is being counted (owner, 25 November 2026)', () => {
  const fillWidth = () =>
    Number(
      styleOf(screen.getByTestId('reader-page-progress-fill', { includeHiddenElements: true }))
        .width,
    );

  it('fills while the page gathers its time, then a drop says the page will count', async () => {
    await openReader(createTestAppStore(), 10);
    await layOutPage(10, 0, 3000);
    await scrollTo(0);
    const line = () => screen.getByTestId('reader-page-progress', { includeHiddenElements: true });
    expect(line()).toBeTruthy();
    await wait(secondsAsked(10) / 2);
    await scrollTo(1);
    // The fill follows with the system's timing (the steps are checked with Reduce Motion below).
    expect(
      screen.queryByTestId('reader-page-progress-drop', { includeHiddenElements: true }),
    ).toBeNull();
    await wait(secondsAsked(10));
    await scrollTo(2);
    // Its time is reached, its end not yet seen: the drop has settled; nothing is recorded yet.
    expect(
      screen.getByTestId('reader-page-progress-drop', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('says nothing to VoiceOver and covers no text', async () => {
    await openReader(createTestAppStore(), 10);
    await showWholePage(10);
    const line = screen.getByTestId('reader-page-progress', { includeHiddenElements: true });
    expect(line.props.accessibilityElementsHidden).toBe(true);
    expect(
      within(screen.getByTestId('reader-pill-row')).getByTestId('reader-page-progress', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('reader-text')).queryByTestId('reader-page-progress'),
    ).toBeNull();
  });

  it('is not there for a page already read in the khatma', async () => {
    await openReader(createTestAppStore({ journal: readPages([10]) }), 10);
    await showWholePage(10);
    await wait(5);
    await scrollTo(1);
    expect(
      screen.queryByTestId('reader-page-progress', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('gives way to the pill when the page counts', async () => {
    await openReader(createTestAppStore(), 10);
    await showWholePage(10);
    await wait(secondsAsked(10));
    await scrollTo(1);
    expect(screen.getByTestId('reader-feedback')).toBeOnTheScreen();
    expect(
      screen.queryByTestId('reader-page-progress', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('moves by three still steps with Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await openReader(createTestAppStore(), 10);
    await changeReducedMotion(true);
    await layOutPage(10, 0, 3000);
    await scrollTo(0);
    const { width, reducedMotionSteps } = READER_CONFIG.progressLine;
    await wait(secondsAsked(10) * 0.5);
    await scrollTo(1);
    // Half the time: the first of three steps, without animation.
    await waitFor(() => expect(fillWidth()).toBeCloseTo(width / reducedMotionSteps));
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

describe('what the pill names (owner, 25 November 2026)', () => {
  const noActions: ReaderActions = {
    observe: jest.fn(),
    toggleBars: jest.fn(),
    toggleBookmark: jest.fn(),
    chooseScript: jest.fn(),
    enlargeText: jest.fn(),
    shrinkText: jest.fn(),
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
      feedback: { kind: 'page-counted', growingKind },
      pageProgress: { kind: 'hidden' },
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
          fontStatus="loading"
          texts={{ status: 'loading' }}
          initialPage={20}
          openContents={openContents}
          close={close}
          follow={IDLE_FOLLOW}
        />
      </AppStoreProvider>,
    );
  }

  it.each([
    ['fr', 'pomegranate', '+1 page, ton grenadier grandit'],
    ['fr', 'channels', '+1 page, tes canaux avancent'],
    ['fr', 'fountain', '+1 page, ta fontaine prend forme'],
    ['en', 'roses', '+1 page, your roses are growing'],
    ['ar', 'date-palm', '+1 صفحة، النخلة في حديقتك تكبر'],
    ['ar', 'wall', '+1 صفحة، السور في حديقتك يرتفع'],
  ] as const)('in %s, names the %s with its own grammar', async (language, kind, text) => {
    await showLanguage(language);
    await pillFor(kind);
    expect(screen.getByTestId('reader-feedback')).toHaveTextContent(text);
  });

  it('waters the garden when nothing grows any more', async () => {
    await pillFor(null);
    expect(screen.getByTestId('reader-feedback')).toHaveTextContent(
      '+1 page, ton jardin est arrosé',
    );
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
