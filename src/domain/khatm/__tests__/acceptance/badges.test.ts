/**
 * Acceptance tests of the khatma badges (docs/specs/khatm.md, rule 9; docs/DECISIONS.md, D9).
 */
import { EMPTY_JOURNAL, getBadges, recordPageRead, type ReadingJournal } from '@/domain/khatm';

import {
  day,
  FIRST_PAGE,
  LAST_PAGE,
  pagesFrom,
  readPages,
  readWholeKhatma,
  seededRandom,
  shuffled,
  storedKhatmaEntries,
} from './acceptance-kit';

/** Reads pages `first`..`last` on each listed day, in the given order. */
function readInStages(
  journal: ReadingJournal,
  stages: readonly (readonly [string, number, number])[],
): ReadingJournal {
  return stages.reduce<ReadingJournal>(
    (current, [date, first, last]) => readPages(current, pagesFrom(first, last), day(date)),
    journal,
  );
}

describe('Règle 9 — badge de khatma', () => {
  it('cas à tester: journal vide — no badge', () => {
    expect(getBadges(EMPTY_JOURNAL)).toEqual([]);
  });

  it('a khatma in progress gives no badge, even one page from the end', () => {
    const journal = readPages(EMPTY_JOURNAL, pagesFrom(1, 603), day('2026-03-01'));

    expect(getBadges(journal)).toEqual([]);
  });

  it('a completed khatma gives { khatm, startedOn, completedOn, daysTaken }', () => {
    // January 10 to February 8, both included: 22 days of January + 8 of February = 30.
    const journal = readInStages(EMPTY_JOURNAL, [
      ['2026-01-10', 1, 300],
      ['2026-01-20', 301, 603],
      ['2026-02-08', 604, 604],
    ]);

    expect(getBadges(journal)).toStrictEqual([
      {
        khatm: 1,
        startedOn: day('2026-01-10'),
        completedOn: day('2026-02-08'),
        daysTaken: 30,
      },
    ]);
  });

  it('a khatma read in a single day took 1 day', () => {
    const journal = readWholeKhatma(EMPTY_JOURNAL, day('2026-03-01'));

    expect(getBadges(journal)).toStrictEqual([
      { khatm: 1, startedOn: day('2026-03-01'), completedOn: day('2026-03-01'), daysTaken: 1 },
    ]);
  });

  it('started one day and completed the next: 2 days, both ends included', () => {
    const journal = readInStages(EMPTY_JOURNAL, [
      ['2026-03-02', 1, 600],
      ['2026-03-03', 601, 604],
    ]);

    expect(getBadges(journal)[0]?.daysTaken).toBe(2);
  });

  it('the dates come from the journal, not from the order of recording', () => {
    // Pages 2-603 are dated March 10. Page 1 is recorded next but dated March 5 (the
    // oldest date). Page 604 is recorded last but dated March 7: the most recent date of
    // the khatma is still March 10. March 5 to March 10 included: 6 days.
    let journal = readPages(EMPTY_JOURNAL, pagesFrom(2, 603), day('2026-03-10'));
    journal = recordPageRead(journal, { page: 1, date: day('2026-03-05') });
    journal = recordPageRead(journal, { page: 604, date: day('2026-03-07') });

    expect(getBadges(journal)).toStrictEqual([
      { khatm: 1, startedOn: day('2026-03-05'), completedOn: day('2026-03-10'), daysTaken: 6 },
    ]);
  });

  it('the pauses are not deducted: a gap of months counts in full', () => {
    // One page on January 1, the rest on December 31 of the same year: 365 days.
    const journal = readInStages(EMPTY_JOURNAL, [
      ['2026-01-01', 1, 1],
      ['2026-12-31', 2, 604],
    ]);

    expect(getBadges(journal)[0]?.daysTaken).toBe(365);
  });

  it('cas à tester: passage d’année', () => {
    const journal = readInStages(EMPTY_JOURNAL, [
      ['2025-12-31', 1, 300],
      ['2026-01-01', 301, 604],
    ]);

    expect(getBadges(journal)).toStrictEqual([
      { khatm: 1, startedOn: day('2025-12-31'), completedOn: day('2026-01-01'), daysTaken: 2 },
    ]);
  });

  it('leap day: February 28 to March 1 is 3 days in 2028 and 2 days in 2026', () => {
    const leapYear = readInStages(EMPTY_JOURNAL, [
      ['2028-02-28', 1, 300],
      ['2028-03-01', 301, 604],
    ]);
    const plainYear = readInStages(EMPTY_JOURNAL, [
      ['2026-02-28', 1, 300],
      ['2026-03-01', 301, 604],
    ]);

    expect(getBadges(leapYear)[0]?.daysTaken).toBe(3);
    expect(getBadges(plainYear)[0]?.daysTaken).toBe(2);
  });

  it('a whole leap year is 366 days', () => {
    const journal = readInStages(EMPTY_JOURNAL, [
      ['2028-01-01', 1, 1],
      ['2028-12-31', 2, 604],
    ]);

    expect(getBadges(journal)[0]?.daysTaken).toBe(366);
  });

  it('cas à tester: badges de plusieurs khatmas, ordered by khatma number', () => {
    // Khatma 1 in one day; khatma 2 over the new year; khatma 3 in progress.
    const journal = readInStages(EMPTY_JOURNAL, [
      ['2025-12-20', 1, 604],
      ['2025-12-31', 1, 300],
      ['2026-01-01', 301, 604],
      ['2026-01-02', 1, 10],
    ]);

    expect(getBadges(journal)).toStrictEqual([
      { khatm: 1, startedOn: day('2025-12-20'), completedOn: day('2025-12-20'), daysTaken: 1 },
      { khatm: 2, startedOn: day('2025-12-31'), completedOn: day('2026-01-01'), daysTaken: 2 },
    ]);
  });

  it('a khatma ended and the next started the same day: both badges carry that day', () => {
    // March 1: pages 1-600. March 4: pages 601-604 end khatma 1, then the whole khatma 2.
    const journal = readInStages(EMPTY_JOURNAL, [
      ['2026-03-01', 1, 600],
      ['2026-03-04', 601, 604],
      ['2026-03-04', 1, 604],
    ]);

    expect(getBadges(journal)).toStrictEqual([
      { khatm: 1, startedOn: day('2026-03-01'), completedOn: day('2026-03-04'), daysTaken: 4 },
      { khatm: 2, startedOn: day('2026-03-04'), completedOn: day('2026-03-04'), daysTaken: 1 },
    ]);
  });

  it('a re-read after the end opens the next khatma and leaves the badge untouched', () => {
    const complete = readWholeKhatma(EMPTY_JOURNAL, day('2026-03-01'));
    const next = recordPageRead(complete, { page: FIRST_PAGE, date: day('2026-04-01') });

    expect(getBadges(next)).toStrictEqual(getBadges(complete));
  });

  it('a stored journal whose entries are not in reading order gives the same badges', () => {
    const stored = [
      ...storedKhatmaEntries(1, day('2026-01-05')),
      ...storedKhatmaEntries(2, day('2026-02-05')),
      ...storedKhatmaEntries(3, day('2026-03-05')),
      { khatm: 4, page: LAST_PAGE, date: day('2026-03-06') },
    ];

    const badges = getBadges(shuffled(stored, seededRandom(9)));

    expect(badges).toStrictEqual(getBadges(stored));
    expect(badges.map((badge) => badge.khatm)).toEqual([1, 2, 3]);
  });

  it('hundreds of khatmas: one badge each, in order', () => {
    const khatmaCount = 300;
    const firstDay = day('2000-01-01');
    const stored = pagesFrom(1, khatmaCount).flatMap((khatm) =>
      storedKhatmaEntries(khatm, firstDay),
    );

    const badges = getBadges(stored);

    expect(badges).toHaveLength(khatmaCount);
    expect(badges.map((badge) => badge.khatm)).toEqual(pagesFrom(1, khatmaCount));
    expect(badges.every((badge) => badge.daysTaken === 1)).toBe(true);
  });
});
