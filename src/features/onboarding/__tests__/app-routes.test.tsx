import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { getLocales } from 'expo-localization';
import { getPermissionsAsync, PermissionStatus, requestPermissionsAsync } from 'expo-notifications';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';

import { DIRECTION_RESTART_KEY } from '@/features/settings';
import { STORED_DATA_KEY, STORED_DATA_VERSION } from '@/store';
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
const LAST_PAGE = 15;

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
    expect(screen.getByRole('header', { name: 'A Bare Earth' })).toBeOnTheScreen();
    expect(SplashScreen.hide).toHaveBeenCalled();
    // The seed is drawn and kept from the very first launch.
    expect(typeof (await storedSettings()).userSeed).toBe('number');
    expect((await storedSettings()).onboardingCompleted).toBe(false);
  });

  it('shows the garden of each page with the garden scene, and a named placeholder elsewhere', async () => {
    await openApp();
    await layOutIntroduction();
    const labels = screen
      .getAllByTestId('garden-scene')
      .map(({ props }) => String(props.accessibilityLabel));
    // The growth pages go from the bare earth to the complete garden...
    expect(labels[0]).toMatch(/^Terre nue/);
    expect(labels[1]).toMatch(/^Jardin, 8 hizb sur 60/);
    expect(labels[5]).toMatch(/^Jardin complet, 60 hizb sur 60/);
    // ...and the drought pages dry a garden of 59 hizb: a complete one no longer dries.
    expect(labels[6]).toMatch(/^Jardin assoiffé, 59 hizb sur 60/);
    expect(labels[7]).toMatch(/^Jardin fané, 59 hizb sur 60/);
    expect(labels[8]).toMatch(/^Jardin qui dépérit, 59 hizb sur 60/);
    expect(labels[9]).toMatch(/^Terre morte, 59 hizb sur 60 acquis/);

    await swipeToPage(11);
    expect(
      await screen.findByRole('image', { name: 'Lecture à voix haute, suivie mot à mot' }),
    ).toBeOnTheScreen();
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
    expect(await screen.findByRole('header', { name: 'Tes rappels.' })).toBeOnTheScreen();

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
    const app = await openApp('/settings');
    await waitFor(() => expect(app.getPathname()).toBe('/onboarding'));
  });

  it('starts as a first launch, without crashing, when what is stored is corrupt', async () => {
    await AsyncStorage.setItem(STORED_DATA_KEY, '{"version":1,"settings":{"dailyGoalPages":9000}');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const app = await openApp();
    await layOutIntroduction();
    expect(app.getPathname()).toBe('/onboarding');
    expect(screen.getByRole('header', { name: 'Une terre nue.' })).toBeOnTheScreen();
    expect((await storedSettings()).dailyGoalPages).toBe(5);
    warn.mockRestore();
  });
});

describe('returning person', () => {
  beforeEach(() => store({ onboardingCompleted: true }));

  it('opens on the tabs: Jardin, Coran, Réglages, one word and one filled symbol each', async () => {
    const app = await openApp();
    await waitFor(() => expect(app.getSegments()).toEqual(['(tabs)']));

    expect(tabs().map(({ props }) => [props.title, props.icon])).toEqual([
      ['Jardin', { sf: 'leaf.fill' }],
      ['Coran', { sf: 'book.fill' }],
      ['Réglages', { sf: 'gearshape.fill' }],
    ]);
    // The selected tab takes the accent, and the bar the direction React Native runs in.
    expect(tabsHost()).toHaveProp('tabBarTintColor', iosAppColor('accent'));
    expect(tabsHost()).toHaveProp('layoutDirection', 'ltr');
    expect(tabsHost()).toHaveProp('tabBarHidden', undefined);
    expect(SplashScreen.hide).toHaveBeenCalled();
    expect(reloadAppAsync).not.toHaveBeenCalled();
  });

  it('explains why the Quran tab is still empty', async () => {
    const app = await openApp('/quran');
    await waitFor(() => expect(app.getPathname()).toBe('/quran'));
    expect(screen.getByText('La lecture arrive bientôt')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Tu liras le Coran ici, page après page, et chaque nouvelle page arrosera ton jardin.',
      ),
    ).toBeOnTheScreen();
  });

  it('finds the settings they made, and can change them', async () => {
    await store({ onboardingCompleted: true, dailyGoalPages: 12 });
    setPermission(PermissionStatus.GRANTED);
    const app = await openApp('/settings');
    await waitFor(() => expect(app.getPathname()).toBe('/settings'));
    expect(screen.getByRole('adjustable', { name: 'Pages par jour' })).toHaveAccessibilityValue({
      text: '12',
    });

    await fireEvent.press(screen.getByTestId('daily-goal-increment'));
    await waitFor(async () => expect((await storedSettings()).dailyGoalPages).toBe(13));
  });

  it('keeps the language they chose, whatever the language of the device', async () => {
    await store({ onboardingCompleted: true, language: 'en' });
    setDeviceLanguage('fr');
    await openApp('/settings');
    expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
    expect(tabs().map(({ props }) => props.title)).toEqual(['Garden', 'Quran', 'Settings']);
  });

  it('gets a mirrored tab bar and Arabic names when the app runs in Arabic', async () => {
    await store({ onboardingCompleted: true, language: 'ar' });
    setDeviceConditions({ rightToLeft: true });
    const app = await openApp();
    await waitFor(() => expect(app.getSegments()).toEqual(['(tabs)']));
    expect(tabs().map(({ props }) => props.title)).toEqual(['الحديقة', 'القرآن', 'الإعدادات']);
    expect(tabsHost()).toHaveProp('layoutDirection', 'rtl');
    expect(reloadAppAsync).not.toHaveBeenCalled();
  });

  it('can see the introduction again from the settings, leave it by the back button, or finish it', async () => {
    setPermission(PermissionStatus.GRANTED);
    const app = await openApp('/settings');
    await fireEvent.press(await screen.findByRole('button', { name: 'Revoir la présentation' }));
    await waitFor(() => expect(app.getPathname()).toBe('/onboarding'));
    await layOutIntroduction();

    // Opened again, the introduction shows the system's header and its back button.
    const header = screen.container
      .queryAll(({ type }) => type === 'RNSScreenStackHeaderConfig')
      .find(({ props }) => props.title === 'Présentation');
    expect(header).toHaveProp('hidden', false);

    await swipeToPage(LAST_PAGE);
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(app.getPathname()).toBe('/settings'));
    // Already allowed: the system has nothing to ask, and is not made to.
    expect(screen.getByRole('header', { name: 'Réglages' })).toBeOnTheScreen();
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
    expect(screen.getByRole('header', { name: 'أرض جرداء.' })).toBeOnTheScreen();
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
