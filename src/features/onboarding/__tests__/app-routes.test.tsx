import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { getLocales } from 'expo-localization';
import { getPermissionsAsync, PermissionStatus, requestPermissionsAsync } from 'expo-notifications';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';

import { DIRECTION_RESTART_KEY } from '@/features/settings';
import { REJECTED_DATA_KEY, RESET_NOTICE_KEY, STORED_DATA_KEY, STORED_DATA_VERSION } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import {
  iosAppColor,
  resetDeviceConditions,
  setDeviceConditions,
  type RenderedElement,
} from '@/ui/test-support/environment';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo', () => ({
  ...jest.requireActual<typeof import('expo')>('expo'),
  reloadAppAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));
jest.mock('expo-notifications', () => ({
  ...jest
    .requireActual<typeof import('@/data/notifications/test-support/quiet-expo-notifications')>(
      '@/data/notifications/test-support/quiet-expo-notifications',
    )
    .loadQuietly(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hide: jest.fn(),
}));

const WINDOW = { x: 0, y: 0, width: 390, height: 700 };
const LAST_PAGE = 12;

/** The first launch loads every route of the app: it needs more than Jest's five seconds. */
jest.setTimeout(30_000);

function setDeviceLanguage(languageCode: string): void {
  jest.mocked(getLocales).mockReturnValue([
    {
      languageCode,
      languageTag: languageCode,
      languageScriptCode: null,
      regionCode: null,
      languageRegionCode: null,
      currencyCode: null,
      currencySymbol: null,
      languageCurrencyCode: null,
      languageCurrencySymbol: null,
      decimalSeparator: null,
      digitGroupingSeparator: null,
      textDirection: languageCode === 'ar' ? 'rtl' : 'ltr',
      measurementSystem: null,
      temperatureUnit: null,
    },
  ]);
}

function setPermission(status: PermissionStatus, answer = status): void {
  const response = (value: PermissionStatus) => ({
    status: value,
    granted: value === PermissionStatus.GRANTED,
    canAskAgain: value === PermissionStatus.UNDETERMINED,
    expires: 'never' as const,
  });
  jest.mocked(getPermissionsAsync).mockResolvedValue(response(status));
  jest.mocked(requestPermissionsAsync).mockImplementation(async () => {
    jest.mocked(getPermissionsAsync).mockResolvedValue(response(answer));
    return response(answer);
  });
}

/** Puts on the device what a person with these settings would have there. */
async function store(settings: Record<string, unknown>): Promise<void> {
  const firstLaunch = createTestAppStore().getState().settings;
  await AsyncStorage.setItem(
    STORED_DATA_KEY,
    JSON.stringify({
      version: STORED_DATA_VERSION,
      settings: { ...firstLaunch, ...settings },
      journal: [],
    }),
  );
}

async function storedSettings(): Promise<Record<string, unknown>> {
  const raw = await AsyncStorage.getItem(STORED_DATA_KEY);
  if (raw === null) throw new Error('Nothing is stored.');
  return (JSON.parse(raw) as { settings: Record<string, unknown> }).settings;
}

/** Opens the app as the phone does: the real routes of `src/app`, at the given address. */
function openApp(initialUrl = '/') {
  return renderRouter({ appDir: 'src/app', overrides: {} }, { initialUrl });
}

function layOut(element: RenderedElement) {
  return fireEvent(element, 'layout', { nativeEvent: { layout: WINDOW } });
}

function pagerList(): RenderedElement {
  const lists = screen
    .getByTestId('onboarding-pager')
    .queryAll(({ type, props }) => type === 'RCTScrollView' && props.horizontal === true);
  if (lists[0] === undefined) throw new Error('The pager is not laid out yet.');
  return lists[0];
}

/** Gives the pager of the introduction its size, as the platform would. */
async function layOutIntroduction(): Promise<void> {
  const frame = (await screen.findByTestId('onboarding-pager')).children[0];
  if (frame === undefined || typeof frame === 'string') throw new Error('No pages frame.');
  await layOut(frame);
  await layOut(pagerList());
  await fireEvent(pagerList(), 'contentSizeChange', WINDOW.width * (LAST_PAGE + 1), WINDOW.height);
}

/** Swipes to a page: the list is scrolled until that page fills it. */
function swipeToPage(page: number) {
  return fireEvent.scroll(pagerList(), {
    nativeEvent: {
      contentOffset: { x: WINDOW.width * page, y: 0 },
      contentSize: { width: WINDOW.width * (LAST_PAGE + 1), height: WINDOW.height },
      layoutMeasurement: { width: WINDOW.width, height: WINDOW.height },
    },
  });
}

/**
 * What the app has written under a key, once its writes have settled. The writes are promises,
 * not renders: they are awaited here without `waitFor`, whose polling would overlap them.
 */
async function writtenUnder(key: string, expected: string | null): Promise<string | null> {
  for (let turn = 0; turn < 100; turn += 1) {
    if ((await AsyncStorage.getItem(key)) === expected) break;
  }
  return AsyncStorage.getItem(key);
}

function tabsHost(): RenderedElement {
  const host = screen.container.queryAll(({ type }) => type === 'RNSTabsHostIOS')[0];
  if (host === undefined) throw new Error('The tab bar is not on screen.');
  return host;
}

function tabs(): RenderedElement[] {
  return screen.container.queryAll(({ type }) => type === 'RNSTabsScreenIOS');
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  setDeviceLanguage('fr');
  setPermission(PermissionStatus.UNDETERMINED, PermissionStatus.GRANTED);
});

