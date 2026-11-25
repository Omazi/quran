import { HIZB_PAGE_RANGES, withHizbRange } from '../__fixtures__/hizb-page-ranges';
import { allPagesOutOfOrder, day, pageRange, readPages } from '../__fixtures__/journal-builders';
import { EMPTY_JOURNAL, getKhatmProgress, recordPageRead, type HizbPageRange } from '../index';

// Fixture reminder: hizb 1 = pages 1..11, hizb 2 = 11..21, hizb 3 = 21..31 ... hizb 60 = 591..604.
const MONDAY = day('2026-11-23');
const TUESDAY = day('2026-11-24');

describe('Rule 2 — completed hizb (hizb terminé)', () => {
  it('a hizb is completed when every page from firstPage to lastPage is read', () => {
    const tenPages = readPages(EMPTY_JOURNAL, 1, pageRange(1, 10), MONDAY);
    const elevenPages = readPages(tenPages, 1, [11], MONDAY);

    expect(getKhatmProgress(tenPages, 1, HIZB_PAGE_RANGES).hizbCompleted).toBe(0);
    expect(getKhatmProgress(elevenPages, 1, HIZB_PAGE_RANGES).hizbCompleted).toBe(1);
  });

  it('a hizb is not completed while one page is missing, wherever it is', () => {
    const allButPageSix = pageRange(1, 11).filter((page) => page !== 6);
    const journal = readPages(EMPTY_JOURNAL, 1, allButPageSix, MONDAY);

    const progress = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

    expect(progress.hizbCompleted).toBe(0);
    expect(progress.currentHizb).toBe(1);
    expect(progress.currentHizbProgress).toBeCloseTo(10 / 11);
  });

  it('hizb with a shared page: the shared page counts for both hizb', () => {
    // Page 11 ends hizb 1 and starts hizb 2.
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 11), MONDAY);

    const progress = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

    expect(progress.hizbCompleted).toBe(1);
    expect(progress.currentHizb).toBe(2);
    expect(progress.currentHizbProgress).toBeCloseTo(1 / 11);
  });

  it('counts the pages read of the current hizb and its pages, the shared page in both', () => {
    const none = getKhatmProgress(EMPTY_JOURNAL, 1, HIZB_PAGE_RANGES);
    expect([none.currentHizbPagesRead, none.currentHizbPageCount]).toEqual([0, 11]);

    const threePages = getKhatmProgress(
      readPages(EMPTY_JOURNAL, 1, pageRange(1, 3), MONDAY),
      1,
      HIZB_PAGE_RANGES,
    );
    expect([threePages.currentHizbPagesRead, threePages.currentHizbPageCount]).toEqual([3, 11]);

    const acrossTheBoundary = getKhatmProgress(
      readPages(EMPTY_JOURNAL, 1, pageRange(1, 12), MONDAY),
      1,
      HIZB_PAGE_RANGES,
    );
    // Pages 11 and 12 of hizb 2 (11..21): page 11 has also completed hizb 1.
    expect(acrossTheBoundary.currentHizb).toBe(2);
    expect([
      acrossTheBoundary.currentHizbPagesRead,
      acrossTheBoundary.currentHizbPageCount,
    ]).toEqual([2, 11]);
  });

  it('a complete khatma has no hizb in progress: no page to count', () => {
    const progress = getKhatmProgress(
      readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY),
      1,
      HIZB_PAGE_RANGES,
    );
    expect([progress.currentHizbPagesRead, progress.currentHizbPageCount]).toEqual([0, 0]);
  });

  it('hizb with a shared page: reading it once is enough to complete both neighbours', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 21), MONDAY);

    expect(getKhatmProgress(journal, 1, HIZB_PAGE_RANGES).hizbCompleted).toBe(2);
  });

  it('hizb with a shared page: a missing shared page leaves both neighbours unfinished', () => {
    const allButSharedPage = pageRange(1, 21).filter((page) => page !== 11);
    const journal = readPages(EMPTY_JOURNAL, 1, allButSharedPage, MONDAY);

    expect(getKhatmProgress(journal, 1, HIZB_PAGE_RANGES).hizbCompleted).toBe(0);
  });

  it('a hizb read before the previous ones is completed on its own', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(11, 21), MONDAY);

    const progress = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

    expect(progress.hizbCompleted).toBe(1);
    expect(progress.currentHizb).toBe(1);
    expect(progress.currentHizbProgress).toBeCloseTo(1 / 11);
  });

  it('a hizb that starts on its own page shares nothing with the previous one', () => {
    // Hand-made edge: hizb 2 starts at the top of page 12 instead of sharing page 11.
    const ranges = withHizbRange({ hizb: 2, firstPage: 12, lastPage: 21 });
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 11), MONDAY);

    const progress = getKhatmProgress(journal, 1, ranges);

    expect(progress.hizbCompleted).toBe(1);
    expect(progress.currentHizb).toBe(2);
    expect(progress.currentHizbProgress).toBe(0);
  });

  it('a page shared by three hizb is accepted and counts for the three', () => {
    // Hand-made edge: hizb 1 = pages 1..11, hizb 2 = page 11 only, hizb 3 = pages 11..31.
    const ranges = withHizbRange({ hizb: 2, firstPage: 11, lastPage: 11 }).map((range) =>
      range.hizb === 3 ? { hizb: 3, firstPage: 11, lastPage: 31 } : range,
    );
    const withoutSharedPage = readPages(EMPTY_JOURNAL, 1, pageRange(1, 10), MONDAY);
    const withSharedPage = readPages(withoutSharedPage, 1, [11], MONDAY);

    expect(getKhatmProgress(withoutSharedPage, 1, ranges).hizbCompleted).toBe(0);
    const progress = getKhatmProgress(withSharedPage, 1, ranges);
    expect(progress.hizbCompleted).toBe(2);
    expect(progress.currentHizb).toBe(3);
    expect(progress.currentHizbProgress).toBeCloseTo(1 / 21);
  });

  it('a one-page hizb is completed by its single page', () => {
    // Hand-made edge: hizb 1 = page 1 only, hizb 2 = pages 1..21.
    const ranges = withHizbRange({ hizb: 1, firstPage: 1, lastPage: 1 }).map((range) =>
      range.hizb === 2 ? { hizb: 2, firstPage: 1, lastPage: 21 } : range,
    );
    const journal = readPages(EMPTY_JOURNAL, 1, [1], MONDAY);

    const progress = getKhatmProgress(journal, 1, ranges);

    expect(progress.hizbCompleted).toBe(1);
    expect(progress.currentHizb).toBe(2);
    expect(progress.currentHizbProgress).toBeCloseTo(1 / 21);
  });
});

