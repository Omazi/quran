import { createQuranStructure } from '../structure';
import {
  replaceAt,
  STRUCTURE,
  STRUCTURE_DATA,
  withStructureData,
} from '../test-support/quran-test-kit';
import {
  HIZB_COUNT,
  JUZ_COUNT,
  PAGE_COUNT,
  SURAH_COUNT,
  VERSE_COUNT,
  type VerseRef,
} from '../types';

describe('Invariant — 114 surahs, 6236 verses, 604 pages, 30 juz, 60 hizb', () => {
  it('the structure data holds exactly these counts', () => {
    expect(STRUCTURE.surahs).toHaveLength(114);
    expect(STRUCTURE.surahs.reduce((total, info) => total + info.verseCount, 0)).toBe(6236);
    expect(STRUCTURE_DATA.pageStarts).toHaveLength(604);
    expect(STRUCTURE_DATA.juzStarts).toHaveLength(30);
    expect(STRUCTURE_DATA.hizbStarts).toHaveLength(60);
    expect(STRUCTURE.hizbPageRanges()).toHaveLength(60);
  });

  it('the shared constants say the same', () => {
    expect([SURAH_COUNT, VERSE_COUNT, PAGE_COUNT, JUZ_COUNT, HIZB_COUNT]).toEqual([
      114, 6236, 604, 30, 60,
    ]);
  });
});

describe('Surahs — Arabic name, transliteration, verse count, Meccan or Medinan', () => {
  it('gives the first and the last surah', () => {
    expect(STRUCTURE.surah(1)).toEqual({
      surah: 1,
      nameArabic: 'الفاتحة',
      nameTransliterated: 'Al-Fatihah',
      verseCount: 7,
      revelationPlace: 'meccan',
    });
    expect(STRUCTURE.surah(114)).toMatchObject({ nameArabic: 'الناس', verseCount: 6 });
  });

  it('knows the longest surah and a Medinan one', () => {
    expect(STRUCTURE.surah(2)).toMatchObject({ verseCount: 286, revelationPlace: 'medinan' });
  });

  it('counts 86 Meccan and 28 Medinan surahs', () => {
    const meccan = STRUCTURE.surahs.filter((info) => info.revelationPlace === 'meccan');
    expect(meccan).toHaveLength(86);
    expect(STRUCTURE.surahs).toHaveLength(86 + 28);
  });

  it.each([0, 115, -1, 1.5, Number.NaN])('surah %p does not exist', (surah) => {
    expect(() => STRUCTURE.surah(surah)).toThrow(RangeError);
  });
});

describe('Structure — page of a verse', () => {
  it.each([
    ['1:1', 1],
    ['1:7', 1],
    ['2:1', 2],
    ['2:5', 2],
    ['2:6', 3],
    ['2:255', 42],
    ['18:1', 293],
    ['36:1', 440],
    ['67:1', 562],
    ['78:1', 582],
    ['112:1', 604],
    ['114:6', 604],
  ])('%s is on page %i', (key, page) => {
    expect(STRUCTURE.pageOfVerse(STRUCTURE.verseRef(key))).toBe(page);
  });

  it('every verse is on a page between the pages of its neighbours', () => {
    let previousPage = 1;
    for (const { surah, verseCount } of STRUCTURE.surahs) {
      for (let verse = 1; verse <= verseCount; verse += 1) {
        const page = STRUCTURE.pageOfVerse({ surah, verse });
        expect(page === previousPage || page === previousPage + 1).toBe(true);
        previousPage = page;
      }
    }
    expect(previousPage).toBe(604);
  });
});

