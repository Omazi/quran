import { createMemoryProgressBackup, createMemoryStorage } from '@/data/storage';
import { gardenVariant } from '@/domain/garden';
import { EMPTY_JOURNAL, getCurrentKhatm, getReadPages, type Pause } from '@/domain/khatm';
import { parseLocalDate } from '@/domain/shared/local-date';

import { createFirstLaunchSettings, loadAppStore } from '../app-store';
import {
  DEFAULT_DAILY_GOAL_PAGES,
  DEFAULT_REMINDERS,
  MAX_PAUSES,
  REJECTED_DATA_KEY,
  RESET_NOTICE_KEY,
  STORED_DATA_KEY,
  STORED_DATA_VERSION,
} from '../config';
import { readBackupDocument } from '../progress-backup';
import type { KeyValueStorage } from '../storage';
import type { ReminderTime } from '../types';
import { readStoredData } from '../stored-data';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const TODAY = parseLocalDate('2026-11-24');
const SEED = 987_654_321;

function load(storage: KeyValueStorage, onStorageError = jest.fn()) {
  return loadAppStore({ storage, drawUserSeed: () => SEED, onStorageError });
}

/** What the storage holds, read the way the app reads it. */
function stored(storage: ReturnType<typeof createMemoryStorage>) {
  return readStoredData(storage.peek(STORED_DATA_KEY));
}

describe('first launch', () => {
  it('starts with the default settings, an empty journal and a seed drawn once', async () => {
    const drawUserSeed = jest.fn(() => SEED);
    const { store, discarded } = await loadAppStore({
      storage: createMemoryStorage(),
      drawUserSeed,
    });
    expect(discarded).toEqual([]);
    expect(drawUserSeed).toHaveBeenCalledTimes(1);
    expect(store.getState().settings).toEqual({
      language: null,
      dailyGoalPages: DEFAULT_DAILY_GOAL_PAGES,
      onboardingCompleted: false,
      userSeed: SEED,
      lastOpenedPage: null,
      bookmarks: [],
      pauses: [],
      reminders: DEFAULT_REMINDERS,
    });
    expect(store.getState().journal).toBe(EMPTY_JOURNAL);
  });

  it('proposes the two reminders about reading, and leaves the Friday one to the person', async () => {
    const { store } = await load(createMemoryStorage());
    expect(store.getState().settings.reminders).toEqual({
      dailyEnabled: true,
      dailyTime: { hour: 20, minute: 30 },
      thirstyGardenEnabled: true,
      fridayKahfEnabled: false,
      fridayTime: { hour: 9, minute: 0 },
      quietHours: null,
    });
  });

  it('writes the fresh start at once, so the next launch finds the same seed', async () => {
    const storage = createMemoryStorage();
    const first = await load(storage);
    await first.store.whenSaved();

    const drawUserSeed = jest.fn(() => 1);
    const second = await loadAppStore({ storage, drawUserSeed });
    expect(drawUserSeed).not.toHaveBeenCalled();
    expect(second.store.getState().settings.userSeed).toBe(SEED);
    expect(second.discarded).toEqual([]);
  });

  it('draws by default a whole number the garden module accepts', async () => {
    for (const random of [0, 0.5, 1 - Number.EPSILON]) {
      jest.spyOn(Math, 'random').mockReturnValue(random);
      const { store } = await loadAppStore({ storage: createMemoryStorage() });
      const { userSeed } = store.getState().settings;
      expect(Number.isSafeInteger(userSeed)).toBe(true);
      expect(userSeed).toBeGreaterThanOrEqual(0);
      expect(() => gardenVariant(1, userSeed)).not.toThrow();
    }
    jest.restoreAllMocks();
  });

  it('refuses a drawn seed the garden module would refuse', async () => {
    await expect(
      loadAppStore({ storage: createMemoryStorage(), drawUserSeed: () => -1 }),
    ).rejects.toThrow(RangeError);
  });
});

