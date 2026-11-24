/**
 * The copy of the progress kept outside the app's own storage (docs/specs/backup.md): on iOS the
 * person's iCloud, so that deleting the app and installing it again brings them back where they
 * were. This file declares what the store needs from such a copy and how the progress is written
 * in it; `src/data/storage` implements the copy itself.
 */

import { PAGE_COUNT } from '@/domain/quran';
import type { ReadingEntry, ReadingJournal } from '@/domain/khatm';
import { addDays, daysBetween, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

import { STORED_DATA_VERSION, STORED_DATE_RANGE } from './config';
import { readStoredDocument } from './stored-data';
import type { AppData } from './types';

/**
 * A place that keeps one text for the person, outside the app's storage. Declared here,
 * implemented in `src/data/storage`. Both calls may fail or find nothing: the store treats a
 * failure as "no copy" and never shows it.
 */
export interface ProgressBackup {
  /** The text of the copy, or null when there is none. */
  read: () => Promise<string | null>;
  write: (document: string) => Promise<void>;
}

/** The form of the copy. Another form is not understood, and such a copy is left aside. */
export const BACKUP_FORMAT = 1;

/**
 * The largest copy written, in characters, which are bytes here: the copy holds only digits,
 * punctuation and plain Latin letters. The iCloud key-value store takes one megabyte for the
 * whole app; a quarter of it leaves room for the system's own encoding and for what the app may
 * keep there later.
 */
export const BACKUP_SIZE_LIMIT = 250_000;

/**
 * The most khatmas a copy may hold. Reading one back makes 604 journal entries of each, so the
 * number must be bounded before anything is built: a thousand is a khatma every ten days for
 * twenty-seven years.
 */
export const BACKUP_MAX_KHATMAS = 1000;

/** Days are written as their distance from the first storable day: short, and bounded. */
const FIRST_DAY = parseLocalDate(STORED_DATE_RANGE.earliest);
const LAST_DAY_NUMBER = daysBetween(FIRST_DAY, parseLocalDate(STORED_DATE_RANGE.latest));

const FIRST_PAGE = 1;

/** The days of a khatma with the pages first read on each: `[day, "1-5,9"]`. */
type FullKhatma = readonly (readonly [number, string])[];
/** A finished khatma reduced to what its badge shows: `[first day, last day]`. */
type ReducedKhatma = readonly [number, number];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether there is anything a copy could bring back. A first launch in progress has nothing. */
export function hasProgress({ settings, journal }: AppData): boolean {
  return settings.onboardingCompleted || journal.length > 0;
}

// --- Writing ----------------------------------------------------------------------------------

function toDayNumber(date: LocalDate): number {
  return daysBetween(FIRST_DAY, date);
}

/** Sorted page numbers as text: `[1, 2, 3, 9]` is "1-3,9". */
function writePages(pages: readonly number[]): string {
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let previous = start;
  for (const page of sorted.slice(1)) {
    if (previous !== undefined && page === previous + 1) {
      previous = page;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = page;
    previous = page;
  }
  if (start !== undefined) ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
  return ranges.join(',');
}

/** The entries of the journal, khatma by khatma, in the order of the khatmas. */
function groupByKhatma(journal: ReadingJournal): ReadingEntry[][] {
  const khatmas: ReadingEntry[][] = [];
  for (const entry of journal) {
    (khatmas[entry.khatm - 1] ??= []).push(entry);
  }
  // A khatma without an entry leaves no hole: the journal has none (one khatma at a time).
  return Array.from(khatmas, (entries) => entries ?? []);
}

function writeFullKhatma(entries: readonly ReadingEntry[]): FullKhatma {
  const pagesByDay = new Map<number, number[]>();
  for (const { date, page } of entries) {
    const day = toDayNumber(date);
    const pages = pagesByDay.get(day);
    if (pages === undefined) pagesByDay.set(day, [page]);
    else pages.push(page);
  }
  return [...pagesByDay]
    .sort(([a], [b]) => a - b)
    .map(([day, pages]) => [day, writePages(pages)] as const);
}

function writeReducedKhatma(entries: readonly ReadingEntry[]): ReducedKhatma {
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const { date } of entries) {
    const day = toDayNumber(date);
    first = Math.min(first, day);
    last = Math.max(last, day);
  }
  return [first, last];
}

/**
 * The progress as the text of a copy, in a compact form: days as numbers, pages as ranges.
 *
 * When that text would pass `BACKUP_SIZE_LIMIT`, finished khatmas are reduced to the two dates of
 * their badge, the oldest first and only as many as needed. The khatma in progress and the last
 * finished one always stay whole: they are what the garden and the streak show. Null when even
 * that does not fit: no copy is then written.
 */
export function writeBackupDocument(data: AppData): string | null {
  const khatmas = groupByKhatma(data.journal);
  const written: string[] = khatmas.map((entries) => JSON.stringify(writeFullKhatma(entries)));
  const assemble = () =>
    `{"f":${BACKUP_FORMAT},"v":${STORED_DATA_VERSION},"s":${JSON.stringify(data.settings)},"k":[${written.join(',')}]}`;

  // The khatma in progress is the last one; every khatma before it is finished.
  const lastFinished = khatmas.length - 2;
  let size = assemble().length;
  for (let index = 0; index < lastFinished && size > BACKUP_SIZE_LIMIT; index += 1) {
    const entries = khatmas[index];
    const full = written[index];
    if (entries === undefined || full === undefined || entries.length !== PAGE_COUNT) continue;
    const reduced = JSON.stringify(writeReducedKhatma(entries));
    written[index] = reduced;
    size += reduced.length - full.length;
  }
  return size > BACKUP_SIZE_LIMIT ? null : assemble();
}

// --- Reading ----------------------------------------------------------------------------------

function isDayNumber(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= LAST_DAY_NUMBER
  );
}

