import type { LocalDate } from '@/domain/shared/local-date';
import { HIZB_PAGE_RANGES } from '../__fixtures__/hizb-page-ranges';
import {
  allPagesOutOfOrder,
  buildCompletedKhatmas,
  day,
  readPages,
} from '../__fixtures__/journal-builders';
import {
  EMPTY_JOURNAL,
  getCurrentKhatm,
  getKhatmProgress,
  getReadPages,
  isPageRead,
  recordPageRead,
  type ReadingJournal,
} from '../index';

const MONDAY = day('2026-11-23');
const TUESDAY = day('2026-11-24');

describe('Model — the reading journal', () => {
  it('starts empty', () => {
    expect(EMPTY_JOURNAL).toEqual([]);
  });

  it('the empty journal is shared and cannot be modified', () => {
    expect(Object.isFrozen(EMPTY_JOURNAL)).toBe(true);
  });

  it('recordPageRead returns a new journal and leaves the previous one untouched', () => {
    const before: ReadingJournal = Object.freeze([{ khatm: 1, page: 1, date: MONDAY }]);

    const after = recordPageRead(before, { page: 2, date: MONDAY });

    expect(after).not.toBe(before);
    expect(before).toEqual([{ khatm: 1, page: 1, date: MONDAY }]);
    expect(after).toEqual([
      { khatm: 1, page: 1, date: MONDAY },
      { khatm: 1, page: 2, date: MONDAY },
    ]);
  });

  it('does not keep a reference to the object given by the caller', () => {
    const pageRead = { page: 1, date: MONDAY };

    const journal = recordPageRead(EMPTY_JOURNAL, pageRead);
    pageRead.page = 2;

    expect(journal).toEqual([{ khatm: 1, page: 1, date: MONDAY }]);
  });

  it('a khatma number is never written by hand: the stored entry gets the khatma in progress', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 7, date: MONDAY });

    expect(journal).toEqual([{ khatm: 1, page: 7, date: MONDAY }]);
  });

  it('stores the khatma, the page and the date, and nothing else the caller may have sent', () => {
    // Cast on purpose: an untyped caller passing a larger object.
    const withExtraField = { page: 7, date: MONDAY, note: 'kept out' } as {
      page: number;
      date: LocalDate;
    };

    const journal = recordPageRead(EMPTY_JOURNAL, withExtraField);

    expect(journal).toStrictEqual([{ khatm: 1, page: 7, date: MONDAY }]);
  });

  it('page read again the same day: an entry is unique per (khatm, page)', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 5, date: MONDAY });

    const again = recordPageRead(journal, { page: 5, date: MONDAY });

    expect(again).toBe(journal);
    expect(again).toHaveLength(1);
  });

  it('page read again another day: no effect, the journal is returned unchanged', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 5, date: MONDAY });
    const progressBefore = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

    const reread = recordPageRead(journal, { page: 5, date: TUESDAY });

    expect(reread).toBe(journal);
    expect(reread).toEqual([{ khatm: 1, page: 5, date: MONDAY }]);
    expect(getKhatmProgress(reread, 1, HIZB_PAGE_RANGES)).toEqual(progressBefore);
  });

  it('an entry keeps the date of the first read, even if a re-read is given an earlier date', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 5, date: TUESDAY });

    const reread = recordPageRead(journal, { page: 5, date: MONDAY });

    expect(reread).toBe(journal);
    expect(reread).toEqual([{ khatm: 1, page: 5, date: TUESDAY }]);
  });

  it('the same page in the next khatma is a new entry', () => {
    const firstDone = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);

    const next = recordPageRead(firstDone, { page: 5, date: TUESDAY });

    expect(next).toHaveLength(605);
    expect(next[604]).toEqual({ khatm: 2, page: 5, date: TUESDAY });
    expect(isPageRead(next, 2, 5)).toBe(true);
  });

  it('accepts the first and the last page', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, [1, 604], MONDAY);

    expect(journal).toHaveLength(2);
  });

  it.each([0, 605, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'invalid input: rejects page %p',
    (page) => {
      expect(() => recordPageRead(EMPTY_JOURNAL, { page, date: MONDAY })).toThrow(RangeError);
    },
  );

  it.each([0, -1, 1.5, Number.NaN])('invalid input: rejects khatma %p', (khatm) => {
    // The khatma number is no longer an input of recordPageRead; it is one wherever a
    // khatma is asked for, and in the entries of a stored journal.
    expect(() => getReadPages(EMPTY_JOURNAL, khatm)).toThrow(RangeError);
    expect(() => isPageRead(EMPTY_JOURNAL, khatm, 1)).toThrow(RangeError);
    expect(() => getCurrentKhatm([{ khatm, page: 1, date: MONDAY }])).toThrow(RangeError);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-1-1', 'yesterday', ''])(
    'invalid input: rejects date %p',
    (value) => {
      // Cast on purpose: a forged LocalDate is exactly what the runtime check must catch.
      const date = value as LocalDate;
      expect(() => recordPageRead(EMPTY_JOURNAL, { page: 1, date })).toThrow(RangeError);
    },
  );

  it('invalid input: rejects an invalid date even when the page is already read', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 5, date: MONDAY });
    // Cast on purpose: a forged LocalDate is exactly what the runtime check must catch.
    const date = 'tomorrow' as LocalDate;

    expect(() => recordPageRead(journal, { page: 5, date })).toThrow(RangeError);
  });

  const corruptedJournals: [string, ReadingJournal][] = [
    ['an impossible page', [{ khatm: 1, page: 700, date: MONDAY }]],
    ['an impossible khatma', [{ khatm: 0, page: 1, date: MONDAY }]],
    ['an impossible date', [{ khatm: 1, page: 1, date: '2026-02-30' as LocalDate }]],
    [
      'the same page recorded twice in a khatma',
      [
        { khatm: 1, page: 5, date: MONDAY },
        { khatm: 1, page: 5, date: TUESDAY },
      ],
    ],
    [
      'two khatmas in progress at the same time',
      [
        { khatm: 1, page: 1, date: MONDAY },
        { khatm: 2, page: 1, date: MONDAY },
      ],
    ],
    ['a khatma number skipped', [{ khatm: 2, page: 1, date: MONDAY }]],
    [
      'a khatma number skipped after a completed khatma',
      [...buildCompletedKhatmas(1, MONDAY, 1), { khatm: 3, page: 1, date: TUESDAY }],
    ],
    // Casts on purpose: values of the wrong type are what a damaged storage would give.
    [
      'a date that is not a string',
      [{ khatm: 1, page: 1, date: 20261123 as unknown as LocalDate }],
    ],
    ['a missing date', [{ khatm: 1, page: 1, date: undefined as unknown as LocalDate }]],
    [
      'a date wrapped in a list',
      [{ khatm: 1, page: 1, date: ['2026-11-23'] as unknown as LocalDate }],
    ],
    ['a page that is not a number', [{ khatm: 1, page: '5' as unknown as number, date: MONDAY }]],
  ];

  it.each(corruptedJournals)(
    'invalid input: a corrupted journal (%s) fails loudly instead of giving a wrong result',
    (_label, corrupted) => {
      expect(() => getReadPages(corrupted, 1)).toThrow(RangeError);
      expect(() => isPageRead(corrupted, 1, 9)).toThrow(RangeError);
      expect(() => getCurrentKhatm(corrupted)).toThrow(RangeError);
      expect(() => getKhatmProgress(corrupted, 1, HIZB_PAGE_RANGES)).toThrow(RangeError);
      expect(() => recordPageRead(corrupted, { page: 9, date: MONDAY })).toThrow(RangeError);
    },
  );

  it('a corrupted journal is rejected even when the page to record is already in it', () => {
    const duplicated: ReadingJournal = [
      { khatm: 1, page: 5, date: MONDAY },
      { khatm: 1, page: 5, date: TUESDAY },
    ];

    expect(() => recordPageRead(duplicated, { page: 5, date: TUESDAY })).toThrow(RangeError);
  });

  it('the entries of a valid journal can be in any order', () => {
    // The first page of khatma 2 is stored before the 604 entries of khatma 1.
    const firstKhatma = buildCompletedKhatmas(1, MONDAY, 1);
    const shuffled: ReadingJournal = [{ khatm: 2, page: 1, date: TUESDAY }, ...firstKhatma];

    expect(getCurrentKhatm(shuffled)).toBe(2);
    expect(getReadPages(shuffled, 1).size).toBe(604);
    expect(getReadPages(shuffled, 2)).toEqual(new Set([1]));
  });
});

