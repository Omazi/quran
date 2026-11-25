/**
 * The home screen as a production bundle runs it: `__DEV__` is false and the build was made
 * without `EXPO_PUBLIC_STATE_PREVIEW`. The modules of the home feature are loaded after both are
 * set, as the bundler would have compiled them, and the preview is replaced by a module that
 * fails the test if anything loads it.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';

import { quranStructure } from '@/data/quran';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { AppStoreProvider } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { resetDeviceConditions } from '@/ui/test-support/environment';

import { buildReadingHistory } from '../dev-preview/reading-histories';
import { deviceLocalDate } from '../use-today';

const mockLoadDevPreview = jest.fn();

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../dev-preview/dev-preview', () => {
  mockLoadDevPreview();
  throw new Error('The preview was loaded in a production bundle.');
});

const devFlag = globalThis as { __DEV__?: boolean };
let HomeRoute: ComponentType;

beforeAll(() => {
  devFlag.__DEV__ = false;
  delete process.env.EXPO_PUBLIC_STATE_PREVIEW;
  // Loaded here, not imported above, so that the modules see the flag of a production bundle.
  HomeRoute = jest.requireActual<{ default: ComponentType }>('@/app/(tabs)/index').default;
});

afterAll(() => {
  devFlag.__DEV__ = true;
});

afterEach(resetDeviceConditions);

describe('the home screen in a production bundle', () => {
  it('never loads the developer preview and shows no trace of it', async () => {
    await showLanguage('fr');
    await render(
      <AppStoreProvider store={createTestAppStore()}>
        <HomeRoute />
      </AppStoreProvider>,
    );
    expect(screen.getByRole('header', { name: 'Jardin' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lire et arroser' })).toBeOnTheScreen();
    expect(mockLoadDevPreview).not.toHaveBeenCalled();
    expect(screen.queryByTestId('home-dev-preview')).toBeNull();
    expect(screen.queryByText(/Aperçu/i)).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('shows what the store holds, and only that', async () => {
    const today = deviceLocalDate(new Date());
    const { journal, settings } = buildReadingHistory(
      'thirsty',
      today,
      quranStructure.hizbPageRanges(),
    );
    const store = createTestAppStore({ journal, settings });
    await showLanguage('fr');
    await render(
      <AppStoreProvider store={store}>
        <HomeRoute />
      </AppStoreProvider>,
    );
    expect(
      screen.getByRole('image', { name: /^Jardin assoiffé, 24 hizb sur 60/ }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Lire et arroser' }));
    expect(store.getState().journal).toBe(journal);
    expect(mockLoadDevPreview).not.toHaveBeenCalled();
  });
});