describe('Structure — first and last verse of a page', () => {
  it('gives both ends of the first, of a middle and of the last page', () => {
    expect(STRUCTURE.firstVerseOfPage(1)).toEqual({ surah: 1, verse: 1 });
    expect(STRUCTURE.lastVerseOfPage(1)).toEqual({ surah: 1, verse: 7 });
    expect(STRUCTURE.firstVerseOfPage(3)).toEqual({ surah: 2, verse: 6 });
    expect(STRUCTURE.lastVerseOfPage(2)).toEqual({ surah: 2, verse: 5 });
    expect(STRUCTURE.firstVerseOfPage(604)).toEqual({ surah: 112, verse: 1 });
    expect(STRUCTURE.lastVerseOfPage(604)).toEqual({ surah: 114, verse: 6 });
  });

  it('the verse after the last verse of a page opens the next page', () => {
    for (let page = 1; page < PAGE_COUNT; page += 1) {
      const last = STRUCTURE.lastVerseOfPage(page);
      const next = STRUCTURE.firstVerseOfPage(page + 1);
      const endsSurah = last.verse === STRUCTURE.surah(last.surah).verseCount;
      expect(next).toEqual(
        endsSurah
          ? { surah: last.surah + 1, verse: 1 }
          : { surah: last.surah, verse: last.verse + 1 },
      );
      expect(STRUCTURE.pageOfVerse(last)).toBe(page);
      expect(STRUCTURE.pageOfVerse(next)).toBe(page + 1);
    }
  });
});

describe('Structure — hizb and juz of a verse', () => {
  it.each([
    ['1:1', 1, 1],
    ['2:74', 1, 1],
    ['2:75', 2, 1],
    ['2:141', 2, 1],
    ['2:142', 3, 2],
    ['2:252', 4, 2],
    ['2:253', 5, 3],
    ['7:1', 16, 8],
    ['18:74', 30, 15],
    ['18:75', 31, 16],
    ['77:50', 58, 29],
    ['78:1', 59, 30],
    ['86:17', 59, 30],
    ['87:1', 60, 30],
    ['114:6', 60, 30],
  ])('%s is in hizb %i and juz %i', (key, hizb, juz) => {
    const ref = STRUCTURE.verseRef(key);
    expect(STRUCTURE.hizbOfVerse(ref)).toBe(hizb);
    expect(STRUCTURE.juzOfVerse(ref)).toBe(juz);
  });

  it('each juz is made of two hizb', () => {
    STRUCTURE_DATA.juzStarts.forEach((key, index) => {
      const ref = STRUCTURE.verseRef(key);
      expect(STRUCTURE.juzOfVerse(ref)).toBe(index + 1);
      expect(STRUCTURE.hizbOfVerse(ref)).toBe(index * 2 + 1);
    });
  });
});

describe('Structure — hizb and juz of a page (those of its first verse)', () => {
  it.each([
    [1, 1, 1],
    // Hizb 2 starts at 2:75, in the middle of page 11: the page still opens in hizb 1.
    [11, 1, 1],
    [12, 2, 1],
    [21, 2, 1],
    // Juz 2 starts with the first verse of page 22.
    [22, 3, 2],
    [582, 59, 30],
    [591, 59, 30],
    [592, 60, 30],
    [604, 60, 30],
  ])('page %i opens in hizb %i and juz %i', (page, hizb, juz) => {
    expect(STRUCTURE.hizbOfPage(page)).toBe(hizb);
    expect(STRUCTURE.juzOfPage(page)).toBe(juz);
  });

  it('agrees with the hizb and juz of the first verse of every page', () => {
    for (let page = 1; page <= PAGE_COUNT; page += 1) {
      const first = STRUCTURE.firstVerseOfPage(page);
      expect(STRUCTURE.hizbOfPage(page)).toBe(STRUCTURE.hizbOfVerse(first));
      expect(STRUCTURE.juzOfPage(page)).toBe(STRUCTURE.juzOfVerse(first));
    }
  });
});