describe('changes', () => {
  it('saves every change, and a returning person finds them all', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    store.getState().setLanguage('ar');
    store.getState().setDailyGoalPages(20);
    store.getState().updateReminders({ dailyEnabled: false, dailyTime: { hour: 6, minute: 15 } });
    store.getState().completeOnboarding();
    store.getState().setLastOpenedPage(293);
    store.getState().recordPageRead({ page: 1, date: TODAY });
    await store.whenSaved();

    const returning = await load(storage);
    expect(returning.discarded).toEqual([]);
    expect(returning.store.getState().settings).toEqual({
      language: 'ar',
      dailyGoalPages: 20,
      onboardingCompleted: true,
      userSeed: SEED,
      lastOpenedPage: 293,
      bookmarks: [],
      pauses: [],
      reminders: { ...DEFAULT_REMINDERS, dailyEnabled: false, dailyTime: { hour: 6, minute: 15 } },
    });
    expect(returning.store.getState().journal).toEqual([{ khatm: 1, page: 1, date: TODAY }]);
  });

  it('keeps the last of several quick changes on the device', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    for (const pages of [2, 3, 4, 59, 60]) store.getState().setDailyGoalPages(pages);
    await store.whenSaved();
    expect(stored(storage).settings?.dailyGoalPages).toBe(60);
  });

  it('writes nothing when nothing changes', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    await store.whenSaved();
    const setItem = jest.spyOn(storage, 'setItem');

    store.getState().setDailyGoalPages(DEFAULT_DAILY_GOAL_PAGES);
    store.getState().updateReminders({});
    store.getState().updateReminders({ dailyTime: { ...DEFAULT_REMINDERS.dailyTime } });
    await store.whenSaved();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('records pages through the khatm module: a page read again changes nothing', async () => {
    const { store } = await load(createMemoryStorage());
    store.getState().recordPageRead({ page: 7, date: TODAY });
    const journal = store.getState().journal;
    store.getState().recordPageRead({ page: 7, date: parseLocalDate('2026-11-25') });
    expect(store.getState().journal).toBe(journal);
    expect(getCurrentKhatm(journal)).toBe(1);
    expect([...getReadPages(journal, 1)]).toEqual([7]);
  });

  it('keeps the last page opened, and nothing is written when it is the same page', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    expect(store.getState().settings.lastOpenedPage).toBeNull();
    store.getState().setLastOpenedPage(604);
    await store.whenSaved();
    expect(stored(storage).settings?.lastOpenedPage).toBe(604);

    const setItem = jest.spyOn(storage, 'setItem');
    store.getState().setLastOpenedPage(604);
    await store.whenSaved();
    expect(setItem).not.toHaveBeenCalled();
    store.getState().setLastOpenedPage(null);
    expect(store.getState().settings.lastOpenedPage).toBeNull();
  });

  it.each([0, 605, 2.5, Number.NaN, -1])('refuses the last page opened %p', async (page) => {
    const { store } = await load(createMemoryStorage());
    expect(() => store.getState().setLastOpenedPage(page)).toThrow(RangeError);
    expect(store.getState().settings.lastOpenedPage).toBeNull();
  });

  it('toggles a bookmark on a page, keeps the pages in order, and saves them', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    expect(store.getState().settings.bookmarks).toEqual([]);
    store.getState().toggleBookmark(293);
    store.getState().toggleBookmark(18);
    store.getState().toggleBookmark(604);
    expect(store.getState().settings.bookmarks).toEqual([18, 293, 604]);
    await store.whenSaved();
    expect(stored(storage).settings?.bookmarks).toEqual([18, 293, 604]);
    store.getState().toggleBookmark(293);
    expect(store.getState().settings.bookmarks).toEqual([18, 604]);
    await store.whenSaved();
    expect((await load(storage)).store.getState().settings.bookmarks).toEqual([18, 604]);
  });

  it.each([0, 605, 2.5, Number.NaN, -1])('refuses a bookmark on page %p', async (page) => {
    const { store } = await load(createMemoryStorage());
    expect(() => store.getState().toggleBookmark(page)).toThrow(RangeError);
    expect(store.getState().settings.bookmarks).toEqual([]);
  });

  it('gives a person with an older document no page opened, and keeps all the rest', async () => {
    const settings = { ...createFirstLaunchSettings(SEED), onboardingCompleted: true };
    const { lastOpenedPage: _lastOpenedPage, ...withoutField } = settings;
    const storage = createMemoryStorage({
      [STORED_DATA_KEY]: JSON.stringify({ version: 2, settings: withoutField, journal: [] }),
    });
    const { store, discarded } = await load(storage);
    expect(discarded).toEqual([]);
    expect(store.getState().settings).toEqual(settings);
    expect(store.getState().settings.lastOpenedPage).toBeNull();
  });

  it.each([0, 61, 2.5, Number.NaN])('refuses a daily goal of %p', async (pages) => {
    const { store } = await load(createMemoryStorage());
    expect(() => store.getState().setDailyGoalPages(pages)).toThrow(RangeError);
    expect(store.getState().settings.dailyGoalPages).toBe(DEFAULT_DAILY_GOAL_PAGES);
  });

  it.each([
    { hour: 24, minute: 0 },
    { hour: -1, minute: 0 },
    { hour: 8, minute: 60 },
    { hour: 8.5, minute: 0 },
  ])('refuses the reminder time %p', async (dailyTime) => {
    const { store } = await load(createMemoryStorage());
    expect(() => store.getState().updateReminders({ dailyTime })).toThrow(RangeError);
    expect(store.getState().settings.reminders).toEqual(DEFAULT_REMINDERS);
  });

  it('saves the Friday time and the quiet hours, and can remove the quiet hours', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    const quietHours = { from: { hour: 22, minute: 0 }, to: { hour: 7, minute: 0 } };
    store.getState().updateReminders({ fridayTime: { hour: 11, minute: 30 }, quietHours });
    expect(store.getState().settings.reminders).toEqual({
      ...DEFAULT_REMINDERS,
      fridayTime: { hour: 11, minute: 30 },
      quietHours,
    });

    store.getState().updateReminders({ quietHours: null });
    await store.whenSaved();
    expect(stored(storage).settings?.reminders).toEqual({
      ...DEFAULT_REMINDERS,
      fridayTime: { hour: 11, minute: 30 },
    });
  });

  it('refuses an impossible Friday time and quiet hours that are not two times', async () => {
    const { store } = await load(createMemoryStorage());
    expect(() => store.getState().updateReminders({ fridayTime: { hour: 9, minute: 61 } })).toThrow(
      RangeError,
    );
    // An untyped caller could pass anything.
    const halfQuietHours = { from: { hour: 22, minute: 0 } } as {
      from: ReminderTime;
      to: ReminderTime;
    };
    expect(() => store.getState().updateReminders({ quietHours: halfQuietHours })).toThrow(
      RangeError,
    );
    expect(store.getState().settings.reminders).toEqual(DEFAULT_REMINDERS);
  });

  it('refuses a language the app does not have and a page the mushaf does not have', async () => {
    const { store } = await load(createMemoryStorage());
    // An untyped caller could pass any text.
    expect(() => store.getState().setLanguage('de' as 'fr')).toThrow(RangeError);
    expect(() => store.getState().recordPageRead({ page: 605, date: TODAY })).toThrow(RangeError);
    expect(store.getState().settings.language).toBeNull();
    expect(store.getState().journal).toBe(EMPTY_JOURNAL);
  });
});

