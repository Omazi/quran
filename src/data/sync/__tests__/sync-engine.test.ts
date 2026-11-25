import { createMemoryStorage } from '@/data/storage';
import { parseLocalDate } from '@/domain/shared/local-date';
import { SYNC_CONFIG, SyncBackendError, eventId } from '@/domain/sync';
import { loadAppStore, type AppStore } from '@/store';

import { createMemorySyncBackend, type MemorySyncBackend } from '../memory-backend';
import { createSyncClock } from '../sync-clock';
import { createSyncEngine, type SyncEngine, type SyncEngineOptions } from '../sync-engine';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const DAY = parseLocalDate('2026-11-20');
const SERVER_NOW = 1_800_000_000_000;

/** Timers the test fires by hand. */
function manualTimers() {
  let pending: { run: () => void; ms: number; id: number }[] = [];
  let next = 0;
  return {
    setTimer: (run: () => void, ms: number) => {
      next += 1;
      pending.push({ run, ms, id: next });
      return next;
    },
    clearTimer: (id: unknown) => {
      pending = pending.filter((timer) => timer.id !== id);
    },
    delays: () => pending.map((timer) => timer.ms),
    /** Fires every timer waiting now. */
    fire: async () => {
      const due = pending;
      pending = [];
      for (const timer of due) timer.run();
      await flush();
    },
  };
}

async function flush() {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

interface Phone {
  store: AppStore;
  engine: SyncEngine;
  timers: ReturnType<typeof manualTimers>;
  storage: ReturnType<typeof createMemoryStorage>;
}

async function phone(
  backend: MemorySyncBackend | null,
  {
    account = 'user-1',
    name = 'phone',
    storage = createMemoryStorage(),
    clockOffset = 0,
    options = {},
  }: {
    account?: string | null;
    name?: string;
    storage?: ReturnType<typeof createMemoryStorage>;
    clockOffset?: number;
    options?: Partial<SyncEngineOptions>;
  } = {},
): Promise<Phone> {
  const clock = createSyncClock(() => SERVER_NOW + clockOffset);
  const { store } = await loadAppStore({
    storage,
    drawUserSeed: () => 3,
    onStorageError: jest.fn(),
    now: clock.now,
    newDeviceId: () => name,
  });
  const timers = manualTimers();
  const engine = createSyncEngine({
    store,
    backend,
    getAccount: async () => account,
    clock,
    random: () => 1,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    ...options,
  });
  return { store, engine, timers, storage };
}

describe('without a server or without an account', () => {
  it('says the progress is saved on this phone, and nothing breaks', async () => {
    const { store, engine } = await phone(null);
    store.getState().recordPageRead({ page: 1, date: DAY });
    await engine.syncNow();
    expect(engine.getStatus()).toEqual({ state: 'local-only' });
    expect(store.getState().journal).toHaveLength(1);
  });

  it('stays local before the sign-in, and sends nothing', async () => {
    const backend = createMemorySyncBackend({ now: () => SERVER_NOW });
    const { store, engine } = await phone(backend, { account: null });
    store.getState().recordPageRead({ page: 1, date: DAY });
    await engine.syncNow();
    expect(engine.getStatus()).toEqual({ state: 'local-only' });
    expect(backend.calls).toEqual({ push: 0, pull: 0 });
  });
});

describe('signed in', () => {
  it('sends the phone’s progress, then says when it synced', async () => {
    const backend = createMemorySyncBackend({ now: () => SERVER_NOW });
    const { store, engine } = await phone(backend);
    store.getState().recordPageRead({ page: 1, date: DAY });
    await engine.syncNow();
    expect(backend.rows().map((row) => row.id)).toContain(
      eventId({ kind: 'page', khatm: 1, page: 1, date: DAY }),
    );
    expect(engine.getStatus()).toEqual({ state: 'synced', lastSyncedAt: SERVER_NOW });
    expect(store.getState().sync.outbox).toEqual([]);
  });

  it('two phones end with the same progress', async () => {
    const backend = createMemorySyncBackend({ now: () => SERVER_NOW });
    const a = await phone(backend, { name: 'a' });
    const b = await phone(backend, { name: 'b' });
    a.store.getState().recordPageRead({ page: 1, date: DAY });
    a.store.getState().setDailyGoalPages(15);
    b.store.getState().recordPageRead({ page: 2, date: DAY });
    await a.engine.syncNow();
    await b.engine.syncNow();
    await a.engine.syncNow();
    for (const { store } of [a, b]) {
      expect(
        store
          .getState()
          .journal.map((entry) => entry.page)
          .sort(),
      ).toEqual([1, 2]);
      expect(store.getState().settings.dailyGoalPages).toBe(15);
    }
  });

  it('a reinstalled app gets everything back at the sign-in', async () => {
    const backend = createMemorySyncBackend({ now: () => SERVER_NOW });
    const old = await phone(backend, { name: 'old' });
    for (let page = 1; page <= 300; page += 1) {
      old.store.getState().recordPageRead({ page, date: DAY });
    }
    old.store.getState().addForegroundTime({ date: DAY, appSeconds: 600, readerSeconds: 500 });
    old.store.getState().toggleBookmark(42);
    await old.engine.syncNow();
    const fresh = await phone(backend, { name: 'fresh' });
    await fresh.engine.syncNow();
    expect(fresh.store.getState().journal).toHaveLength(300);
    expect(fresh.store.getState().timeSpent[DAY]).toEqual({ app: 600, reader: 500 });
    expect(fresh.store.getState().settings.bookmarks).toEqual([42]);
    // More than one page of events was read, and every batch was within the server's limit.
    expect(backend.calls.pull).toBeGreaterThan(1);
  });
});

describe('offline, and failures', () => {
  it('keeps the changes on the phone, says so, and tries again later, waiting longer each time', async () => {
    const backend = createMemorySyncBackend({ now: () => SERVER_NOW });
    const { store, engine, timers } = await phone(backend);
    backend.offline = true;
    store.getState().recordPageRead({ page: 1, date: DAY });
    await engine.syncNow();
    expect(engine.getStatus()).toMatchObject({ state: 'offline', lastSyncedAt: null });
    expect(store.getState().sync.outbox.length).toBeGreaterThan(0);
    expect(timers.delays()).toContain(SYNC_CONFIG.retryBaseMs);
    await timers.fire();
    expect(timers.delays()).toContain(SYNC_CONFIG.retryBaseMs * 2);
    backend.offline = false;
    await timers.fire();
    expect(engine.getStatus()).toMatchObject({ state: 'synced' });
    expect(store.getState().sync.outbox).toEqual([]);
  });

  it('a failure in the middle keeps what was sent, and the next sync finishes without doubles', async () => {
    const backend = createMemorySyncBackend({ now: () => SERVER_NOW });
    const { store, engine, timers } = await phone(backend);
    for (let page = 1; page <= SYNC_CONFIG.pushBatchSize + 50; page += 1) {
      store.getState().recordPageRead({ page, date: DAY });
    }
    const realPush = backend.push;
    let pushes = 0;
    backend.push = async (events) => {
      pushes += 1;
      if (pushes === 2) throw new SyncBackendError('offline', 'cut');
      return realPush(events);
    };
    await engine.syncNow();
    expect(engine.getStatus()).toMatchObject({ state: 'offline' });
    const left = store.getState().sync.outbox.length;
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(SYNC_CONFIG.pushBatchSize + 50);
    await timers.fire();
    expect(engine.getStatus()).toMatchObject({ state: 'synced' });
    const ids = backend.rows().map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.startsWith('p.'))).toHaveLength(SYNC_CONFIG.pushBatchSize + 50);
  });

  it('says it will try again by itself when the server refuses for now', async () => {
    const backend = createMemorySyncBackend({ now: () => SERVER_NOW });
    const { engine } = await phone(backend);
    backend.failNext('pull', 'rate-limited');
    await engine.syncNow();
    expect(engine.getStatus()).toMatchObject({ state: 'waiting' });
  });
});

