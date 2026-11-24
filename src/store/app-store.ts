import { createStore, type StoreApi } from 'zustand/vanilla';

import { EMPTY_JOURNAL, recordPageRead } from '@/domain/khatm';
import { isSupportedLanguage } from '@/i18n';

import {
  DAILY_GOAL_RANGE,
  DEFAULT_DAILY_GOAL_PAGES,
  DEFAULT_REMINDERS,
  STORED_DATA_KEY,
  USER_SEED_COUNT,
} from './config';
import type { KeyValueStorage } from './storage';
import {
  isDailyGoalPages,
  isQuietHours,
  isReminderTime,
  isUserSeed,
  readStoredData,
  writeStoredData,
  type StoredDataPart,
} from './stored-data';
import type { AppData, AppSettings, AppState, ReminderSettings, ReminderTime } from './types';

export interface AppStoreDependencies {
  /** Where the data is kept between two launches. */
  readonly storage: KeyValueStorage;
  /**
   * Draws the user seed, once, at the first launch. Defaults to a random whole number from 0 to
   * 2^53 - 1. It is not a secret: it only varies the look of the gardens.
   */
  readonly drawUserSeed?: () => number;
  /** Told when the data could not be read or written. Defaults to a console warning. */
  readonly onStorageError?: (error: unknown) => void;
}

/** The store of the app: a zustand store whose every change is written to the device. */
export interface AppStore extends StoreApi<AppState> {
  /** Resolves once every change made so far has been written, or has failed to be. */
  whenSaved: () => Promise<void>;
}

export interface LoadedAppStore {
  readonly store: AppStore;
  /**
   * What was found on the device but could not be trusted, and was replaced by a fresh start.
   * Empty when all is well, and at the first launch.
   */
  readonly discarded: readonly StoredDataPart[];
}

function drawRandomUserSeed(): number {
  return Math.floor(Math.random() * USER_SEED_COUNT);
}

function warnAboutStorage(error: unknown): void {
  console.warn('The app data could not be read or written.', error);
}

/** The settings of a person who opens the app for the first time. */
export function createFirstLaunchSettings(userSeed: number): AppSettings {
  if (!isUserSeed(userSeed)) {
    throw new RangeError(
      `userSeed must be a whole number from 0 to 2^53 - 1, received ${userSeed}.`,
    );
  }
  return {
    language: null,
    dailyGoalPages: DEFAULT_DAILY_GOAL_PAGES,
    onboardingCompleted: false,
    userSeed,
    pauses: [],
    reminders: DEFAULT_REMINDERS,
  };
}

function withReminderChange(
  current: ReminderSettings,
  change: Partial<ReminderSettings>,
): ReminderSettings {
  // Built field by field: an unknown key passed by an untyped caller is never stored.
  const next: ReminderSettings = {
    dailyEnabled: change.dailyEnabled ?? current.dailyEnabled,
    dailyTime: change.dailyTime ?? current.dailyTime,
    thirstyGardenEnabled: change.thirstyGardenEnabled ?? current.thirstyGardenEnabled,
    fridayKahfEnabled: change.fridayKahfEnabled ?? current.fridayKahfEnabled,
    fridayTime: change.fridayTime ?? current.fridayTime,
    // Null is a value here: it removes the quiet hours.
    quietHours: change.quietHours === undefined ? current.quietHours : change.quietHours,
  };
  if (!isReminderTime(next.dailyTime) || !isReminderTime(next.fridayTime)) {
    throw new RangeError('A reminder time must be an hour from 0 to 23 and a minute from 0 to 59.');
  }
  if (!isQuietHours(next.quietHours)) {
    throw new RangeError('Quiet hours must be null or two times of day, `from` and `to`.');
  }
  return {
    ...next,
    dailyTime: copyTime(next.dailyTime),
    fridayTime: copyTime(next.fridayTime),
    quietHours:
      next.quietHours === null
        ? null
        : { from: copyTime(next.quietHours.from), to: copyTime(next.quietHours.to) },
  };
}

function copyTime({ hour, minute }: ReminderTime): ReminderTime {
  return { hour, minute };
}

/** The reminder settings hold nothing but booleans, numbers and null: their text compares them. */
function isSameReminders(a: ReminderSettings, b: ReminderSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The state and its actions, without any storage behind them. `loadAppStore` adds the storage;
 * the test support of this folder uses it bare.
 */
export function createStateStore(initial: AppData): StoreApi<AppState> {
  return createStore<AppState>()((set, get) => {
    const changeSettings = (change: Partial<AppSettings>) => {
      set({ settings: { ...get().settings, ...change } });
    };
    return {
      settings: initial.settings,
      journal: initial.journal,

      setLanguage: (language) => {
        if (!isSupportedLanguage(language)) {
          throw new RangeError(`Unsupported language: "${String(language)}".`);
        }
        if (get().settings.language !== language) changeSettings({ language });
      },

      setDailyGoalPages: (pages) => {
        if (!isDailyGoalPages(pages)) {
          throw new RangeError(
            `The daily goal must be a whole number from ${DAILY_GOAL_RANGE.min} to ${DAILY_GOAL_RANGE.max}, received ${pages}.`,
          );
        }
        if (get().settings.dailyGoalPages !== pages) changeSettings({ dailyGoalPages: pages });
      },

      updateReminders: (change) => {
        const current = get().settings.reminders;
        const reminders = withReminderChange(current, change);
        if (!isSameReminders(current, reminders)) changeSettings({ reminders });
      },

      completeOnboarding: () => {
        if (!get().settings.onboardingCompleted) changeSettings({ onboardingCompleted: true });
      },

      recordPageRead: (pageRead) => {
        // The khatm module returns the very same journal for a page already read.
        const journal = recordPageRead(get().journal, pageRead);
        if (journal !== get().journal) set({ journal });
      },
    };
  });
}

/**
 * Reads the data kept on the device and builds the store. At the first launch, and whenever what
 * was stored cannot be trusted, the store starts fresh, with a newly drawn seed, and that fresh
 * start is written at once: the seed is drawn one single time.
 *
 * It never rejects because of the storage: a device that cannot read or write still gets a
 * working app, whose data lasts until it is closed.
 */
export async function loadAppStore({
  storage,
  drawUserSeed = drawRandomUserSeed,
  onStorageError = warnAboutStorage,
}: AppStoreDependencies): Promise<LoadedAppStore> {
  let raw: string | null = null;
  let isUnreadable = false;
  try {
    raw = await storage.getItem(STORED_DATA_KEY);
  } catch (error) {
    isUnreadable = true;
    onStorageError(error);
  }

  const reading = readStoredData(raw);
  const discarded: readonly StoredDataPart[] = isUnreadable ? ['document'] : reading.discarded;
  const store = createStateStore({
    settings: reading.settings ?? createFirstLaunchSettings(drawUserSeed()),
    journal: reading.journal ?? EMPTY_JOURNAL,
  });

  // Writes follow each other, so the last change is always the one that stays on the device.
  let lastSave: Promise<void> = Promise.resolve();
  const save = (data: AppData) => {
    const text = writeStoredData(data);
    lastSave = lastSave.then(() => storage.setItem(STORED_DATA_KEY, text)).catch(onStorageError);
  };

  store.subscribe((state, previous) => {
    if (state.settings !== previous.settings || state.journal !== previous.journal) save(state);
  });
  // A fresh start is written at once, and so is a document upgraded from an older version.
  const isStartingFresh = reading.settings === null || reading.journal === null;
  if (isStartingFresh || reading.wasUpgraded) save(store.getState());

  return { store: Object.assign(store, { whenSaved: () => lastSave }), discarded };
}
