import { createMemoryStorage } from '@/data/storage';
import { gardenVariant } from '@/domain/garden';
import { EMPTY_JOURNAL, getCurrentKhatm, getReadPages } from '@/domain/khatm';
import { parseLocalDate } from '@/domain/shared/local-date';

import { loadAppStore } from '../app-store';
import {
  DEFAULT_DAILY_GOAL_PAGES,
  DEFAULT_REMINDERS,
  STORED_DATA_KEY,
  STORED_DATA_VERSION,
} from '../config';
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
      pauses: [],
      reminders: DEFAULT_REMINDERS,
    });
    expect(store.getState().journal).toBe(EMPTY_JOURNAL);
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
    store.getState().recordPageRead({ page: 1, date: TODAY });
    await store.whenSaved();

    const returning = await load(storage);
    expect(returning.discarded).toEqual([]);
    expect(returning.store.getState().settings).toEqual({
      language: 'ar',
      dailyGoalPages: 20,
      onboardingCompleted: true,
      userSeed: SEED,
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
      discarded: [],
      wasUpgraded: false,
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
