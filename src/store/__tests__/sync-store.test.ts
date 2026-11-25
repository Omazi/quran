/**
 * The store keeps the sync metadata itself (docs/specs/sync.md): every change made on the phone
 * records, in the same write, what is to be sent; what comes from the account is merged without
 * being sent back as this phone's.
 */
import { createMemoryProgressBackup, createMemoryStorage } from '@/data/storage';
import { parseLocalDate } from '@/domain/shared/local-date';
import type { SyncEvent } from '@/domain/sync';

import { createFirstLaunchSettings, loadAppStore } from '../app-store';
import { STORED_DATA_KEY } from '../config';
import { writeBackupDocument } from '../progress-backup';
import type { KeyValueStorage } from '../storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const DAY = parseLocalDate('2026-11-20');
let clock = 10_000;

function load(storage: KeyValueStorage, extra: Partial<Parameters<typeof loadAppStore>[0]> = {}) {
  return loadAppStore({
    storage,
    drawUserSeed: () => 5,
    onStorageError: jest.fn(),
    now: () => clock,
    newDeviceId: () => 'phone',
    ...extra,
  });
}

function storedSync(storage: ReturnType<typeof createMemoryStorage>) {
  return JSON.parse(storage.peek(STORED_DATA_KEY) ?? '{}').sync;
}

beforeEach(() => {
  clock = 10_000;
});

describe('changes made on the phone', () => {
  it('wait in the outbox once there is an account, written in the same document', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    store.getState().recordPageRead({ page: 1, date: DAY });
    expect(store.getState().sync.outbox).toEqual([]);

    store.getState().syncStartAccount('user-1');
    // The first sign-in sends everything the phone holds, the page read before it included.
    expect(store.getState().sync.outbox).toContainEqual({
      kind: 'page',
      khatm: 1,
      page: 1,
      date: DAY,
    });
    store.getState().recordPageRead({ page: 2, date: DAY });
    clock += 1;
    store.getState().setDailyGoalPages(12);
    await store.whenSaved();
    const sync = storedSync(storage);
    expect(sync.account).toBe('user-1');
    expect(sync.outbox).toContainEqual({ kind: 'page', khatm: 1, page: 2, date: DAY });
    expect(sync.outbox).toContainEqual(
      expect.objectContaining({
        kind: 'setting',
        key: 'dailyGoalPages',
        value: 12,
        device: 'phone',
      }),
    );
  });

  it('time counted on this phone goes to its own counter', async () => {
    const { store } = await load(createMemoryStorage());
    store.getState().addForegroundTime({ date: DAY, appSeconds: 60, readerSeconds: 30 });
    expect(store.getState().sync.time.phone?.[DAY]).toEqual({ app: 60, reader: 30 });
  });

  it('the name of the phone and what waits to be sent survive a restart', async () => {
    const storage = createMemoryStorage();
    const first = await load(storage);
    first.store.getState().syncStartAccount('user-1');
    first.store.getState().toggleBookmark(10);
    await first.store.whenSaved();
    const again = await load(storage, { newDeviceId: () => 'other' });
    expect(again.store.getState().sync.deviceId).toBe('phone');
    expect(again.store.getState().sync.account).toBe('user-1');
    expect(again.store.getState().sync.outbox).toEqual(first.store.getState().sync.outbox);
  });
});

describe('the reader’s script and text size travel like the other settings (D41)', () => {
  it('a choice on this phone waits in the outbox', async () => {
    const { store } = await load(createMemoryStorage());
    store.getState().syncStartAccount('user-1');
    clock += 1;
    store.getState().setReaderScript('imlaei');
    clock += 1;
    store.getState().setReaderTextSize(3);
    expect(store.getState().sync.outbox).toContainEqual(
      expect.objectContaining({ kind: 'setting', key: 'readerScript', value: 'imlaei' }),
    );
    expect(store.getState().sync.outbox).toContainEqual(
      expect.objectContaining({ kind: 'setting', key: 'readerTextSize', value: 3 }),
    );
  });

  it('a choice from the account is applied; a value the store refuses keeps the current one', async () => {
    const { store } = await load(createMemoryStorage());
    store.getState().syncStartAccount('user-1');
    store.getState().syncReceive(
      [
        { kind: 'setting', key: 'readerScript', value: 'imlaei', at: 50_000, device: 'tablet' },
        { kind: 'setting', key: 'readerTextSize', value: 4, at: 50_000, device: 'tablet' },
      ],
      1,
      clock,
    );
    expect(store.getState().settings.readerScript).toBe('imlaei');
    expect(store.getState().settings.readerTextSize).toBe(4);
    store.getState().syncReceive(
      [
        { kind: 'setting', key: 'readerScript', value: 'warsh', at: 60_000, device: 'tablet' },
        { kind: 'setting', key: 'readerTextSize', value: 9, at: 60_000, device: 'tablet' },
      ],
      2,
      clock,
    );
    expect(store.getState().settings.readerScript).toBe('imlaei');
    expect(store.getState().settings.readerTextSize).toBe(4);
  });
});

