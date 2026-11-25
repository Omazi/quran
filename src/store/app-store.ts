import { createStore, type StoreApi } from 'zustand/vanilla';

import { EMPTY_JOURNAL, recordPageRead } from '@/domain/khatm';
import { PAGE_COUNT } from '@/domain/quran';
import { isSupportedLanguage } from '@/i18n';

import {
  DAILY_GOAL_RANGE,
  DEFAULT_DAILY_GOAL_PAGES,
  DEFAULT_REMINDERS,
  MAX_PAUSES,
  REJECTED_DATA_KEY,
  RESET_NOTICE_KEY,
  STORED_DATA_KEY,
  STORED_DATE_RANGE,
  USER_SEED_COUNT,
} from './config';
import {
  hasProgress,
  readBackupDocument,
  writeBackupDocument,
  type ProgressBackup,
} from './progress-backup';
import type { KeyValueStorage } from './storage';
import {
  isDailyGoalPages,
  isLastOpenedPage,
  isQuietHours,
  isReminderTime,
  isStorableDate,
  isUserSeed,
  readPause,
  readStoredData,
  writeStoredData,
  type StoredDataPart,
} from './stored-data';
import type {
  AppData,
  AppSettings,
  AppState,
  DataResetNotice,
  ReminderSettings,
  ReminderTime,
} from './types';

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
  /**
   * The copy of the progress outside the app's storage (docs/specs/backup.md). Without one, the
   * progress lives on the device only.
   */
  readonly backup?: ProgressBackup;
}

/** The store of the app: a zustand store whose every change is written to the device. */
export interface AppStore extends StoreApi<AppState> {
  /** Resolves once every change made so far has been written, or has failed to be. */
  whenSaved: () => Promise<void>;
  /** Resolves once the copy of the progress has followed, or has failed to. */
  whenBackedUp: () => Promise<void>;
}