describe('Structure — surahs present on a page', () => {
  it.each([
    [1, [1]],
    [2, [2]],
    [49, [2]],
    [50, [3]],
    // An-Nisa ends and Al-Ma'idah starts on page 106.
    [106, [4, 5]],
    [603, [109, 110, 111]],
    [604, [112, 113, 114]],
  ])('page %i holds surahs %p', (page, surahs) => {
    expect(STRUCTURE.surahsOnPage(page)).toEqual(surahs);
  });

  it('every surah is on at least one page, in order', () => {
    const seen = new Set<number>();
    let highest = 0;
    for (let page = 1; page <= PAGE_COUNT; page += 1) {
      for (const surah of STRUCTURE.surahsOnPage(page)) {
        expect(surah).toBeGreaterThanOrEqual(highest);
        highest = surah;
        seen.add(surah);
      }
    }
    expect(seen.size).toBe(114);
  });
});

function verseBefore(ref: VerseRef): VerseRef {
  if (ref.verse > 1) return { surah: ref.surah, verse: ref.verse - 1 };
  return { surah: ref.surah - 1, verse: STRUCTURE.surah(ref.surah - 1).verseCount };
}

describe('Structure — first and last page of each hizb (hizbPageRanges)', () => {
  it('gives { hizb, firstPage, lastPage } for the 60 hizb, in order', () => {
    const ranges = STRUCTURE.hizbPageRanges();
    expect(ranges).toHaveLength(60);
    expect(ranges.map((range) => range.hizb)).toEqual(
      Array.from({ length: 60 }, (_, index) => index + 1),
    );
    expect(ranges[0]).toEqual({ hizb: 1, firstPage: 1, lastPage: 11 });
    expect(ranges[1]).toEqual({ hizb: 2, firstPage: 11, lastPage: 21 });
    expect(ranges[2]).toEqual({ hizb: 3, firstPage: 22, lastPage: 31 });
    expect(ranges[59]).toEqual({ hizb: 60, firstPage: 591, lastPage: 604 });
  });

  it('hizbPageRange gives one of them', () => {
    expect(STRUCTURE.hizbPageRange(1)).toEqual({ hizb: 1, firstPage: 1, lastPage: 11 });
    expect(STRUCTURE.hizbPageRange(60)).toEqual({ hizb: 60, firstPage: 591, lastPage: 604 });
    expect(STRUCTURE.hizbPageRange(30)).toBe(STRUCTURE.hizbPageRanges()[29]);
  });

  it('a range goes from the page of its first verse to the page of its last verse', () => {
    const ranges = STRUCTURE.hizbPageRanges();
    STRUCTURE_DATA.hizbStarts.forEach((key, index) => {
      const nextStart = STRUCTURE_DATA.hizbStarts[index + 1];
      const lastVerse =
        nextStart === undefined
          ? { surah: 114, verse: 6 }
          : verseBefore(STRUCTURE.verseRef(nextStart));

      expect(ranges[index]).toEqual({
        hizb: index + 1,
        firstPage: STRUCTURE.pageOfVerse(STRUCTURE.verseRef(key)),
        lastPage: STRUCTURE.pageOfVerse(lastVerse),
      });
    });
  });

  it('the ranges cannot be modified by a caller', () => {
    const ranges = STRUCTURE.hizbPageRanges();
    expect(Object.isFrozen(ranges)).toBe(true);
    expect(ranges.every((range) => Object.isFrozen(range))).toBe(true);
    expect(STRUCTURE.hizbPageRanges()).toBe(ranges);
  });
});

