/**
 * The rules of the reader that do not need a screen (docs/specs/reader.md, sections 1 to 3 and 8):
 * the page to resume, the bounds of the pages, the table of contents and its search, and the
 * feedback after a page. The scroll's own rules (sections, text, place, the 30-second rule) are in
 * scroll-model.test.ts.
 */

import { quranStructure } from '@/data/quran';
import { EMPTY_JOURNAL, recordPageRead, type ReadingJournal } from '@/domain/khatm';
import { PAGE_COUNT } from '@/domain/quran';
import { parseLocalDate } from '@/domain/shared/local-date';

import {
  buildJuzEntries,
  buildSurahEntries,
  filterSurahs,
  openingWords,
  parseGoToPage,
} from '../contents-model';
import { isPageNumber, parsePageParam } from '../page-order';
import { pageSurah } from '../page-surah';
import { buildHomeModel } from '@/features/home';
import { readingFeedback } from '../reading-feedback';
import { resolveResumePage } from '../resume-page';

const RANGES = quranStructure.hizbPageRanges();
const DAY = parseLocalDate('2026-11-24');

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

describe('the bounds of the pages (spec 2)', () => {
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
});

describe('the feedback after a page (spec 3)', () => {
  const settings = { dailyGoalPages: 5, userSeed: 42, lastOpenedPage: null, pauses: [] };

  it('says a new page counted, and names what grows in the hizb in progress', () => {
    const before = readPages([1]);
    const after = readPages([2], before);
    const feedback = readingFeedback({
      before,
      after,
      settings,
      today: DAY,
      hizbPageRanges: RANGES,
    });
    // The element the garden module grows with the pages of the hizb in progress.
    const growing = buildHomeModel({ journal: after, settings, today: DAY, hizbPageRanges: RANGES })
      .garden.nextElement?.element.kind;
    expect(growing).toBeDefined();
    expect(feedback).toEqual({ kind: 'page-counted', growingKind: growing });
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
        { hizb: 1, page: 1, start: { surah: 1, verse: 1 } },
        { hizb: 2, page: RANGES[1]!.firstPage, start: { surah: 2, verse: 75 } },
      ],
    });
    expect(juz[29]!.hizbs[1]).toEqual({
      hizb: 60,
      page: RANGES[59]!.firstPage,
      start: { surah: 87, verse: 1 },
    });
  });

  it('starts each hizb on the verse of the structure, on the page it gives', () => {
    for (const juz of buildJuzEntries(quranStructure)) {
      for (const hizb of juz.hizbs) {
        expect(quranStructure.hizbOfVerse(hizb.start)).toBe(hizb.hizb);
        expect(quranStructure.pageOfVerse(hizb.start)).toBe(hizb.page);
        if (hizb.start.verse > 1) {
          const before = { surah: hizb.start.surah, verse: hizb.start.verse - 1 };
          expect(quranStructure.hizbOfVerse(before)).toBe(hizb.hizb - 1);
        }
      }
    }
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

describe('going to a page by its number (spec 1)', () => {
  it('reads a page between 1 and 604', () => {
    expect(parseGoToPage('1')).toBe(1);
    expect(parseGoToPage(' 293 ')).toBe(293);
    expect(parseGoToPage('604')).toBe(PAGE_COUNT);
  });

  it('refuses anything else', () => {
    for (const text of ['', '  ', '0', '605', '-3', '2.5', '1e2', 'abc', '12a', '٢٩٣x']) {
      expect(parseGoToPage(text)).toBeNull();
    }
  });

  it('reads Arabic-Indic digits, as an Arabic keyboard types them', () => {
    expect(parseGoToPage('٢٩٣')).toBe(293);
  });
});

describe('the surah a page is named after', () => {
  it('is the surah that begins on the page, as the mockup names page 293 "Al-Kahf"', () => {
    // Page 293 opens with the last verses of Al-Isra, then Al-Kahf begins.
    expect(quranStructure.firstVerseOfPage(293).surah).toBe(17);
    expect(pageSurah(quranStructure, 293)).toBe(18);
  });

  it('is the surah the page continues when none begins on it', () => {
    expect(pageSurah(quranStructure, 294)).toBe(18);
    expect(pageSurah(quranStructure, 3)).toBe(2);
  });

  it('is the first to begin when several do', () => {
    expect(pageSurah(quranStructure, 1)).toBe(1);
    expect(pageSurah(quranStructure, 604)).toBe(quranStructure.firstVerseOfPage(604).surah);
  });
});

describe('the opening words of a juz', () => {
  it('keeps the first words of a verse, as they are written', () => {
    expect(openingWords('سَيَقُولُ ٱلسُّفَهَآءُ مِنَ ٱلنَّاسِ مَا وَلَّىٰهُمْ', 3)).toBe('سَيَقُولُ ٱلسُّفَهَآءُ مِنَ');
  });

  it('keeps a short verse whole, and ignores the spaces around it', () => {
    expect(openingWords('  بِسْمِ ٱللَّهِ  ', 3)).toBe('بِسْمِ ٱللَّهِ');
  });
});
