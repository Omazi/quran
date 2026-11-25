/**
 * The rules of the reader that do not need a screen (docs/specs/reader.md, sections 1 to 3 and 8):
 * the page to resume, the 30-second rule with a fake clock, the order and bounds of the pages,
 * the table of contents and its search, the size of the page text, and the feedback after a page.
 */

import { quranStructure } from '@/data/quran';
import { EMPTY_JOURNAL, recordPageRead, type ReadingJournal } from '@/domain/khatm';
import { PAGE_COUNT } from '@/domain/quran';
import { parseLocalDate } from '@/domain/shared/local-date';

import { READER_CONFIG } from '../config';
import { buildJuzEntries, buildSurahEntries, filterSurahs } from '../contents-model';
import {
  isPageNumber,
  nextPage,
  pageAtPagerIndex,
  pagerIndexOfPage,
  parsePageParam,
  previousPage,
} from '../page-order';
import { computePageMetrics, fitLine } from '../page-layout';
import { readingFeedback } from '../reading-feedback';
import { finishVisit, pauseVisit, resumeVisit, startVisit, type PageVisit } from '../reading-timer';
import { resolveResumePage } from '../resume-page';

const RANGES = quranStructure.hizbPageRanges();
const DAY = parseLocalDate('2026-11-24');
const SECOND = 1000;
const MINIMUM = READER_CONFIG.minimumSecondsOnPage;

function readPages(pages: readonly number[], journal: ReadingJournal = EMPTY_JOURNAL) {
  return pages.reduce((current, page) => recordPageRead(current, { page, date: DAY }), journal);
}

