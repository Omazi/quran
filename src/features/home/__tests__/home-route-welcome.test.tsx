/**
 * The home opened from "Créer mon jardin" (`?welcome=1`): the invitation to create an account
 * rises over the new garden, but only in a build whose `accountInvitation` flag is on.
 */
import asyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import HomeRoute from '@/app/(tabs)/index';
import { demoForTest, withStore } from '@/features/friends/test-support/demo';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { AppStoreProvider } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { resetDeviceConditions } from '@/ui/test-support/environment';

import { ACCOUNT_INVITATION_DELAY_MS, ACCOUNT_INVITATION_SEEN_KEY } from '../account-invitation';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockParams: Record<string, string> = {};
let mockFlag = false;
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useIsFocused: () => true,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: { features: { accountInvitation: mockFlag } } };
    },
  },
}));

beforeEach(async () => {
  mockParams = {};
  mockFlag = false;
  jest.clearAllMocks();
  await asyncStorage.clear();
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});

afterEach(async () => {
  jest.useRealTimers();
  await resetDeviceConditions();
});

async function renderWelcomeHome() {
  const { store: social, demo } = demoForTest();
  await showLanguage('fr');
  await render(
    withStore(
      social,
      <AppStoreProvider store={createTestAppStore()}>
        <HomeRoute />
      </AppStoreProvider>,
    ),
  );
  return demo;
}

async function letTheGardenSettle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    jest.advanceTimersByTime(ACCOUNT_INVITATION_DELAY_MS);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('the home opened with ?welcome=1', () => {
  it('shows the new garden and, with the flag on, the invitation rises over it', async () => {
    mockParams = { welcome: '1' };
    mockFlag = true;
    await renderWelcomeHome();
    expect(screen.getByRole('image', { name: /^Terre nue/ })).toBeOnTheScreen();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
    await letTheGardenSettle();
    expect(screen.getByRole('header', { name: 'Ton jardin est prêt.' })).toBeOnTheScreen();
    expect(await asyncStorage.getItem(ACCOUNT_INVITATION_SEEN_KEY)).toBe('1');
  });

  it('leads the e-mail way to the sign-in of the friends tab', async () => {
    mockParams = { welcome: '1' };
    mockFlag = true;
    await renderWelcomeHome();
    await letTheGardenSettle();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec un e-mail' }));
    expect(router.push).toHaveBeenCalledWith('/friends');
    expect(screen.queryByTestId('account-invitation')).toBeNull();
  });

  it('shows nothing while the flag is off, as in the TestFlight build', async () => {
    mockParams = { welcome: '1' };
    mockFlag = false;
    await renderWelcomeHome();
    await letTheGardenSettle();
    expect(screen.getByTestId('home')).toBeOnTheScreen();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
    expect(await asyncStorage.getItem(ACCOUNT_INVITATION_SEEN_KEY)).toBeNull();
  });

  it('shows nothing when the home is opened any other way, flag on', async () => {
    mockFlag = true;
    await renderWelcomeHome();
    await letTheGardenSettle();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
  });

  it('ignores any other value of the parameter', async () => {
    mockParams = { welcome: '0' };
    mockFlag = true;
    await renderWelcomeHome();
    await letTheGardenSettle();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
  });
});