export interface LoadedAppStore {
  readonly store: AppStore;
  /**
   * What was found on the device but could not be trusted, and was replaced by a fresh start.
   * Empty when all is well, and at the first launch.
   */
  readonly discarded: readonly StoredDataPart[];
  /** True when the device had no page of its own and the progress came back from its copy. */
  readonly restoredFromBackup: boolean;
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
    lastOpenedPage: null,
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

/** What the state holds besides the stored document. */
export interface StateStoreOptions {
  readonly dataResetNotice?: DataResetNotice | null;
  /** Called when the person dismisses the notice, to forget it on the device too. */
  readonly onDataResetNoticeDismissed?: () => void;
}

/**
 * The state and its actions, without any storage behind them. `loadAppStore` adds the storage;
 * the test support of this folder uses it bare.
 */
export function createStateStore(
  initial: AppData,
  { dataResetNotice = null, onDataResetNoticeDismissed }: StateStoreOptions = {},
): StoreApi<AppState> {
  return createStore<AppState>()((set, get) => {
    const changeSettings = (change: Partial<AppSettings>) => {
      set({ settings: { ...get().settings, ...change } });
    };
    return {
      settings: initial.settings,
      journal: initial.journal,
      dataResetNotice,

      dismissDataResetNotice: () => {
        if (get().dataResetNotice === null) return;
        set({ dataResetNotice: null });
        onDataResetNoticeDismissed?.();
      },

      setLanguage: (language) => {
        // Null is a value here: it gives the choice back to the phone (D32).
        if (language !== null && !isSupportedLanguage(language)) {
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

      setLastOpenedPage: (page) => {
        if (!isLastOpenedPage(page)) {
          throw new RangeError(
            `The last page opened must be a page from 1 to ${PAGE_COUNT} or null, received ${String(page)}.`,
          );
        }
        if (get().settings.lastOpenedPage !== page) changeSettings({ lastOpenedPage: page });
      },

      recordPageRead: (pageRead) => {
        if (!isStorableDate(pageRead.date)) {
          throw new RangeError(
            `A page can only be read on a day from ${STORED_DATE_RANGE.earliest} to ${STORED_DATE_RANGE.latest}, received "${String(pageRead.date)}".`,
          );
        }
        // The khatm module returns the very same journal for a page already read.
        const journal = recordPageRead(get().journal, pageRead);
        if (journal !== get().journal) set({ journal });
      },

      addPause: (candidate) => {
        const pause = readPause(candidate);
        if (pause === null) {
          throw new RangeError(
            `A pause needs two days from ${STORED_DATE_RANGE.earliest} to ${STORED_DATE_RANGE.latest}, the end not before the start.`,
          );
        }
        const { pauses } = get().settings;
        if (pauses.length >= MAX_PAUSES) {
          throw new RangeError(`No more than ${MAX_PAUSES} pauses can be kept.`);
        }
        changeSettings({ pauses: [...pauses, pause] });
      },
    };
  });
}

/** Which notice a list of rejected parts calls for. */
function noticeFor(discarded: readonly StoredDataPart[]): DataResetNotice | null {
  const lostSettings = discarded.includes('document') || discarded.includes('settings');
  const lostJournal = discarded.includes('document') || discarded.includes('journal');
  if (lostSettings && lostJournal) return 'everything';
  if (lostSettings) return 'settings';
  return lostJournal ? 'journal' : null;
}

/** A notice left on the device by an earlier launch, or null. Anything else found there is none. */
function readPendingNotice(raw: string | null): DataResetNotice | null {
  return raw === 'settings' || raw === 'journal' || raw === 'everything' ? raw : null;
}

/** The notice to show when one was already waiting and another reset happens. */
function mergeNotices(
  pending: DataResetNotice | null,
  fresh: DataResetNotice | null,
): DataResetNotice | null {
  if (pending === null || fresh === null) return pending ?? fresh;
  return pending === fresh ? pending : 'everything';
}

/**
 * Reads the data kept on the device and builds the store. At the first launch, and whenever what
 * was stored cannot be trusted, the store starts fresh, with a newly drawn seed, and that fresh
 * start is written at once: the seed is drawn one single time.
 *
 * The copy of the progress (docs/specs/backup.md): as long as the device has no page of its own
 * (a new app, or a journal that was rejected), a sound copy is adopted. Once it has one, the
 * device is right, and its data replaces the copy after every successful write, in the
 * background.
 *
 * It never rejects because of the storage or of the copy: a device that cannot read or write
 * still gets a working app, whose data lasts until it is closed.
 */
export async function loadAppStore({
  storage,
  drawUserSeed = drawRandomUserSeed,
  onStorageError = warnAboutStorage,
  backup,
}: AppStoreDependencies): Promise<LoadedAppStore> {
  let raw: string | null = null;
  let pendingNotice: DataResetNotice | null = null;
  let isUnreadable = false;
  try {
    raw = await storage.getItem(STORED_DATA_KEY);
  } catch (error) {
    isUnreadable = true;
    onStorageError(error);
  }
  try {
    pendingNotice = readPendingNotice(await storage.getItem(RESET_NOTICE_KEY));
  } catch (error) {
    onStorageError(error);
  }

  const reading = readStoredData(raw);
  const discarded: readonly StoredDataPart[] = isUnreadable ? ['document'] : reading.discarded;
  const local: AppData = {
    settings: reading.settings ?? createFirstLaunchSettings(drawUserSeed()),
    journal: reading.journal ?? EMPTY_JOURNAL,
  };

  // A device that could not read its own storage does not know what it holds: it neither adopts
  // the copy nor replaces it.
  const copy = isUnreadable ? undefined : backup;
  /**
   * The copy, when it is sound and the device must adopt it instead of replacing it: the device
   * has no page of its own, and the copy brings something. A device without any progress adopts
   * any sound copy; one whose introduction is finished only adopts a copy that has pages, its
   * own settings being the fresher ones (it would otherwise undo each change of a setting).
   */
  const findCopyToAdopt = async (device: AppData): Promise<AppData | null> => {
    if (copy === undefined || device.journal.length > 0) return null;
    try {
      const found = readBackupDocument(await copy.read());
      if (found !== null && (!hasProgress(device) || found.journal.length > 0)) return found;
    } catch {
      // A copy that cannot be reached is no copy.
    }
    return null;
  };
  const restored = await findCopyToAdopt(local);

  // Writes follow each other, so the last change is always the one that stays on the device.
  let lastSave: Promise<void> = Promise.resolve();
  let lastBackup: Promise<void> = Promise.resolve();
  const keep = (key: string, text: string) => {
    lastSave = lastSave.then(() => storage.setItem(key, text)).catch(onStorageError);
  };
  const forget = (key: string) => {
    lastSave = lastSave.then(() => storage.removeItem(key)).catch(onStorageError);
  };

  // A rejected text is kept aside before the fresh start replaces it, and the person is told
  // once. Progress that came back from its copy leaves nothing to tell.
  if (raw !== null && discarded.length > 0) keep(REJECTED_DATA_KEY, raw);
  const dataResetNotice =
    restored === null ? mergeNotices(pendingNotice, noticeFor(discarded)) : null;
  if (dataResetNotice === null && pendingNotice !== null) forget(RESET_NOTICE_KEY);
  else if (dataResetNotice !== null && dataResetNotice !== pendingNotice) {
    keep(RESET_NOTICE_KEY, dataResetNotice);
  }

  const store = createStateStore(restored ?? local, {
    dataResetNotice,
    onDataResetNoticeDismissed: () => forget(RESET_NOTICE_KEY),
  });

  /**
   * Sends the progress to its copy. A first launch with nothing to bring back sends nothing, and
   * a device with no page of its own never replaces a copy that has some: it adopts it, even
   * when that copy arrives after the start (iCloud promises no delay).
   */
  const backUp = (data: AppData) => {
    if (copy === undefined || !hasProgress(data)) return;
    lastBackup = lastBackup
      .then(async () => {
        const found = await findCopyToAdopt(data);
        if (found === null) {
          const document = writeBackupDocument(data);
          if (document !== null) await copy.write(document);
        } else if (store.getState().journal.length === 0) {
          const hadNotice = store.getState().dataResetNotice !== null;
          store.setState({ ...found, dataResetNotice: null });
          if (hadNotice) forget(RESET_NOTICE_KEY);
        }
      })
      // The copy is a comfort, not a duty: its failures are never shown.
      .catch(() => {});
  };
  const save = (data: AppData) => {
    const text = writeStoredData(data);
    lastSave = lastSave
      .then(() => storage.setItem(STORED_DATA_KEY, text))
      .then(() => backUp(data), onStorageError);
  };

  store.subscribe((state, previous) => {
    if (state.settings !== previous.settings || state.journal !== previous.journal) save(state);
  });
  // A fresh start is written at once, and so are an adopted copy and a document upgraded from
  // an older version.
  const isStartingFresh = reading.settings === null || reading.journal === null;
  if (restored !== null || isStartingFresh || reading.wasUpgraded) save(store.getState());
  // Otherwise the device is right: its data replaces the copy.
  else backUp(store.getState());

  // An adopted copy is itself saved and sent back: wait until nothing more follows.
  const whenBackedUp = async (): Promise<void> => {
    let awaitedSave: Promise<void>;
    let awaitedBackup: Promise<void>;
    do {
      awaitedSave = lastSave;
      awaitedBackup = lastBackup;
      await awaitedSave;
      await awaitedBackup;
    } while (awaitedSave !== lastSave || awaitedBackup !== lastBackup);
  };

  return {
    store: Object.assign(store, { whenSaved: () => lastSave, whenBackedUp }),
    discarded,
    restoredFromBackup: restored !== null,
  };
}