afterEach(resetDeviceConditions);

describe('first launch', () => {
  it('opens on the introduction, in the language of the device, once everything is ready', async () => {
    setDeviceLanguage('en');
    const app = await openApp();
    await layOutIntroduction();

    expect(app.getPathname()).toBe('/onboarding');
    expect(screen.getByRole('header', { name: 'Bare Earth' })).toBeOnTheScreen();
    expect(SplashScreen.hide).toHaveBeenCalled();
    // The seed is drawn and kept from the very first launch.
    expect(typeof (await storedSettings()).userSeed).toBe('number');
    expect((await storedSettings()).onboardingCompleted).toBe(false);
  });

  it('shows the garden of each page with the garden scene: it grows, dries, revives', async () => {
    await openApp();
    await layOutIntroduction();
    expect(screen.getByTestId('onboarding-pager-indicator')).toHaveAccessibilityValue({
      text: 'Page 1 sur 13',
    });
    const labels = screen
      .getAllByTestId('garden-scene')
      .map(({ props }) => String(props.accessibilityLabel));
    // The garden grows from the bare earth to hizb 40...
    expect(labels[0]).toMatch(/^Terre nue/);
    expect(labels[1]).toMatch(/^Jardin, 8 hizb sur 60/);
    expect(labels[4]).toMatch(/^Jardin, 40 hizb sur 60/);
    // ...and it is that garden in progress that dries, never the complete one.
    expect(labels[5]).toMatch(/^Jardin assoiffé, 40 hizb sur 60/);
    expect(labels[6]).toMatch(/^Jardin fané, 40 hizb sur 60/);
    expect(labels[7]).toMatch(/^Jardin mourant, 40 hizb sur 60/);
    expect(labels[8]).toMatch(/^Terre morte, 40 hizb sur 60 acquis/);
    // No page presents a feature the app does not have yet.
    expect(screen.queryByRole('image', { name: /voix haute|proches|Passage/ })).toBeNull();
  });

  it('gives no way out of the introduction but its last page: no header, no back swipe', async () => {
    await openApp();
    await layOutIntroduction();
    const header = screen.container.queryAll(({ type }) => type === 'RNSScreenStackHeaderConfig');
    expect(header.every(({ props }) => props.hidden === true)).toBe(true);
    const introduction = screen.container
      .queryAll(({ type }) => type === 'RNSScreen')
      .find(({ props }) => String(props.screenId).startsWith('onboarding'));
    expect(introduction).toHaveProp('gestureEnabled', false);
  });

  it('ends on the tabs after the last page, having asked for the permission to notify', async () => {
    const app = await openApp();
    await layOutIntroduction();
    await swipeToPage(LAST_PAGE);
    expect(await screen.findByRole('header', { name: 'Tes rappels' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(app.getSegments()).toEqual(['(tabs)']));
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(tabs()).toHaveLength(3);
    expect((await storedSettings()).onboardingCompleted).toBe(true);
  });

  it('ends on the tabs as well when the person refuses the notifications', async () => {
    setPermission(PermissionStatus.UNDETERMINED, PermissionStatus.DENIED);
    const app = await openApp();
    await layOutIntroduction();
    await swipeToPage(LAST_PAGE);
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(app.getSegments()).toEqual(['(tabs)']));
    expect((await storedSettings()).onboardingCompleted).toBe(true);
  });

  it('does not let a link into the tabs skip the introduction', async () => {
    const app = await openApp('/profile');
    await waitFor(() => expect(app.getPathname()).toBe('/onboarding'));
  });

  it('starts as a first launch, without crashing, when what is stored is corrupt', async () => {
    await AsyncStorage.setItem(STORED_DATA_KEY, '{"version":1,"settings":{"dailyGoalPages":9000}');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const app = await openApp();
    await layOutIntroduction();
    expect(app.getPathname()).toBe('/onboarding');
    expect(screen.getByRole('header', { name: 'Une terre nue' })).toBeOnTheScreen();
    expect((await storedSettings()).dailyGoalPages).toBe(5);
    warn.mockRestore();
  });
});

describe('returning person', () => {
  beforeEach(() => store({ onboardingCompleted: true }));

  it('opens on the tabs: Jardin, Coran, Profil, one word and one filled symbol each', async () => {
    const app = await openApp();
    await waitFor(() => expect(app.getSegments()).toEqual(['(tabs)']));

    expect(tabs().map(({ props }) => [props.title, props.icon])).toEqual([
      ['Jardin', { sf: 'leaf.fill' }],
      ['Coran', { sf: 'book.fill' }],
      ['Profil', { sf: 'person.crop.circle.fill' }],
    ]);
    // The selected tab takes the accent, and the bar the direction React Native runs in.
    expect(tabsHost()).toHaveProp('tabBarTintColor', iosAppColor('accent'));
    expect(tabsHost()).toHaveProp('layoutDirection', 'ltr');
    expect(tabsHost()).toHaveProp('tabBarHidden', undefined);
    expect(SplashScreen.hide).toHaveBeenCalled();
    expect(reloadAppAsync).not.toHaveBeenCalled();
  });

  // docs/specs/reader.md, section 1: the tab is the table of contents of the mushaf.
  it('finds the table of contents in the Quran tab', async () => {
    const app = await openApp('/quran');
    await waitFor(() => expect(app.getPathname()).toBe('/quran'));
    expect(screen.getByRole('header', { name: 'Coran' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reprendre, Al-Fatiha · Page 1' })).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^contents-surah-/)).toHaveLength(114);
  });

  it('opens the reader on a page', async () => {
    const app = await openApp('/reader/293');
    await waitFor(() => expect(app.getPathname()).toBe('/reader/293'));
    expect(screen.getByTestId('reader')).toBeOnTheScreen();
  });

  it('says when a page of the reader does not exist', async () => {
    const missing = await openApp('/reader/605');
    await waitFor(() => expect(missing.getPathname()).toBe('/reader/605'));
    expect(screen.getByText('Page introuvable')).toBeOnTheScreen();
  });

  it('finds the settings they made, and can change them', async () => {
    await store({ onboardingCompleted: true, dailyGoalPages: 12 });
    setPermission(PermissionStatus.GRANTED);
    const app = await openApp('/profile');
    await waitFor(() => expect(app.getPathname()).toBe('/profile'));
    expect(screen.getByRole('adjustable', { name: 'Pages par jour' })).toHaveAccessibilityValue({
      text: '12',
    });

    await fireEvent.press(screen.getByTestId('daily-goal-increment'));
    await waitFor(async () => expect((await storedSettings()).dailyGoalPages).toBe(13));
  });

  it('keeps the language they chose, whatever the language of the device', async () => {
    await store({ onboardingCompleted: true, language: 'en' });
    setDeviceLanguage('fr');
    await openApp('/profile');
    expect(await screen.findByRole('header', { name: 'Profile' })).toBeOnTheScreen();
    expect(tabs().map(({ props }) => props.title)).toEqual(['Garden', 'Quran', 'Profile']);
  });

  it('gets a mirrored tab bar and Arabic names when the app runs in Arabic', async () => {
    await store({ onboardingCompleted: true, language: 'ar' });
    setDeviceConditions({ rightToLeft: true });
    const app = await openApp();
    await waitFor(() => expect(app.getSegments()).toEqual(['(tabs)']));
    expect(tabs().map(({ props }) => props.title)).toEqual(['الحديقة', 'القرآن', 'الملف الشخصي']);
    expect(tabsHost()).toHaveProp('layoutDirection', 'rtl');
    expect(reloadAppAsync).not.toHaveBeenCalled();
  });

  it('can see the introduction again from the profile, with a back button, and finish it', async () => {
    setPermission(PermissionStatus.GRANTED);
    const app = await openApp('/profile');
    await fireEvent.press(await screen.findByRole('button', { name: 'Revoir la présentation' }));
    await waitFor(() => expect(app.getPathname()).toBe('/onboarding'));
    await layOutIntroduction();

    // Opened again, the introduction shows the system's header and its back button.
    const header = screen.container
      .queryAll(({ type }) => type === 'RNSScreenStackHeaderConfig')
      .find(({ props }) => props.title === 'Présentation');
    expect(header).toHaveProp('hidden', false);
    // The back button takes the accent of the app, not the system's blue.
    expect(header).toHaveProp('color', iosAppColor('accent'));

    // Opened again, the flow simply ends: "Terminé", and the system is asked nothing.
    await swipeToPage(LAST_PAGE);
    await fireEvent.press(await screen.findByRole('button', { name: 'Terminé' }));
    await waitFor(() => expect(app.getPathname()).toBe('/profile'));
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Profil' })).toBeOnTheScreen();
  });
});

describe('stored data that could not be read back', () => {
  /** Sound settings of a returning person, and a journal the app cannot trust. */
  async function storeDamagedJournal(): Promise<string> {
    const settings = { ...createTestAppStore().getState().settings, onboardingCompleted: true };
    const raw = JSON.stringify({ version: STORED_DATA_VERSION, settings, journal: 'damaged' });
    await AsyncStorage.setItem(STORED_DATA_KEY, raw);
    return raw;
  }

  it('shows no badge on any tab when all is well', async () => {
    await store({ onboardingCompleted: true });
    const app = await openApp();
    await waitFor(() => expect(app.getSegments()).toEqual(['(tabs)']));
    expect(tabs().map(({ props }) => props.badgeValue)).toEqual([undefined, undefined, undefined]);
  });

  it('marks the profile tab, says there what happened, and forgets it once read', async () => {
    const raw = await storeDamagedJournal();
    setPermission(PermissionStatus.GRANTED);
    const app = await openApp('/profile');
    await waitFor(() => expect(app.getPathname()).toBe('/profile'));

    // No alert at launch: a badge leads to the explanation, written in the profile.
    expect(tabs().map(({ props }) => props.badgeValue)).toEqual([undefined, undefined, '!']);
    expect(screen.getByRole('header', { name: 'À savoir' })).toBeOnTheScreen();
    expect(
      screen.getByText(/L’appli n’a pas pu relire ton journal de lecture\./),
    ).toBeOnTheScreen();
    // What could not be read is kept aside on the device, as it was.
    expect(await writtenUnder(REJECTED_DATA_KEY, raw)).toBe(raw);
    expect(await writtenUnder(RESET_NOTICE_KEY, 'journal')).toBe('journal');

    await fireEvent.press(screen.getByRole('button', { name: 'D’accord' }));
    await waitFor(() =>
      expect(tabs().map(({ props }) => props.badgeValue)).toEqual([
        undefined,
        undefined,
        undefined,
      ]),
    );
    expect(screen.queryByRole('header', { name: 'À savoir' })).toBeNull();
    expect(await writtenUnder(RESET_NOTICE_KEY, null)).toBeNull();
    expect(await AsyncStorage.getItem(REJECTED_DATA_KEY)).toBe(raw);
  });

  it('still says it at the next launch when the app was closed before it was read', async () => {
    await store({ onboardingCompleted: true });
    await AsyncStorage.setItem(RESET_NOTICE_KEY, 'settings');
    setPermission(PermissionStatus.GRANTED);
    const app = await openApp('/profile');
    await waitFor(() => expect(app.getPathname()).toBe('/profile'));
    expect(tabs().map(({ props }) => props.badgeValue)).toEqual([undefined, undefined, '!']);
    expect(screen.getByText(/L’appli n’a pas pu relire tes réglages\./)).toBeOnTheScreen();
  });
});

describe('links', () => {
  it('opened on the introduction once it is finished, ends on the tabs: nobody is stuck', async () => {
    await store({ onboardingCompleted: true });
    setPermission(PermissionStatus.GRANTED);
    const app = await openApp('/onboarding');
    await waitFor(() => expect(app.getPathname()).toBe('/onboarding'));
    await layOutIntroduction();
    await swipeToPage(LAST_PAGE);

    // There is no screen behind the introduction to go back to.
    await fireEvent.press(await screen.findByRole('button', { name: 'Terminé' }));
    await waitFor(() => expect(app.getSegments()).toEqual(['(tabs)']));
    expect(app.getPathname()).toBe('/');
    expect(tabs()).toHaveLength(3);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('explains an address that leads nowhere, and offers the way back to the garden', async () => {
    await store({ onboardingCompleted: true });
    const app = await openApp('/nowhere/at/all');
    expect(await screen.findByText('Cette page n’existe pas')).toBeOnTheScreen();
    expect(
      screen.getByText('Le lien que tu as suivi ne mène nulle part dans l’appli.'),
    ).toBeOnTheScreen();
    // The app's own words, not the router's "Unmatched Route" page, and no bare header.
    expect(screen.queryByText(/unmatched/i)).toBeNull();
    const header = screen.container
      .queryAll(({ type }) => type === 'RNSScreenStackHeaderConfig')
      .find(({ props }) => props.title === '+not-found');
    expect(header).toHaveProp('hidden', true);

    await fireEvent.press(screen.getByRole('button', { name: 'Revenir au jardin' }));
    await waitFor(() => expect(app.getSegments()).toEqual(['(tabs)']));
    expect(app.getPathname()).toBe('/');
  });

  it('explains it in the language of the person', async () => {
    await store({ onboardingCompleted: true, language: 'ar' });
    setDeviceConditions({ rightToLeft: true });
    await openApp('/nowhere');
    expect(await screen.findByText('هذه الصفحة غير موجودة')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'العودة إلى الحديقة' })).toBeOnTheScreen();
  });

  it('leads a person who has not seen the introduction to it, not past it', async () => {
    const app = await openApp('/nowhere');
    await fireEvent.press(await screen.findByRole('button', { name: 'Revenir au jardin' }));
    await waitFor(() => expect(app.getPathname()).toBe('/onboarding'));
  });
});

describe('writing direction at start-up', () => {
  it('restarts once, before showing anything, when Arabic starts in a left-to-right app', async () => {
    setDeviceLanguage('ar');
    // As on a phone: the app stops when it restarts, so the call never comes back.
    jest.mocked(reloadAppAsync).mockReturnValueOnce(new Promise(() => {}));
    await openApp();
    await waitFor(() => expect(reloadAppAsync).toHaveBeenCalledTimes(1));

    expect(await AsyncStorage.getItem(DIRECTION_RESTART_KEY)).toBe('rtl');
    expect(screen.queryByTestId('onboarding')).toBeNull();
    expect(SplashScreen.hide).not.toHaveBeenCalled();
  });

  it('does not restart a second time if the first restart changed nothing', async () => {
    setDeviceLanguage('ar');
    await AsyncStorage.setItem(DIRECTION_RESTART_KEY, 'rtl');
    await openApp();
    await layOutIntroduction();

    // The app shows itself in Arabic, in the direction it has, and says nothing false about it.
    expect(screen.getByRole('header', { name: 'أرض جرداء' })).toBeOnTheScreen();
    expect(reloadAppAsync).not.toHaveBeenCalled();
    expect(SplashScreen.hide).toHaveBeenCalled();
  });
});

// Last on purpose: it loads the root layout a second time, apart from the app under test.
describe('launch screen', () => {
  it('is kept until the app is ready, from the moment the app is loaded', () => {
    jest.isolateModules(() => {
      const splash = jest.requireMock<typeof SplashScreen>('expo-splash-screen');
      jest.mocked(splash.preventAutoHideAsync).mockClear();
      jest.requireActual('@/app/_layout');
      expect(splash.preventAutoHideAsync).toHaveBeenCalledTimes(1);
    });
  });
});
