/**
 * The stored document: how the app's data is written to the device and, above all, how it is read
 * back. Nothing read from storage is trusted: the version, every type and every bound are checked,
 * and what fails is discarded instead of crashing the app or reaching the rules of the domain.
 */

import {
  getCurrentKhatm,
  type Pause,
  type ReadingEntry,
  type ReadingJournal,
} from '@/domain/khatm';
import { PAGE_COUNT } from '@/domain/quran';
import { compareLocalDates, isLocalDate, type LocalDate } from '@/domain/shared/local-date';
import { isDaySeconds, type SecondsByDay } from '@/domain/stats';
import { isSupportedLanguage } from '@/i18n';

import {
  DAILY_GOAL_RANGE,
  DEFAULT_READER_SCRIPT,
  DEFAULT_READER_TEXT_SIZE,
  DEFAULT_REMINDERS,
  EMPTY_TIME_SPENT,
  LAST_HOUR,
  LAST_MINUTE,
  MAX_PAUSES,
  MAX_TIME_DAYS,
  READER_SCRIPTS,
  READER_TEXT_SIZE_RANGE,
  STORED_DATA_VERSION,
  STORED_DATE_RANGE,
} from './config';
import type {
  AppDataToWrite,
  AppSettings,
  QuietHours,
  ReminderSettings,
  ReminderTime,
  ReaderScript,
} from './types';

/** A part of the stored document that can be kept or discarded on its own. */
export type StoredDataPart = 'document' | 'settings' | 'journal' | 'time';

