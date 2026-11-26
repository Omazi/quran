/**
 * The progress is never lost on the phone (docs/specs/sync.md, section 1): every past version of
 * the stored document is upgraded, a second copy of the document stands in for a damaged first
 * one, a document written by a newer version is still read, and an older build of the app still
 * reads what this one writes.
 */
import { createMemoryStorage } from '@/data/storage';
import { EMPTY_JOURNAL, recordPageRead, type ReadingJournal } from '@/domain/khatm';
import { parseLocalDate } from '@/domain/shared/local-date';

import { loadAppStore } from '../app-store';
import {
  REJECTED_DATA_KEY,
  RESET_NOTICE_KEY,
  STORED_DATA_BACKUP_KEY,
  STORED_DATA_KEY,
  STORED_DATA_VERSION,
} from '../config';
import type { KeyValueStorage } from '../storage';
import { readStoredData } from '../stored-data';
import type { AppSettings } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const DAY = parseLocalDate('2026-11-20');

const JOURNAL: ReadingJournal = [1, 2, 3, 4].reduce(
  (journal, page) => recordPageRead(journal, { page, date: DAY }),
  EMPTY_JOURNAL,
);

const SETTINGS: AppSettings = {
  language: 'en',
  dailyGoalPages: 9,
  goalKind: 'own-pace',
  onboardingCompleted: true,
  userSeed: 31_337,
  lastOpenedPage: 4,
  bookmarks: [2],
  readerScript: 'imlaei',
  readerTextSize: 2,
  pauses: [{ from: parseLocalDate('2026-10-01'), to: parseLocalDate('2026-10-02') }],
  reminders: {
    dailyEnabled: true,
    dailyTime: { hour: 21, minute: 15 },
    thirstyGardenEnabled: false,
    fridayKahfEnabled: true,
    fridayTime: { hour: 8, minute: 30 },
    quietHours: null,
  },
};

const { fridayTime: _f, quietHours: _q, ...REMINDERS_V1 } = SETTINGS.reminders;
const { lastOpenedPage: _l, bookmarks: _b, ...SETTINGS_V1_TO_3 } = SETTINGS;
const { bookmarks: _b4, ...SETTINGS_V4 } = SETTINGS;
const TIME = { [DAY]: { app: 600, reader: 420 } };

/** What each version of the app wrote, for the same person. */
const PAST_DOCUMENTS: readonly [string, Record<string, unknown>][] = [
  [
    'version 1',
    { version: 1, settings: { ...SETTINGS_V1_TO_3, reminders: REMINDERS_V1 }, journal: JOURNAL },
  ],
  ['version 2', { version: 2, settings: SETTINGS_V1_TO_3, journal: JOURNAL }],
  [
    'version 3 with the time',
    { version: 3, settings: SETTINGS_V1_TO_3, journal: JOURNAL, timeSpent: TIME },
  ],
  [
    'version 3 with the last page',
    { version: 3, settings: { ...SETTINGS_V1_TO_3, lastOpenedPage: 4 }, journal: JOURNAL },
  ],
  ['version 4', { version: 4, settings: SETTINGS_V4, journal: JOURNAL, timeSpent: TIME }],
  ['version 5', { version: 5, settings: SETTINGS, journal: JOURNAL, timeSpent: TIME }],
];

function load(storage: KeyValueStorage, onStorageError = jest.fn()) {
  return loadAppStore({
    storage,
    drawUserSeed: () => 1,
    onStorageError,
    now: () => 1_000,
    newDeviceId: () => 'phone',
  });
}

