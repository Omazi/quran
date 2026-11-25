import { createMemoryProgressBackup, createMemoryStorage } from '@/data/storage';
import {
  EMPTY_JOURNAL,
  getBadges,
  getCurrentKhatm,
  recordPageRead,
  type ReadingJournal,
} from '@/domain/khatm';
import { addDays, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

import { loadAppStore } from '../app-store';
import {
  DEFAULT_REMINDERS,
  REJECTED_DATA_KEY,
  RESET_NOTICE_KEY,
  STORED_DATA_KEY,
  STORED_DATA_VERSION,
} from '../config';
import {
  BACKUP_FORMAT,
  BACKUP_MAX_KHATMAS,
  BACKUP_SIZE_LIMIT,
  hasProgress,
  readBackupDocument,
  writeBackupDocument,
  type ProgressBackup,
} from '../progress-backup';
import { readStoredData, writeStoredData } from '../stored-data';
import type { AppDataToWrite, AppSettings } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const PAGE_COUNT = 604;
const START = parseLocalDate('2026-01-01');
const SEED = 4242;

const SETTINGS: AppSettings = {
  language: 'ar',
  dailyGoalPages: 12,
  onboardingCompleted: true,
  lastOpenedPage: 293,
  userSeed: 987_654,
  pauses: [{ from: parseLocalDate('2026-03-01'), to: parseLocalDate('2026-03-04') }],
  reminders: { ...DEFAULT_REMINDERS, fridayKahfEnabled: true },
};

/** Reads `pages` pages a day from `firstPage`, one day after the other, starting on `start`. */
function read(
  journal: ReadingJournal,
  start: LocalDate,
  firstPage: number,
  lastPage: number,
  pagesPerDay: number,
): ReadingJournal {
  let next = journal;
  for (let page = firstPage; page <= lastPage; page += 1) {
    const day = Math.floor((page - firstPage) / pagesPerDay);
    next = recordPageRead(next, { page, date: addDays(start, day) });
  }
  return next;
}

/** `count` finished khatmas, one after the other, written directly: the khatm module checks them. */
function finishedKhatmas(count: number, daysPerKhatma = 30): ReadingJournal {
  const journal = [];
  for (let khatm = 1; khatm <= count; khatm += 1) {
    const start = addDays(parseLocalDate('2020-01-01'), (khatm - 1) * daysPerKhatma);
    for (let page = 1; page <= PAGE_COUNT; page += 1) {
      const day = Math.floor(((page - 1) * daysPerKhatma) / PAGE_COUNT);
      journal.push({ khatm, page, date: addDays(start, day) });
    }
  }
  return journal;
}

const JOURNAL = read(read(EMPTY_JOURNAL, START, 1, 60, 10), addDays(START, 20), 100, 104, 5);
const DATA: AppDataToWrite = { settings: SETTINGS, journal: JOURNAL };

function sorted(journal: ReadingJournal) {
  return [...journal].sort((a, b) => a.khatm - b.khatm || a.page - b.page);
}

describe('copy of the progress, as text', () => {
  it('brings back exactly the settings and the journal it was written from', () => {
    const document = writeBackupDocument(DATA);
    const restored = readBackupDocument(document);
    expect(restored?.settings).toEqual(SETTINGS);
    expect(sorted(restored?.journal ?? [])).toEqual(sorted(JOURNAL));
  });

  it('is compact: days as numbers, pages as ranges, far smaller than the stored document', () => {
    const document = writeBackupDocument(DATA) ?? '';
    expect(document).toContain('"1-10"');
    expect(document).toContain('"100-104"');
    expect(document.length).toBeLessThan(writeStoredData(DATA).length / 3);
    // Characters are bytes: the size rule can count characters.
    expect(document).toMatch(/^[\x20-\x7e]*$/);
  });

  it('keeps pages read out of order, and a journal with no page at all', () => {
    let journal = EMPTY_JOURNAL;
    for (const page of [604, 3, 300, 2, 1, 301])
      journal = recordPageRead(journal, { page, date: START });
    const restored = readBackupDocument(writeBackupDocument({ settings: SETTINGS, journal }));
    expect(sorted(restored?.journal ?? [])).toEqual(sorted(journal));

    const empty = readBackupDocument(writeBackupDocument({ settings: SETTINGS, journal: [] }));
    expect(empty).toEqual({ settings: SETTINGS, journal: [], timeSpent: {} });
  });

  it('has nothing to bring back from a first launch in progress', () => {
    const firstLaunch = { ...SETTINGS, onboardingCompleted: false };
    expect(hasProgress({ settings: firstLaunch, journal: [] })).toBe(false);
    expect(hasProgress({ settings: SETTINGS, journal: [] })).toBe(true);
    expect(hasProgress({ settings: firstLaunch, journal: JOURNAL })).toBe(true);
  });
});

describe('size of the copy', () => {
  it('stays under the limit with 500 khatmas, by reducing the oldest to their badge', () => {
    const journal = read(finishedKhatmas(500), parseLocalDate('2061-03-01'), 1, 37, 5);
    const data: AppDataToWrite = { settings: SETTINGS, journal };
    expect(writeStoredData(data).length).toBeGreaterThan(10_000_000);

    const document = writeBackupDocument(data);
    expect(document).not.toBeNull();
    expect(document?.length).toBeLessThanOrEqual(BACKUP_SIZE_LIMIT);

    const restored = readBackupDocument(document);
    if (restored === null) throw new Error('The copy of 500 khatmas could not be read back.');
    // Every khatma is still finished, the khatma in progress is where it was...
    expect(restored.settings).toEqual(SETTINGS);
    expect(getCurrentKhatm(restored.journal)).toBe(501);
    expect(restored.journal).toHaveLength(journal.length);
    expect(sorted(restored.journal.filter(({ khatm }) => khatm >= 500))).toEqual(
      sorted(journal.filter(({ khatm }) => khatm >= 500)),
    );
    // ...and every badge keeps its two dates and its number of days.
    expect(getBadges(restored.journal)).toEqual(getBadges(journal));
  });

  it('reduces only as many khatmas as needed, the oldest first', () => {
    // Sixty slow khatmas (300 days of reading each) pass the limit; a few reduced ones are enough.
    const journal = finishedKhatmas(60, 300);
    const restored = readBackupDocument(writeBackupDocument({ settings: SETTINGS, journal }));
    if (restored === null) throw new Error('The copy could not be read back.');
    const daysOf = (khatm: number) =>
      new Set(restored.journal.filter((entry) => entry.khatm === khatm).map(({ date }) => date))
        .size;
    expect(daysOf(1)).toBe(2);
    const whole = Array.from({ length: 60 }, (_, index) => index + 1).filter(
      (khatm) => daysOf(khatm) > 2,
    );
    // The reduced khatmas are the first ones, without a gap, and most khatmas stay whole.
    expect(whole).toEqual(
      Array.from({ length: whole.length }, (_, index) => 61 - whole.length + index),
    );
    expect(whole.length).toBeGreaterThan(30);
    expect(getBadges(restored.journal)).toEqual(getBadges(journal));
  });

  it('leaves small journals whole', () => {
    const journal = finishedKhatmas(3);
    const restored = readBackupDocument(writeBackupDocument({ settings: SETTINGS, journal }));
    expect(sorted(restored?.journal ?? [])).toEqual(sorted(journal));
  });

  it('writes no copy when even the reduced form is too large', () => {
    const pauses = Array.from({ length: 50 }, () => SETTINGS.pauses[0]).filter(
      (pause) => pause !== undefined,
    );
    // Settings cannot be reduced: made absurdly large here, they alone pass the limit.
    const reminders = { ...DEFAULT_REMINDERS, padding: 'x'.repeat(BACKUP_SIZE_LIMIT) };
    const data = { settings: { ...SETTINGS, pauses, reminders }, journal: JOURNAL };
    expect(writeBackupDocument(data)).toBeNull();
  });
});

describe('copy that cannot be trusted', () => {
  const VALID = writeBackupDocument(DATA) ?? '';
  const parsed = JSON.parse(VALID) as Record<string, unknown>;
  const withChange = (change: Record<string, unknown>) => JSON.stringify({ ...parsed, ...change });

  it.each([
    ['no copy', null],
    ['text that is not JSON', '{"f":1,'],
    ['a list', '[]'],
    ['a copy of an unknown form', withChange({ f: BACKUP_FORMAT + 1 })],
    ['a copy without its form', withChange({ f: undefined })],
    ['settings of an unknown version', withChange({ v: STORED_DATA_VERSION + 1 })],
    ['damaged settings', withChange({ s: { ...SETTINGS, dailyGoalPages: 900 } })],
    ['khatmas that are not a list', withChange({ k: {} })],
    ['a day before the first storable day', withChange({ k: [[[-1, '1-5']]] })],
    ['a day after the last storable day', withChange({ k: [[[40_000, '1-5']]] })],
    ['a page above 604', withChange({ k: [[[10, '600-605']]] })],
    ['a range written backwards', withChange({ k: [[[10, '9-3']]] })],
    ['a range that is not numbers', withChange({ k: [[[10, '1-5;drop']]] })],
    [
      'the same page twice in a khatma',
      withChange({
        k: [
          [
            [10, '1-5'],
            [11, '5'],
          ],
        ],
      }),
    ],
    [
      'more pages than a khatma has',
      withChange({
        k: [
          [
            [10, '1-604'],
            [11, '1-604'],
          ],
        ],
      }),
    ],
    [
      'a second khatma before the first is finished',
      withChange({ k: [[[10, '1-5']], [[11, '1']]] }),
    ],
    ['a reduced khatma that ends before it starts', withChange({ k: [[20, 10], []] })],
    [
      'more khatmas than a copy may hold',
      withChange({ k: Array.from({ length: BACKUP_MAX_KHATMAS + 1 }, () => [1, 2]) }),
    ],
    ['a text longer than any copy the app writes', `${VALID}${' '.repeat(BACKUP_SIZE_LIMIT)}`],
  ])('is left aside whole: %s', (_name, raw) => {
    expect(readBackupDocument(raw)).toBeNull();
  });

  it('accepts both kinds of version 3 copy: with only the page, and with only the time', () => {
    const onlyPage = JSON.stringify({ f: 1, v: 3, s: SETTINGS, k: [] });
    expect(readBackupDocument(onlyPage)).toEqual({
      settings: SETTINGS,
      journal: [],
      timeSpent: {},
    });
    const { lastOpenedPage: _lastOpenedPage, ...withoutPage } = SETTINGS;
    // Day 0 of a copy's time is 2026-01-01; the triple is [day, app seconds, reader seconds].
    const onlyTime = readBackupDocument(
      JSON.stringify({ f: 1, v: 3, s: withoutPage, k: [], t: [[10, 600, 300]] }),
    );
    expect(onlyTime?.settings).toEqual({ ...SETTINGS, lastOpenedPage: null });
    expect(Object.values(onlyTime?.timeSpent ?? {})).toEqual([{ app: 600, reader: 300 }]);
  });

  it('accepts a copy written by version 1 of the app, upgraded like a stored document', () => {
    const { fridayTime: _fridayTime, quietHours: _quietHours, ...reminders } = SETTINGS.reminders;
    const restored = readBackupDocument(withChange({ v: 1, s: { ...SETTINGS, reminders } }));
    expect(restored?.settings.reminders).toEqual({
      ...reminders,
      fridayTime: DEFAULT_REMINDERS.fridayTime,
      quietHours: null,
    });
  });
});

describe('restoring at start-up', () => {
  function load(storage = createMemoryStorage(), backup?: ProgressBackup) {
    return loadAppStore({ storage, backup, drawUserSeed: () => SEED, onStorageError: jest.fn() });
  }

  it('adopts a sound copy when the device holds nothing: the introduction is skipped', async () => {
    const storage = createMemoryStorage();
    const { store, restoredFromBackup, discarded } = await load(
      storage,
      createMemoryProgressBackup(writeBackupDocument(DATA)),
    );
    expect(restoredFromBackup).toBe(true);
    expect(discarded).toEqual([]);
    expect(store.getState().settings).toEqual(SETTINGS);
    expect(store.getState().settings.onboardingCompleted).toBe(true);
    expect(sorted(store.getState().journal)).toEqual(sorted(JOURNAL));
    expect(store.getState().dataResetNotice).toBeNull();

    // The progress is written on the device at once: the next launch needs no copy.
    await store.whenSaved();
    expect(readStoredData(storage.peek(STORED_DATA_KEY)).settings).toEqual(SETTINGS);
  });

  it.each([
    ['damaged', '{"f":1,"k":'],
    ['of an unknown form', JSON.stringify({ f: 99, v: STORED_DATA_VERSION, s: SETTINGS, k: [] })],
    ['of an unknown version', JSON.stringify({ f: BACKUP_FORMAT, v: 99, s: SETTINGS, k: [] })],
  ])('goes on with a normal first launch when the copy is %s', async (_name, copy) => {
    const backup = createMemoryProgressBackup(copy);
    const { store, restoredFromBackup } = await load(createMemoryStorage(), backup);
    expect(restoredFromBackup).toBe(false);
    expect(store.getState().settings.onboardingCompleted).toBe(false);
    expect(store.getState().settings.userSeed).toBe(SEED);
    expect(store.getState().journal).toEqual([]);
    // The copy that could not be used is not replaced by an empty first launch.
    await store.whenBackedUp();
    expect(backup.peek()).toBe(copy);
  });

  it('is a normal first launch when there is no copy, or when the copy cannot be reached', async () => {
    const empty = await load(createMemoryStorage(), createMemoryProgressBackup());
    expect(empty.restoredFromBackup).toBe(false);
    expect(empty.store.getState().settings.onboardingCompleted).toBe(false);

    const unreachable: ProgressBackup = {
      read: () => Promise.reject(new Error('no iCloud')),
      write: () => Promise.reject(new Error('no iCloud')),
    };
    const { store, restoredFromBackup } = await load(createMemoryStorage(), unreachable);
    expect(restoredFromBackup).toBe(false);
    expect(store.getState().settings.userSeed).toBe(SEED);
  });

  it('lets a device that has a page of its own win, and replaces the copy', async () => {
    const ownJournal = recordPageRead(EMPTY_JOURNAL, { page: 7, date: START });
    const local: AppDataToWrite = {
      settings: { ...SETTINGS, dailyGoalPages: 3 },
      journal: ownJournal,
    };
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: writeStoredData(local) });
    const backup = createMemoryProgressBackup(writeBackupDocument(DATA));
    const read = jest.spyOn(backup, 'read');

    const { store, restoredFromBackup } = await load(storage, backup);
    expect(restoredFromBackup).toBe(false);
    expect(store.getState().settings.dailyGoalPages).toBe(3);
    expect(store.getState().journal).toEqual(ownJournal);

    await store.whenBackedUp();
    expect(read).not.toHaveBeenCalled();
    expect(readBackupDocument(backup.peek())).toEqual({ ...local, timeSpent: {} });
  });

  it('adopts the copy at a later start-up too, while the device has no page of its own', async () => {
    // The introduction was finished before the copy arrived: settings on the device, no page.
    const local: AppDataToWrite = { settings: { ...SETTINGS, dailyGoalPages: 3 }, journal: [] };
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: writeStoredData(local) });
    const backup = createMemoryProgressBackup(writeBackupDocument(DATA));

    const { store, restoredFromBackup } = await load(storage, backup);
    expect(restoredFromBackup).toBe(true);
    expect(store.getState().settings).toEqual(SETTINGS);
    expect(sorted(store.getState().journal)).toEqual(sorted(JOURNAL));

    await store.whenBackedUp();
    expect(sorted(readStoredData(storage.peek(STORED_DATA_KEY)).journal ?? [])).toEqual(
      sorted(JOURNAL),
    );
    expect(sorted(readBackupDocument(backup.peek())?.journal ?? [])).toEqual(sorted(JOURNAL));
  });

  it('keeps its own settings when the copy has no page either, and replaces the copy', async () => {
    const local: AppDataToWrite = { settings: { ...SETTINGS, dailyGoalPages: 3 }, journal: [] };
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: writeStoredData(local) });
    const backup = createMemoryProgressBackup(
      writeBackupDocument({ settings: SETTINGS, journal: [] }),
    );

    const { store, restoredFromBackup } = await load(storage, backup);
    expect(restoredFromBackup).toBe(false);
    expect(store.getState().settings.dailyGoalPages).toBe(3);
    await store.whenBackedUp();
    expect(readBackupDocument(backup.peek())).toEqual({ ...local, timeSpent: {} });
  });

  it('adopts any sound copy while the introduction is not finished', async () => {
    const unfinished = { ...SETTINGS, onboardingCompleted: false, dailyGoalPages: 3 };
    const storage = createMemoryStorage({
      [STORED_DATA_KEY]: writeStoredData({ settings: unfinished, journal: [] }),
    });
    const copy: AppDataToWrite = { settings: SETTINGS, journal: [] };
    const { store, restoredFromBackup } = await load(
      storage,
      createMemoryProgressBackup(writeBackupDocument(copy)),
    );
    expect(restoredFromBackup).toBe(true);
    expect(store.getState().settings).toEqual(SETTINGS);
  });

  it('brings the journal back when the device rejected its own, and tells nothing', async () => {
    const raw = JSON.stringify({
      version: STORED_DATA_VERSION,
      settings: { ...SETTINGS, dailyGoalPages: 3 },
      journal: 'damaged',
    });
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: raw, [RESET_NOTICE_KEY]: 'settings' });
    const { store, restoredFromBackup, discarded } = await load(
      storage,
      createMemoryProgressBackup(writeBackupDocument(DATA)),
    );
    expect(discarded).toEqual(['journal']);
    expect(restoredFromBackup).toBe(true);
    expect(sorted(store.getState().journal)).toEqual(sorted(JOURNAL));
    // Nothing is lost any more: no notice, not even the one an earlier launch had left.
    expect(store.getState().dataResetNotice).toBeNull();
    await store.whenBackedUp();
    expect(storage.peek(RESET_NOTICE_KEY)).toBeNull();
    expect(storage.peek(REJECTED_DATA_KEY)).toBe(raw);
  });

  it('uses the copy when the document on the device is rejected whole, and tells nothing', async () => {
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: 'not json' });
    const { store, restoredFromBackup, discarded } = await load(
      storage,
      createMemoryProgressBackup(writeBackupDocument(DATA)),
    );
    expect(discarded).toEqual(['document']);
    expect(restoredFromBackup).toBe(true);
    expect(store.getState().settings).toEqual(SETTINGS);
    // Nothing was lost: there is nothing to announce.
    expect(store.getState().dataResetNotice).toBeNull();
  });

  it('neither adopts the copy nor replaces it when the device could not be read', async () => {
    const storage = createMemoryStorage();
    jest.spyOn(storage, 'getItem').mockRejectedValue(new Error('disk'));
    const copy = writeBackupDocument(DATA);
    const backup = createMemoryProgressBackup(copy);
    const { store, restoredFromBackup } = await load(storage, backup);
    expect(restoredFromBackup).toBe(false);
    expect(store.getState().settings.onboardingCompleted).toBe(false);

    // What the device really holds is unknown: the copy is left as it is.
    store.getState().completeOnboarding();
    await store.whenBackedUp();
    expect(store.getState().journal).toEqual([]);
    expect(backup.peek()).toBe(copy);
  });
});