/** What could be read back from the device. */
export interface StoredDataReading {
  /** Null when no usable settings were stored: the app then starts as on a first launch. */
  readonly settings: AppSettings | null;
  /** Null when no usable journal was stored: the journal then starts empty. */
  readonly journal: ReadingJournal | null;
  /** Null when no usable time counters were stored: the time then starts again from nothing. */
  readonly timeSpent: SecondsByDay | null;
  /** What was stored but could not be trusted. Empty when all is well, and at the first launch. */
  readonly discarded: readonly StoredDataPart[];
  /** True when the document was written by an older version of the app and has been upgraded. */
  readonly wasUpgraded: boolean;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWholeNumberWithin(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function isDailyGoalPages(value: unknown): value is number {
  return isWholeNumberWithin(value, DAILY_GOAL_RANGE.min, DAILY_GOAL_RANGE.max);
}

/** A page of the Quran book, or null for none: the last page opened in the reader. */
export function isLastOpenedPage(value: unknown): value is number | null {
  return value === null || isWholeNumberWithin(value, 1, PAGE_COUNT);
}

/**
 * Bookmarks the store can keep: whole pages from 1 to 604, each once, in increasing order, which
 * is how the app always writes them. Anything else means the document was damaged.
 */
export function isBookmarkList(value: unknown): value is readonly number[] {
  if (!Array.isArray(value) || value.length > PAGE_COUNT) return false;
  return value.every(
    (page, index) =>
      isWholeNumberWithin(page, 1, PAGE_COUNT) &&
      (index === 0 || page > (value[index - 1] as number)),
  );
}

/** A script the reader can show (D41). */
export function isReaderScript(value: unknown): value is ReaderScript {
  return typeof value === 'string' && (READER_SCRIPTS as readonly string[]).includes(value);
}

/** A step of the reader's text size control. */
export function isReaderTextSize(value: unknown): value is number {
  return isWholeNumberWithin(value, READER_TEXT_SIZE_RANGE.min, READER_TEXT_SIZE_RANGE.max);
}

/** A seed the garden module accepts: a whole number from 0 to 2^53 - 1. */
export function isUserSeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isReminderTime(value: unknown): value is ReminderTime {
  return (
    isRecord(value) &&
    isWholeNumberWithin(value.hour, 0, LAST_HOUR) &&
    isWholeNumberWithin(value.minute, 0, LAST_MINUTE)
  );
}

function copyTime({ hour, minute }: ReminderTime): ReminderTime {
  return { hour, minute };
}

/** Quiet hours: none, or a start and an end that are both times of day. */
export function isQuietHours(value: unknown): value is QuietHours | null {
  if (value === null) return true;
  return isRecord(value) && isReminderTime(value.from) && isReminderTime(value.to);
}

function readReminders(value: unknown): ReminderSettings | null {
  if (!isRecord(value)) return null;
  const { dailyEnabled, dailyTime, thirstyGardenEnabled, fridayKahfEnabled } = value;
  const { fridayTime, quietHours } = value;
  if (
    typeof dailyEnabled !== 'boolean' ||
    typeof thirstyGardenEnabled !== 'boolean' ||
    typeof fridayKahfEnabled !== 'boolean' ||
    !isReminderTime(dailyTime) ||
    !isReminderTime(fridayTime) ||
    !isQuietHours(quietHours)
  ) {
    return null;
  }
  return {
    dailyEnabled,
    dailyTime: copyTime(dailyTime),
    thirstyGardenEnabled,
    fridayKahfEnabled,
    fridayTime: copyTime(fridayTime),
    quietHours:
      quietHours === null ? null : { from: copyTime(quietHours.from), to: copyTime(quietHours.to) },
  };
}

/**
 * A real calendar day inside `STORED_DATE_RANGE`. `YYYY-MM-DD` texts compare like the days they
 * name.
 */
export function isStorableDate(value: unknown): value is LocalDate {
  return (
    typeof value === 'string' &&
    isLocalDate(value) &&
    value >= STORED_DATE_RANGE.earliest &&
    value <= STORED_DATE_RANGE.latest
  );
}

/** A pause the store can keep: two storable days, the end not before the start. */
export function readPause(value: unknown): Pause | null {
  if (!isRecord(value)) return null;
  const { from, to } = value;
  if (!isStorableDate(from) || !isStorableDate(to)) return null;
  if (compareLocalDates(to, from) < 0) return null;
  return { from, to };
}

function readPauses(value: unknown): readonly Pause[] | null {
  if (!Array.isArray(value) || value.length > MAX_PAUSES) return null;
  const pauses: Pause[] = [];
  for (const item of value) {
    const pause = readPause(item);
    if (pause === null) return null;
    pauses.push(pause);
  }
  return pauses;
}

/**
 * The settings are kept or discarded as a whole: a single wrong field means the document was
 * damaged, and guessing which other fields can still be trusted would correct values in silence.
 */
function readSettings(value: unknown): AppSettings | null {
  if (!isRecord(value)) return null;
  const {
    language,
    dailyGoalPages,
    onboardingCompleted,
    userSeed,
    lastOpenedPage,
    bookmarks,
    readerScript,
    readerTextSize,
  } = value;
  const reminders = readReminders(value.reminders);
  const pauses = readPauses(value.pauses);
  if (language !== null && (typeof language !== 'string' || !isSupportedLanguage(language))) {
    return null;
  }
  if (!isDailyGoalPages(dailyGoalPages) || typeof onboardingCompleted !== 'boolean') return null;
  if (!isUserSeed(userSeed) || reminders === null || pauses === null) return null;
  if (!isLastOpenedPage(lastOpenedPage) || !isBookmarkList(bookmarks)) return null;
  if (!isReaderScript(readerScript) || !isReaderTextSize(readerTextSize)) return null;
  return {
    language,
    dailyGoalPages,
    onboardingCompleted,
    userSeed,
    lastOpenedPage,
    bookmarks: [...bookmarks],
    readerScript,
    readerTextSize,
    pauses,
    reminders,
  };
}

function readJournalEntry(value: unknown): ReadingEntry | null {
  if (!isRecord(value)) return null;
  const { khatm, page, date } = value;
  if (typeof khatm !== 'number' || typeof page !== 'number' || !isStorableDate(date)) {
    return null;
  }
  return { khatm, page, date };
}

/**
 * The journal is kept or discarded as a whole. Its shape is checked here; its rules (pages from 1
 * to 604, one entry per page and khatma, one khatma at a time) are checked by the khatm module,
 * which rejects a journal that breaks them.
 */
function readJournal(value: unknown): ReadingJournal | null {
  if (!Array.isArray(value)) return null;
  const journal: ReadingEntry[] = [];
  for (const item of value) {
    const entry = readJournalEntry(item);
    if (entry === null) return null;
    journal.push(entry);
  }
  try {
    getCurrentKhatm(journal);
  } catch {
    return null;
  }
  return journal;
}

/**
 * The time counters: a record of storable days, each with seconds `isDaySeconds` accepts, at most
 * `MAX_TIME_DAYS` days. Kept or discarded as a whole, like the settings. The time is the one part
 * whose loss the person is not told about: it is a count, not their reading.
 */
export function readTimeSpent(value: unknown): SecondsByDay | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > MAX_TIME_DAYS) return null;
  const days: [LocalDate, { app: number; reader: number }][] = [];
  for (const [date, seconds] of entries) {
    // The key is checked before anything is stored under it: "__proto__" is not a day.
    if (!isStorableDate(date) || !isDaySeconds(seconds)) return null;
    days.push([date, { app: seconds.app, reader: seconds.reader }]);
  }
  // Built from checked days only: the keys are real dates, so the cast to the branded key is safe.
  return Object.fromEntries(days) as SecondsByDay;
}