function pagesFromTo(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

describe('the page to resume (spec 1)', () => {
  it('is page 1 at the very first opening', () => {
    expect(
      resolveResumePage({ lastOpenedPage: null, journal: EMPTY_JOURNAL, hizbPageRanges: RANGES }),
    ).toBe(1);
  });

  it('is the first unread page of the khatma when the reader was never opened', () => {
    const journal = readPages([1, 2, 3, 5]);
    expect(resolveResumePage({ lastOpenedPage: null, journal, hizbPageRanges: RANGES })).toBe(4);
  });

  it('is the last page opened in the reader, read or not', () => {
    const journal = readPages([1, 2, 3]);
    expect(resolveResumePage({ lastOpenedPage: 293, journal, hizbPageRanges: RANGES })).toBe(293);
    expect(resolveResumePage({ lastOpenedPage: 2, journal, hizbPageRanges: RANGES })).toBe(2);
  });

  it('starts the next khatma at page 1 once one is complete', () => {
    const journal = readPages(pagesFromTo(1, PAGE_COUNT));
    expect(resolveResumePage({ lastOpenedPage: null, journal, hizbPageRanges: RANGES })).toBe(1);
  });

  it('refuses a last page that does not exist', () => {
    expect(() =>
      resolveResumePage({ lastOpenedPage: 605, journal: EMPTY_JOURNAL, hizbPageRanges: RANGES }),
    ).toThrow(RangeError);
  });
});

describe('the order and bounds of the pages (spec 2)', () => {
  it('accepts pages 1 to 604 only', () => {
    expect(isPageNumber(1)).toBe(true);
    expect(isPageNumber(PAGE_COUNT)).toBe(true);
    for (const page of [0, -1, 605, 1.5, Number.NaN]) expect(isPageNumber(page)).toBe(false);
  });

  it('reads a page from the route, and nothing else', () => {
    expect(parsePageParam('1')).toBe(1);
    expect(parsePageParam('604')).toBe(PAGE_COUNT);
    expect(parsePageParam('293')).toBe(293);
    for (const param of ['0', '605', '-3', '12abc', '1.5', '', ' 7', '007', undefined]) {
      expect(parsePageParam(param)).toBeNull();
    }
    expect(parsePageParam(['12', '13'])).toBeNull();
  });

  it('goes forward and back one page, and stops at 1 and 604', () => {
    expect(nextPage(1)).toBe(2);
    expect(nextPage(603)).toBe(PAGE_COUNT);
    expect(nextPage(PAGE_COUNT)).toBeNull();
    expect(previousPage(2)).toBe(1);
    expect(previousPage(1)).toBeNull();
    expect(() => nextPage(605)).toThrow(RangeError);
    expect(() => previousPage(0)).toThrow(RangeError);
  });

  it('lays the pages out as a book: the next page is on the left of the current one', () => {
    // The pager runs left to right in every interface language: a smaller index is further left.
    expect(pagerIndexOfPage(2)).toBeLessThan(pagerIndexOfPage(1));
    expect(pagerIndexOfPage(PAGE_COUNT)).toBe(0);
    expect(pagerIndexOfPage(1)).toBe(PAGE_COUNT - 1);
    for (const page of [1, 2, 293, PAGE_COUNT]) {
      expect(pageAtPagerIndex(pagerIndexOfPage(page))).toBe(page);
    }
    expect(() => pageAtPagerIndex(PAGE_COUNT)).toThrow(RangeError);
    expect(() => pageAtPagerIndex(-1)).toThrow(RangeError);
  });
});

describe('the 30-second rule (spec 3), with a fake clock', () => {
  it('starts at 30 seconds, in the configuration of the feature', () => {
    expect(MINIMUM).toBe(30);
  });

  it('a page flicked through does not count', () => {
    const visit = startVisit(12, 0);
    expect(finishVisit(visit, 5 * SECOND)).toEqual({ page: 12, secondsOnPage: 5, counts: false });
  });

  it('a page read for 30 seconds counts when the person turns the page or leaves', () => {
    expect(finishVisit(startVisit(12, 0), MINIMUM * SECOND).counts).toBe(true);
    expect(finishVisit(startVisit(12, 0), MINIMUM * SECOND - 1).counts).toBe(false);
  });

  it('time spent with the app in the background does not count', () => {
    let visit: PageVisit = startVisit(12, 0);
    visit = pauseVisit(visit, 10 * SECOND);
    visit = resumeVisit(visit, 10 * 60 * SECOND);
    expect(finishVisit(visit, 10 * 60 * SECOND + 5 * SECOND)).toMatchObject({
      secondsOnPage: 15,
      counts: false,
    });
  });

  it('foreground time before and after an interruption adds up', () => {
    let visit: PageVisit = startVisit(12, 0);
    visit = pauseVisit(visit, 20 * SECOND);
    visit = resumeVisit(visit, 100 * SECOND);
    expect(finishVisit(visit, 110 * SECOND)).toMatchObject({ secondsOnPage: 30, counts: true });
  });

  it('a page opened while the app is in the background starts counting when it comes back', () => {
    let visit: PageVisit = startVisit(12, 0, false);
    visit = resumeVisit(visit, 50 * SECOND);
    expect(finishVisit(visit, 70 * SECOND)).toMatchObject({ secondsOnPage: 20, counts: false });
  });

  it('a visit that ends in the background keeps only its foreground time', () => {
    let visit: PageVisit = startVisit(12, 0);
    visit = pauseVisit(visit, 31 * SECOND);
    expect(finishVisit(visit, 500 * SECOND)).toMatchObject({ secondsOnPage: 31, counts: true });
  });

  it('pausing or resuming twice changes nothing', () => {
    let visit: PageVisit = startVisit(12, 0);
    visit = pauseVisit(pauseVisit(visit, 10 * SECOND), 20 * SECOND);
    visit = resumeVisit(resumeVisit(visit, 30 * SECOND), 40 * SECOND);
    expect(finishVisit(visit, 40 * SECOND).secondsOnPage).toBe(20);
  });

  it('refuses a clock that goes back, and a page that does not exist', () => {
    expect(() => finishVisit(startVisit(12, 10 * SECOND), 5 * SECOND)).toThrow(RangeError);
    expect(() => startVisit(0, 0)).toThrow(RangeError);
  });

  it('a page already read in this khatma changes nothing in the journal (D8)', () => {
    // The screen does not decide: it records, and the khatm module ignores the re-read.
    const journal = readPages([12]);
    expect(recordPageRead(journal, { page: 12, date: DAY })).toBe(journal);
    expect(
      readingFeedback({
        before: journal,
        after: journal,
        settings: { dailyGoalPages: 5, userSeed: 42, pauses: [] },
        today: DAY,
        hizbPageRanges: RANGES,
      }),
    ).toBeNull();
  });
});

describe('the feedback after a page (spec 3)', () => {
  const settings = { dailyGoalPages: 5, userSeed: 42, pauses: [] };

  it('says a new page counted', () => {
    const before = readPages([1]);
    const after = readPages([2], before);
    expect(
      readingFeedback({ before, after, settings, today: DAY, hizbPageRanges: RANGES }),
    ).toEqual({ kind: 'page-counted' });
  });

  it('names the new element of the garden when the page completes a hizb', () => {
    const lastPage = RANGES[0]!.lastPage;
    const before = readPages(pagesFromTo(1, lastPage - 1));
    const after = readPages([lastPage], before);
    const feedback = readingFeedback({
      before,
      after,
      settings,
      today: DAY,
      hizbPageRanges: RANGES,
    });
    expect(feedback?.kind).toBe('hizb-completed');
    expect(feedback?.kind === 'hizb-completed' && typeof feedback.elementKind).toBe('string');
  });
});

describe('the table of contents (spec 1)', () => {
  const surahs = buildSurahEntries(quranStructure);

  it('lists the 114 surahs from the structure, with their first page', () => {
    expect(surahs).toHaveLength(114);
    expect(surahs[0]).toMatchObject({
      surah: 1,
      page: 1,
      verseCount: 7,
      revelationPlace: 'meccan',
    });
    expect(surahs[17]).toMatchObject({
      surah: 18,
      nameTransliterated: 'Al-Kahf',
      nameArabic: 'الكهف',
      page: 293,
      verseCount: 110,
    });
    expect(surahs[113]).toMatchObject({ surah: 114, page: PAGE_COUNT });
  });

  it('lists the 30 juz and their two hizb, with the page each starts on', () => {
    const juz = buildJuzEntries(quranStructure);
    expect(juz).toHaveLength(30);
    expect(juz[0]).toEqual({
      juz: 1,
      page: 1,
      hizbs: [
        { hizb: 1, page: 1 },
        { hizb: 2, page: RANGES[1]!.firstPage },
      ],
    });
    expect(juz[29]!.hizbs[1]!.hizb).toBe(60);
  });

  it('finds a surah by its number', () => {
    expect(filterSurahs(surahs, '18').map((entry) => entry.surah)).toEqual([18]);
    expect(filterSurahs(surahs, ' 114 ').map((entry) => entry.surah)).toEqual([114]);
    expect(filterSurahs(surahs, '115')).toEqual([]);
  });

  it('finds a surah by its name, whatever the case, accents and hyphens', () => {
    expect(filterSurahs(surahs, 'kahf').map((entry) => entry.surah)).toEqual([18]);
    expect(filterSurahs(surahs, 'AL KAHF').map((entry) => entry.surah)).toEqual([18]);
    expect(filterSurahs(surahs, 'الكهف').map((entry) => entry.surah)).toEqual([18]);
    expect(filterSurahs(surahs, 'كهف').map((entry) => entry.surah)).toEqual([18]);
  });

  it('shows every surah for an empty search', () => {
    expect(filterSurahs(surahs, '   ')).toBe(surahs);
  });
});

describe('the size of the page text (spec 2)', () => {
  const IPHONE_X = { width: 375, height: 812 - 44 - 34 - 44 };

  it('follows the width of the screen, not the text size setting', () => {
    const narrow = computePageMetrics({ width: 375, height: 700 });
    const wide = computePageMetrics({ width: 430, height: 700 });
    expect(wide.fontSize).toBeGreaterThan(narrow.fontSize);
    expect(narrow.fontSize).toBeCloseTo(narrow.textWidth / READER_CONFIG.lineWidthInEm, 5);
  });

  it('fits the 15 lines in the height, without two lines overlapping', () => {
    for (const size of [
      IPHONE_X,
      { width: 375, height: 667 - 20 - 44 },
      { width: 430, height: 600 },
    ]) {
      const metrics = computePageMetrics(size);
      expect(metrics.lineHeight * 15).toBeLessThanOrEqual(size.height + 1e-9);
      expect(metrics.lineHeight).toBeGreaterThanOrEqual(
        metrics.fontSize * READER_CONFIG.minimumLineHeightInEm - 1e-9,
      );
    }
  });

  it('refuses a page with no room', () => {
    expect(() => computePageMetrics({ width: 0, height: 700 })).toThrow(RangeError);
    expect(() => computePageMetrics({ width: 375, height: -1 })).toThrow(RangeError);
  });

  it('keeps a line that fits at full size, and shrinks one that does not, never more', () => {
    expect(fitLine({ itemWidths: [50, 60, 70], available: 300, minimumGap: 5 })).toEqual({
      scale: 1,
    });
    const tight = fitLine({ itemWidths: [100, 100, 100], available: 300, minimumGap: 10 });
    expect(tight.scale).toBeCloseTo(300 / 320, 10);
    expect(() => fitLine({ itemWidths: [], available: 300, minimumGap: 5 })).toThrow(RangeError);
  });
});