const PAGE_RANGE = /^(\d{1,3})(?:-(\d{1,3}))?$/;

/** The pages of a text such as "1-3,9", or null when it is not such a text. */
function readPages(text: unknown): number[] | null {
  if (typeof text !== 'string') return null;
  const pages: number[] = [];
  for (const range of text.split(',')) {
    const match = PAGE_RANGE.exec(range);
    if (match === null) return null;
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (start < FIRST_PAGE || end > PAGE_COUNT || start > end) return null;
    for (let page = start; page <= end; page += 1) pages.push(page);
  }
  return pages;
}

/**
 * The journal entries of one khatma of a copy. A reduced khatma comes back as a finished one that
 * keeps its two dates: its first page on the first day, the others on the last. Null when the
 * khatma is not written as expected.
 */
function readKhatma(value: unknown, khatm: number): ReadingEntry[] | null {
  if (!Array.isArray(value)) return null;
  const [first, last]: readonly unknown[] = value;
  // Two numbers are a reduced khatma; a whole one is a list of `[day, pages]` pairs.
  if (value.length === 2 && isDayNumber(first) && isDayNumber(last)) {
    if (first > last) return null;
    const firstDate = addDays(FIRST_DAY, first);
    const lastDate = addDays(FIRST_DAY, last);
    return Array.from({ length: PAGE_COUNT }, (_, index) => ({
      khatm,
      page: FIRST_PAGE + index,
      date: index === 0 ? firstDate : lastDate,
    }));
  }
  const entries: ReadingEntry[] = [];
  for (const dayOfReading of value) {
    if (!Array.isArray(dayOfReading) || dayOfReading.length !== 2) return null;
    const [day, pagesText]: readonly unknown[] = dayOfReading;
    const pages = readPages(pagesText);
    if (!isDayNumber(day) || pages === null) return null;
    // A copy cannot make more entries than a khatma has pages, whatever it repeats.
    if (entries.length + pages.length > PAGE_COUNT) return null;
    const date = addDays(FIRST_DAY, day);
    for (const page of pages) entries.push({ khatm, page, date });
  }
  return entries;
}

/**
 * Reads the text of a copy. A copy is trusted no more than the app's own storage: its form, its
 * size, then every setting and the whole journal are checked the same way. It is taken whole or
 * not at all: null for a copy that is damaged, of an unknown form, or only partly sound.
 */
export function readBackupDocument(raw: string | null): AppData | null {
  // The app writes nothing larger: a longer text is not one of its copies, and is not even parsed.
  if (raw === null || raw.length > BACKUP_SIZE_LIMIT) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const { f: format, v: version, s: settings, k: khatmas } = parsed;
  if (format !== BACKUP_FORMAT || !Array.isArray(khatmas)) return null;
  if (khatmas.length > BACKUP_MAX_KHATMAS) return null;

  const journal: ReadingEntry[] = [];
  for (const [index, khatma] of khatmas.entries()) {
    const entries = readKhatma(khatma, index + 1);
    if (entries === null) return null;
    for (const entry of entries) journal.push(entry);
  }
  const reading = readStoredDocument({ version, settings, journal });
  if (reading.settings === null || reading.journal === null) return null;
  return { settings: reading.settings, journal: reading.journal };
}