describe('an update of the app keeps everything, from every past version', () => {
  it.each(PAST_DOCUMENTS)('%s', async (_name, document) => {
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: JSON.stringify(document) });
    const { store, discarded } = await load(storage);
    await store.whenSaved();

    expect(discarded).toEqual([]);
    const state = store.getState();
    expect(state.dataResetNotice).toBeNull();
    expect(state.journal).toEqual(JOURNAL);
    expect(state.settings.dailyGoalPages).toBe(9);
    expect(state.settings.language).toBe('en');
    expect(state.settings.userSeed).toBe(31_337);
    expect(state.settings.reminders.dailyTime).toEqual({ hour: 21, minute: 15 });
    expect(state.settings.pauses).toEqual(SETTINGS.pauses);
    if (document.version !== 1 && document.version !== 2 && 'timeSpent' in document) {
      expect(state.timeSpent).toEqual(TIME);
    }
    // Rewritten in the current version, with the sync metadata, and read back the same.
    const rewritten = JSON.parse(storage.peek(STORED_DATA_KEY) ?? '{}');
    expect(rewritten.version).toBe(STORED_DATA_VERSION);
    expect(rewritten.sync.deviceId).toBe('phone');
    expect(storage.peek(STORED_DATA_BACKUP_KEY)).toBe(storage.peek(STORED_DATA_KEY));
    const again = await load(storage);
    expect(again.store.getState().journal).toEqual(state.journal);
    expect(again.store.getState().settings).toEqual(state.settings);
    expect(again.store.getState().sync.deviceId).toBe('phone');
  });

  it('time found by the update waits as the baseline, to be compared with the account’s', async () => {
    const [, version5] = PAST_DOCUMENTS[5]!;
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: JSON.stringify(version5) });
    const { store } = await load(storage);
    expect(store.getState().sync.timeBaseline).toEqual(TIME);
    expect(store.getState().sync.time).toEqual({});
  });
});

describe('the second copy of the document', () => {
  it('is written after each change, with the same text', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    store.getState().setDailyGoalPages(17);
    await store.whenSaved();
    expect(storage.peek(STORED_DATA_BACKUP_KEY)).toBe(storage.peek(STORED_DATA_KEY));
    expect(readStoredData(storage.peek(STORED_DATA_BACKUP_KEY)).settings?.dailyGoalPages).toBe(17);
  });

  it.each([
    ['cut in the middle', '{"version":5,"settings":{"langu'],
    ['damaged', JSON.stringify({ version: 5, settings: 4, journal: 'x' })],
  ])('stands in for a first document %s, and nothing is said to the person', async (_name, raw) => {
    const sound = createMemoryStorage();
    const first = await load(sound);
    first.store.getState().recordPageRead({ page: 1, date: DAY });
    first.store.getState().setDailyGoalPages(33);
    await first.store.whenSaved();
    const storage = createMemoryStorage({
      [STORED_DATA_KEY]: raw,
      [STORED_DATA_BACKUP_KEY]: sound.peek(STORED_DATA_BACKUP_KEY) ?? '',
    });

    const { store, discarded, recoveredFromSecondCopy } = await load(storage);
    await store.whenSaved();
    expect(discarded).toEqual([]);
    expect(recoveredFromSecondCopy.length).toBeGreaterThan(0);
    expect(store.getState().dataResetNotice).toBeNull();
    expect(store.getState().journal).toHaveLength(1);
    expect(store.getState().settings.dailyGoalPages).toBe(33);
    expect(store.getState().sync.deviceId).toBe(first.store.getState().sync.deviceId);
    // The damaged text is kept aside, and the first document is whole again.
    expect(storage.peek(REJECTED_DATA_KEY)).toBe(raw);
    expect(readStoredData(storage.peek(STORED_DATA_KEY)).discarded).toEqual([]);
    expect(storage.peek(RESET_NOTICE_KEY)).toBeNull();
  });

  it('stands in for a first document the phone cannot read at all', async () => {
    const sound = createMemoryStorage();
    const first = await load(sound);
    first.store.getState().recordPageRead({ page: 7, date: DAY });
    await first.store.whenSaved();
    const backup = sound.peek(STORED_DATA_BACKUP_KEY);
    const storage: KeyValueStorage = {
      getItem: async (key) => {
        if (key === STORED_DATA_KEY) throw new Error('unreadable');
        return key === STORED_DATA_BACKUP_KEY ? backup : null;
      },
      setItem: async () => {},
      removeItem: async () => {},
    };
    const { store, discarded } = await load(storage);
    expect(discarded).toEqual([]);
    expect(store.getState().journal).toEqual([{ khatm: 1, page: 7, date: DAY }]);
  });

  it('brings everything back when the first document is gone', async () => {
    const sound = createMemoryStorage();
    const first = await load(sound);
    first.store.getState().recordPageRead({ page: 7, date: DAY });
    await first.store.whenSaved();
    const storage = createMemoryStorage({
      [STORED_DATA_BACKUP_KEY]: sound.peek(STORED_DATA_BACKUP_KEY) ?? '',
    });
    const { store } = await load(storage);
    expect(store.getState().journal).toHaveLength(1);
  });

  it('only parts neither copy can give back start again, and the person is told about those', async () => {
    const storage = createMemoryStorage({
      [STORED_DATA_KEY]: JSON.stringify({ version: 5, settings: SETTINGS, journal: 'x' }),
      [STORED_DATA_BACKUP_KEY]: JSON.stringify({ version: 5, settings: SETTINGS, journal: 7 }),
    });
    const { store, discarded } = await load(storage);
    expect(discarded).toEqual(['journal']);
    expect(store.getState().dataResetNotice).toBe('journal');
    expect(store.getState().settings.dailyGoalPages).toBe(9);
  });

  it('a second copy that cannot be written never stops the first', async () => {
    const inner = createMemoryStorage();
    const onStorageError = jest.fn();
    const storage: KeyValueStorage = {
      ...inner,
      setItem: async (key, value) => {
        if (key === STORED_DATA_BACKUP_KEY) throw new Error('full');
        await inner.setItem(key, value);
      },
    };
    const { store } = await load(storage, onStorageError);
    store.getState().setDailyGoalPages(3);
    await store.whenSaved();
    expect(readStoredData(inner.peek(STORED_DATA_KEY)).settings?.dailyGoalPages).toBe(3);
    expect(onStorageError).toHaveBeenCalled();
  });
});

