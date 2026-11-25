import { render, renderHook, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { Linking } from 'react-native';

import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { resetDeviceConditions } from '@/ui/test-support/environment';

import { forgetOpenedInApp, markOpenedInApp } from '../in-app-open';

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
};

jest.mock('expo-router', () => ({
  router: mockRouter,
  useLocalSearchParams: () => ({ scenario: 'listening' }),
  Redirect: ({ href }: { href: string }) => {
    const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
    return <MockText testID="redirect">{href}</MockText>;
  },
}));
// A mock factory runs before imports: `require` is the only way to load the stand-in here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('../test-support/reanimated-stand-in'));

afterEach(async () => {
  forgetOpenedInApp();
  jest.clearAllMocks();
  await resetDeviceConditions();
});

describe('where the listening screen leads', () => {
  it('opens the reader at the page of the passage', async () => {
    const { useListeningNavigation } = jest.requireActual<
      typeof import('../use-listening-navigation')
    >('../use-listening-navigation');
    const { result } = await renderHook(() => useListeningNavigation());
    result.current.openPage(42);
    expect(mockRouter.push).toHaveBeenCalledWith('/reader/42');
  });

  it('goes back when it can, home when it was opened by its address', async () => {
    const { useListeningNavigation } = jest.requireActual<
      typeof import('../use-listening-navigation')
    >('../use-listening-navigation');
    const { result } = await renderHook(() => useListeningNavigation());
    result.current.close();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    mockRouter.canGoBack.mockReturnValueOnce(false);
    result.current.close();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it("opens the app's page in the system settings for the microphone", async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const { useListeningNavigation } = jest.requireActual<
      typeof import('../use-listening-navigation')
    >('../use-listening-navigation');
    const { result } = await renderHook(() => useListeningNavigation());
    result.current.openSettings();
    expect(openSettings).toHaveBeenCalledTimes(1);
  });
});

describe('the route', () => {
  it('in development, shows the listening screen with the simulated engine', async () => {
    await showLanguage('fr');
    markOpenedInApp('listening');
    const ListeningRoute = jest.requireActual<{ default: ComponentType }>(
      '@/app/listening',
    ).default;
    await render(<ListeningRoute />);
    // "Un instant…" while the engine starts, then "J'écoute…" once the microphone is open.
    expect(
      await screen.findByRole('header', { name: 'J’écoute…' }, { timeout: 10_000 }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });
});
