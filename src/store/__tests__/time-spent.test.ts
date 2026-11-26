import { createMemoryProgressBackup, createMemoryStorage } from '@/data/storage';
import { parseLocalDate as day, type LocalDate } from '@/domain/shared/local-date';
import { MAX_SECONDS_PER_DAY } from '@/domain/stats';

import { loadAppStore } from '../app-store';
import {
  DEFAULT_REMINDERS,
  MAX_TIME_DAYS,
  REJECTED_DATA_KEY,
  RESET_NOTICE_KEY,
  STORED_DATA_KEY,
  STORED_DATA_VERSION,
  STORED_DATE_RANGE,
} from '../config';
import { readBackupDocument, writeBackupDocument } from '../progress-backup';
import { readStoredData, writeStoredData } from '../stored-data';
import type { AppData, AppSettings } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const TODAY = day('2026-11-25');
const YESTERDAY = day('2026-11-24');
const SEED = 4242;

const SETTINGS: AppSettings = {
  language: 'fr',
  dailyGoalPages: 8,
  goalKind: 'own-pace',
  onboardingCompleted: true,
  userSeed: 77,
  lastOpenedPage: null,
  bookmarks: [],
  readerScript: 'uthmani',
  readerTextSize: 1,
  showLevel: true,
  celebratedKhatm: 0,
  gender: null,
  genderAsked: false,
  pauses: [],
  reminders: DEFAULT_REMINDERS,
};

function load(
  storage = createMemoryStorage(),
  backup?: ReturnType<typeof createMemoryProgressBackup>,
) {
  return loadAppStore({ storage, backup, drawUserSeed: () => SEED, onStorageError: jest.fn() });
}

/** A document of the current version with a chosen time part (or none). */
function documentWith(timeSpent: unknown): string {
  return JSON.stringify({
    version: STORED_DATA_VERSION,
    settings: SETTINGS,
    journal: [],
    timeSpent,
  });
}

