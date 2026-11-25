import { getCurrentKhatm } from '@/domain/khatm';
import type { ReadingJournal } from '@/domain/khatm';
import { addDays, daysBetween, type LocalDate } from '@/domain/shared/local-date';

import { HASANAT_PER_LETTER, MAX_DAILY_RANGE_DAYS } from './config';
import { assertToday, getPeriodRange, isDateInRange } from './periods';
import type { DayReadingStats, PageStatsTable, ReadingCounts, StatsPeriod } from './types';

/** What one day adds up to, before hasanat are derived. */
interface Tally {
  pages: number;
  words: number;
  verses: number;
  letters: number;
}

function emptyTally(): Tally {
  return { pages: 0, words: 0, verses: 0, letters: 0 };
}

function toCounts({ pages, words, verses, letters }: Tally): ReadingCounts {
  return { pages, words, verses, letters, hasanatEstimate: letters * HASANAT_PER_LETTER };
}

function assertTable(table: PageStatsTable): void {
  if (!Array.isArray(table)) {
    throw new TypeError(`Invalid page table: expected a list, got ${typeof table}`);
  }
  if (table.length === 0) throw new RangeError('Invalid page table: it is empty');
}

function assertKhatmNumber(khatm: number): void {
  if (typeof khatm !== 'number') {
    throw new TypeError(`Invalid khatma: expected a number, got ${typeof khatm}`);
  }
  if (!Number.isInteger(khatm) || khatm < 1) {
    throw new RangeError(`Invalid khatma: ${khatm} (expected a whole number from 1)`);
  }
}

/**
 * The counters of the journal day by day. The journal is checked first (the khatm module
 * rejects a damaged one), then read once:
 *
 * - every entry is a page read for the first time in its khatma, so it adds its page, words
 *   and letters to the day of the entry (a re-read never makes an entry: D8);
 * - a verse counts when every page that holds a word of it has an entry in the SAME khatma, on
 *   the day of the latest of those entries: a verse cut between two pages is therefore dated
 *   by the second page read, whichever page was read first.
 *
 * `khatm` restricts the count to one khatma; without it all khatmas are added.
 */
function tallyByDay(
  journal: ReadingJournal,
  table: PageStatsTable,
  khatm?: number,
): Map<LocalDate, Tally> {
  assertTable(table);
  // Validates the whole journal: shape, pages, dates, one entry per page and khatma.
  getCurrentKhatm(journal);

  const datesByKhatm = new Map<number, Map<number, LocalDate>>();
  const days = new Map<LocalDate, Tally>();
  const tallyOf = (date: LocalDate): Tally => {
    const existing = days.get(date);
    if (existing !== undefined) return existing;
    const created = emptyTally();
    days.set(date, created);
    return created;
  };

  for (const entry of journal) {
    if (khatm !== undefined && entry.khatm !== khatm) continue;
    const pageStats = table[entry.page - 1];
    if (pageStats === undefined) {
      throw new RangeError(`The page table has no page ${entry.page} (it has ${table.length})`);
    }
    const day = tallyOf(entry.date);
    day.pages += 1;
    day.words += pageStats.words;
    day.letters += pageStats.letters;

    const dates = datesByKhatm.get(entry.khatm) ?? new Map<number, LocalDate>();
    dates.set(entry.page, entry.date);
    datesByKhatm.set(entry.khatm, dates);
  }

  for (const dates of datesByKhatm.values()) {
    for (const page of dates.keys()) {
      for (const { pages } of table[page - 1]?.endingVerses ?? []) {
        const completedOn = latestDate(pages.map((versePage) => dates.get(versePage)));
        if (completedOn !== null) tallyOf(completedOn).verses += 1;
      }
    }
  }
  return days;
}

/** The latest of the dates, or null as soon as one is missing (a page not read). */
function latestDate(dates: readonly (LocalDate | undefined)[]): LocalDate | null {
  let latest: LocalDate | null = null;
  for (const date of dates) {
    if (date === undefined) return null;
    if (latest === null || date > latest) latest = date;
  }
  return latest;
}

function sumTallies(tallies: Iterable<Tally>): ReadingCounts {
  const total = emptyTally();
  for (const tally of tallies) {
    total.pages += tally.pages;
    total.words += tally.words;
    total.verses += tally.verses;
    total.letters += tally.letters;
  }
  return toCounts(total);
}

/**
 * The counters of a period ending `today` (docs/specs/stats.md): pages, words, verses, letters
 * and the hasanat estimate. Entries are counted on the day of their first read; all time has no
 * bound at all.
 */
export function getReadingStats(
  journal: ReadingJournal,
  table: PageStatsTable,
  period: StatsPeriod,
  today: LocalDate,
): ReadingCounts {
  const range = getPeriodRange(period, today);
  const days = tallyByDay(journal, table);
  return sumTallies(
    [...days].filter(([date]) => isDateInRange(date, range)).map(([, tally]) => tally),
  );
}

/** The counters of one khatma. Zero for a khatma the journal does not have yet. */
export function getKhatmStats(
  journal: ReadingJournal,
  table: PageStatsTable,
  khatm: number,
): ReadingCounts {
  assertKhatmNumber(khatm);
  return sumTallies(tallyByDay(journal, table, khatm).values());
}

/**
 * What one complete khatma gives with this table: all its pages, words, verses and letters.
 * The control totals of the module: for the real mushaf, 6,236 verses.
 */
export function getMushafTotals(table: PageStatsTable): ReadingCounts {
  assertTable(table);
  return sumTallies(
    table.map(({ words, letters, endingVerses }) => ({
      pages: 1,
      words,
      letters,
      verses: endingVerses.length,
    })),
  );
}

/**
 * The counters of each day from `from` to `to`, both included, with a zero entry for a day
 * without reading: what a chart of the evolution needs. At most `MAX_DAILY_RANGE_DAYS` days.
 */
export function getDailyReadingStats(
  journal: ReadingJournal,
  table: PageStatsTable,
  from: LocalDate,
  to: LocalDate,
): DayReadingStats[] {
  assertToday(from);
  assertToday(to);
  const dayCount = daysBetween(from, to) + 1;
  if (dayCount < 1) throw new RangeError(`Invalid range: ${to} is before ${from}`);
  if (dayCount > MAX_DAILY_RANGE_DAYS) {
    throw new RangeError(`Invalid range: ${dayCount} days (at most ${MAX_DAILY_RANGE_DAYS})`);
  }
  const days = tallyByDay(journal, table);
  return Array.from({ length: dayCount }, (_, offset) => {
    const date = addDays(from, offset);
    return { date, ...toCounts(days.get(date) ?? emptyTally()) };
  });
}