describe('builds of other versions', () => {
  it('an older build reads what this one writes: the sync part and the reader choices are left out', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    store.getState().recordPageRead({ page: 1, date: DAY });
    await store.whenSaved();
    const text = storage.peek(STORED_DATA_KEY);
    // Versions 6 (D41) and 7 only add settings (the reader's two choices, the goal kind).
    const written = JSON.parse(text ?? '{}');
    expect(written.version).toBe(STORED_DATA_VERSION);
    expect(STORED_DATA_VERSION).toBe(7);
    // A version 5 build reads its own device's newer document (`acceptNewer`) with its checks,
    // which look only at the settings they know: those are all there, and valid.
    for (const key of [
      'language',
      'dailyGoalPages',
      'onboardingCompleted',
      'userSeed',
      'lastOpenedPage',
      'bookmarks',
      'pauses',
      'reminders',
    ]) {
      expect(written.settings).toHaveProperty(key);
    }
    const asThisBuildReads = readStoredData(text);
    expect(asThisBuildReads.discarded).toEqual([]);
    expect(asThisBuildReads.journal).toHaveLength(1);
  });

  it('a document of a newer version is read when its core passes the checks', async () => {
    const storage = createMemoryStorage({
      [STORED_DATA_KEY]: JSON.stringify({
        version: STORED_DATA_VERSION + 1,
        settings: SETTINGS,
        journal: JOURNAL,
        timeSpent: TIME,
        somethingNew: { x: 1 },
      }),
    });
    const { store, discarded } = await load(storage);
    expect(discarded).toEqual([]);
    expect(store.getState().journal).toEqual(JOURNAL);
    expect(store.getState().dataResetNotice).toBeNull();
  });

  it('a newer document whose core does not pass is discarded as a whole, as before', async () => {
    const storage = createMemoryStorage({
      [STORED_DATA_KEY]: JSON.stringify({
        version: STORED_DATA_VERSION + 1,
        settings: 1,
        journal: JOURNAL,
      }),
    });
    const { discarded } = await load(storage);
    expect(discarded).toEqual(['document']);
  });
});