describe('language of the phone (D32)', () => {
  it('is what a fresh install follows: no language is chosen', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    await store.whenSaved();
    expect(store.getState().settings.language).toBeNull();
    expect(stored(storage).settings?.language).toBeNull();
  });

  it('can be chosen again after another language, and a returning person still follows it', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    store.getState().setLanguage('ar');
    store.getState().setLanguage(null);
    expect(store.getState().settings.language).toBeNull();
    await store.whenSaved();

    expect(stored(storage).settings?.language).toBeNull();
    const returning = await load(storage);
    expect(returning.discarded).toEqual([]);
    expect(returning.store.getState().settings.language).toBeNull();
  });

  it('leaves a language chosen before this version where it was', async () => {
    // What a person who chose English in the app has on their device: the document does not change.
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    store.getState().setLanguage('en');
    await store.whenSaved();

    const returning = await load(storage);
    expect(returning.discarded).toEqual([]);
    expect(returning.store.getState().settings.language).toBe('en');
  });

  it('writes nothing when it is chosen while already followed', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    await store.whenSaved();
    const setItem = jest.spyOn(storage, 'setItem');
    store.getState().setLanguage(null);
    await store.whenSaved();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('travels with the copy of the progress, and comes back with it after a reinstallation', async () => {
    const backup = createMemoryProgressBackup();
    const storage = createMemoryStorage();
    const { store } = await loadAppStore({ storage, backup, drawUserSeed: () => SEED });
    store.getState().completeOnboarding();
    store.getState().setLanguage('ar');
    store.getState().setLanguage(null);
    await store.whenBackedUp();
    expect(readBackupDocument(backup.peek())?.settings.language).toBeNull();

    // A new phone: nothing on the device, the copy in iCloud.
    const reinstalled = await loadAppStore({ storage: createMemoryStorage(), backup });
    expect(reinstalled.restoredFromBackup).toBe(true);
    expect(reinstalled.store.getState().settings.language).toBeNull();
  });

  it('is not something an untyped caller can fake: anything but null or a language is refused', async () => {
    const { store } = await load(createMemoryStorage());
    store.getState().setLanguage('fr');
    for (const wrong of [undefined, '', 'device', 'de']) {
      // An untyped caller could pass anything.
      expect(() => store.getState().setLanguage(wrong as unknown as null)).toThrow(RangeError);
    }
    expect(store.getState().settings.language).toBe('fr');
  });
});