describe('changes from the account', () => {
  const remote: SyncEvent[] = [
    { kind: 'page', khatm: 1, page: 50, date: DAY },
    { kind: 'setting', key: 'dailyGoalPages', value: 30, at: 50_000, device: 'tablet' },
    { kind: 'setting', key: 'language', value: 'ar', at: 50_000, device: 'tablet' },
    { kind: 'time', device: 'tablet', date: DAY, app: 120, reader: 60 },
    { kind: 'bookmark', page: 9, on: true, at: 50_000, device: 'tablet' },
  ];

  it('are merged, saved, and never put back in this phone’s outbox', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    store.getState().syncStartAccount('user-1');
    const before = store.getState().sync.outbox;
    expect(store.getState().syncReceive(remote, 42, clock)).toBe(true);
    const state = store.getState();
    expect(state.journal).toContainEqual({ khatm: 1, page: 50, date: DAY });
    expect(state.settings.dailyGoalPages).toBe(30);
    expect(state.settings.language).toBe('ar');
    expect(state.settings.bookmarks).toEqual([9]);
    expect(state.timeSpent[DAY]).toEqual({ app: 120, reader: 60 });
    expect(state.sync.outbox).toEqual(before);
    expect(state.sync.cursor).toBe(42);
    await store.whenSaved();
    expect(storedSync(storage).cursor).toBe(42);
    expect(JSON.parse(storage.peek(STORED_DATA_KEY) ?? '{}').settings.dailyGoalPages).toBe(30);
  });

  it('receiving them again changes nothing, and the cursor never goes back', async () => {
    const { store } = await load(createMemoryStorage());
    store.getState().syncReceive(remote, 42, clock);
    const settings = store.getState().settings;
    expect(store.getState().syncReceive(remote, 7, clock)).toBe(false);
    expect(store.getState().settings).toBe(settings);
    expect(store.getState().sync.cursor).toBe(42);
  });

  it('time added on the phone after a merge adds to the total', async () => {
    const { store } = await load(createMemoryStorage());
    store.getState().syncReceive(remote, 1, clock);
    store.getState().addForegroundTime({ date: DAY, appSeconds: 10, readerSeconds: 0 });
    expect(store.getState().timeSpent[DAY]).toEqual({ app: 130, reader: 60 });
  });

  it('forgets what the server received and remembers when it last synced', async () => {
    const { store } = await load(createMemoryStorage());
    store.getState().syncStartAccount('user-1');
    const sent = store.getState().sync.outbox;
    store.getState().syncAcknowledge(sent);
    store.getState().syncMarkSynced(77_000);
    expect(store.getState().sync.outbox).toEqual([]);
    expect(store.getState().sync.lastSyncedAt).toBe(77_000);
  });

  it('settles the time found before the sync against the account’s', async () => {
    const storage = createMemoryStorage({
      [STORED_DATA_KEY]: JSON.stringify({
        version: 5,
        settings: { ...createFirstLaunchSettings(5), onboardingCompleted: true },
        journal: [],
        timeSpent: { [DAY]: { app: 300, reader: 0 } },
      }),
    });
    const { store } = await load(storage);
    store.getState().syncStartAccount('user-1');
    store
      .getState()
      .syncReceive(
        [{ kind: 'time', device: 'old-phone', date: DAY, app: 300, reader: 0 }],
        3,
        clock,
      );
    expect(store.getState().timeSpent[DAY]?.app).toBe(300);
    store.getState().syncSettleTime();
    expect(store.getState().sync.timeBaseline).toBeNull();
    expect(store.getState().timeSpent[DAY]?.app).toBe(300);
  });
});

describe('progress brought back by the iCloud copy', () => {
  it('starts the sync metadata from that progress: its time is the baseline', async () => {
    const settings = { ...createFirstLaunchSettings(5), onboardingCompleted: true };
    const copy = writeBackupDocument({
      settings,
      journal: [{ khatm: 1, page: 3, date: DAY }],
      timeSpent: { [DAY]: { app: 900, reader: 100 } },
    });
    const { store, restoredFromBackup } = await load(createMemoryStorage(), {
      backup: createMemoryProgressBackup(copy),
    });
    expect(restoredFromBackup).toBe(true);
    expect(store.getState().sync.timeBaseline).toEqual({ [DAY]: { app: 900, reader: 100 } });
    expect(store.getState().sync.deviceId).toBe('phone');
  });
});