describe('Rule 3 — progress (progression)', () => {
  it('empty journal: nothing is read', () => {
    expect(getKhatmProgress(EMPTY_JOURNAL, 1, HIZB_PAGE_RANGES)).toEqual({
      khatm: 1,
      pagesRead: 0,
      pagesRemaining: 604,
      fraction: 0,
      hizbCompleted: 0,
      currentHizb: 1,
      currentHizbProgress: 0,
      currentHizbPagesRead: 0,
      currentHizbPageCount: 11,
      firstUnreadPage: 1,
      isComplete: false,
    });
  });

  it('gives pages read, fraction, completed hizb, first unfinished hizb and first unread page', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 15), MONDAY);

    const progress = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

    expect(progress.pagesRead).toBe(15);
    expect(progress.pagesRemaining).toBe(589);
    expect(progress.fraction).toBeCloseTo(15 / 604);
    expect(progress.hizbCompleted).toBe(1);
    expect(progress.currentHizb).toBe(2);
    // Hizb 2 is pages 11..21: pages 11 to 15 are read, 5 out of 11.
    expect(progress.currentHizbProgress).toBeCloseTo(5 / 11);
    expect(progress.firstUnreadPage).toBe(16);
    expect(progress.isComplete).toBe(false);
  });

  it('a single page read', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, [1], MONDAY);

    const progress = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

    expect(progress.pagesRead).toBe(1);
    expect(progress.fraction).toBeCloseTo(1 / 604);
    expect(progress.firstUnreadPage).toBe(2);
  });

  it('pages read in any order: the first unfinished hizb and first unread page come first in the mushaf', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, [...pageRange(300, 310), 1], MONDAY);

    const progress = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

    expect(progress.pagesRead).toBe(12);
    expect(progress.hizbCompleted).toBe(0);
    expect(progress.currentHizb).toBe(1);
    expect(progress.currentHizbProgress).toBeCloseTo(1 / 11);
    expect(progress.firstUnreadPage).toBe(2);
  });

  it('page read again another day: no effect on the progress', () => {
    const monday = readPages(EMPTY_JOURNAL, 1, [1, 2, 3], MONDAY);
    const tuesday = readPages(monday, 1, [1, 2, 3], TUESDAY);

    expect(getKhatmProgress(tuesday, 1, HIZB_PAGE_RANGES)).toEqual(
      getKhatmProgress(monday, 1, HIZB_PAGE_RANGES),
    );
    expect(getKhatmProgress(tuesday, 1, HIZB_PAGE_RANGES).pagesRead).toBe(3);
  });

  it('counts only the pages of the requested khatma', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);
    journal = readPages(journal, 2, [1, 2], TUESDAY);

    expect(getKhatmProgress(journal, 1, HIZB_PAGE_RANGES).pagesRead).toBe(604);
    expect(getKhatmProgress(journal, 2, HIZB_PAGE_RANGES).pagesRead).toBe(2);
    expect(getKhatmProgress(journal, 3, HIZB_PAGE_RANGES).pagesRead).toBe(0);
  });

  it('the fraction stays between 0 and 1', () => {
    const complete = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);

    expect(getKhatmProgress(EMPTY_JOURNAL, 1, HIZB_PAGE_RANGES).fraction).toBe(0);
    expect(getKhatmProgress(complete, 1, HIZB_PAGE_RANGES).fraction).toBe(1);
  });

  it('pages read in any order: every new page adds one page and never removes a hizb', () => {
    let journal = EMPTY_JOURNAL;
    let previous = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

    for (const page of allPagesOutOfOrder()) {
      journal = recordPageRead(journal, { page, date: MONDAY });
      const progress = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

      expect(progress.pagesRead).toBe(previous.pagesRead + 1);
      expect(progress.hizbCompleted).toBeGreaterThanOrEqual(previous.hizbCompleted);
      expect(progress.currentHizbProgress).toBeGreaterThanOrEqual(0);
      expect(progress.currentHizbProgress).toBeLessThan(1);
      previous = progress;
    }

    expect(previous.hizbCompleted).toBe(60);
    expect(previous.isComplete).toBe(true);
  });
});