describe('Rule 1 — page read (page lue)', () => {
  it('a page is read for a khatma as soon as one entry exists', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 42, date: MONDAY });

    expect(isPageRead(journal, 1, 42)).toBe(true);
    expect(isPageRead(journal, 1, 43)).toBe(false);
    expect(getReadPages(journal, 1)).toEqual(new Set([42]));
  });

  it('a page read for one khatma is not read for another', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 42, date: MONDAY });

    expect(isPageRead(journal, 2, 42)).toBe(false);
    expect(getReadPages(journal, 2).size).toBe(0);
  });

  it('page read again another day: still one read page and one entry', () => {
    let journal = recordPageRead(EMPTY_JOURNAL, { page: 42, date: MONDAY });
    journal = recordPageRead(journal, { page: 42, date: TUESDAY });

    expect(getReadPages(journal, 1)).toEqual(new Set([42]));
    expect(journal).toHaveLength(1);
  });

  it('empty journal: no page is read', () => {
    expect(isPageRead(EMPTY_JOURNAL, 1, 1)).toBe(false);
    expect(getReadPages(EMPTY_JOURNAL, 1).size).toBe(0);
  });

  it('invalid input: rejects an impossible page or khatma', () => {
    expect(() => isPageRead(EMPTY_JOURNAL, 1, 605)).toThrow(RangeError);
    expect(() => isPageRead(EMPTY_JOURNAL, 0, 1)).toThrow(RangeError);
    expect(() => getReadPages(EMPTY_JOURNAL, 0)).toThrow(RangeError);
  });
});