describe('when it syncs', () => {
  it('a change on the phone is sent a little later, once', async () => {
    const backend = createMemorySyncBackend({ now: () => SERVER_NOW });
    const { store, engine, timers } = await phone(backend);
    engine.start();
    await flush();
    const before = backend.calls.push;
    store.getState().recordPageRead({ page: 1, date: DAY });
    store.getState().recordPageRead({ page: 2, date: DAY });
    expect(timers.delays()).toEqual([SYNC_CONFIG.changeDelayMs]);
    await timers.fire();
    expect(backend.calls.push).toBe(before + 1);
    engine.stop();
  });

  it('two requests at once make one sync, then one more', async () => {
    const backend = createMemorySyncBackend({ now: () => SERVER_NOW });
    const { engine } = await phone(backend);
    await Promise.all([engine.syncNow(), engine.syncNow(), engine.syncNow()]);
    expect(backend.calls.pull).toBeLessThanOrEqual(4);
    expect(engine.getStatus()).toMatchObject({ state: 'synced' });
  });

  it('tells its listeners each change of status', async () => {
    const backend = createMemorySyncBackend({ now: () => SERVER_NOW });
    const { engine } = await phone(backend);
    const seen: string[] = [];
    const stop = engine.subscribe((status) => seen.push(status.state));
    await engine.syncNow();
    stop();
    expect(seen).toEqual(['syncing', 'synced']);
  });

  it('follows the server’s clock when the phone’s is wrong', async () => {
    const backend = createMemorySyncBackend({ now: () => SERVER_NOW });
    const late = await phone(backend, { clockOffset: -3_600_000 });
    await late.engine.syncNow();
    expect(late.engine.getStatus()).toEqual({ state: 'synced', lastSyncedAt: SERVER_NOW });
  });

  it('pulls again on its own while the app is in the foreground, and stops in the background', async () => {
    const backend = createMemorySyncBackend({ now: () => SERVER_NOW });
    const { engine, timers } = await phone(backend);
    engine.setActive(true);
    await flush();
    expect(timers.delays()).toContain(SYNC_CONFIG.pollIntervalMs);
    engine.setActive(false);
    await flush();
    expect(timers.delays()).not.toContain(SYNC_CONFIG.pollIntervalMs);
  });
});
