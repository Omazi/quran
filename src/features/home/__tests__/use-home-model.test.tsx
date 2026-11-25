import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { quranStructure } from '@/data/quran';
import { isLocalDate, parseLocalDate } from '@/domain/shared/local-date';

import { AppStoreProvider } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';

import { buildHomeModel } from '../home-model';
import { buildReadingHistory, READING_HISTORIES } from '../dev-preview/reading-histories';
import { useHomeModel } from '../use-home-model';
import { deviceLocalDate, useToday } from '../use-today';

// Noon in UTC is the same calendar day in almost every time zone a test machine can be in.
const NOON = new Date('2026-11-24T12:00:00Z');
const TODAY = deviceLocalDate(NOON);
const NEXT_NOON = new Date('2026-11-25T12:00:00Z');
const ONE_MINUTE_MS = 60_000;

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('deviceLocalDate', () => {
  it('gives the calendar day of an instant where the device is', () => {
    const today = deviceLocalDate(NOON);
    expect(isLocalDate(today)).toBe(true);
    expect(deviceLocalDate(NEXT_NOON)).not.toBe(today);
  });
});

describe('useToday', () => {
  it('changes when the day changes while the screen is open', async () => {
    jest.useFakeTimers();
    let now = NOON;
    const clock = () => now;
    const { result } = await renderHook(() => useToday(clock));
    expect(result.current).toBe(deviceLocalDate(NOON));

    now = NEXT_NOON;
    await act(async () => {
      jest.advanceTimersByTime(ONE_MINUTE_MS);
    });
    expect(result.current).toBe(deviceLocalDate(NEXT_NOON));
  });

  it('changes when the app comes back to the foreground on another day', async () => {
    const listen = jest.spyOn(AppState, 'addEventListener');
    let now = NOON;
    const clock = () => now;
    const { result } = await renderHook(() => useToday(clock));
    const handlers = listen.mock.calls
      .filter(([event]) => event === 'change')
      // The mock records the handler of any event; a state change gives the new state.
      .map(([, handler]) => handler as (state: AppStateStatus) => void);
    expect(handlers.length).toBeGreaterThan(0);
    const comeBack = (state: AppStateStatus) => handlers.forEach((handler) => handler(state));

    now = NEXT_NOON;
    await act(async () => comeBack('background'));
    expect(result.current).toBe(deviceLocalDate(NOON));
    await act(async () => comeBack('active'));
    expect(result.current).toBe(deviceLocalDate(NEXT_NOON));
  });

  it('stops watching the day when the screen goes away', async () => {
    jest.useFakeTimers();
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
    const startTimer = jest.spyOn(globalThis, 'setInterval');
    const stopTimer = jest.spyOn(globalThis, 'clearInterval');
    const clock = () => NOON;
    const { unmount } = await renderHook(() => useToday(clock));
    // Other code sets timers too: the one of the day check is the one-minute interval.
    const dayCheck = startTimer.mock.results.find(
      (_, index) => startTimer.mock.calls[index]?.[1] === ONE_MINUTE_MS,
    );
    expect(dayCheck).toBeDefined();
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(stopTimer).toHaveBeenCalledWith(dayCheck?.value);
  });
});

describe('useHomeModel', () => {
  const RANGES = quranStructure.hizbPageRanges();

  /** Renders the hook below a store that holds the given journal and settings. */
  function renderHomeModel(source = buildReadingHistory('bare-earth', TODAY, RANGES)) {
    const store = createTestAppStore({ journal: source.journal, settings: source.settings });
    const clock = () => NOON;
    const hook = renderHook(() => useHomeModel({ clock }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AppStoreProvider store={store}>{children}</AppStoreProvider>
      ),
    });
    return { store, hook };
  }

  it('shows a new person a bare earth: nothing is made up', async () => {
    const { result } = await renderHomeModel().hook;
    expect(result.current.model).toMatchObject({
      status: 'ready',
      garden: { phase: 'bare', hizbCompleted: 0 },
      today: { pagesRead: 0 },
    });
  });

  it.each(READING_HISTORIES)('builds the model of what the store holds: %s', async (name) => {
    const source = buildReadingHistory(name, TODAY, RANGES);
    const { result } = await renderHomeModel(source).hook;
    expect(result.current.model).toEqual(
      buildHomeModel({ ...source, today: TODAY, hizbPageRanges: RANGES }),
    );
  });

  it('follows the store: a page read and a new goal change the model', async () => {
    const { store, hook } = renderHomeModel();
    const { result } = await hook;
    await act(async () => {
      store.getState().recordPageRead({ page: 1, date: TODAY });
      store.getState().setDailyGoalPages(2);
    });
    expect(result.current.model).toMatchObject({
      status: 'ready',
      today: { pagesRead: 1, goalPages: 2 },
    });
  });

  it('follows the last page opened in the reader, as the button does', async () => {
    const { store, hook } = renderHomeModel();
    const { result } = await hook;
    expect(result.current.model).toMatchObject({ reading: { nextPage: 1, hasStarted: false } });
    await act(async () => store.getState().setLastOpenedPage(293));
    expect(result.current.model).toMatchObject({ reading: { nextPage: 293, hasStarted: true } });
  });

  it('gives the same model again while neither the data nor the day changes', async () => {
    const { result, rerender } = await renderHomeModel().hook;
    const first = result.current;
    await rerender({});
    expect(result.current.model).toBe(first.model);
    expect(result.current.retry).toBe(first.retry);
  });

  it('says the screen is unavailable when the data cannot be read, and tries again when asked', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await renderHomeModel({
      journal: [],
      settings: { dailyGoalPages: 0, userSeed: 1, lastOpenedPage: null, pauses: [] },
    }).hook;
    expect(result.current.model).toEqual({ status: 'unavailable' });
    expect(logged).toHaveBeenCalledTimes(1);
    // Trying again builds the model once more from the data as it is now.
    await act(async () => result.current.retry());
    expect(logged).toHaveBeenCalledTimes(2);
    expect(result.current.model).toEqual({ status: 'unavailable' });
  });

  it('every history is a valid journal on any day, a leap day included', () => {
    const ranges = quranStructure.hizbPageRanges();
    for (const day of ['2026-01-01', '2028-02-29', '2026-12-31']) {
      const today = parseLocalDate(day);
      for (const name of READING_HISTORIES) {
        const source = buildReadingHistory(name, today, ranges);
        expect(() => buildHomeModel({ ...source, today, hizbPageRanges: ranges })).not.toThrow();
      }
    }
  });
});
