import { summarizeJournal } from './journal-summary';
import type { PageRead, ReadingJournal } from './types';
import { assertKhatmNumber, assertLocalDate, assertObject, assertPage } from './validation';

/** The journal of a user who has not read anything yet. */
export const EMPTY_JOURNAL: ReadingJournal = Object.freeze([]);

/**
 * Records a page read and returns the new journal. The journal given is never modified.
 *
 * The caller never chooses the khatma: the page is filed in the khatma in progress (the
 * first one that is not complete), so khatma n + 1 starts with the first page recorded
 * after khatma n is complete (spec rule 4).
 *
 * A page already read in the khatma in progress is a re-read: it never counts, whatever the
 * day, and the very same journal is returned (callers can detect "nothing new" with `===`).
 * The entry keeps the date of the first read.
 */
export function recordPageRead(journal: ReadingJournal, pageRead: PageRead): ReadingJournal {
  assertObject(pageRead, 'page read');
  assertPage(pageRead.page);
  assertLocalDate(pageRead.date, 'reading date');
  const { khatmas, currentKhatm } = summarizeJournal(journal);

  const isAlreadyRead = khatmas.get(currentKhatm)?.readPages.has(pageRead.page) ?? false;
  if (isAlreadyRead) return journal;

  // Built field by field so the journal never keeps a reference to a caller-owned object.
  return [...journal, { khatm: currentKhatm, page: pageRead.page, date: pageRead.date }];
}

/** The set of pages read for a khatma (spec rule 1: a page is read once an entry exists). */
export function getReadPages(journal: ReadingJournal, khatm: number): ReadonlySet<number> {
  assertKhatmNumber(khatm);
  return summarizeJournal(journal).khatmas.get(khatm)?.readPages ?? new Set<number>();
}

/** Spec rule 1: a page is read for a khatma as soon as one entry exists for it. */
export function isPageRead(journal: ReadingJournal, khatm: number, page: number): boolean {
  assertPage(page);
  return getReadPages(journal, khatm).has(page);
}

/**
 * The khatma in progress (spec rule 4): the first khatma that is not complete. It is 1 for
 * an empty journal, and n + 1 as soon as the 604 pages of khatma n are read.
 */
export function getCurrentKhatm(journal: ReadingJournal): number {
  return summarizeJournal(journal).currentKhatm;
}