describe('document written by version 1 of the app', () => {
  it('gives a returning person all their settings, and is rewritten in the current version', async () => {
    const {
      fridayTime: _fridayTime,
      quietHours: _quietHours,
      ...remindersOfVersion1
    } = {
      ...DEFAULT_REMINDERS,
      dailyEnabled: false,
    };
    const settings = {
      language: 'ar',
      dailyGoalPages: 12,
      onboardingCompleted: true,
      userSeed: 77,
      pauses: [],
      reminders: remindersOfVersion1,
    };
    const journal = [{ khatm: 1, page: 3, date: TODAY }];
    const storage = createMemoryStorage({
      [STORED_DATA_KEY]: JSON.stringify({ version: 1, settings, journal }),
    });
    const { store, discarded } = await load(storage);

    expect(discarded).toEqual([]);
    expect(store.getState().settings).toEqual({
      ...settings,
      lastOpenedPage: null,
      bookmarks: [],
      reminders: { ...DEFAULT_REMINDERS, dailyEnabled: false },
    });
    expect(store.getState().journal).toEqual(journal);

    await store.whenSaved();
    const rewritten: unknown = JSON.parse(storage.peek(STORED_DATA_KEY) ?? '');
    expect(rewritten).toMatchObject({ version: STORED_DATA_VERSION, settings: { userSeed: 77 } });
    expect(stored(storage).wasUpgraded).toBe(false);
  });
});

