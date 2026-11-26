/**
 * The script choice on the real route (owner's report: the text did not change on his iPhone).
 * Unlike reader-screen.test.tsx, the fonts are not given as ready: the simple script's font is
 * missing at first and loads when asked, as on a phone where the reader was opened in Uthmani,
 * and the route composes the hooks as the app does. The text and its font change both ways.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import { quranRepository } from '@/data/quran';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { AppStoreProvider } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { styleOf } from '@/ui/test-support/environment';
import { fontFamily } from '@/ui/tokens';

import ReaderRoute from '@/app/reader/[page]';

/** The fonts registered so far, as on a phone: the Uthmani one at launch, Amiri only once asked. */
const mockLoadedFonts = new Set<string>(['KFGQPCHafsUthmanic']);
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  isLoaded: (name: string) => mockLoadedFonts.has(name),
  loadAsync: async (fonts: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    for (const name of Object.keys(fonts)) mockLoadedFonts.add(name);
  },
}));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useLocalSearchParams: () => ({ page: '293' }),
  Stack: { Screen: () => null },
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
}));

/** The font of the paragraph that holds Al-Kahf's first verses. */
function fontOfAlKahf(): unknown {
  return styleOf(screen.getByTestId('verses-18-1')).fontFamily;
}

it('changes the text and its font when the script is switched, and back', async () => {
  await showLanguage('fr');
  const store = createTestAppStore({ settings: { onboardingCompleted: true } });
  await render(
    <AppStoreProvider store={store}>
      <ReaderRoute />
    </AppStoreProvider>,
  );
  const uthmani = (await quranRepository.getVerse('18:1', 'uthmani')).text;
  const simple = (await quranRepository.getVerse('18:1', 'imlaei')).text;
  await waitFor(() => expect(screen.getByTestId('verse-18:1').props.children).toBe(uthmani));
  expect(fontOfAlKahf()).toBe(fontFamily.quran);

  const group = screen.getByTestId('reader-script');
  await fireEvent.press(within(group).getByRole('radio', { name: 'Simple' }));
  expect(store.getState().settings.readerScript).toBe('imlaei');
  await waitFor(() => expect(screen.getByTestId('verse-18:1').props.children).toBe(simple));
  expect(fontOfAlKahf()).toBe(fontFamily.quranSimple);

  await fireEvent.press(within(group).getByRole('radio', { name: 'Uthmani' }));
  await waitFor(() => expect(screen.getByTestId('verse-18:1').props.children).toBe(uthmani));
  expect(fontOfAlKahf()).toBe(fontFamily.quran);
});