/** The version that had no `fridayTime` and no `quietHours` in the reminders. */
const VERSION_WITHOUT_FRIDAY_TIME = 1;
/** The version that had no time counters. */
const VERSION_WITHOUT_TIME_SPENT = 2;
/**
 * The version written by two lines of the app at once: some builds added `timeSpent` to it, others
 * added `settings.lastOpenedPage`. Its documents are told apart by their shape, not by number.
 */
const VERSION_OF_TWO_SHAPES = 3;
/** The version that had no bookmarks. */
const VERSION_WITHOUT_BOOKMARKS = 4;
/** The version that had no script and no text size for the reader. */
const VERSION_WITHOUT_READER_CHOICES = 5;

/** Version 1 to 2: the reminders get the Friday time and the quiet hours of the defaults. */
function upgradeFromVersion1(document: UnknownRecord): UnknownRecord {
  const next = { ...document, version: VERSION_WITHOUT_TIME_SPENT };
  const { settings } = document;
  if (!isRecord(settings) || !isRecord(settings.reminders)) return next;
  const { fridayTime, quietHours } = DEFAULT_REMINDERS;
  return {
    ...next,
    settings: { ...settings, reminders: { ...settings.reminders, fridayTime, quietHours } },
  };
}

/** Version 2 to 3: the time counters start empty, whatever the document claims to hold. */
function upgradeFromVersion2(document: UnknownRecord): UnknownRecord {
  return { ...document, version: VERSION_OF_TWO_SHAPES, timeSpent: {} };
}

/**
 * Version 3 to 4. A version 3 document may lack the time counters (written with only the last
 * opened page), the last opened page (written with only the time counters), or have both. Each
 * missing part is added with its default; a part that is present is left untouched, even when it
 * is wrong, so that the checks that follow decide about it and no valid data is ever replaced.
 */
function upgradeFromVersion3(document: UnknownRecord): UnknownRecord {
  const { settings } = document;
  let next: UnknownRecord = { ...document, version: VERSION_WITHOUT_BOOKMARKS };
  if (next.timeSpent === undefined) next = { ...next, timeSpent: {} };
  if (isRecord(settings) && settings.lastOpenedPage === undefined) {
    next = { ...next, settings: { ...settings, lastOpenedPage: null } };
  }
  return next;
}

