import {
  allPagesOutOfOrder,
  buildCompletedKhatmas,
  day,
  pageRange,
  readPages,
} from '../__fixtures__/journal-builders';
import { EMPTY_JOURNAL, getBadges, recordPageRead, type ReadingJournal } from '../index';

describe('Rule 9 — khatma badge (badge de khatma)', () => {
  it('empty journal: no badge', () => {
    expect(getBadges(EMPTY_JOURNAL)).toEqual([]);
  });

  it('a khatma in progress gives no badge', () => {
    const almostDone = readPages(
      EMPTY_JOURNAL,
      1,
      allPagesOutOfOrder().slice(0, 603),
      day('2026-11-01'),
    );

    expect(getBadges(almostDone)).toEqual([]);
  });

  it('a completed khatma gives a badge with its start date, completion date and days taken', () => {
    // 600 pages on the 1st, the last 4 on the 30th.
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 600), day('2026-11-01'));
    journal = readPages(journal, 1, pageRange(601, 604), day('2026-11-30'));

    expect(getBadges(journal)).toEqual([
      { khatm: 1, startedOn: '2026-11-01', completedOn: '2026-11-30', daysTaken: 30 },
    ]);
  });

  it('daysTaken includes both ends: a khatma read in a single day took 1 day', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), day('2026-11-23'));

    expect(getBadges(journal)).toEqual([
      { khatm: 1, startedOn: '2026-11-23', completedOn: '2026-11-23', daysTaken: 1 },
    ]);
  });

  it('daysTaken includes both ends: started one day and completed the next took 2 days', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 300), day('2026-11-23'));
    journal = readPages(journal, 1, pageRange(301, 604), day('2026-11-24'));

    expect(getBadges(journal)[0]?.daysTaken).toBe(2);
  });

  it('completedOn is the date of the last page read, startedOn the date of the first', () => {
    // Read out of order, over three days: the dates follow the reading, not the page numbers.
    const pages = allPagesOutOfOrder();
    let journal = readPages(EMPTY_JOURNAL, 1, pages.slice(0, 200), day('2026-11-10'));
    journal = readPages(journal, 1, pages.slice(200, 603), day('2026-11-15'));
    journal = readPages(journal, 1, pages.slice(603), day('2026-11-20'));

    expect(getBadges(journal)).toEqual([
      { khatm: 1, startedOn: '2026-11-10', completedOn: '2026-11-20', daysTaken: 11 },
    ]);
  });

  it('pages recorded for a past day: the dates are the earliest and the latest, not the first and last entries', () => {
    // Recorded in this order: the 15th, then the 10th (entered late), then the 12th.
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 200), day('2026-11-15'));
    journal = readPages(journal, 1, pageRange(201, 400), day('2026-11-10'));
    journal = readPages(journal, 1, pageRange(401, 604), day('2026-11-12'));

    expect(getBadges(journal)).toEqual([
      { khatm: 1, startedOn: '2026-11-10', completedOn: '2026-11-15', daysTaken: 6 },
    ]);
  });

  it('year change: the days are counted across the new year', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 300), day('2026-12-20'));
    journal = readPages(journal, 1, pageRange(301, 604), day('2027-01-10'));

    expect(getBadges(journal)).toEqual([
      { khatm: 1, startedOn: '2026-12-20', completedOn: '2027-01-10', daysTaken: 22 },
    ]);
  });

  it('leap day: February 29th is one of the days taken', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 300), day('2028-02-28'));
    journal = readPages(journal, 1, pageRange(301, 604), day('2028-03-01'));

    expect(getBadges(journal)[0]?.daysTaken).toBe(3);
  });

  it('badges of several khatmas: one per completed khatma, ordered by number, none for the one in progress', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), day('2026-09-01'));
    journal = readPages(journal, 2, pageRange(1, 600), day('2026-10-01'));
    journal = readPages(journal, 2, pageRange(601, 604), day('2026-10-03'));
    journal = readPages(journal, 3, pageRange(1, 50), day('2026-11-01'));

    expect(getBadges(journal)).toEqual([
      { khatm: 1, startedOn: '2026-09-01', completedOn: '2026-09-01', daysTaken: 1 },
      { khatm: 2, startedOn: '2026-10-01', completedOn: '2026-10-03', daysTaken: 3 },
    ]);
  });

  it('badges are ordered by khatma number whatever the order of the entries', () => {
    const journal = buildCompletedKhatmas(3, day('2026-01-01'), 10);
    const reversed = [...journal].reverse();

    expect(getBadges(reversed)).toEqual(getBadges(journal));
    expect(getBadges(reversed).map((badge) => badge.khatm)).toEqual([1, 2, 3]);
  });

  it('completed khatma then new khatma: a badge never changes afterwards', () => {
    const firstDone = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), day('2026-09-01'));
    const badgeBefore = getBadges(firstDone);

    // The next pages, even a page of the mushaf already read, belong to khatma 2.
    let journal = recordPageRead(firstDone, { page: 1, date: day('2026-11-23') });
    journal = recordPageRead(journal, { page: 604, date: day('2026-11-24') });

    expect(journal).toHaveLength(606);
    expect(getBadges(journal)).toEqual(badgeBefore);
  });

  it('hundreds of khatmas: one badge each, still ordered', () => {
    // 300 khatmas of 7 days each (100 pages a day), one starting every 10 days from 2020-01-01.
    const journal = buildCompletedKhatmas(300, day('2020-01-01'), 10);

    const badges = getBadges(journal);

    expect(journal).toHaveLength(300 * 604);
    expect(badges).toHaveLength(300);
    expect(badges.map((badge) => badge.khatm)).toEqual(pageRange(1, 300));
    expect(badges[0]).toEqual({
      khatm: 1,
      startedOn: '2020-01-01',
      completedOn: '2020-01-07',
      daysTaken: 7,
    });
    expect(badges[299]).toEqual({
      khatm: 300,
      startedOn: '2028-03-09',
      completedOn: '2028-03-15',
      daysTaken: 7,
    });
  });

  it('the badge appears with the page that completes the khatma', () => {
    const allButOne = allPagesOutOfOrder().filter((page) => page !== 300);
    const almostDone = readPages(EMPTY_JOURNAL, 1, allButOne, day('2026-11-01'));

    const done = recordPageRead(almostDone, { page: 300, date: day('2026-11-05') });

    expect(getBadges(almostDone)).toEqual([]);
    expect(getBadges(done)).toEqual([
      { khatm: 1, startedOn: '2026-11-01', completedOn: '2026-11-05', daysTaken: 5 },
    ]);
  });

  it('invalid input: rejects a corrupted journal', () => {
    const twoInProgress: ReadingJournal = [
      { khatm: 1, page: 1, date: day('2026-11-23') },
      { khatm: 2, page: 1, date: day('2026-11-23') },
    ];
    const duplicated: ReadingJournal = [
      { khatm: 1, page: 1, date: day('2026-11-22') },
      { khatm: 1, page: 1, date: day('2026-11-23') },
    ];

    expect(() => getBadges(twoInProgress)).toThrow(RangeError);
    expect(() => getBadges(duplicated)).toThrow(RangeError);
  });
});
