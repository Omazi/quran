import type { LocalDate } from '@/domain/shared/local-date';
import { HIZB_PAGE_RANGES } from '../__fixtures__/hizb-page-ranges';
import { allPagesOutOfOrder, day, readPages } from '../__fixtures__/journal-builders';
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

  it('recordPageRead returns a new journal and leaves the previous one untouched', () => {
    const before: ReadingJournal = Object.freeze([{ khatm: 1, page: 1, date: MONDAY }]);

    const after = recordPageRead(before, { khatm: 1, page: 2, date: MONDAY });

    expect(after).not.toBe(before);
    expect(before).toEqual([{ khatm: 1, page: 1, date: MONDAY }]);
    expect(after).toEqual([
      { khatm: 1, page: 1, date: MONDAY },
      { khatm: 1, page: 2, date: MONDAY },
    ]);
  });

  it('does not keep a reference to the object given by the caller', () => {
    const entry = { khatm: 1, page: 1, date: MONDAY };

    const journal = recordPageRead(EMPTY_JOURNAL, entry);
    entry.page = 2;

    expect(journal).toEqual([{ khatm: 1, page: 1, date: MONDAY }]);
  });

  it('page read again the same day: an entry is unique per (khatm, page, date)', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { khatm: 1, page: 5, date: MONDAY });

    const again = recordPageRead(journal, { khatm: 1, page: 5, date: MONDAY });

    expect(again).toBe(journal);
    expect(again).toHaveLength(1);
  });

  it('page read again another day: adds an entry but does not change the progress', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { khatm: 1, page: 5, date: MONDAY });
    const progressBefore = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

    const reread = recordPageRead(journal, { khatm: 1, page: 5, date: TUESDAY });

    expect(reread).toHaveLength(2);
    expect(getKhatmProgress(reread, 1, HIZB_PAGE_RANGES)).toEqual(progressBefore);
  });

  it('the same page on the same day in another khatma is a separate entry', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { khatm: 1, page: 5, date: MONDAY });

    expect(recordPageRead(journal, { khatm: 2, page: 5, date: MONDAY })).toHaveLength(2);
  });

  it('accepts the first and the last page', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, [1, 604], MONDAY);

    expect(journal).toHaveLength(2);
  });

  it.each([0, 605, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'invalid input: rejects page %p',
    (page) => {
      expect(() => recordPageRead(EMPTY_JOURNAL, { khatm: 1, page, date: MONDAY })).toThrow(
        RangeError,
      );
    },
  );

  it.each([0, -1, 1.5, Number.NaN])('invalid input: rejects khatma %p', (khatm) => {
    expect(() => recordPageRead(EMPTY_JOURNAL, { khatm, page: 1, date: MONDAY })).toThrow(
      RangeError,
    );
  });

  it.each(['2026-02-30', '2026-13-01', '2026-1-1', 'yesterday', ''])(
    'invalid input: rejects date %p',
    (value) => {
      // Cast on purpose: a forged LocalDate is exactly what the runtime check must catch.
      const date = value as LocalDate;
      expect(() => recordPageRead(EMPTY_JOURNAL, { khatm: 1, page: 1, date })).toThrow(RangeError);
    },
  );

  it('invalid input: a corrupted journal fails loudly instead of giving a wrong result', () => {
    const corrupted: ReadingJournal = [{ khatm: 1, page: 700, date: MONDAY }];

    expect(() => getReadPages(corrupted, 1)).toThrow(RangeError);
    expect(() => getCurrentKhatm(corrupted)).toThrow(RangeError);
    expect(() => getKhatmProgress(corrupted, 1, HIZB_PAGE_RANGES)).toThrow(RangeError);
  });
});

describe('Rule 1 — page read (page lue)', () => {
  it('a page is read for a khatma as soon as one entry exists', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { khatm: 1, page: 42, date: MONDAY });

    expect(isPageRead(journal, 1, 42)).toBe(true);
    expect(isPageRead(journal, 1, 43)).toBe(false);
    expect(getReadPages(journal, 1)).toEqual(new Set([42]));
  });

  it('a page read for one khatma is not read for another', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { khatm: 1, page: 42, date: MONDAY });

    expect(isPageRead(journal, 2, 42)).toBe(false);
    expect(getReadPages(journal, 2).size).toBe(0);
  });

  it('a page read on several days is still one read page', () => {
    let journal = recordPageRead(EMPTY_JOURNAL, { khatm: 1, page: 42, date: MONDAY });
    journal = recordPageRead(journal, { khatm: 1, page: 42, date: TUESDAY });

    expect(getReadPages(journal, 1)).toEqual(new Set([42]));
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
