/**
 * Reading in the reader shows on the tabs (bug report of 25 November 2026: "j'ai lu 4 hizb et le
 * jardin, le compteur et les hasanat n'ont pas bougé"). The whole app, through expo-router and
 * the real store saved in the device storage: the reader on top of the tabs, its continuous
 * scroll (D41) and its reading rule (each page asks a time that grows with its words) driven by
 * the fake clock, then the "Jardin" and "Profil" tabs, which stay mounted under the native tabs
 * and must follow the store, and a restart of the app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { AppState } from 'react-native';

import { quranRepository, quranStructure } from '@/data/quran';
import { requiredReadingSeconds } from '@/domain/khatm';
import { deviceLocalDate } from '@/features/home';
import { setCamera } from '@/features/friends/test-support/camera';
import { freshAppDemoForTest } from '@/features/friends/test-support/demo';
import { STORED_DATA_KEY, STORED_DATA_VERSION } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { resetDeviceConditions, setDeviceConditions } from '@/ui/test-support/environment';

import { READER_CONFIG } from '../config';
import { pageWordCounts } from '../page-words';
import { forgetReadingProgress } from '../reading-memory';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-localization', () => ({
  getLocales: () => [
    {
      languageCode: 'fr',
      languageTag: 'fr',
      textDirection: 'ltr',
    },
  ],
}));
jest.mock('expo-notifications', () => ({
  ...jest
    .requireActual<typeof import('@/data/notifications/test-support/quiet-expo-notifications')>(
      '@/data/notifications/test-support/quiet-expo-notifications',
    )
    .loadQuietly(),
  // The root layout keeps the reminders scheduled and listens to taps: no system behind it here
  // (the same stubs as app-routes.test.tsx).
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined', granted: false })),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationCategoryAsync: jest.fn(async () => ({})),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponse: jest.fn(),
}));
jest.mock(
  'expo-camera',
  () =>
    jest.requireActual<typeof import('@/features/friends/test-support/camera')>(
      '@/features/friends/test-support/camera',
    ).fakeExpoCamera,
);
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hide: jest.fn(),
}));

/** Loading every route of the app takes more than Jest's five seconds. */
jest.setTimeout(60_000);

/** The scroll on screen, and the height given to each page section: one page fits whole. */
const SCROLL = { width: 390, height: 700 };
const PAGE_HEIGHT = 600;
const SECOND = 1000;
/** Pages of the first hizb, from the app's own structure. */
const FIRST_HIZB = quranStructure.hizbPageRanges()[0];

/** Puts on the device what a returning person has there, before the app opens. */
async function storeReturningPerson(journal: readonly object[] = []): Promise<void> {
  const settings = { ...createTestAppStore().getState().settings, onboardingCompleted: true };
  await AsyncStorage.setItem(
    STORED_DATA_KEY,
    JSON.stringify({ version: STORED_DATA_VERSION, settings, journal, timeSpent: {} }),
  );
}

/** The pages written in the device storage, once the writes have settled. */
async function storedPages(expectedCount: number): Promise<number[]> {
  const read = async () => {
    const raw = await AsyncStorage.getItem(STORED_DATA_KEY);
    if (raw === null) return [];
    return (JSON.parse(raw) as { journal: { page: number }[] }).journal.map(({ page }) => page);
  };
  for (let turn = 0; turn < 100; turn += 1) {
    if ((await read()).length === expectedCount) break;
  }
  return read();
}

function openApp(initialUrl = '/') {
  return renderRouter({ appDir: 'src/app', overrides: {} }, { initialUrl });
}

/** Words of each page, for the time each page asks (spec 3). */
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

function secondsAsked(page: number): number {
  return requiredReadingSeconds(words[page - 1] ?? 1, READER_CONFIG.readingTime);
}

/**
 * The scroll brings a page on screen, whole, as the layout of a phone would: its section gets its
 * place in the content (pages one under the other, from `firstPage`), then the scroll settles on it.
 */