describe('writing the copy', () => {
  function load(backup: ProgressBackup, storage = createMemoryStorage()) {
    return loadAppStore({ storage, backup, drawUserSeed: () => SEED, onStorageError: jest.fn() });
  }

  it('follows every change saved on the device, once there is progress to keep', async () => {
    const backup = createMemoryProgressBackup();
    const { store } = await load(backup);
    // A first launch in progress has nothing to bring back: it must not replace a copy.
    store.getState().setDailyGoalPages(7);
    await store.whenBackedUp();
    expect(backup.peek()).toBeNull();

    store.getState().completeOnboarding();
    store.getState().recordPageRead({ page: 1, date: START });
    await store.whenBackedUp();
    const copy = readBackupDocument(backup.peek());
    expect(copy?.settings).toMatchObject({ dailyGoalPages: 7, onboardingCompleted: true });
    expect(copy?.journal).toEqual([{ khatm: 1, page: 1, date: START }]);
  });

  it('adopts a copy that arrives after the start instead of replacing it', async () => {
    // A reinstallation: iCloud has not delivered the copy yet when the app starts.
    const storage = createMemoryStorage();
    const backup = createMemoryProgressBackup();
    const { store, restoredFromBackup } = await load(backup, storage);
    expect(restoredFromBackup).toBe(false);
    store.getState().setDailyGoalPages(7);
    await store.whenBackedUp();

    // The copy arrives while the person goes through the introduction.
    await backup.write(writeBackupDocument(DATA) ?? '');
    store.getState().completeOnboarding();
    await store.whenBackedUp();

    expect(store.getState().settings).toEqual(SETTINGS);
    expect(sorted(store.getState().journal)).toEqual(sorted(JOURNAL));
    expect(sorted(readStoredData(storage.peek(STORED_DATA_KEY)).journal ?? [])).toEqual(
      sorted(JOURNAL),
    );
    expect(sorted(readBackupDocument(backup.peek())?.journal ?? [])).toEqual(sorted(JOURNAL));
  });

  it('lets the device win once it has a page of its own, even if a copy arrives later', async () => {
    const backup = createMemoryProgressBackup();
    const { store } = await load(backup);
    store.getState().completeOnboarding();
    store.getState().recordPageRead({ page: 300, date: START });
    await store.whenBackedUp();

    await backup.write(writeBackupDocument(DATA) ?? '');
    store.getState().setDailyGoalPages(7);
    await store.whenBackedUp();
    expect(store.getState().journal).toEqual([{ khatm: 1, page: 300, date: START }]);
    expect(readBackupDocument(backup.peek())?.journal).toEqual(store.getState().journal);
  });

  it('does not undo a change of setting made before the first page is read', async () => {
    const backup = createMemoryProgressBackup();
    const { store } = await load(backup);
    store.getState().completeOnboarding();
    await store.whenBackedUp();
    // The copy now holds the device's own earlier settings, and no page.
    store.getState().setDailyGoalPages(9);
    await store.whenBackedUp();
    expect(store.getState().settings.dailyGoalPages).toBe(9);
    expect(readBackupDocument(backup.peek())?.settings.dailyGoalPages).toBe(9);
  });

  it('forgets a notice about a lost journal when the copy brings the journal back', async () => {
    const raw = JSON.stringify({ version: STORED_DATA_VERSION, settings: SETTINGS, journal: 3 });
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: raw });
    const backup = createMemoryProgressBackup();
    const { store } = await load(backup, storage);
    expect(store.getState().dataResetNotice).toBe('journal');
    await store.whenBackedUp();
    expect(storage.peek(RESET_NOTICE_KEY)).toBe('journal');

    await backup.write(writeBackupDocument(DATA) ?? '');
    store.getState().setDailyGoalPages(9);
    await store.whenBackedUp();
    expect(sorted(store.getState().journal)).toEqual(sorted(JOURNAL));
    expect(store.getState().dataResetNotice).toBeNull();
    expect(storage.peek(RESET_NOTICE_KEY)).toBeNull();
  });

  it('writes the copy only after the device has kept the change', async () => {
    const storage = createMemoryStorage();
    const { store } = await loadAppStore({
      storage,
      backup: createMemoryProgressBackup(),
      drawUserSeed: () => SEED,
      onStorageError: jest.fn(),
    });
    await store.whenBackedUp();

    const backup = createMemoryProgressBackup();
    const failing = await loadAppStore({
      storage: { ...storage, setItem: () => Promise.reject(new Error('full')) },
      backup,
      drawUserSeed: () => SEED,
      onStorageError: jest.fn(),
    });
    failing.store.getState().completeOnboarding();
    await failing.store.whenBackedUp();
    expect(backup.peek()).toBeNull();
  });

  it('never shows a failure of the copy, and keeps saving on the device', async () => {
    const write = jest.fn(() => Promise.reject(new Error('iCloud is full')));
    const storage = createMemoryStorage();
    const onStorageError = jest.fn();
    const { store } = await loadAppStore({
      storage,
      backup: { read: async () => null, write },
      drawUserSeed: () => SEED,
      onStorageError,
    });
    store.getState().completeOnboarding();
    store.getState().setDailyGoalPages(9);
    await expect(store.whenBackedUp()).resolves.toBeUndefined();

    expect(write).toHaveBeenCalled();
    expect(onStorageError).not.toHaveBeenCalled();
    expect(readStoredData(storage.peek(STORED_DATA_KEY)).settings?.dailyGoalPages).toBe(9);
  });

  it('works without any copy at all', async () => {
    const { store, restoredFromBackup } = await loadAppStore({
      storage: createMemoryStorage(),
      drawUserSeed: () => SEED,
    });
    store.getState().completeOnboarding();
    await expect(store.whenBackedUp()).resolves.toBeUndefined();
    expect(restoredFromBackup).toBe(false);
  });
});