describe('time counters — foreground seconds per local day, for the app and for the reader', () => {
  describe('addForegroundTime', () => {
    it('starts empty at the first launch', async () => {
      const { store } = await load();
      expect(store.getState().timeSpent).toEqual({});
    });

    it('adds the seconds of a day, for the app and for the reader', async () => {
      const { store } = await load();
      store.getState().addForegroundTime({ date: TODAY, appSeconds: 120, readerSeconds: 45 });
      expect(store.getState().timeSpent).toEqual({ [TODAY]: { app: 120, reader: 45 } });
    });

    it('adds to the seconds already counted that day, and keeps the days apart', async () => {
      const { store } = await load();
      const { addForegroundTime } = store.getState();
      addForegroundTime({ date: TODAY, appSeconds: 100, readerSeconds: 40 });
      addForegroundTime({ date: TODAY, appSeconds: 20, readerSeconds: 0 });
      addForegroundTime({ date: YESTERDAY, appSeconds: 7, readerSeconds: 7 });
      expect(store.getState().timeSpent).toEqual({
        [TODAY]: { app: 120, reader: 40 },
        [YESTERDAY]: { app: 7, reader: 7 },
      });
    });

    it('accepts the bounds: zero seconds on a new day, and a full 25-hour day', async () => {
      const { store } = await load();
      const { addForegroundTime } = store.getState();
      addForegroundTime({
        date: TODAY,
        appSeconds: MAX_SECONDS_PER_DAY,
        readerSeconds: MAX_SECONDS_PER_DAY,
      });
      addForegroundTime({ date: YESTERDAY, appSeconds: 0, readerSeconds: 0 });
      expect(store.getState().timeSpent[TODAY]).toEqual({
        app: MAX_SECONDS_PER_DAY,
        reader: MAX_SECONDS_PER_DAY,
      });
    });

    it('changes nothing, and writes nothing, for zero seconds', async () => {
      const { store } = await load();
      const before = store.getState().timeSpent;
      store.getState().addForegroundTime({ date: TODAY, appSeconds: 0, readerSeconds: 0 });
      expect(store.getState().timeSpent).toBe(before);
    });

    it.each([
      ['negative app seconds', { appSeconds: -1, readerSeconds: 0 }],
      ['negative reader seconds', { appSeconds: 5, readerSeconds: -1 }],
      ['fractional seconds', { appSeconds: 1.5, readerSeconds: 0 }],
      ['seconds that are not a number', { appSeconds: Number.NaN, readerSeconds: 0 }],
      ['infinite seconds', { appSeconds: Infinity, readerSeconds: 0 }],
      ['reader seconds above the app seconds', { appSeconds: 10, readerSeconds: 11 }],
      ['more than a day in one go', { appSeconds: MAX_SECONDS_PER_DAY + 1, readerSeconds: 0 }],
    ])('rejects %s with a RangeError and keeps the state', async (_name, seconds) => {
      const { store } = await load();
      const before = store.getState().timeSpent;
      expect(() => store.getState().addForegroundTime({ date: TODAY, ...seconds })).toThrow(
        RangeError,
      );
      expect(store.getState().timeSpent).toBe(before);
    });

    it('rejects a day that would go over 25 hours, and keeps what was there', async () => {
      const { store } = await load();
      const { addForegroundTime } = store.getState();
      addForegroundTime({ date: TODAY, appSeconds: MAX_SECONDS_PER_DAY - 10, readerSeconds: 0 });
      expect(() => addForegroundTime({ date: TODAY, appSeconds: 11, readerSeconds: 0 })).toThrow(
        RangeError,
      );
      expect(store.getState().timeSpent[TODAY]?.app).toBe(MAX_SECONDS_PER_DAY - 10);
    });

    it.each([
      ['a day before the first storable day', day('2019-12-31')],
      ['a day after the last storable day', '2100-01-01' as LocalDate],
      ['a day that does not exist', '2026-02-30' as LocalDate],
      ['something that is not a day', 'today' as LocalDate],
    ])('rejects %s', async (_name, date) => {
      const { store } = await load();
      expect(() =>
        store.getState().addForegroundTime({ date, appSeconds: 5, readerSeconds: 0 }),
      ).toThrow(RangeError);
      expect(STORED_DATE_RANGE.earliest).toBe('2020-01-01');
    });

    it('keeps at most MAX_TIME_DAYS days, dropping the oldest', async () => {
      const { store } = await load();
      const { addForegroundTime } = store.getState();
      // MAX_TIME_DAYS + 1 consecutive days from the first storable one.
      const first = day(STORED_DATE_RANGE.earliest);
      for (let offset = 0; offset <= MAX_TIME_DAYS; offset += 1) {
        const date = new Date(Date.UTC(2020, 0, 1 + offset))
          .toISOString()
          .slice(0, 10) as LocalDate;
        addForegroundTime({ date, appSeconds: 1, readerSeconds: 0 });
      }
      const days = Object.keys(store.getState().timeSpent);
      expect(days).toHaveLength(MAX_TIME_DAYS);
      expect(days).not.toContain(first);
    });
  });

  describe('kept on the device', () => {
    it('is written with the document and read back at the next launch', async () => {
      const storage = createMemoryStorage();
      const first = await load(storage);
      first.store.getState().addForegroundTime({ date: TODAY, appSeconds: 300, readerSeconds: 90 });
      await first.store.whenSaved();

      const second = await load(storage);
      expect(second.discarded).toEqual([]);
      expect(second.store.getState().timeSpent).toEqual({ [TODAY]: { app: 300, reader: 90 } });
    });

    it('is part of the stored document: version, settings, journal and time', () => {
      const data: AppData = {
        settings: SETTINGS,
        journal: [],
        timeSpent: { [TODAY]: { app: 5, reader: 2 } },
      };
      expect(JSON.parse(writeStoredData(data))).toEqual({
        version: STORED_DATA_VERSION,
        settings: SETTINGS,
        journal: [],
        timeSpent: { [TODAY]: { app: 5, reader: 2 } },
      });
    });
  });

  describe('document written by version 2 of the app (no time yet)', () => {
    const VERSION_2 = JSON.stringify({ version: 2, settings: SETTINGS, journal: [] });

    it('is upgraded: nothing is lost and the time starts empty', () => {
      expect(readStoredData(VERSION_2)).toEqual({
        settings: SETTINGS,
        journal: [],
        timeSpent: {},
        discarded: [],
        wasUpgraded: true,
      });
    });

    it('is rewritten in the current version at the next launch', async () => {
      const storage = createMemoryStorage({ [STORED_DATA_KEY]: VERSION_2 });
      const { store, discarded } = await load(storage);
      expect(discarded).toEqual([]);
      expect(store.getState().settings).toEqual(SETTINGS);
      await store.whenSaved();
      expect(JSON.parse(storage.peek(STORED_DATA_KEY) ?? '')).toMatchObject({
        version: STORED_DATA_VERSION,
        timeSpent: {},
      });
    });

    it('does not trust a time part that a version 2 document should not have', () => {
      const withTime = JSON.stringify({
        version: 2,
        settings: SETTINGS,
        journal: [],
        timeSpent: { [TODAY]: { app: 5, reader: 2 } },
      });
      expect(readStoredData(withTime).timeSpent).toEqual({});
    });
  });

  describe('document written by version 1 of the app', () => {
    it('goes through both upgrades: Friday reminder defaults, then empty time', () => {
      const { fridayTime: _fridayTime, quietHours: _quietHours, ...reminders } = SETTINGS.reminders;
      const version1 = JSON.stringify({
        version: 1,
        settings: { ...SETTINGS, reminders },
        journal: [],
      });
      expect(readStoredData(version1)).toEqual({
        settings: SETTINGS,
        journal: [],
        timeSpent: {},
        discarded: [],
        wasUpgraded: true,
      });
    });
  });

  describe('time that cannot be trusted', () => {
    it.each([
      ['a time part that is not a record', 5],
      ['a time part that is a list', []],
      ['a day that does not exist', { '2026-02-30': { app: 5, reader: 0 } }],
      ['a day before the first storable day', { '2019-12-31': { app: 5, reader: 0 } }],
      ['a day after the last storable day', { '2100-01-01': { app: 5, reader: 0 } }],
      ['a key that is not a day', { yesterday: { app: 5, reader: 0 } }],
      ['negative seconds', { [TODAY]: { app: -5, reader: 0 } }],
      ['fractional seconds', { [TODAY]: { app: 5.5, reader: 0 } }],
      ['seconds that are text', { [TODAY]: { app: '5', reader: 0 } }],
      ['more than 25 hours', { [TODAY]: { app: MAX_SECONDS_PER_DAY + 1, reader: 0 } }],
      ['reader time above the app time', { [TODAY]: { app: 5, reader: 6 } }],
      ['a day without its reader time', { [TODAY]: { app: 5 } }],
      ['a day that is not a record', { [TODAY]: 5 }],
    ])('discards only the time for %s', (_name, timeSpent) => {
      expect(readStoredData(documentWith(timeSpent))).toEqual({
        settings: SETTINGS,
        journal: [],
        timeSpent: null,
        discarded: ['time'],
        wasUpgraded: false,
      });
    });

    it('reads a document without a time part as no time counted yet, not as damaged', () => {
      const raw = JSON.stringify({ version: STORED_DATA_VERSION, settings: SETTINGS, journal: [] });
      expect(readStoredData(raw)).toEqual({
        settings: SETTINGS,
        journal: [],
        timeSpent: {},
        discarded: [],
        wasUpgraded: false,
      });
    });

    it('discards the time of a document that holds more than MAX_TIME_DAYS days', () => {
      const days: Record<string, unknown> = {};
      for (let offset = 0; offset <= MAX_TIME_DAYS; offset += 1) {
        const date = new Date(Date.UTC(2020, 0, 1 + offset)).toISOString().slice(0, 10);
        days[date] = { app: 1, reader: 0 };
      }
      expect(readStoredData(documentWith(days)).discarded).toEqual(['time']);
    });

    it('accepts MAX_TIME_DAYS days exactly', () => {
      const days: Record<string, unknown> = {};
      for (let offset = 0; offset < MAX_TIME_DAYS; offset += 1) {
        const date = new Date(Date.UTC(2020, 0, 1 + offset)).toISOString().slice(0, 10);
        days[date] = { app: 1, reader: 0 };
      }
      expect(readStoredData(documentWith(days)).discarded).toEqual([]);
    });

    it('does not let a key named like an object property in', () => {
      const raw = `{"version":${STORED_DATA_VERSION},"settings":${JSON.stringify(SETTINGS)},"journal":[],"timeSpent":{"__proto__":{"app":5,"reader":0}}}`;
      const reading = readStoredData(raw);
      expect(reading.discarded).toEqual(['time']);
      expect(({} as { app?: number }).app).toBeUndefined();
    });

    it('keeps the settings and the journal, starts the time again, and tells the person nothing', async () => {
      const raw = documentWith({ [TODAY]: { app: -1, reader: 0 } });
      const storage = createMemoryStorage({ [STORED_DATA_KEY]: raw });
      const { store, discarded } = await load(storage);

      expect(discarded).toEqual(['time']);
      expect(store.getState().settings).toEqual(SETTINGS);
      expect(store.getState().timeSpent).toEqual({});
      expect(store.getState().dataResetNotice).toBeNull();

      await store.whenSaved();
      // The text that could not be trusted is kept aside, not lost; the notice is not written.
      expect(storage.peek(REJECTED_DATA_KEY)).toBe(raw);
      expect(storage.peek(RESET_NOTICE_KEY)).toBeNull();
      // And the document is rewritten sound, so the next launch discards nothing.
      expect((await load(storage)).discarded).toEqual([]);
    });
  });

  describe('in the progress backup', () => {
    const DATA: AppData = {
      settings: SETTINGS,
      journal: [{ khatm: 1, page: 3, date: YESTERDAY }],
      timeSpent: {
        [YESTERDAY]: { app: 600, reader: 480 },
        [TODAY]: { app: 120, reader: 0 },
      },
    };

    it('brings back the time with the settings and the journal', () => {
      expect(readBackupDocument(writeBackupDocument(DATA))).toEqual(DATA);
    });

    it('writes the days as numbers: compact', () => {
      const document = writeBackupDocument(DATA) ?? '';
      expect(document).toContain('"t":[[');
      expect(document).not.toContain(TODAY);
    });

    it('is written again after the time changes, and restored on a new device', async () => {
      const backup = createMemoryProgressBackup();
      const first = await load(createMemoryStorage(), backup);
      first.store.getState().completeOnboarding();
      first.store.getState().recordPageRead({ page: 1, date: TODAY });
      first.store
        .getState()
        .addForegroundTime({ date: TODAY, appSeconds: 200, readerSeconds: 150 });
      await first.store.whenBackedUp();

      const second = await load(createMemoryStorage(), backup);
      expect(second.restoredFromBackup).toBe(true);
      expect(second.store.getState().timeSpent).toEqual({ [TODAY]: { app: 200, reader: 150 } });
    });

    it('reads a copy without a time part as no time counted yet', () => {
      const copy = JSON.stringify({ f: 1, v: STORED_DATA_VERSION, s: SETTINGS, k: [] });
      expect(readBackupDocument(copy)).toEqual({ settings: SETTINGS, journal: [], timeSpent: {} });
    });

    it('still reads a copy written by version 2 of the app, with an empty time', () => {
      const version2 = JSON.stringify({ f: 1, v: 2, s: SETTINGS, k: [] });
      expect(readBackupDocument(version2)).toEqual({
        settings: SETTINGS,
        journal: [],
        timeSpent: {},
      });
    });

    it.each([
      ['a time that is not a list', { f: 1, v: STORED_DATA_VERSION, s: SETTINGS, k: [], t: 5 }],
      [
        'a day that is not a triple',
        { f: 1, v: STORED_DATA_VERSION, s: SETTINGS, k: [], t: [[1, 2]] },
      ],
      [
        'a day number out of range',
        { f: 1, v: STORED_DATA_VERSION, s: SETTINGS, k: [], t: [[-1, 2, 1]] },
      ],
      [
        'a day number that is not whole',
        { f: 1, v: STORED_DATA_VERSION, s: SETTINGS, k: [], t: [[1.5, 2, 1]] },
      ],
      [
        'the same day twice',
        {
          f: 1,
          v: STORED_DATA_VERSION,
          s: SETTINGS,
          k: [],
          t: [
            [10, 2, 1],
            [10, 3, 1],
          ],
        },
      ],
      [
        'reader seconds above app seconds',
        { f: 1, v: STORED_DATA_VERSION, s: SETTINGS, k: [], t: [[10, 2, 3]] },
      ],
      [
        'seconds that are negative',
        { f: 1, v: STORED_DATA_VERSION, s: SETTINGS, k: [], t: [[10, -2, 0]] },
      ],
    ])('leaves aside a copy with %s', (_name, copy) => {
      expect(readBackupDocument(JSON.stringify(copy))).toBeNull();
    });
  });
});