async function scrollToPage(page: number, firstPage: number): Promise<void> {
  const top = (page - firstPage) * PAGE_HEIGHT;
  // The list learns its own size, as the platform tells it, and draws the pages it then needs.
  const list = await screen.findByTestId('reader-scroll');
  await fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, ...SCROLL } } });
  await fireEvent(list, 'contentSizeChange', SCROLL.width, 604 * PAGE_HEIGHT);
  // The cells the list drew before are laid out one under the other.
  for (let drawn = firstPage; drawn < page; drawn += 1) {
    const cell = screen.queryByTestId(`page-cell-${drawn}`);
    if (cell === null) continue;
    await fireEvent(cell, 'layout', {
      nativeEvent: {
        layout: {
          x: 0,
          y: (drawn - firstPage) * PAGE_HEIGHT,
          width: SCROLL.width,
          height: PAGE_HEIGHT,
        },
      },
    });
  }
  await stay(1);
  await fireEvent(await screen.findByTestId(`page-cell-${page}`), 'layout', {
    nativeEvent: { layout: { x: 0, y: top, width: SCROLL.width, height: PAGE_HEIGHT } },
  });
  await fireEvent.scroll(screen.getByTestId('reader-scroll'), {
    nativeEvent: {
      contentOffset: { x: 0, y: top },
      layoutMeasurement: SCROLL,
      contentSize: { width: SCROLL.width, height: 100_000 },
    },
  });
}

/** Time passes with the app in the foreground, every timer of the app running. */
async function stay(seconds: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(seconds * SECOND);
  });
}

async function closeReader(): Promise<void> {
  await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
}

/**
 * The hizb count of the home screen, as the living garden says it to VoiceOver ("Jardin, 1 hizb
 * sur 60, …"; "Terre nue, aucun hizb terminé" before the first): the home's sixty dots are gone
 * with the living home (maquette-wow).
 */
function homeHizbCount(text: string) {
  const label =
    text === '0 hizb sur 60'
      ? /^Terre nue, aucun hizb terminé/
      : new RegExp(`^Jardin[^,]*, ${text}`);
  return waitFor(() => {
    const garden = within(screen.getByTestId('home')).getAllByLabelText(label)[0]!;
    expect(garden).toBeOnTheScreen();
    return garden;
  });
}

function accessibilityLabelOf(testID: string): string {
  return String(screen.getByTestId(testID).props.accessibilityLabel);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  freshAppDemoForTest();
  setCamera('granted', 'granted');
  setDeviceConditions();
  // React Native's Jest mock makes the state a function; on a phone it is a string.
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  forgetReadingProgress();
  await storeReturningPerson();
});

afterEach(resetDeviceConditions);

/**
 * Gesture Handler binds the zoom's `enabled` shared value on the UI runtime, which Jest does not
 * have: under the fake clock of the router that binding runs, and the web shared value has no
 * listener API. Only that binding is skipped; every other worklet runs as in jest.setup.js. The
 * module is the one jest.setup.js mocked, already held by Gesture Handler, so it is patched in
 * place.
 */
const worklets = jest.requireMock<{ scheduleOnUI: (...args: never[]) => void }>(
  'react-native-worklets',
);
const scheduleOnUI = worklets.scheduleOnUI;
beforeAll(() => {
  worklets.scheduleOnUI = ((worklet: (...args: unknown[]) => unknown, ...args: unknown[]) =>
    (scheduleOnUI as (...all: unknown[]) => void)(
      (...inner: unknown[]) => {
        try {
          worklet(...inner);
        } catch (error) {
          const isListenerBinding =
            error instanceof TypeError && /(add|remove)Listener/.test(error.message);
          if (!isListenerBinding) throw error;
        }
      },
      ...args,
    )) as typeof worklets.scheduleOnUI;
});
afterAll(() => {
  worklets.scheduleOnUI = scheduleOnUI;
});