describe('Rule 4 — completed khatma (khatma terminée)', () => {
  it('604 pages read out of order complete the khatma', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);

    expect(new Set(allPagesOutOfOrder()).size).toBe(604);
    expect(getKhatmProgress(journal, 1, HIZB_PAGE_RANGES)).toEqual({
      khatm: 1,
      pagesRead: 604,
      pagesRemaining: 0,
      fraction: 1,
      hizbCompleted: 60,
      currentHizb: null,
      currentHizbProgress: 0,
      currentHizbPagesRead: 0,
      currentHizbPageCount: 0,
      firstUnreadPage: null,
      isComplete: true,
    });
  });

  it('603 pages are not a completed khatma', () => {
    const allButPage300 = allPagesOutOfOrder().filter((page) => page !== 300);
    const journal = readPages(EMPTY_JOURNAL, 1, allButPage300, MONDAY);

    const progress = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

    expect(progress.isComplete).toBe(false);
    expect(progress.pagesRead).toBe(603);
    expect(progress.firstUnreadPage).toBe(300);
    // Page 300 belongs to hizb 30 only (pages 291..301).
    expect(progress.hizbCompleted).toBe(59);
    expect(progress.currentHizb).toBe(30);
    expect(progress.currentHizbProgress).toBeCloseTo(10 / 11);
  });

  it('a missing shared page keeps two hizb unfinished', () => {
    // Page 301 ends hizb 30 and starts hizb 31.
    const allButPage301 = allPagesOutOfOrder().filter((page) => page !== 301);
    const journal = readPages(EMPTY_JOURNAL, 1, allButPage301, MONDAY);

    const progress = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

    expect(progress.hizbCompleted).toBe(58);
    expect(progress.currentHizb).toBe(30);
  });

  it('completed khatma then new khatma: khatma n + 1 starts from zero', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);

    const next = getKhatmProgress(journal, 2, HIZB_PAGE_RANGES);

    expect(next.khatm).toBe(2);
    expect(next.pagesRead).toBe(0);
    expect(next.hizbCompleted).toBe(0);
    expect(next.currentHizb).toBe(1);
    expect(next.firstUnreadPage).toBe(1);
    expect(next.isComplete).toBe(false);
  });

  it('completed khatma then new khatma: the hizb of the completed khatma are never removed', () => {
    const firstDone = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), MONDAY);
    const completedProgress = getKhatmProgress(firstDone, 1, HIZB_PAGE_RANGES);

    const secondStarted = readPages(firstDone, 2, pageRange(1, 15), TUESDAY);

    expect(getKhatmProgress(secondStarted, 1, HIZB_PAGE_RANGES)).toEqual(completedProgress);
    expect(getKhatmProgress(secondStarted, 1, HIZB_PAGE_RANGES).hizbCompleted).toBe(60);
    expect(getKhatmProgress(secondStarted, 2, HIZB_PAGE_RANGES).hizbCompleted).toBe(1);
    expect(getKhatmProgress(secondStarted, 2, HIZB_PAGE_RANGES).pagesRead).toBe(15);
  });
});