describe('storage that cannot be trusted', () => {
  it.each([
    ['text that is not JSON', 'not json', ['document']],
    ['a document of another version', JSON.stringify({ version: 99 }), ['document']],
    [
      'damaged settings and journal',
      JSON.stringify({
        version: STORED_DATA_VERSION,
        settings: { dailyGoalPages: 900 },
        journal: 3,
      }),
      ['settings', 'journal'],
    ],
  ])('starts fresh without crashing: %s', async (_name, raw, expected) => {
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: raw });
    const { store, discarded } = await load(storage);
    expect(discarded).toEqual(expected);
    expect(store.getState().settings.onboardingCompleted).toBe(false);
    expect(store.getState().settings.userSeed).toBe(SEED);
    expect(store.getState().journal).toBe(EMPTY_JOURNAL);

    // The damaged content is replaced on the device: the next launch is sound.
    await store.whenSaved();
    expect(stored(storage)).toEqual({
      settings: store.getState().settings,
      journal: [],
      timeSpent: {},
      discarded: [],
      wasUpgraded: false,
      // The sync metadata travels in the same document (docs/specs/sync.md).
      rawSync: JSON.parse(JSON.stringify(store.getState().sync)),
    });
  });

  it('keeps a sound journal when only the settings are damaged', async () => {
    const journal = [{ khatm: 1, page: 3, date: TODAY }];
    const raw = JSON.stringify({ version: STORED_DATA_VERSION, settings: null, journal });
    const { store, discarded } = await load(createMemoryStorage({ [STORED_DATA_KEY]: raw }));
    expect(discarded).toEqual(['settings']);
    expect(store.getState().journal).toEqual(journal);
    expect(store.getState().settings.onboardingCompleted).toBe(false);
  });

  it('still starts when the device cannot read, and says so', async () => {
    const failure = new Error('disk');
    const storage: KeyValueStorage = {
      getItem: () => Promise.reject(failure),
      setItem: () => Promise.reject(failure),
      removeItem: () => Promise.reject(failure),
    };
    const onStorageError = jest.fn();
    const { store, discarded } = await load(storage, onStorageError);
    expect(discarded).toEqual(['document']);
    expect(store.getState().settings.dailyGoalPages).toBe(DEFAULT_DAILY_GOAL_PAGES);

    store.getState().setDailyGoalPages(9);
    await expect(store.whenSaved()).resolves.toBeUndefined();
    expect(store.getState().settings.dailyGoalPages).toBe(9);
    expect(onStorageError).toHaveBeenCalledWith(failure);
  });

  it('warns on the console by default when the device cannot write', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = createMemoryStorage();
    jest.spyOn(storage, 'setItem').mockRejectedValue(new Error('full'));
    const { store } = await loadAppStore({ storage, drawUserSeed: () => SEED });
    await store.whenSaved();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('pauses and dates the store accepts', () => {
  const pause = (from: string, to: string) => ({
    from: parseLocalDate(from),
    to: parseLocalDate(to),
  });

  it('adds a pause, saves it, and a returning person finds it', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    store.getState().addPause(pause('2026-03-01', '2026-03-04'));
    store.getState().addPause(pause('2026-06-10', '2026-06-10'));
    expect(store.getState().settings.pauses).toEqual([
      pause('2026-03-01', '2026-03-04'),
      pause('2026-06-10', '2026-06-10'),
    ]);

    await store.whenSaved();
    const again = await load(storage);
    expect(again.discarded).toEqual([]);
    expect(again.store.getState().settings.pauses).toHaveLength(2);
  });

  it.each([
    ['starts before the window', pause('2019-12-31', '2026-01-01')],
    ['ends after the window', pause('2026-01-01', '2100-01-01')],
    ['starts in year 100', pause('0100-01-01', '2026-01-01')],
    ['ends before it starts', pause('2026-03-04', '2026-03-01')],
  ])('refuses a pause that %s', async (_name, refused) => {
    const { store } = await load(createMemoryStorage());
    expect(() => store.getState().addPause(refused)).toThrow(RangeError);
    expect(store.getState().settings.pauses).toEqual([]);
  });

  it('refuses a pause that is not two days', async () => {
    const { store } = await load(createMemoryStorage());
    // An untyped caller could pass anything.
    const notAPause = { from: '2026-02-30', to: 7 } as unknown as Pause;
    expect(() => store.getState().addPause(notAPause)).toThrow(RangeError);
  });

  it('keeps no more pauses than it accepts back, so what it writes is never rejected', async () => {
    const storage = createMemoryStorage();
    const { store } = await load(storage);
    for (let index = 0; index < MAX_PAUSES; index += 1) {
      store.getState().addPause(pause('2026-03-01', '2026-03-04'));
    }
    expect(() => store.getState().addPause(pause('2026-03-01', '2026-03-04'))).toThrow(RangeError);
    expect(store.getState().settings.pauses).toHaveLength(MAX_PAUSES);

    await store.whenSaved();
    expect(stored(storage).discarded).toEqual([]);
  });

  it.each(['2019-12-31', '2100-01-01', '0100-01-01'])(
    'refuses a page read on %s, outside the window',
    async (date) => {
      const { store } = await load(createMemoryStorage());
      expect(() =>
        store.getState().recordPageRead({ page: 1, date: parseLocalDate(date) }),
      ).toThrow(RangeError);
      expect(store.getState().journal).toBe(EMPTY_JOURNAL);
    },
  );

  it('accepts a page read on the first and on the last day of the window', async () => {
    const { store } = await load(createMemoryStorage());
    store.getState().recordPageRead({ page: 1, date: parseLocalDate('2020-01-01') });
    store.getState().recordPageRead({ page: 2, date: parseLocalDate('2099-12-31') });
    expect(store.getState().journal).toHaveLength(2);
  });
});