describe('pages read in the reader, seen on the tabs', () => {
  it('waters the garden, adds the hizb, and counts the pages and hasanat in the profile', async () => {
    expect(FIRST_HIZB).toBeDefined();
    const { firstPage, lastPage } = FIRST_HIZB!;
    const app = await openApp('/');
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(await homeHizbCount('0 hizb sur 60')).toBeOnTheScreen();
    expect(accessibilityLabelOf('home-today-pages')).toMatch(/0 page sur 5/);

    // The profile tab is visited once before reading: it stays mounted under the native tabs.
    await act(() => router.navigate('/profile'));
    await waitFor(() => expect(app.getPathname()).toBe('/profile'));
    expect(await screen.findByTestId('profile-stats-empty')).toBeOnTheScreen();
    await act(() => router.navigate('/'));

    // "Lire et arroser" opens the reader on the first page.
    await fireEvent.press(screen.getByTestId('home-read'));
    await waitFor(() => expect(app.getPathname()).toBe(`/reader/${firstPage}`));

    // The whole first hizb, each page on screen for the time it asks.
    for (let page = firstPage; page <= lastPage; page += 1) {
      await scrollToPage(page, firstPage);
      await stay(secondsAsked(page) + 1);
    }
    expect(screen.getByTestId('reader-feedback')).toBeOnTheScreen();
    await closeReader();
    await waitFor(() => expect(app.getPathname()).toBe('/'));

    const pageCount = lastPage - firstPage + 1;
    // The garden: one hizb, and the pages of the day.
    expect(await homeHizbCount('1 hizb sur 60')).toBeOnTheScreen();
    expect(accessibilityLabelOf('home-today-pages')).toMatch(
      new RegExp(`${pageCount} pages sur 5`),
    );

    // The profile, mounted before the reading, follows the store.
    await act(() => router.navigate('/profile'));
    await waitFor(() => expect(app.getPathname()).toBe('/profile'));
    // The figures of the profile, restyled on main (work/mk-profile): pages, hasanat, time.
    expect(
      within(await screen.findByTestId('profile-figure-pages')).getByText(`${pageCount}`),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('profile-hero-value')).toHaveTextContent(/[1-9]/);
    // The time is handed over to the store by batches of a minute (D37): some minutes are there.
    expect(screen.getByTestId('profile-figure-readingTime')).toHaveTextContent(/[1-9] min/);

    // Saved on the device (the next test opens the app on what is saved here).
    expect(await storedPages(pageCount)).toEqual(
      Array.from({ length: pageCount }, (_, index) => firstPage + index),
    );
  });

  it('counts nothing for pages flicked through faster than the rule', async () => {
    const app = await openApp('/');
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    await fireEvent.press(await screen.findByTestId('home-read'));
    await waitFor(() => expect(app.getPathname()).toBe('/reader/1'));
    for (let page = 1; page <= 12; page += 1) {
      await scrollToPage(page, 1);
      await stay(secondsAsked(page) / 3);
    }
    expect(screen.queryByTestId('reader-feedback')).toBeNull();
    await closeReader();
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(await homeHizbCount('0 hizb sur 60')).toBeOnTheScreen();
    expect(accessibilityLabelOf('home-today-pages')).toMatch(/0 page sur 5/);
  });

  it('finds the same garden after a restart, from what the reader saved', async () => {
    const { firstPage, lastPage } = FIRST_HIZB!;
    const today = deviceLocalDate(new Date());
    // What the first test found written on the device after reading the first hizb.
    await storeReturningPerson(
      Array.from({ length: lastPage - firstPage + 1 }, (_, index) => ({
        khatm: 1,
        page: firstPage + index,
        date: today,
      })),
    );
    const app = await openApp('/');
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(await homeHizbCount('1 hizb sur 60')).toBeOnTheScreen();
    expect(accessibilityLabelOf('home-today-pages')).toMatch(
      new RegExp(`${lastPage - firstPage + 1} pages sur 5`),
    );
  });
});
