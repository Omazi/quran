import { PAGE_COUNT } from '@/domain/quran/types';
import { FIRST_KHATM } from './config';
import type { ReadingEntry, ReadingJournal } from './types';
import { assertEntry, assertKhatmNumber, assertPage } from './validation';

/** The journal of a user who has not read anything yet. */
export const EMPTY_JOURNAL: ReadingJournal = Object.freeze([]);

function isSameEntry(a: ReadingEntry, b: ReadingEntry): boolean {
  return a.khatm === b.khatm && a.page === b.page && a.date === b.date;
}

/**
 * Records that a page was read on a day, for a khatma, and returns the new journal.
 *
 * An entry is unique per (khatm, page, date): recording the same page again on the same day
 * changes nothing and returns the very same journal, so callers can detect "nothing new"
 * with `===`. Reading the page again on another day adds an entry: it counts for that day
 * (daily goal, watered day) but not for the progress of the khatma.
 */
export function recordPageRead(journal: ReadingJournal, entry: ReadingEntry): ReadingJournal {
  assertEntry(entry);
  if (journal.some((existing) => isSameEntry(existing, entry))) return journal;
  // Copied field by field so the journal never keeps a reference to a caller-owned object.
  return [...journal, { khatm: entry.khatm, page: entry.page, date: entry.date }];
}

/**
 * The set of pages read for a khatma (spec rule 1: one entry is enough, whatever its date).
 * Every entry of the journal is checked on the way, so a corrupted journal (for example one
 * loaded from storage) fails loudly instead of producing a wrong progress.
 */
export function getReadPages(journal: ReadingJournal, khatm: number): ReadonlySet<number> {
  assertKhatmNumber(khatm);
  const pages = new Set<number>();
  for (const entry of journal) {
    assertEntry(entry);
    if (entry.khatm === khatm) pages.add(entry.page);
  }
  return pages;
}

/** Spec rule 1: a page is read for a khatma as soon as one entry exists for it. */
export function isPageRead(journal: ReadingJournal, khatm: number, page: number): boolean {
  assertPage(page);
  return getReadPages(journal, khatm).has(page);
}

/**
 * The khatma the user is reading now (spec rule 4): the highest khatma number found in the
 * journal, or the next one when that khatma is complete. An empty journal gives khatma 1.
 */
export function getCurrentKhatm(journal: ReadingJournal): number {
  let latestKhatm = FIRST_KHATM;
  for (const entry of journal) {
    assertEntry(entry);
    if (entry.khatm > latestKhatm) latestKhatm = entry.khatm;
  }
  const isLatestComplete = getReadPages(journal, latestKhatm).size === PAGE_COUNT;
  return isLatestComplete ? latestKhatm + 1 : latestKhatm;
}
