import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithStore } from '@/features/settings/test-support/render-with-store';

/** The route loads the whole introduction the first time: more than Jest's five seconds. */
jest.setTimeout(20_000);

const WINDOW = { x: 0, y: 0, width: 390, height: 844 };

// The iOS check's build: `?page=N` is honoured (the flag is on), as `-screenCheckPage N` makes it.
jest.mock('@/features/screen-check', () => {
  const { parseCheckPage } = jest.requireActual<typeof import('@/features/screen-check/parse')>(
    '@/features/screen-check/parse',
  );
  return {
    screenCheckPage: (raw: unknown, count: number) => parseCheckPage(raw, true, count),
    screenCheckPagerDriver: null,
  };
});

// `mock` prefix: the only outside variable a module factory may read.
const mockParams = { page: '7' };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
}));

async function openRoute() {
  const Route =
    jest.requireActual<typeof import('@/app/onboarding/index')>('@/app/onboarding/index').default;
  await renderWithStore(<Route />);
  await fireEvent(screen.getByTestId('onboarding'), 'layout', { nativeEvent: { layout: WINDOW } });
  await fireEvent(screen.getByTestId('onboarding-pager-pages'), 'layout', {
    nativeEvent: { layout: WINDOW },
  });
}

describe('the screen check opens the page it asks for (`?page=N`, 1-based)', () => {
  it('opens page 7, the thirsty garden', async () => {
    mockParams.page = '7';
    await openRoute();
    expect(
      screen.getByRole('header', { name: 'Si tu arrêtes de lire, il a soif.' }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-pager-indicator')).toHaveAccessibilityValue({
      text: 'Page 7 sur 16',
    });
  });

  it('opens the last page, the reminders, with "Créer mon jardin"', async () => {
    mockParams.page = '16';
    await openRoute();
    expect(screen.getByRole('header', { name: 'Tes rappels.' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Créer mon jardin' })).toBeOnTheScreen();
  });

  it('opens the first page for a page that does not exist', async () => {
    mockParams.page = '17';
    await openRoute();
    expect(screen.getByRole('header', { name: 'Une terre nue.' })).toBeOnTheScreen();
  });
});