describe('rejected text kept aside', () => {
  it('keeps the text that could not be trusted under its own key, untouched', async () => {
    const raw = '{"version":2,"settings":{"dailyGoalPages":900},"journal":3}';
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: raw });
    const { store } = await load(storage);
    await store.whenSaved();
    expect(storage.peek(REJECTED_DATA_KEY)).toBe(raw);
    // The document itself is sound again.
    expect(stored(storage).discarded).toEqual([]);
  });

  it('keeps one generation only: the next rejected text takes its place', async () => {
    const storage = createMemoryStorage({
      [STORED_DATA_KEY]: 'second damaged text',
      [REJECTED_DATA_KEY]: 'first damaged text',
    });
    const { store } = await load(storage);
    await store.whenSaved();
    expect(storage.peek(REJECTED_DATA_KEY)).toBe('second damaged text');
  });

  it('never reads the kept text back, and leaves it alone on a sound launch', async () => {
    const storage = createMemoryStorage({ [REJECTED_DATA_KEY]: 'an old damaged text' });
    const getItem = jest.spyOn(storage, 'getItem');
    const { store, discarded } = await load(storage);
    store.getState().setDailyGoalPages(9);
    await store.whenSaved();
    expect(discarded).toEqual([]);
    expect(getItem).not.toHaveBeenCalledWith(REJECTED_DATA_KEY);
    expect(storage.peek(REJECTED_DATA_KEY)).toBe('an old damaged text');
  });

  it('keeps nothing aside at the first launch, nor for a document upgraded from version 1', async () => {
    const first = createMemoryStorage();
    await (await load(first)).store.whenSaved();
    expect(first.peek(REJECTED_DATA_KEY)).toBeNull();

    const { fridayTime: _fridayTime, quietHours: _quietHours, ...reminders } = DEFAULT_REMINDERS;
    const settings = {
      language: null,
      dailyGoalPages: 5,
      onboardingCompleted: true,
      userSeed: 1,
      pauses: [],
      reminders,
    };
    const upgraded = createMemoryStorage({
      [STORED_DATA_KEY]: JSON.stringify({ version: 1, settings, journal: [] }),
    });
    const { store } = await load(upgraded);
    await store.whenSaved();
    expect(upgraded.peek(REJECTED_DATA_KEY)).toBeNull();
    expect(store.getState().dataResetNotice).toBeNull();
  });
});

