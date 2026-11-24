import { render, screen } from '@testing-library/react-native';
import { StrictMode } from 'react';
import { Text } from 'react-native';

import { createMemoryStorage } from '@/data/storage';
import { getDisplayedLanguage } from '@/i18n';
import { STORED_DATA_KEY, STORED_DATA_VERSION, type KeyValueStorage } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';

import { startApp, useAppStartup, type StartupDependencies } from '../startup';
import { createFixedDirection } from '../test-support/render-with-store';
import { DIRECTION_RESTART_KEY } from '../writing-direction';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/** What a person who finished the introduction in Arabic has on their device. */
function storedData(settings: Record<string, unknown>): Record<string, string> {
  const store = createTestAppStore();
  return {
    [STORED_DATA_KEY]: JSON.stringify({
      version: STORED_DATA_VERSION,
      settings: { ...store.getState().settings, ...settings },
      journal: [],
    }),
  };
}

function dependencies(
  storage: KeyValueStorage,
  { deviceLanguages = ['fr'], rightToLeft = false } = {},
) {
  const direction = createFixedDirection(rightToLeft);
  const startup: StartupDependencies = {
    storage,
    direction: direction.platform,
    getDeviceLanguageCodes: () => deviceLanguages,
    wait: jest.fn(async () => {}),
  };
  return { startup, direction };
}

describe('start of the app', () => {
  it('is a first launch when nothing is stored: fresh settings, in the language of the device', async () => {
    const { startup, direction } = dependencies(createMemoryStorage(), { deviceLanguages: ['en'] });
    const app = await startApp(startup);

    expect(app.store.getState().settings.onboardingCompleted).toBe(false);
    expect(app.store.getState().settings.language).toBeNull();
    expect(app.language).toBe('en');
    expect(getDisplayedLanguage()).toBe('en');
    expect(app.isLaidOutForLanguage).toBe(true);
    expect(app.discardedStoredData).toEqual([]);
    expect(direction.platform.restart).not.toHaveBeenCalled();
  });

  it('falls back to French on a device set to a language the app does not have', async () => {
    const { startup } = dependencies(createMemoryStorage(), { deviceLanguages: ['de', 'es'] });
    expect((await startApp(startup)).language).toBe('fr');
  });

  it('gives a returning person their settings, and their language before the device’s', async () => {
    const storage = createMemoryStorage(
      storedData({ language: 'ar', onboardingCompleted: true, dailyGoalPages: 12 }),
    );
    const { startup, direction } = dependencies(storage, {
      deviceLanguages: ['fr'],
      rightToLeft: true,
    });
    const app = await startApp(startup);

    expect(app.language).toBe('ar');
    expect(getDisplayedLanguage()).toBe('ar');
    expect(app.store.getState().settings).toMatchObject({
      onboardingCompleted: true,
      dailyGoalPages: 12,
    });
    expect(app.isLaidOutForLanguage).toBe(true);
    expect(direction.platform.restart).not.toHaveBeenCalled();
  });

  it('starts as a first launch, without crashing, when what is stored is corrupt', async () => {
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: '{"version":1,"settings":' });
    const { startup } = dependencies(storage);
    const app = await startApp(startup);
    expect(app.discardedStoredData).toEqual(['document']);
    expect(app.store.getState().settings.onboardingCompleted).toBe(false);
    expect(app.language).toBe('fr');
  });

  it('restarts once to mirror the layout when Arabic starts in a left-to-right app', async () => {
    const storage = createMemoryStorage();
    const { startup, direction } = dependencies(storage, { deviceLanguages: ['ar'] });
    const app = await startApp(startup);

    expect(app.language).toBe('ar');
    expect(direction.recorded()).toBe(true);
    expect(direction.platform.restart).toHaveBeenCalledTimes(1);
    expect(storage.peek(DIRECTION_RESTART_KEY)).toBe('rtl');
    // Had the restart not happened, the app would say so instead of pretending.
    expect(app.isLaidOutForLanguage).toBe(false);
  });

  it('uses a timer to wait for a restart when no other wait is given', async () => {
    jest.useFakeTimers();
    const direction = createFixedDirection(false);
    const started = startApp({
      storage: createMemoryStorage(),
      direction: direction.platform,
      getDeviceLanguageCodes: () => ['ar'],
    });
    let isStarted = false;
    void started.then(() => {
      isStarted = true;
    });
    await jest.advanceTimersByTimeAsync(1000);
    expect(isStarted).toBe(false);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(isStarted).toBe(true);
    jest.useRealTimers();
  });
});

describe('useAppStartup', () => {
  function Probe({ startup }: { startup: StartupDependencies }) {
    const app = useAppStartup(startup);
    return <Text>{app === null ? 'starting' : `ready in ${app.language}`}</Text>;
  }

  it('is null while the app starts, then gives the started app', async () => {
    let release: (value: string | null) => void = () => {};
    const storage = createMemoryStorage();
    jest.spyOn(storage, 'getItem').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const { startup } = dependencies(storage, { deviceLanguages: ['en'] });
    await render(<Probe startup={startup} />);
    expect(screen.getByText('starting')).toBeOnTheScreen();

    release(null);
    expect(await screen.findByText('ready in en')).toBeOnTheScreen();
  });

  it('starts the app once, even when React runs the effect twice', async () => {
    const storage = createMemoryStorage();
    const getItem = jest.spyOn(storage, 'getItem');
    const { startup } = dependencies(storage);
    await render(
      <StrictMode>
        <Probe startup={startup} />
      </StrictMode>,
    );
    expect(await screen.findByText('ready in fr')).toBeOnTheScreen();
    const readsOfTheData = getItem.mock.calls.filter(([key]) => key === STORED_DATA_KEY);
    expect(readsOfTheData).toHaveLength(1);
  });

  it('throws a failed start to the error screen instead of waiting for ever', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { startup } = dependencies(createMemoryStorage());
    const failing: StartupDependencies = {
      ...startup,
      getDeviceLanguageCodes: () => {
        throw new Error('no locale');
      },
    };
    await expect(
      (async () => {
        await render(<Probe startup={failing} />);
        await screen.findByText('ready in fr');
      })(),
    ).rejects.toThrow('no locale');
    jest.restoreAllMocks();
  });
});
