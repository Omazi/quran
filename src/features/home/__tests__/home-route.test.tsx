import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import HomeRoute from '@/app/(tabs)/index';
import { quranStructure } from '@/data/quran';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { AppStoreProvider, type AppStore } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { resetDeviceConditions } from '@/ui/test-support/environment';

import { buildReadingHistory } from '../test-support/reading-histories';
import { deviceLocalDate } from '../use-today';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

afterEach(resetDeviceConditions);

/** A person at hizb 24 who read every day, three pages already today. */
function readerStore(): AppStore {
  const today = deviceLocalDate(new Date());
  const { journal, settings } = buildReadingHistory(
    'thriving',
    today,
    quranStructure.hizbPageRanges(),
  );
  return createTestAppStore({ journal, settings });
}

async function renderRoute(store: AppStore) {
  await showLanguage('fr');
  await render(
    <AppStoreProvider store={store}>
      <HomeRoute />
    </AppStoreProvider>,
  );
}

describe('the "Jardin" tab', () => {
  it('shows a new person a bare earth, not made-up data', async () => {
    await renderRoute(createTestAppStore());
    expect(screen.getByRole('header', { name: 'Jardin' })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: /^Terre nue, aucun hizb terminé/ })).toBeOnTheScreen();
    expect(screen.getByTestId('home-today-pages')).toHaveTextContent('Pages lues0 sur 5');
  });

  it('shows the garden of what the person read', async () => {
    await renderRoute(readerStore());
    expect(screen.getByRole('image', { name: /^Jardin, 24 hizb sur 60/ })).toBeOnTheScreen();
  });

  it('"Lire et arroser" opens the Quran tab and reads no page', async () => {
    const store = readerStore();
    const journal = store.getState().journal;
    await renderRoute(store);
    await fireEvent.press(screen.getByRole('button', { name: 'Lire et arroser' }));
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith('/quran');
    // Nothing was added to the journal: the pages of the day are what they were.
    expect(store.getState().journal).toBe(journal);
    expect(screen.getByTestId('home-today-pages')).toHaveTextContent('Pages lues3 sur 5');
  });
});