describe('telling the person, once, that something was lost', () => {
  const SOUND_SETTINGS = {
    language: 'fr',
    dailyGoalPages: 5,
    onboardingCompleted: true,
    userSeed: 1,
    lastOpenedPage: null,
    bookmarks: [],
    pauses: [],
    reminders: DEFAULT_REMINDERS,
  };
  const document = (change: Record<string, unknown>) =>
    JSON.stringify({
      version: STORED_DATA_VERSION,
      settings: SOUND_SETTINGS,
      journal: [],
      ...change,
    });

  it.each([
    ['the journal', document({ journal: 3 }), 'journal'],
    ['the settings', document({ settings: null }), 'settings'],
    ['both', document({ settings: null, journal: 3 }), 'everything'],
    ['the whole document', 'not json', 'everything'],
  ])('has a notice when %s could not be kept', async (_name, raw, notice) => {
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: raw });
    const { store } = await load(storage);
    expect(store.getState().dataResetNotice).toBe(notice);
  });

  it('has none at the first launch and on a sound launch', async () => {
    const storage = createMemoryStorage();
    const first = await load(storage);
    expect(first.store.getState().dataResetNotice).toBeNull();
    await first.store.whenSaved();
    expect((await load(storage)).store.getState().dataResetNotice).toBeNull();
    expect(storage.peek(RESET_NOTICE_KEY)).toBeNull();
  });

  it('still has it at the next launch if the app was closed before it was read', async () => {
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: document({ journal: 3 }) });
    await (await load(storage)).store.whenSaved();

    // The document is sound now: only the remembered notice says what happened.
    const again = await load(storage);
    expect(again.discarded).toEqual([]);
    expect(again.store.getState().dataResetNotice).toBe('journal');
  });

  it('is forgotten for good once the person has dismissed it', async () => {
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: document({ journal: 3 }) });
    const { store } = await load(storage);
    await store.whenSaved();
    expect(storage.peek(RESET_NOTICE_KEY)).toBe('journal');

    store.getState().dismissDataResetNotice();
    expect(store.getState().dataResetNotice).toBeNull();
    await store.whenSaved();
    expect(storage.peek(RESET_NOTICE_KEY)).toBeNull();
    expect((await load(storage)).store.getState().dataResetNotice).toBeNull();

    // Dismissing again changes nothing, and does not touch the device.
    const removeItem = jest.spyOn(storage, 'removeItem');
    store.getState().dismissDataResetNotice();
    await store.whenSaved();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('covers both losses when a second one happens before the first was read', async () => {
    const storage = createMemoryStorage({
      [STORED_DATA_KEY]: document({ settings: null }),
      [RESET_NOTICE_KEY]: 'journal',
    });
    const { store } = await load(storage);
    expect(store.getState().dataResetNotice).toBe('everything');
    await store.whenSaved();
    expect(storage.peek(RESET_NOTICE_KEY)).toBe('everything');
  });

  it('ignores anything else found under the key of the notice', async () => {
    const storage = createMemoryStorage({ [RESET_NOTICE_KEY]: '<script>' });
    expect((await load(storage)).store.getState().dataResetNotice).toBeNull();
  });

  it('does not change what the device stores as the document', async () => {
    const storage = createMemoryStorage({ [STORED_DATA_KEY]: document({ journal: 3 }) });
    const { store } = await load(storage);
    store.getState().dismissDataResetNotice();
    await store.whenSaved();
    const rewritten: unknown = JSON.parse(storage.peek(STORED_DATA_KEY) ?? '');
    expect(rewritten).toEqual({
      version: STORED_DATA_VERSION,
      settings: SOUND_SETTINGS,
      journal: [],
      timeSpent: {},
      sync: JSON.parse(JSON.stringify(store.getState().sync)),
    });
  });
});
