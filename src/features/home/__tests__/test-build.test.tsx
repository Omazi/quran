/**
 * The home screen as a test build (TestFlight) runs it: `__DEV__` is false, and the build was
 * made with `EXPO_PUBLIC_STATE_PREVIEW=1`. The modules of the home feature are loaded after both
 * are set, as the bundler would have compiled them.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';

import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { AppStoreProvider } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { resetDeviceConditions } from '@/ui/test-support/environment';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useIsFocused: () => true }));

const devFlag = globalThis as { __DEV__?: boolean };
let HomeRoute: ComponentType;

beforeAll(() => {
  devFlag.__DEV__ = false;
  process.env.EXPO_PUBLIC_STATE_PREVIEW = '1';
  // Loaded here, not imported above, so that the modules see the flags of a test build.
  HomeRoute = jest.requireActual<{ default: ComponentType }>('@/app/(tabs)/index').default;
});

afterAll(() => {
  devFlag.__DEV__ = true;
  delete process.env.EXPO_PUBLIC_STATE_PREVIEW;
});

afterEach(resetDeviceConditions);

describe('the home screen in a test build made with EXPO_PUBLIC_STATE_PREVIEW=1', () => {
  it('offers the preview of the states although it is not a development build', async () => {
    expect(__DEV__).toBe(false);
    const store = createTestAppStore();
    const before = store.getState();
    const changed = jest.fn();
    store.subscribe(changed);
    await showLanguage('fr');
    await render(
      <AppStoreProvider store={store}>
        <HomeRoute />
      </AppStoreProvider>,
    );
    expect(screen.getByRole('header', { name: 'Aperçu des états' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Mes vraies données' })).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: 'Terre morte (14 jours)' }));
    expect(
      screen.getByRole('image', { name: /^Terre morte, 24 hizb sur 60 acquis/ }),
    ).toBeOnTheScreen();
    // In memory only: the stored journal and settings are what they were.
    expect(changed).not.toHaveBeenCalled();
    expect(store.getState().journal).toBe(before.journal);
    expect(store.getState().settings).toBe(before.settings);
  });
});

describe.each(['0', '', 'true', 'yes'])('with EXPO_PUBLIC_STATE_PREVIEW=%p', (value) => {
  it('the preview stays closed: only the exact value 1 opens it', () => {
    devFlag.__DEV__ = false;
    process.env.EXPO_PUBLIC_STATE_PREVIEW = value;
    jest.isolateModules(() => {
      const gate = jest.requireActual<typeof import('../state-preview')>('../state-preview');
      expect(gate.StatePreviewSection).toBeNull();
    });
    process.env.EXPO_PUBLIC_STATE_PREVIEW = '1';
  });
});
