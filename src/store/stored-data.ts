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
import { compareLocalDates, isLocalDate, type LocalDate } from '@/domain/shared/local-date';
import { isSupportedLanguage } from '@/i18n';

import {
  DAILY_GOAL_RANGE,
  DEFAULT_REMINDERS,
  LAST_HOUR,
  LAST_MINUTE,
  MAX_PAUSES,
  STORED_DATA_VERSION,
  STORED_DATE_RANGE,
} from './config';
import type { AppData, AppSettings, QuietHours, ReminderSettings, ReminderTime } from './types';

/** A part of the stored document that can be kept or discarded on its own. */
export type StoredDataPart = 'document' | 'settings' | 'journal';

/** What could be read back from the device. */
export interface StoredDataReading {
  /** Null when no usable settings were stored: the app then starts as on a first launch. */
  readonly settings: AppSettings | null;
  /** Null when no usable journal was stored: the journal then starts empty. */
  readonly journal: ReadingJournal | null;
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
  const { language, dailyGoalPages, onboardingCompleted, userSeed } = value;
  const reminders = readReminders(value.reminders);
  const pauses = readPauses(value.pauses);
  if (language !== null && (typeof language !== 'string' || !isSupportedLanguage(language))) {
    return null;
  }
  if (!isDailyGoalPages(dailyGoalPages) || typeof onboardingCompleted !== 'boolean') return null;
  if (!isUserSeed(userSeed) || reminders === null || pauses === null) return null;
  return { language, dailyGoalPages, onboardingCompleted, userSeed, pauses, reminders };
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

/** The version that had no `fridayTime` and no `quietHours` in the reminders. */
const VERSION_WITHOUT_FRIDAY_TIME = 1;

/**
 * Brings a document written by an older version of the app to the current shape, so that an
 * update of the app never costs a person their settings. What a version did not have takes its
 * default value; everything is then checked like any other document. Null for a version this
 * app does not know.
 */
function upgradeDocument(document: UnknownRecord): UnknownRecord | null {
  if (document.version === STORED_DATA_VERSION) return document;
  if (document.version !== VERSION_WITHOUT_FRIDAY_TIME) return null;

  const { settings } = document;
  if (!isRecord(settings) || !isRecord(settings.reminders)) return document;
  const { fridayTime, quietHours } = DEFAULT_REMINDERS;
  return {
    ...document,
    settings: { ...settings, reminders: { ...settings.reminders, fridayTime, quietHours } },
  };
}

const NOTHING_USABLE = { settings: null, journal: null, wasUpgraded: false } as const;

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
  const discarded: StoredDataPart[] = [];
  if (settings === null) discarded.push('settings');
  if (journal === null) discarded.push('journal');
  return { settings, journal, discarded, wasUpgraded: document !== parsed };
}

/** The text to keep on the device for this data. Only the data is written, never the actions. */
export function writeStoredData({ settings, journal }: AppData): string {
  return JSON.stringify({ version: STORED_DATA_VERSION, settings, journal });
}