describe('Invariant — hizb page ranges cover 1..604 without a gap; two neighbouring hizb share at most one page', () => {
  const ranges = STRUCTURE.hizbPageRanges();

  it('the first hizb starts on page 1 and the last one ends on page 604', () => {
    expect(ranges[0]?.firstPage).toBe(1);
    expect(ranges[59]?.lastPage).toBe(604);
  });

  it('each hizb starts on the page where the previous one ends, or on the next page', () => {
    for (let index = 1; index < ranges.length; index += 1) {
      const previous = ranges[index - 1];
      const current = ranges[index];
      const gap = (current?.firstPage ?? 0) - (previous?.lastPage ?? 0);
      expect([0, 1]).toContain(gap);
    }
  });

  it('every page from 1 to 604 belongs to one hizb, or to two neighbours', () => {
    for (let page = 1; page <= PAGE_COUNT; page += 1) {
      const owners = ranges.filter((range) => range.firstPage <= page && page <= range.lastPage);
      expect(owners.length === 1 || owners.length === 2).toBe(true);
      if (owners.length === 2) expect((owners[1]?.hizb ?? 0) - (owners[0]?.hizb ?? 0)).toBe(1);
    }
  });

  it('no hizb ends before it starts', () => {
    expect(ranges.every((range) => range.firstPage <= range.lastPage)).toBe(true);
  });

  it('a page is shared exactly when the next hizb starts below the first line of a page', () => {
    for (let index = 1; index < ranges.length; index += 1) {
      const start = STRUCTURE.verseRef(STRUCTURE_DATA.hizbStarts[index] ?? '');
      const startsWithThePage =
        STRUCTURE_DATA.pageStarts[STRUCTURE.pageOfVerse(start) - 1] ===
        STRUCTURE_DATA.hizbStarts[index];
      const sharesAPage = ranges[index]?.firstPage === ranges[index - 1]?.lastPage;
      expect(sharesAPage).toBe(!startsWithThePage);
    }
  });
});