describe('Rule 4 — one khatma at a time (une seule khatma en cours)', () => {
  it('empty journal: the first page goes to khatma 1', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 300, date: MONDAY });

    expect(journal).toEqual([{ khatm: 1, page: 300, date: MONDAY }]);
  });

  it('while khatma n is not complete, every new page goes to khatma n', () => {
    const almostDone = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder().slice(0, 603), MONDAY);
    const lastPage = allPagesOutOfOrder()[603] ?? 0;

    const done = recordPageRead(almostDone, { page: lastPage, date: TUESDAY });

    expect(done[603]).toEqual({ khatm: 1, page: lastPage, date: TUESDAY });
    expect(getReadPages(done, 1).size).toBe(604);
    expect(getReadPages(done, 2).size).toBe(0);
  });

  it('khatma n + 1 starts with the first page recorded after khatma n is complete', () => {
    const done = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);

    const next = recordPageRead(done, { page: 1, date: TUESDAY });

    expect(next).toHaveLength(605);
    expect(next[604]).toEqual({ khatm: 2, page: 1, date: TUESDAY });
    expect(getReadPages(next, 2)).toEqual(new Set([1]));
  });

  it('the pages that follow stay in khatma n + 1: no khatma number is skipped', () => {
    const done = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);

    const next = readPages(done, 2, [1, 2, 3], TUESDAY);

    expect(getReadPages(next, 2)).toEqual(new Set([1, 2, 3]));
    expect(getReadPages(next, 3).size).toBe(0);
    expect(getCurrentKhatm(next)).toBe(2);
  });

  it('a page read again after the khatma is complete is the first page of the next khatma, even the same day', () => {
    const done = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);

    const next = recordPageRead(done, { page: 604, date: MONDAY });

    expect(next).not.toBe(done);
    expect(next[604]).toEqual({ khatm: 2, page: 604, date: MONDAY });
  });

  it('a completed khatma is never written again: the next pages leave it as it was', () => {
    const done = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);
    const completed = getKhatmProgress(done, 1, HIZB_PAGE_RANGES);

    const next = readPages(done, 2, [5, 604], TUESDAY);

    expect(getKhatmProgress(next, 1, HIZB_PAGE_RANGES)).toEqual(completed);
    expect(next.slice(0, 604)).toEqual(done);
  });

  it('an app holding an outdated khatma number cannot lose a read', () => {
    const done = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);
    // Cast on purpose: an untyped caller still sending the number of the finished khatma.
    const withOutdatedNumber = { khatm: 1, page: 5, date: TUESDAY } as {
      page: number;
      date: LocalDate;
    };

    const next = recordPageRead(done, withOutdatedNumber);

    expect(next[604]).toEqual({ khatm: 2, page: 5, date: TUESDAY });
  });

  it('a refused page leaves the journal as it was', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, [1, 2, 3], MONDAY);

    expect(() => recordPageRead(journal, { page: 605, date: TUESDAY })).toThrow(RangeError);
    expect(journal).toHaveLength(3);
    expect(getCurrentKhatm(journal)).toBe(1);
  });
});

describe('Rule 4 — the next khatma is numbered n + 1 (getCurrentKhatm)', () => {
  it('empty journal: the current khatma is the first', () => {
    expect(getCurrentKhatm(EMPTY_JOURNAL)).toBe(1);
  });

  it('stays on the khatma in progress', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, [1, 2, 3], MONDAY);

    expect(getCurrentKhatm(journal)).toBe(1);
  });

  it('moves to n + 1 once the 604 pages of khatma n are read', () => {
    const almostDone = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder().slice(0, 603), MONDAY);
    const done = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);

    expect(getCurrentKhatm(almostDone)).toBe(1);
    expect(getCurrentKhatm(done)).toBe(2);
  });

  it('follows the highest khatma started, then the one after it when complete', () => {
    const first = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);
    const secondStarted = readPages(first, 2, [1], TUESDAY);
    const secondDone = readPages(first, 2, allPagesOutOfOrder(), TUESDAY);

    expect(getCurrentKhatm(secondStarted)).toBe(2);
    expect(getCurrentKhatm(secondDone)).toBe(3);
  });
});
