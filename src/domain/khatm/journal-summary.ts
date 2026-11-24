import { PAGE_COUNT } from '@/domain/quran/types';
import { compareLocalDates, type LocalDate } from '@/domain/shared/local-date';
import { FIRST_KHATM } from './config';
import type { ReadingEntry, ReadingJournal } from './types';
import { assertKhatmNumber, assertLocalDate, assertPage } from './validation';

/** What the journal says about one khatma. */
export interface KhatmSummary {
  /** The pages that have an entry in this khatma (spec rule 1). */
  readonly readPages: ReadonlySet<number>;
  /** Earliest date among the entries of the khatma. */
  readonly firstDate: LocalDate;
  /** Latest date among the entries of the khatma. */
  readonly lastDate: LocalDate;
}

/**
 * The journal, read once and checked. Every public function of the module starts by
 * building this summary, so the journal is validated in a single place and a corrupted
 * journal (for example one loaded from storage) fails loudly instead of giving wrong numbers.
 */
export interface JournalSummary {
  /** The khatmas that have at least one entry, by khatma number. */
  readonly khatmas: ReadonlyMap<number, KhatmSummary>;
  /**
   * Number of entries dated each day, all khatmas together. An entry is the first read of a
   * page in its khatma, so this is the number of NEW pages of the day: the one definition
   * shared by the daily goal, the watered days, the streak and the recent pace.
   */
  readonly newPagesByDay: ReadonlyMap<LocalDate, number>;
  /** The khatma in progress (spec rule 4): the first one that is not complete. */
  readonly currentKhatm: number;
}

/** A `KhatmSummary` while the journal is being read. */
interface KhatmSummaryInProgress {
  readonly readPages: Set<number>;
  firstDate: LocalDate;
  lastDate: LocalDate;
}

function addEntryToItsKhatm(
  khatmas: Map<number, KhatmSummaryInProgress>,
  entry: ReadingEntry,
): void {
  const khatm = khatmas.get(entry.khatm);
  if (khatm === undefined) {
    khatmas.set(entry.khatm, {
      readPages: new Set([entry.page]),
      firstDate: entry.date,
      lastDate: entry.date,
    });
    return;
  }
  // A re-read is never recorded: counting it would let the same page fill the daily goal.
  if (khatm.readPages.has(entry.page)) {
    throw new RangeError(
      `Corrupted journal: page ${entry.page} of khatm ${entry.khatm} is recorded twice`,
    );
  }
  khatm.readPages.add(entry.page);
  // Dates are compared, not taken from the position of the entries: a page can be recorded
  // for a past day, so entries are not necessarily in date order.
  if (compareLocalDates(entry.date, khatm.firstDate) < 0) khatm.firstDate = entry.date;
  if (compareLocalDates(entry.date, khatm.lastDate) > 0) khatm.lastDate = entry.date;
}

function findFirstIncompleteKhatm(khatmas: ReadonlyMap<number, KhatmSummary>): number {
  let khatm = FIRST_KHATM;
  while (khatmas.get(khatm)?.readPages.size === PAGE_COUNT) khatm += 1;
  return khatm;
}

/**
 * Spec rule 4, one khatma at a time: khatma n + 1 only starts once khatma n is complete.
 * `recordPageRead` cannot break this rule, but a journal loaded from storage can. Every
 * khatma before the one in progress is complete by definition, so the only thing to check
 * is that no entry belongs to a later one.
 */
function assertNoEntryAfterCurrentKhatm(
  khatmas: ReadonlyMap<number, KhatmSummary>,
  currentKhatm: number,
): void {
  for (const khatm of khatmas.keys()) {
    if (khatm > currentKhatm) {
      throw new RangeError(
        `Corrupted journal: khatm ${khatm} has entries but khatm ${currentKhatm} is not complete (one khatm at a time)`,
      );
    }
  }
}

/**
 * Reads the whole journal in one pass. Throws a RangeError unless the journal has:
 * - valid entries (khatma from 1, page 1..604, real date);
 * - at most one entry per (khatm, page);
 * - one khatma in progress at a time.
 */
export function summarizeJournal(journal: ReadingJournal): JournalSummary {
  const khatmas = new Map<number, KhatmSummaryInProgress>();
  const newPagesByDay = new Map<LocalDate, number>();
  for (const entry of journal) {
    assertKhatmNumber(entry.khatm);
    assertPage(entry.page);
    // A journal holds far fewer days than entries, and checking a date is the costly part
    // of the pass: a day that is already counted has already been checked.
    const newPagesCounted = newPagesByDay.get(entry.date);
    if (newPagesCounted === undefined) assertLocalDate(entry.date, 'entry date');
    newPagesByDay.set(entry.date, (newPagesCounted ?? 0) + 1);
    addEntryToItsKhatm(khatmas, entry);
  }

  const currentKhatm = findFirstIncompleteKhatm(khatmas);
  assertNoEntryAfterCurrentKhatm(khatmas, currentKhatm);
  return { khatmas, newPagesByDay, currentKhatm };
}
