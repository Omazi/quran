import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import HomeRoute from '@/app/(tabs)/index';
import { quranStructure } from '@/data/quran';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { resolveResumePage } from '@/features/reader';
import { AppStoreProvider, type AppStore } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { resetDeviceConditions } from '@/ui/test-support/environment';

import { buildReadingHistory } from '../dev-preview/reading-histories';
import { deviceLocalDate } from '../use-today';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useIsFocused: () => true }));

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
    expect(screen.getByRole('header', { name: 'Ton jardin' })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: /^Terre nue, aucun hizb terminé/ })).toBeOnTheScreen();
    expect(screen.getByTestId('home-today-pages')).toHaveTextContent(/0 page sur 5/);
    // Nothing read yet: the first page is to start, not to resume.
    expect(screen.getByTestId('home-resume')).toHaveTextContent('Al-FatihaCommencer page 1الفاتحة');
  });

  it('shows the garden of what the person read', async () => {
    await renderRoute(readerStore());
    expect(screen.getByRole('image', { name: /^Jardin, 24 hizb sur 60/ })).toBeOnTheScreen();
  });

  // docs/specs/reader.md, section 4: the reader opens on the page to resume.
  it('"Lire et arroser" opens the reader on the page to resume and reads no page', async () => {
    const store = readerStore();
    const journal = store.getState().journal;
    const resumePage = resolveResumePage({
      lastOpenedPage: null,
      journal,
      hizbPageRanges: quranStructure.hizbPageRanges(),
    });
    await renderRoute(store);
    await fireEvent.press(screen.getByRole('button', { name: /^Lire et arroser/ }));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(`/reader/${resumePage}`);
    // Nothing was added to the journal: the pages of the day are what they were.
    expect(store.getState().journal).toBe(journal);
    expect(screen.getByTestId('home-today-pages')).toHaveTextContent(/3 pages sur 5/);
  });

  it('names above its button the page it opens, once the reader was opened elsewhere', async () => {
    const store = readerStore();
    store.getState().setLastOpenedPage(293);
    await renderRoute(store);
    // accueil.png: "Al-Kahf · Reprendre page 293", the Arabic name beside it. Page 293 opens on
    // the last verses of Al-Isra: the surah of its first verse names it, as the reader does.
    expect(screen.getByTestId('home-resume')).toHaveTextContent('Al-IsraReprendre page 293الإسراء');
    expect(screen.queryByTestId('home-next-page')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Lire et arroser/ }));
    expect(router.push).toHaveBeenCalledWith('/reader/293');
  });

  it('names the first unread page too while the reader was never opened', async () => {
    const store = readerStore();
    await renderRoute(store);
    const resumePage = resolveResumePage({
      lastOpenedPage: store.getState().settings.lastOpenedPage,
      journal: store.getState().journal,
      hizbPageRanges: quranStructure.hizbPageRanges(),
    });
    expect(screen.getByTestId('home-resume')).toHaveTextContent(
      new RegExp(`Reprendre page ${resumePage}`),
    );
  });
});
