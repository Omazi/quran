import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import type { ReactNode } from 'react';

import { AppStoreProvider } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';

import { PROFILE_STATS_CONFIG } from '../config';
import { createForegroundTimeRecorder } from '../foreground-time';
import { enterReader, forgetReaderPresence } from '../reader-presence';
import { useForegroundTimeRecording } from '../use-foreground-time-recording';

const MINUTE = 60_000;

/** A clock that only moves when the test says so. */
function manualClocks(start = new Date('2026-11-25T10:00:00')) {
  let ms = 0;
  return {
    monotonicClock: () => ms,
    clock: () => new Date(start.getTime() + ms),
    advance: (by: number) => {
      ms += by;
    },
  };
}

describe('createForegroundTimeRecorder', () => {
  it('hands whole seconds of foreground time to the store, by local day', () => {
    const clocks = manualClocks();
    const record = jest.fn();
    const recorder = createForegroundTimeRecorder({ ...clocks, record, isForeground: true });
    clocks.advance(61_500);
    recorder.flush();
    expect(record).toHaveBeenCalledWith({ date: '2026-11-25', appSeconds: 61, readerSeconds: 0 });
  });

  it('keeps the part of a second for the next batch, so nothing is lost', () => {
    const clocks = manualClocks();
    const record = jest.fn();
    const recorder = createForegroundTimeRecorder({ ...clocks, record, isForeground: true });
    clocks.advance(1_500);
    recorder.flush();
    clocks.advance(1_500);
    recorder.flush();
    expect(record.mock.calls.map(([time]) => time.appSeconds)).toEqual([1, 2]);
  });

  it('does not count the time in the background, and writes when the app leaves', () => {
    const clocks = manualClocks();
    const record = jest.fn();
    const recorder = createForegroundTimeRecorder({ ...clocks, record, isForeground: true });
    clocks.advance(10_000);
    recorder.setForeground(false);
    expect(record).toHaveBeenCalledTimes(1);
    clocks.advance(3_600_000);
    recorder.setForeground(true);
    clocks.advance(5_000);
    recorder.flush();
    expect(record.mock.calls.map(([time]) => time.appSeconds)).toEqual([10, 5]);
  });

  it('counts reader time while the reader is open, inside the app time', () => {
    const clocks = manualClocks();
    const record = jest.fn();
    const recorder = createForegroundTimeRecorder({ ...clocks, record, isForeground: true });
    clocks.advance(20_000);
    recorder.setReaderOpen(true);
    clocks.advance(40_000);
    recorder.setReaderOpen(false);
    clocks.advance(10_000);
    recorder.flush();
    expect(record).toHaveBeenCalledWith({ date: '2026-11-25', appSeconds: 70, readerSeconds: 40 });
  });

  it('never hands more reader seconds than app seconds in one batch', () => {
    const clocks = manualClocks();
    const record = jest.fn();
    const recorder = createForegroundTimeRecorder({ ...clocks, record, isForeground: true });
    // App 1.0 s then reader joins: app 1.0 -> 1.5, reader 0 -> 0.5... then 0.6 more of both.
    clocks.advance(1_000);
    recorder.flush();
    recorder.setReaderOpen(true);
    clocks.advance(900);
    recorder.flush();
    clocks.advance(200);
    recorder.flush();
    for (const [time] of record.mock.calls) {
      expect(time.readerSeconds).toBeLessThanOrEqual(time.appSeconds);
    }
  });

  it('writes nothing when less than a second has passed', () => {
    const clocks = manualClocks();
    const record = jest.fn();
    const recorder = createForegroundTimeRecorder({ ...clocks, record, isForeground: true });
    clocks.advance(400);
    recorder.flush();
    expect(record).not.toHaveBeenCalled();
  });
});

describe('useForegroundTimeRecording', () => {
  let appStateHandlers: ((state: AppStateStatus) => void)[];

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-25T10:00:00') });
    forgetReaderPresence();
    appStateHandlers = [];
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'change') appStateHandlers.push(handler as (state: AppStateStatus) => void);
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderWithStore() {
    const store = createTestAppStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AppStoreProvider store={store}>{children}</AppStoreProvider>
    );
    const view = await renderHook(
      () =>
        useForegroundTimeRecording({
          monotonicClock: () => Date.now(),
          clock: () => new Date(Date.now()),
        }),
      { wrapper },
    );
    return { store, view };
  }

  it('adds the time to the store every minute, not every second', async () => {
    const { store } = await renderWithStore();
    await act(async () => {
      jest.advanceTimersByTime(MINUTE - 1_000);
    });
    expect(store.getState().timeSpent).toEqual({});
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(store.getState().timeSpent).toEqual({ '2026-11-25': { app: 60, reader: 0 } });
    expect(PROFILE_STATS_CONFIG.foregroundFlushIntervalMs).toBe(MINUTE);
  });

  it('adds the time at once when the app goes to the background, and stops counting', async () => {
    const { store } = await renderWithStore();
    await act(async () => {
      jest.advanceTimersByTime(15_000);
      for (const handler of appStateHandlers) handler('background');
    });
    expect(store.getState().timeSpent).toEqual({ '2026-11-25': { app: 15, reader: 0 } });
    await act(async () => {
      jest.advanceTimersByTime(10 * MINUTE);
    });
    expect(store.getState().timeSpent).toEqual({ '2026-11-25': { app: 15, reader: 0 } });
  });

  it('counts the reader while a reader screen is open', async () => {
    const { store } = await renderWithStore();
    let leave: () => void = () => {};
    await act(async () => {
      jest.advanceTimersByTime(10_000);
      leave = enterReader();
      jest.advanceTimersByTime(30_000);
      leave();
      jest.advanceTimersByTime(20_000);
    });
    expect(store.getState().timeSpent).toEqual({ '2026-11-25': { app: 60, reader: 30 } });
  });

  it('writes what is left when it stops', async () => {
    const { store, view } = await renderWithStore();
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    await act(async () => {
      view.unmount();
    });
    expect(store.getState().timeSpent).toEqual({ '2026-11-25': { app: 5, reader: 0 } });
  });
});
