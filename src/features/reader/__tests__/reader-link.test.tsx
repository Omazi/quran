/**
 * A link must not open the microphone (docs/SECURITY.md): `quranapp://reader/294?follow=1` opens
 * the reader and leaves the microphone off; a follow started inside the app listens at once.
 */
import { act, render, screen, waitFor } from '@testing-library/react-native';
import type { ComponentType } from 'react';

import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { forgetOpenedInApp, markOpenedInApp } from '@/features/listening';
import { createSimulatedSpeechEngine } from '@/features/listening/simulated/simulated-speech-engine';
import { AppStoreProvider } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { resetDeviceConditions } from '@/ui/test-support/environment';

let mockEngine = createSimulatedSpeechEngine({ permission: 'granted', steps: [] });
let mockStart = jest.spyOn(mockEngine, 'start');

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ page: '294', follow: '1', from: '18:10' }),
  useRouter: () => ({
    replace: jest.fn(),
    back: jest.fn(),
    push: jest.fn(),
    canGoBack: () => true,
  }),
  Redirect: () => null,
  Stack: { Screen: () => null },
}));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/features/listening', () => ({
  ...jest.requireActual('@/features/listening'),
  createFollowEngine: () => mockEngine,
}));

beforeEach(() => {
  mockEngine = createSimulatedSpeechEngine({ permission: 'granted', steps: [] });
  mockStart = jest.spyOn(mockEngine, 'start');
  forgetOpenedInApp();
});
afterEach(resetDeviceConditions);

async function openRoute() {
  await showLanguage('en');
  const ReaderRoute = jest.requireActual<{ default: ComponentType }>('@/app/reader/[page]').default;
  await render(
    <AppStoreProvider store={createTestAppStore({ settings: { onboardingCompleted: true } })}>
      <ReaderRoute />
    </AppStoreProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('page-section-294')).toBeOnTheScreen());
}

describe('the reader route with ?follow=1', () => {
  it('opened by a link: shows the page, the microphone stays off', async () => {
    await openRoute();
    // Time for the text to load and for any auto start to have happened.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('opened by the app itself: follows at once', async () => {
    markOpenedInApp('reader-follow');
    await openRoute();
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1), { timeout: 10_000 });
  });
});