describe('Invalid input — khatma number and hizb page ranges', () => {
  it.each([0, -1, 1.5, Number.NaN])('rejects khatma %p', (khatm) => {
    expect(() => getKhatmProgress(EMPTY_JOURNAL, khatm, HIZB_PAGE_RANGES)).toThrow(RangeError);
  });

  it('accepts the realistic fixture', () => {
    expect(HIZB_PAGE_RANGES).toHaveLength(60);
    expect(() => getKhatmProgress(EMPTY_JOURNAL, 1, HIZB_PAGE_RANGES)).not.toThrow();
  });

  const invalidRanges: [string, readonly HizbPageRange[]][] = [
    ['no range at all', []],
    [
      'only two hizb',
      [
        { hizb: 1, firstPage: 1, lastPage: 300 },
        { hizb: 2, firstPage: 300, lastPage: 604 },
      ],
    ],
    ['59 hizb', HIZB_PAGE_RANGES.slice(0, 59)],
    ['61 hizb', [...HIZB_PAGE_RANGES, { hizb: 61, firstPage: 604, lastPage: 604 }]],
    ['hizb in the wrong order', [...HIZB_PAGE_RANGES].reverse()],
    [
      'a hizb numbered twice',
      withHizbRange({ hizb: 5, firstPage: 41, lastPage: 51 }).map((range) =>
        range.hizb === 5 ? { ...range, hizb: 4 } : range,
      ),
    ],
    ['a gap between two hizb', withHizbRange({ hizb: 2, firstPage: 13, lastPage: 21 })],
    [
      'two hizb sharing more than one page',
      withHizbRange({ hizb: 2, firstPage: 10, lastPage: 21 }),
    ],
    ['hizb 1 not starting on page 1', withHizbRange({ hizb: 1, firstPage: 2, lastPage: 11 })],
    ['hizb 60 not ending on page 604', withHizbRange({ hizb: 60, firstPage: 591, lastPage: 603 })],
    ['a page beyond 604', withHizbRange({ hizb: 60, firstPage: 591, lastPage: 605 })],
    ['page 0', withHizbRange({ hizb: 1, firstPage: 0, lastPage: 11 })],
    ['a hizb ending before it starts', withHizbRange({ hizb: 2, firstPage: 11, lastPage: 10 })],
    ['a fractional page', withHizbRange({ hizb: 1, firstPage: 1, lastPage: 10.5 })],
  ];

  it('hizb ranges of the wrong shape are named by the module, not by the engine', () => {
    // Casts on purpose: an untyped caller, or data that was not loaded.
    const notAList = null as unknown as HizbPageRange[];
    const listWithAHole = HIZB_PAGE_RANGES.map((range) =>
      range.hizb === 30 ? null : range,
    ) as HizbPageRange[];

    expect(() => getKhatmProgress(EMPTY_JOURNAL, 1, notAList)).toThrow(
      'Invalid hizb page ranges: expected a list',
    );
    expect(() => getKhatmProgress(EMPTY_JOURNAL, 1, listWithAHole)).toThrow(
      'Invalid hizb page range: expected an object',
    );
  });

  it.each(invalidRanges)('incomplete hizb ranges: rejects %s', (_label, ranges) => {
    expect(() => getKhatmProgress(EMPTY_JOURNAL, 1, ranges)).toThrow(RangeError);
  });
});
