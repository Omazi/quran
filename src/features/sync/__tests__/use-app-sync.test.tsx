import { renderHook } from '@testing-library/react-native';

import { createSyncClock, type SyncEngine } from '@/data/sync';
import { createTestAppStore } from '@/store/test-support/test-store';

import { useAppSync } from '../use-app-sync';

jest.setTimeout(30_000);

function fakeEngine(): SyncEngine {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    setActive: jest.fn(),
    syncNow: jest.fn(async () => {}),
    getStatus: () => ({ state: 'local-only' }),
    subscribe: () => () => {},
  };
}

describe('the sync of the app', () => {
  it('waits for the store, then starts once and stops when the app goes', async () => {
    const engine = fakeEngine();
    const createEngine = jest.fn(() => engine);
    const dependencies = { clock: createSyncClock(), session: null, createEngine };
    const store = createTestAppStore();
    const { result, rerender, unmount } = await renderHook(
      ({ ready }: { ready: boolean }) => useAppSync(ready ? store : null, dependencies),
      { initialProps: { ready: false } },
    );
    expect(result.current).toBeNull();
    expect(createEngine).not.toHaveBeenCalled();
    await rerender({ ready: true });
    expect(result.current).toBe(engine);
    expect(createEngine).toHaveBeenCalledTimes(1);
    expect(createEngine).toHaveBeenCalledWith({ store, clock: dependencies.clock, session: null });
    expect(engine.start).toHaveBeenCalled();
    await unmount();
    expect(engine.stop).toHaveBeenCalled();
  });
});