/**
 * Version 4 to 5: no bookmarks yet. A `bookmarks` field already there is left untouched, so that
 * the checks that follow decide about it.
 */
function upgradeFromVersion4(document: UnknownRecord): UnknownRecord {
  const { settings } = document;
  const next: UnknownRecord = { ...document, version: VERSION_WITHOUT_READER_CHOICES };
  if (isRecord(settings) && settings.bookmarks === undefined) {
    return { ...next, settings: { ...settings, bookmarks: [] } };
  }
  return next;
}

/**
 * Version 5 to 6: the reader's script and text size take their first-launch values. A field
 * already there is left untouched, so that the checks that follow decide about it.
 */
function upgradeFromVersion5(document: UnknownRecord): UnknownRecord {
  const { settings } = document;
  const next: UnknownRecord = { ...document, version: STORED_DATA_VERSION };
  if (!isRecord(settings)) return next;
  return {
    ...next,
    settings: {
      ...settings,
      readerScript:
        settings.readerScript === undefined ? DEFAULT_READER_SCRIPT : settings.readerScript,
      readerTextSize:
        settings.readerTextSize === undefined ? DEFAULT_READER_TEXT_SIZE : settings.readerTextSize,
    },
  };
}

/**
 * Brings a document written by an older version of the app to the current shape, one version at a
 * time, so that an update of the app never costs a person their settings or their reading. What
 * a version did not have takes its default value; everything is then checked like any other
 * document. Null for a version this app does not know.
 */
function upgradeDocument(document: UnknownRecord): UnknownRecord | null {
  let current = document;
  if (current.version === VERSION_WITHOUT_FRIDAY_TIME) current = upgradeFromVersion1(current);
  if (current.version === VERSION_WITHOUT_TIME_SPENT) current = upgradeFromVersion2(current);
  if (current.version === VERSION_OF_TWO_SHAPES) current = upgradeFromVersion3(current);
  if (current.version === VERSION_WITHOUT_BOOKMARKS) current = upgradeFromVersion4(current);
  if (current.version === VERSION_WITHOUT_READER_CHOICES) current = upgradeFromVersion5(current);
  return current.version === STORED_DATA_VERSION ? current : null;
}

const NOTHING_USABLE = {
  settings: null,
  journal: null,
  timeSpent: null,
  wasUpgraded: false,
} as const;

/** Reads the stored document. `raw` is the text found on the device, or null when there is none. */
export function readStoredData(raw: string | null): StoredDataReading {
  if (raw === null) return { ...NOTHING_USABLE, discarded: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...NOTHING_USABLE, discarded: ['document'] };
  }
  return readStoredDocument(parsed);
}

/** Checks a stored document already turned from text into a value. */
export function readStoredDocument(parsed: unknown): StoredDataReading {
  const document = isRecord(parsed) ? upgradeDocument(parsed) : null;
  if (document === null) return { ...NOTHING_USABLE, discarded: ['document'] };

  const settings = readSettings(document.settings);
  const journal = readJournal(document.journal);
  // A document without a time part has simply not counted any yet; a damaged one is discarded.
  const timeSpent =
    document.timeSpent === undefined ? EMPTY_TIME_SPENT : readTimeSpent(document.timeSpent);
  const discarded: StoredDataPart[] = [];
  if (settings === null) discarded.push('settings');
  if (journal === null) discarded.push('journal');
  if (timeSpent === null) discarded.push('time');
  return { settings, journal, timeSpent, discarded, wasUpgraded: document !== parsed };
}

/** The text to keep on the device for this data. Only the data is written, never the actions. */
export function writeStoredData({ settings, journal, timeSpent }: AppDataToWrite): string {
  return JSON.stringify({
    version: STORED_DATA_VERSION,
    settings,
    journal,
    timeSpent: timeSpent ?? EMPTY_TIME_SPENT,
  });
}
