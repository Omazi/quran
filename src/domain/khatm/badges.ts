import { daysBetween, type LocalDate } from '@/domain/shared/local-date';
import { FIRST_KHATM } from './config';
import { summarizeJournal } from './journal-summary';
import type { KhatmBadge, ReadingJournal } from './types';

/** Calendar days from `first` to `last`, both included: the same day counts as 1. */
function countDaysIncludingBothEnds(first: LocalDate, last: LocalDate): number {
  return daysBetween(first, last) + 1;
}

/**
 * Spec rule 9: one badge per completed khatma, ordered by khatma number.
 *
 * `startedOn` and `completedOn` are the earliest and the latest reading dates of the
 * khatma; `daysTaken` counts the calendar days between them, both included. Paused days
 * are not subtracted. A badge never changes once its khatma is complete.
 *
 * Linear in the size of the journal: one pass to read it, then one step per khatma. The
 * khatmas before the one in progress are exactly the completed ones, so walking their
 * numbers gives the badges in order without sorting.
 */
export function getBadges(journal: ReadingJournal): readonly KhatmBadge[] {
  const { khatmas, currentKhatm } = summarizeJournal(journal);
  const badges: KhatmBadge[] = [];
  for (let khatm = FIRST_KHATM; khatm < currentKhatm; khatm += 1) {
    const completed = khatmas.get(khatm);
    // Never undefined: a khatma before the one in progress is complete, so it has entries.
    if (completed === undefined) continue;
    badges.push({
      khatm,
      startedOn: completed.firstDate,
      completedOn: completed.lastDate,
      daysTaken: countDaysIncludingBothEnds(completed.firstDate, completed.lastDate),
    });
  }
  return badges;
}
