import { createStore, type StoreApi } from 'zustand/vanilla';

import { goalPagesPerDay, readingMomentTime, READING_MOMENTS } from '@/domain/goal-plan';
import { EMPTY_JOURNAL, recordPageRead } from '@/domain/khatm';
import { PAGE_COUNT } from '@/domain/quran';
import type { LocalDate } from '@/domain/shared/local-date';
import { MAX_SECONDS_PER_DAY, type SecondsByDay } from '@/domain/stats';
import {
  acknowledgePushed,
  createSyncMeta,
  mergeRemoteEvents,
  readSyncMeta,
  recordLocalChanges,
  settleTimeBaseline,
  startAccount,
  type SyncMeta,
} from '@/domain/sync';
import { isSupportedLanguage } from '@/i18n';

import {
  DAILY_GOAL_RANGE,
  DEFAULT_DAILY_GOAL_PAGES,
  DEFAULT_GOAL_KIND,
  DEFAULT_READER_SCRIPT,
  DEFAULT_READER_TEXT_SIZE,
  DEFAULT_REMINDERS,
  DEFAULT_SHOW_LEVEL,
  EMPTY_TIME_SPENT,
  MAX_PAUSES,
  MAX_TIME_DAYS,
  NO_KHATMA_CELEBRATED,
  READER_SCRIPTS,
  READER_TEXT_SIZE_RANGE,
  REJECTED_DATA_KEY,
  RESET_NOTICE_KEY,
  STORED_DATA_BACKUP_KEY,
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
import { drawDeviceId, fromSyncedValues, SYNC_RULES, toSyncedValues } from './sync-bridge';
import {
  isDailyGoalPages,
  isLastOpenedPage,
  isQuietHours,
  isReaderScript,
  isReaderTextSize,
  isReminderTime,
  isStorableDate,
  isUserSeed,
  readPause,
  readStoredData,
  writeStoredData,
  type StoredDataPart,
  type StoredDataReading,
} from './stored-data';
import type {
  AppData,
  AppSettings,
  AppState,
  DataResetNotice,
  ForegroundTime,
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
  /** The device's clock, in milliseconds since 1970: stamps of the sync. Defaults to `Date.now`. */
  readonly now?: () => number;
  /** Draws a new name for this phone (docs/specs/sync.md). Defaults to 20 random characters. */
  readonly newDeviceId?: () => string;
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
  /**
   * Parts the device's document could not give back but its second copy did
   * (`STORED_DATA_BACKUP_KEY`). Nothing was lost for those: the person is not told.
   */
  readonly recoveredFromSecondCopy: readonly StoredDataPart[];
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
    goalKind: DEFAULT_GOAL_KIND,
    onboardingCompleted: false,
    userSeed,
    lastOpenedPage: null,
    bookmarks: [],
    readerScript: DEFAULT_READER_SCRIPT,
    readerTextSize: DEFAULT_READER_TEXT_SIZE,
    showLevel: DEFAULT_SHOW_LEVEL,
    celebratedKhatm: NO_KHATMA_CELEBRATED,
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

/** Whole seconds from 0: what a duration measured by the app is made of. */
function isWholeSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * The time counters with some foreground time added to a day. The oldest days go when there are
 * more than `MAX_TIME_DAYS`. Throws a `RangeError` for anything the stored document would refuse.
 */
function withForegroundTime(current: SecondsByDay, time: ForegroundTime): SecondsByDay {
  const { date, appSeconds, readerSeconds } = time;
  if (!isStorableDate(date)) {
    throw new RangeError(
      `Time can only be counted on a day from ${STORED_DATE_RANGE.earliest} to ${STORED_DATE_RANGE.latest}, received "${String(date)}".`,
    );
  }
  if (!isWholeSeconds(appSeconds) || !isWholeSeconds(readerSeconds) || readerSeconds > appSeconds) {
    throw new RangeError(
      `Time must be whole seconds, and the reader seconds no more than the app seconds, received ${String(appSeconds)} and ${String(readerSeconds)}.`,
    );
  }
  const before = current[date] ?? { app: 0, reader: 0 };
  const after = { app: before.app + appSeconds, reader: before.reader + readerSeconds };
  if (after.app > MAX_SECONDS_PER_DAY) {
    throw new RangeError(
      `A day cannot hold more than 25 hours of time, received ${after.app} seconds on ${date}.`,
    );
  }
  // Days are written as YYYY-MM-DD, so sorting the texts sorts the days.
  const days = Object.entries({ ...current, [date]: after }).sort(([a], [b]) => (a < b ? -1 : 1));
  // The keys come from storable days: the cast only brings back the branded key type.
  return Object.fromEntries(days.slice(-MAX_TIME_DAYS)) as Record<LocalDate, typeof after>;
}

/** What the state holds besides the stored document. */
export interface StateStoreOptions {
  readonly dataResetNotice?: DataResetNotice | null;
  /** Called when the person dismisses the notice, to forget it on the device too. */
  readonly onDataResetNoticeDismissed?: () => void;
  /** The sync metadata read back from the device. Defaults to new metadata for this data. */
  readonly sync?: SyncMeta;
  /** The device's clock, in milliseconds. Defaults to `Date.now`. */
  readonly now?: () => number;
  /** Draws a new name for this phone. */
  readonly newDeviceId?: () => string;
}

/**
 * The state and its actions, without any storage behind them. `loadAppStore` adds the storage;
 * the test support of this folder uses it bare.
 */
export function createStateStore(
  initial: AppData,
  {
    dataResetNotice = null,
    onDataResetNoticeDismissed,
    now = Date.now,
    newDeviceId = drawDeviceId,
    sync = createSyncMeta(toSyncedValues(initial), SYNC_RULES, {
      deviceId: newDeviceId(),
      now: now(),
    }),
  }: StateStoreOptions = {},
): StoreApi<AppState> {
  return createStore<AppState>()((rawSet, get) => {
    /**
     * Every change of the data made on this phone goes through here: the sync metadata records
     * it in the same change, so both are written together (docs/specs/sync.md). Changes that
     * come from the account use `rawSet`: they are not this phone's to send.
     */
    const set = (partial: Partial<AppState>) => {
      const isDataChange = 'settings' in partial || 'journal' in partial || 'timeSpent' in partial;
      if (!isDataChange) {
        rawSet(partial);
        return;
      }
      const state = get();
      const next = { ...state, ...partial };
      const meta = recordLocalChanges(
        state.sync,
        toSyncedValues(state),
        toSyncedValues(next),
        now(),
        SYNC_RULES,
      );
      rawSet(meta === state.sync ? partial : { ...partial, sync: meta });
    };
    const changeSyncMeta = (meta: SyncMeta) => {
      if (meta !== get().sync) rawSet({ sync: meta });
    };
    const changeSettings = (change: Partial<AppSettings>) => {
      set({ settings: { ...get().settings, ...change } });
    };
    return {
      settings: initial.settings,
      journal: initial.journal,
      timeSpent: initial.timeSpent,
      sync,
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
        // The stepper is the own pace: a duration chosen before is no longer what the goal says.
        const { dailyGoalPages, goalKind } = get().settings;
        if (dailyGoalPages !== pages || goalKind !== 'own-pace') {
          changeSettings({ dailyGoalPages: pages, goalKind: 'own-pace' });
        }
      },

      setReadingGoal: (goal) => {
        // The plan names what the goal means (and refuses an unknown kind or impossible pages);
        // the store only keeps what its daily goal accepts.
        const pagesPerDay = goalPagesPerDay(goal);
        if (!isDailyGoalPages(pagesPerDay)) {
          throw new RangeError(
            `The daily goal must be a whole number from ${DAILY_GOAL_RANGE.min} to ${DAILY_GOAL_RANGE.max}, received ${pagesPerDay}.`,
          );
        }
        const { dailyGoalPages, goalKind } = get().settings;
        if (dailyGoalPages !== pagesPerDay || goalKind !== goal.kind) {
          changeSettings({ dailyGoalPages: pagesPerDay, goalKind: goal.kind });
        }
      },

      setReadingMoment: (moment) => {
        if (!READING_MOMENTS.includes(moment)) {
          throw new TypeError(`Unknown reading moment: ${JSON.stringify(moment)}.`);
        }
        const current = get().settings.reminders;
        const reminders = withReminderChange(current, {
          dailyEnabled: true,
          dailyTime: readingMomentTime(moment),
        });
        if (!isSameReminders(current, reminders)) changeSettings({ reminders });
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

      toggleBookmark: (page) => {
        if (!isLastOpenedPage(page)) {
          throw new RangeError(
            `A bookmark is on a page from 1 to ${PAGE_COUNT}, received ${String(page)}.`,
          );
        }
        const current = get().settings.bookmarks;
        const bookmarks = current.includes(page)
          ? current.filter((bookmarked) => bookmarked !== page)
          : [...current, page].sort((first, second) => first - second);
        changeSettings({ bookmarks });
      },

      setReaderScript: (script) => {
        if (!isReaderScript(script)) {
          throw new RangeError(
            `The reader shows ${READER_SCRIPTS.join(' or ')}, received ${String(script)}.`,
          );
        }
        if (get().settings.readerScript !== script) changeSettings({ readerScript: script });
      },

      setReaderTextSize: (step) => {
        if (!isReaderTextSize(step)) {
          const { min, max } = READER_TEXT_SIZE_RANGE;
          throw new RangeError(
            `The reader's text size is a step from ${min} to ${max}, received ${String(step)}.`,
          );
        }
        if (get().settings.readerTextSize !== step) changeSettings({ readerTextSize: step });
      },

      setShowLevel: (showLevel) => {
        if (typeof showLevel !== 'boolean') {
          throw new TypeError(`showLevel must be true or false, received ${String(showLevel)}.`);
        }
        if (get().settings.showLevel !== showLevel) changeSettings({ showLevel });
      },

      markKhatmaCelebrated: (khatm) => {
        if (!Number.isSafeInteger(khatm) || khatm < 1) {
          throw new RangeError(`A khatma is a whole number from 1, received ${String(khatm)}.`);
        }
        if (khatm > get().settings.celebratedKhatm) changeSettings({ celebratedKhatm: khatm });
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

      addForegroundTime: (time) => {
        const timeSpent = withForegroundTime(get().timeSpent, time);
        if (time.appSeconds > 0) set({ timeSpent });
      },

      syncStartAccount: (account) => {
        const state = get();
        changeSyncMeta(startAccount(state.sync, toSyncedValues(state), account));
      },

      syncReceive: (events, cursor, at) => {
        const state = get();
        const merged = mergeRemoteEvents(state.sync, toSyncedValues(state), events, SYNC_RULES, {
          now: at,
          newDeviceId,
        });
        const meta = { ...merged.meta, cursor: Math.max(state.sync.cursor, cursor) };
        if (!merged.changed) {
          rawSet({ sync: meta });
          return false;
        }
        rawSet({ ...fromSyncedValues(state, merged.values), sync: meta });
        return true;
      },

      syncSettleTime: () => {
        const state = get();
        const settled = settleTimeBaseline(state.sync, toSyncedValues(state), SYNC_RULES);
        if (settled.meta === state.sync) return;
        rawSet({ timeSpent: settled.values.timeSpent, sync: settled.meta });
      },

      syncAcknowledge: (sent) => {
        changeSyncMeta(acknowledgePushed(get().sync, sent));
      },

      syncMarkSynced: (at) => {
        changeSyncMeta({ ...get().sync, lastSyncedAt: Math.floor(at) });
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
  now = Date.now,
  newDeviceId = drawDeviceId,
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

  const main = readStoredData(raw, { acceptNewer: true });
  const mainDiscarded: readonly StoredDataPart[] = isUnreadable ? ['document'] : main.discarded;
  // The second copy is only read when the first is missing or lacks a part.
  const needsSecondCopy = raw === null || mainDiscarded.length > 0;
  const second = needsSecondCopy ? await readSecondCopy(storage) : null;
  const reading = combineReadings(main, isUnreadable, second);
  const recoveredFromSecondCopy = mainDiscarded.filter((part) => !reading.discarded.includes(part));
  const discarded = reading.discarded;
  const local: AppData = {
    settings: reading.settings ?? createFirstLaunchSettings(drawUserSeed()),
    journal: reading.journal ?? EMPTY_JOURNAL,
    timeSpent: reading.timeSpent ?? EMPTY_TIME_SPENT,
  };
  const storedSync = readSyncMeta(reading.rawSync, SYNC_RULES);

  // A device that could not read its own storage does not know what it holds: it neither adopts
  // the copy nor replaces it (unless its second copy could be read).
  const copy = isUnreadable && second === null ? undefined : backup;
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
  if (raw !== null && mainDiscarded.length > 0) keep(REJECTED_DATA_KEY, raw);
  const dataResetNotice =
    restored === null ? mergeNotices(pendingNotice, noticeFor(discarded)) : null;
  if (dataResetNotice === null && pendingNotice !== null) forget(RESET_NOTICE_KEY);
  else if (dataResetNotice !== null && dataResetNotice !== pendingNotice) {
    keep(RESET_NOTICE_KEY, dataResetNotice);
  }

  /**
   * Sync metadata for progress that came back from the copy: started again from that progress
   * (its time becomes the baseline), keeping this phone's name and its account, to which the
   * whole progress is then sent.
   */
  const syncMetaFor = (data: AppData, previous: SyncMeta | null): SyncMeta => {
    const values = toSyncedValues(data);
    const fresh = createSyncMeta(values, SYNC_RULES, {
      deviceId: previous?.deviceId ?? newDeviceId(),
      now: now(),
    });
    return previous === null || previous.account === null
      ? fresh
      : startAccount(fresh, values, previous.account);
  };
  const sync = restored === null ? (storedSync ?? undefined) : syncMetaFor(restored, storedSync);

  const store = createStateStore(restored ?? local, {
    dataResetNotice,
    onDataResetNoticeDismissed: () => forget(RESET_NOTICE_KEY),
    sync,
    now,
    newDeviceId,
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
          const sync = syncMetaFor(found, store.getState().sync);
          store.setState({ ...found, sync, dataResetNotice: null });
          if (hadNotice) forget(RESET_NOTICE_KEY);
        }
      })
      // The copy is a comfort, not a duty: its failures are never shown.
      .catch(() => {});
  };
  /**
   * Writes the document, then its second copy with the same text, then the copy of the progress
   * (when the progress itself changed). The second copy is only written once the first write has
   * succeeded: one of the two always holds a whole document.
   */
  const save = (state: AppState, hasProgressChanged = true) => {
    const text = writeStoredData(state, state.sync);
    lastSave = lastSave
      .then(() => storage.setItem(STORED_DATA_KEY, text))
      .then(async () => {
        try {
          await storage.setItem(STORED_DATA_BACKUP_KEY, text);
        } catch (error) {
          onStorageError(error);
        }
        if (hasProgressChanged) backUp(state);
      }, onStorageError);
  };

  store.subscribe((state, previous) => {
    const hasProgressChanged =
      state.settings !== previous.settings ||
      state.journal !== previous.journal ||
      state.timeSpent !== previous.timeSpent;
    if (hasProgressChanged || state.sync !== previous.sync) save(state, hasProgressChanged);
  });
  // A fresh start is written at once, and so are an adopted copy and a document upgraded from
  // an older version.
  const isStartingFresh =
    reading.settings === null || reading.journal === null || reading.timeSpent === null;
  // New sync metadata (an update from a version without sync) is written at once too, so that
  // this phone keeps the name it has just drawn.
  const isSyncNew = storedSync === null;
  if (
    restored !== null ||
    isStartingFresh ||
    reading.wasUpgraded ||
    isSyncNew ||
    recoveredFromSecondCopy.length > 0
  ) {
    save(store.getState());
  }
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
    recoveredFromSecondCopy,
  };
}

/** The second copy of the document, or null when it cannot be read or is not there. */
async function readSecondCopy(storage: KeyValueStorage): Promise<StoredDataReading | null> {
  try {
    const text = await storage.getItem(STORED_DATA_BACKUP_KEY);
    return text === null ? null : readStoredData(text, { acceptNewer: true });
  } catch {
    return null;
  }
}

/**
 * The device's document, with each part it could not give back taken from the second copy when
 * that copy has it. `discarded` names what neither could give back.
 */
function combineReadings(
  main: StoredDataReading,
  isMainUnreadable: boolean,
  second: StoredDataReading | null,
): StoredDataReading {
  const first = isMainUnreadable ? { ...main, discarded: ['document' as const] } : main;
  if (second === null) return first;
  const settings = first.settings ?? second.settings;
  const journal = first.journal ?? second.journal;
  // A time part simply missing from the first document reads as "no time yet", not as damage.
  const isTimeLost = first.discarded.includes('time') || first.discarded.includes('document');
  const timeSpent = isTimeLost ? (second.timeSpent ?? first.timeSpent) : first.timeSpent;
  const discarded: StoredDataPart[] = [];
  const hadDocument = first.discarded.includes('document');
  if (settings === null && (hadDocument || first.discarded.includes('settings'))) {
    discarded.push('settings');
  }
  if (journal === null && (hadDocument || first.discarded.includes('journal'))) {
    discarded.push('journal');
  }
  if (timeSpent === null && isTimeLost) discarded.push('time');
  // Everything lost in a document that could not be read at all is still said as `document`.
  const lostAll = hadDocument && settings === null && journal === null;
  return {
    settings,
    journal,
    timeSpent,
    discarded: lostAll ? ['document'] : discarded,
    wasUpgraded: first.wasUpgraded || (second !== null && settings !== first.settings),
    rawSync: first.rawSync ?? second.rawSync,
  };
}
