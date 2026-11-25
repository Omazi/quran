/**
 * A link must not open the microphone (docs/SECURITY.md): `quranapp://listening` shows the screen
 * with its start button; only the app's own navigation starts the listening at once.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ComponentType } from 'react';

import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { resetDeviceConditions } from '@/ui/test-support/environment';

import { forgetOpenedInApp, markOpenedInApp } from '../in-app-open';
import { createScenarioEngine } from '../simulated/scenarios';

let mockEngine = createScenarioEngine('found');
let mockStart = jest.spyOn(mockEngine, 'start');

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
// A mock factory runs before imports: `require` is the only way to load the stand-in here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('../test-support/reanimated-stand-in'));
jest.mock('../speech-engine-door', () => ({
  ...jest.requireActual('../speech-engine-door'),
  createListeningEngine: () => mockEngine,
}));

beforeEach(() => {
  mockEngine = createScenarioEngine('found');
  mockStart = jest.spyOn(mockEngine, 'start');
  forgetOpenedInApp();
});
afterEach(resetDeviceConditions);

const route = () => jest.requireActual<{ default: ComponentType }>('@/app/listening').default;

describe('the listening route', () => {
  it('opened by a link: ready with a start button, the microphone untouched', async () => {
    await showLanguage('en');
    const ListeningRoute = route();
    await render(<ListeningRoute />);
    expect(screen.getByTestId('listening-ready')).toBeOnTheScreen();
    expect(mockStart).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Start Listening' }));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('opened by the app itself: listens at once', async () => {
    await showLanguage('en');
    markOpenedInApp('listening');
    const ListeningRoute = route();
    await render(<ListeningRoute />);
    expect(screen.queryByTestId('listening-ready')).toBeNull();
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1), { timeout: 15_000 });
  });
});