describe('Invariant — invalid input (surah 0, verse 300 of surah 1, page 605) raises an explicit error', () => {
  it('surah 0', () => {
    expect(() => STRUCTURE.verseRef('0:1')).toThrow(RangeError);
    expect(() => STRUCTURE.assertVerse({ surah: 0, verse: 1 })).toThrow('Invalid surah: 0');
    expect(() => STRUCTURE.pageOfVerse({ surah: 0, verse: 1 })).toThrow(RangeError);
    expect(() => STRUCTURE.hizbOfVerse({ surah: 0, verse: 1 })).toThrow(RangeError);
    expect(() => STRUCTURE.juzOfVerse({ surah: 0, verse: 1 })).toThrow(RangeError);
  });

  it('verse 300 of surah 1', () => {
    expect(() => STRUCTURE.verseRef('1:300')).toThrow(RangeError);
    expect(() => STRUCTURE.verseRef('1:300')).toThrow(
      'Invalid verse: 1:300 (surah 1 has 7 verses)',
    );
    expect(() => STRUCTURE.pageOfVerse({ surah: 1, verse: 300 })).toThrow(RangeError);
    expect(() => STRUCTURE.hizbOfVerse({ surah: 1, verse: 300 })).toThrow(RangeError);
    expect(() => STRUCTURE.juzOfVerse({ surah: 1, verse: 300 })).toThrow(RangeError);
  });

  it('page 605', () => {
    expect(() => STRUCTURE.firstVerseOfPage(605)).toThrow(RangeError);
    expect(() => STRUCTURE.firstVerseOfPage(605)).toThrow('Invalid page: 605');
    expect(() => STRUCTURE.lastVerseOfPage(605)).toThrow(RangeError);
    expect(() => STRUCTURE.hizbOfPage(605)).toThrow(RangeError);
    expect(() => STRUCTURE.juzOfPage(605)).toThrow(RangeError);
    expect(() => STRUCTURE.surahsOnPage(605)).toThrow(RangeError);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('page %p', (page) => {
    expect(() => STRUCTURE.firstVerseOfPage(page)).toThrow(RangeError);
    expect(() => STRUCTURE.surahsOnPage(page)).toThrow(RangeError);
    expect(() => STRUCTURE.hizbOfPage(page)).toThrow(RangeError);
  });

  it.each([0, 61, 1.5, Number.NaN])('hizb %p', (hizb) => {
    expect(() => STRUCTURE.hizbPageRange(hizb)).toThrow(RangeError);
  });

  it.each([
    { surah: 115, verse: 1 },
    { surah: 2, verse: 287 },
    { surah: 114, verse: 7 },
    { surah: 1, verse: 0 },
    { surah: 1, verse: 1.5 },
    { surah: 1.5, verse: 1 },
    { surah: 1, verse: Number.NaN },
  ])('verse %p', (ref) => {
    expect(() => STRUCTURE.assertVerse(ref)).toThrow(RangeError);
    expect(() => STRUCTURE.pageOfVerse(ref)).toThrow(RangeError);
  });

  it('the last verse of a surah is valid, the next number is not', () => {
    expect(() => STRUCTURE.assertVerse({ surah: 1, verse: 7 })).not.toThrow();
    expect(() => STRUCTURE.assertVerse({ surah: 1, verse: 8 })).toThrow(RangeError);
  });

  it('a malformed verse key is a TypeError', () => {
    expect(() => STRUCTURE.verseRef('18')).toThrow(TypeError);
  });
});

describe('Structure data — invalid data is refused when the structure is created', () => {
  const firstSurah = STRUCTURE_DATA.surahs[0];
  if (firstSurah === undefined) throw new Error('The structure data has no surah');

  it.each<[string, Parameters<typeof withStructureData>[0]]>([
    ['113 surahs', { surahs: STRUCTURE_DATA.surahs.slice(1) }],
    [
      'a surah with the wrong number',
      { surahs: replaceAt(STRUCTURE_DATA.surahs, 0, { ...firstSurah, surah: 2 }) },
    ],
    [
      'a surah without verses',
      { surahs: replaceAt(STRUCTURE_DATA.surahs, 0, { ...firstSurah, verseCount: 0 }) },
    ],
    [
      '6237 verses in total',
      { surahs: replaceAt(STRUCTURE_DATA.surahs, 0, { ...firstSurah, verseCount: 8 }) },
    ],
    [
      'a surah without a name',
      { surahs: replaceAt(STRUCTURE_DATA.surahs, 0, { ...firstSurah, nameArabic: '' }) },
    ],
    [
      'an unknown revelation place',
      {
        surahs: replaceAt(STRUCTURE_DATA.surahs, 0, {
          ...firstSurah,
          revelationPlace: 'elsewhere',
        }),
      },
    ],
    ['603 pages', { pageStarts: STRUCTURE_DATA.pageStarts.slice(0, 603) }],
    ['605 pages', { pageStarts: [...STRUCTURE_DATA.pageStarts, '114:6'] }],
    [
      'a first page that does not start at 1:1',
      { pageStarts: replaceAt(STRUCTURE_DATA.pageStarts, 0, '1:2') },
    ],
    [
      'two pages starting with the same verse',
      { pageStarts: replaceAt(STRUCTURE_DATA.pageStarts, 2, '2:1') },
    ],
    ['pages out of order', { pageStarts: replaceAt(STRUCTURE_DATA.pageStarts, 2, '1:3') }],
    [
      'a page starting at a verse that does not exist',
      { pageStarts: replaceAt(STRUCTURE_DATA.pageStarts, 603, '114:7') },
    ],
    ['59 hizb', { hizbStarts: STRUCTURE_DATA.hizbStarts.slice(0, 59) }],
    ['a hizb out of order', { hizbStarts: replaceAt(STRUCTURE_DATA.hizbStarts, 1, '1:1') }],
    ['29 juz', { juzStarts: STRUCTURE_DATA.juzStarts.slice(0, 29) }],
    [
      'a juz that does not start with a hizb',
      { juzStarts: replaceAt(STRUCTURE_DATA.juzStarts, 1, '2:143') },
    ],
  ])('%s', (_label, changes) => {
    expect(() => createQuranStructure(withStructureData(changes))).toThrow(RangeError);
  });

  it('a page start that is not a verse key is a TypeError', () => {
    const data = withStructureData({
      pageStarts: replaceAt(STRUCTURE_DATA.pageStarts, 5, 'page 6'),
    });
    expect(() => createQuranStructure(data)).toThrow(TypeError);
  });

  it('the generated data is accepted', () => {
    expect(() => createQuranStructure(STRUCTURE_DATA)).not.toThrow();
  });
});
