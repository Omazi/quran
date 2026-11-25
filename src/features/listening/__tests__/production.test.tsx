/**
 * The listening route as a published bundle runs it: `__DEV__` is false and the build was made
 * without `EXPO_PUBLIC_STATE_PREVIEW`. The modules are loaded after both are set, as the bundler
 * would have compiled them, and the simulation is replaced by a module that fails the test if
 * anything loads it (the same check as the home screen's preview). The engine of the phone is
 * the real one (D42), even when the address names a scenario.
 */
import { render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';

const mockLoadScenarios = jest.fn();
const mockCreateDeviceSpeechEngine = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({ scenario: 'found' }),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text testID="redirect">{href}</Text>;
  },
}));
// A mock factory runs before imports: `require` is the only way to load the stand-in here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('../test-support/reanimated-stand-in'));
jest.mock('@/data/speech', () => ({
  createDeviceSpeechEngine: (mode: string) => mockCreateDeviceSpeechEngine(mode),
}));
jest.mock('../listening-screen', () => ({
  ListeningScreen: ({ engine }: { engine: { name: string } }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text testID="listening-screen">{engine.name}</Text>;
  },
}));
jest.mock('../simulated/scenarios', () => {
  mockLoadScenarios();
  throw new Error('The simulated engine was loaded in a published bundle.');
});

const devFlag = globalThis as { __DEV__?: boolean };
let ListeningRoute: ComponentType;

beforeAll(() => {
  devFlag.__DEV__ = false;
  delete process.env.EXPO_PUBLIC_STATE_PREVIEW;
  // Loaded here, not imported above, so that the modules see the flag of a published bundle.
  ListeningRoute = jest.requireActual<{ default: ComponentType }>('@/app/listening').default;
});

afterAll(() => {
  devFlag.__DEV__ = true;
});

describe('the listening route in a published bundle', () => {
  it('listens with the real engine of the phone, never the simulated one', async () => {
    mockCreateDeviceSpeechEngine.mockReturnValue({ name: 'device engine' });
    await render(<ListeningRoute />);
    expect(mockCreateDeviceSpeechEngine).toHaveBeenCalledWith('search');
    expect(screen.getByTestId('listening-screen')).toHaveTextContent('device engine');
    expect(mockLoadScenarios).not.toHaveBeenCalled();
  });

  it('sends the address home where the phone has no engine', async () => {
    mockCreateDeviceSpeechEngine.mockReturnValue(null);
    await render(<ListeningRoute />);
    expect(mockLoadScenarios).not.toHaveBeenCalled();
    expect(screen.getByTestId('redirect')).toHaveTextContent('/');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
