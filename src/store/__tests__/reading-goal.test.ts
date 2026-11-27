/**
 * The reading goal and the reading moment of the first-launch flow (docs/specs/goal-plan.md):
 * what the store keeps, how it travels between phones, and how an older document is upgraded.
 */
import { createMemoryStorage } from '@/data/storage';
import { readingMomentAt } from '@/domain/goal-plan';

import { loadAppStore } from '../app-store';
import { DEFAULT_REMINDERS, STORED_DATA_KEY, STORED_DATA_VERSION } from '../config';
import { SYNC_RULES } from '../sync-bridge';
import { readStoredData } from '../stored-data';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

async function freshStore(storage = createMemoryStorage()) {
  const { store } = await loadAppStore({
    storage,
    drawUserSeed: () => 7,
    onStorageError: jest.fn(),
  });
  return { store, storage };
}

describe('the reading goal in the settings', () => {
  it('came with version 7 of the document', () => {
    expect(STORED_DATA_VERSION).toBeGreaterThanOrEqual(7);
  });

  it('starts on the own pace of 5 pages a day', async () => {
    const { store } = await freshStore();
    expect(store.getState().settings.goalKind).toBe('own-pace');
    expect(store.getState().settings.dailyGoalPages).toBe(5);
  });

  it('a fixed duration sets the kind and the daily goal of the khatm module together', async () => {
    const { store } = await freshStore();
    store.getState().setReadingGoal({ kind: '3-months' });
    expect(store.getState().settings.goalKind).toBe('3-months');
    expect(store.getState().settings.dailyGoalPages).toBe(7);
  });

  it('an own pace keeps the pages chosen', async () => {
    const { store } = await freshStore();
    store.getState().setReadingGoal({ kind: 'own-pace', pagesPerDay: 12 });
    expect(store.getState().settings.goalKind).toBe('own-pace');
    expect(store.getState().settings.dailyGoalPages).toBe(12);
  });

  it('an own pace without pages takes the default of 5', async () => {
    const { store } = await freshStore();
    store.getState().setReadingGoal({ kind: '1-month' });
    store.getState().setReadingGoal({ kind: 'own-pace' });
    expect(store.getState().settings.dailyGoalPages).toBe(5);
  });

  it('the stepper of the settings is an own pace again', async () => {
    const { store } = await freshStore();
    store.getState().setReadingGoal({ kind: '1-year' });
    store.getState().setDailyGoalPages(9);
    expect(store.getState().settings.goalKind).toBe('own-pace');
    expect(store.getState().settings.dailyGoalPages).toBe(9);
  });

  it('refuses a goal the daily goal range would refuse, and keeps the previous goal', async () => {
    const { store } = await freshStore();
    expect(() => store.getState().setReadingGoal({ kind: 'own-pace', pagesPerDay: 0 })).toThrow(
      RangeError,
    );
    expect(() => store.getState().setReadingGoal({ kind: 'own-pace', pagesPerDay: 61 })).toThrow(
      RangeError,
    );
    expect(() => store.getState().setReadingGoal({ kind: '2-weeks' as never })).toThrow();
    expect(store.getState().settings.goalKind).toBe('own-pace');
    expect(store.getState().settings.dailyGoalPages).toBe(5);
  });

  it('is written to the device and read back', async () => {
    const { store, storage } = await freshStore();
    store.getState().setReadingGoal({ kind: '1-month' });
    await store.whenSaved();
    expect(readStoredData(storage.peek(STORED_DATA_KEY)).settings).toMatchObject({
      goalKind: '1-month',
      dailyGoalPages: 21,
    });
  });

  it('travels from phone to phone, and an unknown kind is refused', () => {
    const rule = SYNC_RULES.settings.goalKind;
    expect(rule?.rule).toBe('latest');
    expect(rule?.isValid('1-year')).toBe(true);
    expect(rule?.isValid('2-weeks')).toBe(false);
    expect(rule?.isValid(null)).toBe(false);
  });
});

describe('the reading moment', () => {
  it('turns the daily reminder on at the fixed time of the moment', async () => {
    const { store } = await freshStore();
    store.getState().updateReminders({ dailyEnabled: false });
    store.getState().setReadingMoment('after-fajr');
    expect(store.getState().settings.reminders).toMatchObject({
      dailyEnabled: true,
      dailyTime: { hour: 6, minute: 30 },
    });
  });

  it('is read back from the time of the daily reminder', async () => {
    const { store } = await freshStore();
    store.getState().setReadingMoment('before-sleep');
    expect(readingMomentAt(store.getState().settings.reminders.dailyTime)).toBe('before-sleep');
  });

  it('leaves Friday Al-Kahf and the thirsty garden as they are, on by default', async () => {
    const { store } = await freshStore();
    expect(DEFAULT_REMINDERS.fridayKahfEnabled).toBe(true);
    expect(DEFAULT_REMINDERS.thirstyGardenEnabled).toBe(true);
    store.getState().setReadingMoment('midday');
    expect(store.getState().settings.reminders).toMatchObject({
      fridayKahfEnabled: true,
      thirstyGardenEnabled: true,
    });
  });

  it('refuses an unknown moment', async () => {
    const { store } = await freshStore();
    expect(() => store.getState().setReadingMoment('noon' as never)).toThrow(TypeError);
    expect(store.getState().settings.reminders).toEqual(DEFAULT_REMINDERS);
  });
});

describe('a document written by version 6', () => {
  it('takes the own pace, and keeps its daily goal', () => {
    const settings = {
      language: null,
      dailyGoalPages: 12,
      onboardingCompleted: true,
      userSeed: 5,
      lastOpenedPage: null,
      bookmarks: [],
      readerScript: 'uthmani',
      readerTextSize: 1,
      pauses: [],
      reminders: DEFAULT_REMINDERS,
    };
    const reading = readStoredData(
      JSON.stringify({ version: 6, settings, journal: [], timeSpent: {} }),
    );
    expect(reading.settings).toEqual({
      ...settings,
      goalKind: 'own-pace',
      showLevel: true,
      celebratedKhatm: 0,
      gender: null,
      genderAsked: false,
      soundsEnabled: true,
      hapticsEnabled: true,
    });
    expect(reading.discarded).toEqual([]);
    expect(reading.wasUpgraded).toBe(true);
  });
});
