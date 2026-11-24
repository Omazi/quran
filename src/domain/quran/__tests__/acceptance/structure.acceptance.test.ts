/**
 * Acceptance tests — structure of the mushaf (surahs, pages, juz, hizb).
 * Spec: docs/specs/quran.md, livrable 3 and "Invariants à tester".
 *
 * The structure is built from the generated `assets/data/structure.json` and compared with
 * anchors that the tester knows independently of the app (see ./mushaf-anchors.ts).
 */
import {
  createQuranStructure,
  formatVerseKey,
  type QuranStructure,
  type QuranStructureData,
  type VerseRef,
} from '@/domain/quran';

import structureData from '../../../../../assets/data/structure.json';
import {
  allVerseKeys,
  CLASSIC_PAGE_STARTS,
  DECLARED_PAGE_START_DIFFERENCES,
  FIRST_PAGE_OF_HIZB,
  FIRST_PAGE_OF_JUZ,
  FIRST_PAGE_OF_SURAH,
  HIZB_STARTS,
  itemAt,
  JUZ_STARTS,
  MEDINAN_SURAHS,
  pageInList,
  readingRank,
  SURAH_NAMES_ARABIC,
  VERSE_COUNT_BY_SURAH,
} from './mushaf-anchors';

const structure: QuranStructure = createQuranStructure(structureData);

const PAGES = Array.from({ length: 604 }, (_, index) => index + 1);
const HIZBS = Array.from({ length: 60 }, (_, index) => index + 1);
const ALL_KEYS = allVerseKeys();
const ALL_REFS: readonly VerseRef[] = ALL_KEYS.map((key) => {
  const [surah, verse] = key.split(':').map(Number);
  return { surah: surah ?? 0, verse: verse ?? 0 };
});

function keyOf(ref: VerseRef): string {
  return `${ref.surah}:${ref.verse}`;
}

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return undefined;
}

function expectExplicitError(action: () => unknown): void {
  const error = thrownBy(action);
  expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
}

/** The structure data with every field writable, so that a test can corrupt a copy. */
type MutableData = {
  surahs: {
    surah: number;
    nameArabic: string;
    nameTransliterated: string;
    verseCount: number;
    revelationPlace: string;
  }[];
  pageStarts: string[];
  juzStarts: string[];
  hizbStarts: string[];
};

/** Arabic letters, vowel signs and spaces only. */
const ARABIC_NAME = /^[\u0621-\u0652\u0670\u0671 ]+$/;
/** Latin letters, spaces, hyphens and the apostrophes used for ayn and hamza. */
const LATIN_NAME = /^['\u2018\u2019]?[A-Za-z][A-Za-z '\u2018\u2019-]*$/;

/** Folds spelling variants that are not differences of name (hamza seats, vowel signs). */
function foldName(name: string): string {
  return name
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .trim();
}

describe('Invariant — 114 sourates, 6 236 versets, 604 pages, 30 juz, 60 hizb', () => {
  it('114 surahs, numbered 1..114 in order', () => {
    expect(structure.surahs).toHaveLength(114);
    expect(structure.surahs.map((surah) => surah.surah)).toEqual(
      Array.from({ length: 114 }, (_, index) => index + 1),
    );
  });

  it('6236 verses in total', () => {
    expect(structure.surahs.reduce((sum, surah) => sum + surah.verseCount, 0)).toBe(6236);
  });

  it('604 pages: page 1 starts at 1:1 and page 604 ends at 114:6', () => {
    expect(structureData.pageStarts).toHaveLength(604);
    expect(structure.firstVerseOfPage(1)).toEqual({ surah: 1, verse: 1 });
    expect(structure.lastVerseOfPage(604)).toEqual({ surah: 114, verse: 6 });
  });

  it('30 juz and 60 hizb: the last verse is in juz 30 and hizb 60, the first in juz 1 and hizb 1', () => {
    expect(structureData.juzStarts).toHaveLength(30);
    expect(structureData.hizbStarts).toHaveLength(60);
    expect(structure.juzOfVerse({ surah: 1, verse: 1 })).toBe(1);
    expect(structure.hizbOfVerse({ surah: 1, verse: 1 })).toBe(1);
    expect(structure.juzOfVerse({ surah: 114, verse: 6 })).toBe(30);
    expect(structure.hizbOfVerse({ surah: 114, verse: 6 })).toBe(60);
    expect(structure.hizbPageRanges()).toHaveLength(60);
  });
});

describe('Ancres indépendantes — sourates', () => {
  it('each surah has the verse count of the Hafs mushaf (Kufan count)', () => {
    expect(structure.surahs.map((surah) => surah.verseCount)).toEqual(VERSE_COUNT_BY_SURAH);
  });

  it('well-known verse counts: 1 -> 7, 2 -> 286 (longest), 108 -> 3 (shortest), 114 -> 6', () => {
    expect(structure.surah(1).verseCount).toBe(7);
    expect(structure.surah(2).verseCount).toBe(286);
    expect(structure.surah(9).verseCount).toBe(129);
    expect(structure.surah(18).verseCount).toBe(110);
    expect(structure.surah(36).verseCount).toBe(83);
    expect(structure.surah(108).verseCount).toBe(3);
    expect(structure.surah(114).verseCount).toBe(6);
    expect(Math.max(...structure.surahs.map((surah) => surah.verseCount))).toBe(286);
    expect(Math.min(...structure.surahs.map((surah) => surah.verseCount))).toBe(3);
  });

  it('28 surahs are Medinan and 86 Meccan, as headed in the Madinah mushaf', () => {
    const medinan = structure.surahs
      .filter((surah) => surah.revelationPlace === 'medinan')
      .map((surah) => surah.surah);
    const meccan = structure.surahs.filter((surah) => surah.revelationPlace === 'meccan');
    expect(medinan).toEqual(MEDINAN_SURAHS);
    expect(meccan).toHaveLength(86);
  });

  it('undisputed cases: 1, 6, 96 and 112 Meccan; 2, 9, 24 and 110 Medinan', () => {
    for (const surah of [1, 6, 96, 112]) {
      expect(structure.surah(surah).revelationPlace).toBe('meccan');
    }
    for (const surah of [2, 9, 24, 110]) {
      expect(structure.surah(surah).revelationPlace).toBe('medinan');
    }
  });

  it('Arabic names are those of the mushaf headings (hamza seats and vowel signs folded)', () => {
    expect(structure.surahs.map((surah) => foldName(surah.nameArabic))).toEqual(
      SURAH_NAMES_ARABIC.map(foldName),
    );
  });

  it('names are present, trimmed and distinct; transliterations are in Latin letters', () => {
    const arabicNames = structure.surahs.map((surah) => surah.nameArabic);
    const latinNames = structure.surahs.map((surah) => surah.nameTransliterated);
    expect(new Set(arabicNames).size).toBe(114);
    expect(new Set(latinNames).size).toBe(114);
    for (const name of [...arabicNames, ...latinNames]) {
      expect(name).toBe(name.trim());
      expect(name.length).toBeGreaterThan(0);
    }
    expect(arabicNames.filter((name) => !ARABIC_NAME.test(name))).toEqual([]);
    expect(latinNames.filter((name) => !LATIN_NAME.test(name))).toEqual([]);
  });

  it('surah(n) is the n-th entry of surahs', () => {
    structure.surahs.forEach((info, index) => {
      expect(structure.surah(index + 1)).toEqual(info);
    });
  });
});

describe('Ancres indépendantes — pages', () => {
  it('each surah begins on its well-known page (18 -> 293, 36 -> 440, 67 -> 562, 78 -> 582...)', () => {
    const firstPages = structure.surahs.map((surah) =>
      structure.pageOfVerse({ surah: surah.surah, verse: 1 }),
    );
    expect(firstPages).toEqual(FIRST_PAGE_OF_SURAH);
  });

  it('the README example holds: 18:10 is on page 294, in hizb 30 and juz 15', () => {
    const ref = structure.verseRef('18:10');
    expect(ref).toEqual({ surah: 18, verse: 10 });
    expect(structure.pageOfVerse(ref)).toBe(294);
    expect(structure.hizbOfVerse(ref)).toBe(30);
    expect(structure.juzOfVerse(ref)).toBe(15);
  });

  it('the verse of the Throne (2:255) is on page 42; the verse of debt (2:282) fills page 48', () => {
    expect(structure.pageOfVerse({ surah: 2, verse: 255 })).toBe(42);
    expect(structure.firstVerseOfPage(48)).toEqual({ surah: 2, verse: 282 });
    expect(structure.lastVerseOfPage(48)).toEqual({ surah: 2, verse: 282 });
  });

  it('page 1 is al-Fatiha alone, page 2 is 2:1-5, page 604 is surahs 112 to 114', () => {
    expect(structure.firstVerseOfPage(1)).toEqual({ surah: 1, verse: 1 });
    expect(structure.lastVerseOfPage(1)).toEqual({ surah: 1, verse: 7 });
    expect(structure.firstVerseOfPage(2)).toEqual({ surah: 2, verse: 1 });
    expect(structure.lastVerseOfPage(2)).toEqual({ surah: 2, verse: 5 });
    expect(structure.firstVerseOfPage(604)).toEqual({ surah: 112, verse: 1 });
    expect(structure.surahsOnPage(604)).toEqual([112, 113, 114]);
  });

  it('first verse of each page is that of the classic Madinah mushaf, outside the 25 declared pages', () => {
    const declaredPages = new Set(DECLARED_PAGE_START_DIFFERENCES.map((entry) => entry.page));
    const undeclaredDifferences: string[] = [];
    for (const page of PAGES) {
      const actual = keyOf(structure.firstVerseOfPage(page));
      const classic = itemAt(CLASSIC_PAGE_STARTS, page - 1);
      if (actual !== classic && !declaredPages.has(page)) {
        undeclaredDifferences.push(`page ${page}: ${actual}, classic mushaf ${classic}`);
      }
    }
    expect(undeclaredDifferences).toEqual([]);
  });

  it('Toute incohérence entre deux sources est signalée — the 25 declared pages start where docs/DATA_SOURCES.md says', () => {
    // The tester could NOT verify these 25 starts against a printed mushaf: this test only
    // proves that the differences with the classic list are exactly the declared ones.
    const actual = DECLARED_PAGE_START_DIFFERENCES.map((entry) => ({
      page: entry.page,
      layout: keyOf(structure.firstVerseOfPage(entry.page)),
    }));
    const declared = DECLARED_PAGE_START_DIFFERENCES.map((entry) => ({
      page: entry.page,
      layout: entry.layout,
    }));
    expect(actual).toEqual(declared);
  });

  it('56 verses are on another page than in the classic mushaf, never more than one page away', () => {
    const appPageStarts = PAGES.map((page) => keyOf(structure.firstVerseOfPage(page)));
    const moved = ALL_KEYS.filter(
      (key) => pageInList(appPageStarts, key) !== pageInList(CLASSIC_PAGE_STARTS, key),
    );
    expect(moved).toHaveLength(56);
    for (const key of moved) {
      const distance = pageInList(appPageStarts, key) - pageInList(CLASSIC_PAGE_STARTS, key);
      expect(Math.abs(distance)).toBe(1);
    }
  });
});

describe('Fonctions de structure — page d’un verset', () => {
  it('every verse is reachable exactly once: the pages partition the 6236 verses in order', () => {
    const seen: string[] = [];
    for (const page of PAGES) {
      const first = readingRank(keyOf(structure.firstVerseOfPage(page)));
      const last = readingRank(keyOf(structure.lastVerseOfPage(page)));
      expect(last).toBeGreaterThanOrEqual(first);
      for (let rank = first; rank <= last; rank += 1) {
        seen.push(itemAt(ALL_KEYS, rank));
      }
    }
    expect(seen).toEqual(ALL_KEYS);
  });

  it('pages are contiguous: a page starts with the verse that follows the last verse of the previous page', () => {
    for (const page of PAGES.slice(1)) {
      const previousLast = readingRank(keyOf(structure.lastVerseOfPage(page - 1)));
      const first = readingRank(keyOf(structure.firstVerseOfPage(page)));
      expect(first).toBe(previousLast + 1);
    }
  });

  it('pageOfVerse agrees with firstVerseOfPage and lastVerseOfPage for the 6236 verses', () => {
    const appPageStarts = PAGES.map((page) => keyOf(structure.firstVerseOfPage(page)));
    ALL_REFS.forEach((ref, index) => {
      expect(structure.pageOfVerse(ref)).toBe(pageInList(appPageStarts, itemAt(ALL_KEYS, index)));
    });
  });

  it('pageOfVerse never decreases along the reading order and never skips a page', () => {
    let previous = 1;
    for (const ref of ALL_REFS) {
      const page = structure.pageOfVerse(ref);
      expect(page === previous || page === previous + 1).toBe(true);
      previous = page;
    }
    expect(previous).toBe(604);
  });

  it('verseRef reads a key and checks that the verse exists', () => {
    expect(structure.verseRef('1:7')).toEqual({ surah: 1, verse: 7 });
    expect(structure.verseRef('114:6')).toEqual({ surah: 114, verse: 6 });
    for (const key of ALL_KEYS) {
      expect(formatVerseKey(structure.verseRef(key))).toBe(key);
    }
  });
});

describe('Fonctions de structure — juz et hizb', () => {
  it('each juz begins at its well-known verse', () => {
    expect(structureData.juzStarts).toEqual(JUZ_STARTS);
  });

  it('each hizb begins at its well-known verse', () => {
    expect(structureData.hizbStarts).toEqual(HIZB_STARTS);
  });

  it('juz 30 begins at 78:1 on page 582; juz 29 at 67:1 on page 562; juz 2 at 2:142 on page 22', () => {
    expect(structure.juzOfVerse({ surah: 78, verse: 1 })).toBe(30);
    expect(structure.juzOfVerse({ surah: 77, verse: 50 })).toBe(29);
    expect(structure.pageOfVerse({ surah: 78, verse: 1 })).toBe(582);
    expect(structure.juzOfPage(582)).toBe(30);
    expect(structure.juzOfPage(581)).toBe(29);
    expect(structure.juzOfVerse({ surah: 67, verse: 1 })).toBe(29);
    expect(structure.juzOfVerse({ surah: 66, verse: 12 })).toBe(28);
    expect(structure.juzOfVerse({ surah: 2, verse: 141 })).toBe(1);
    expect(structure.juzOfVerse({ surah: 2, verse: 142 })).toBe(2);
    expect(structure.pageOfVerse({ surah: 2, verse: 142 })).toBe(22);
  });

  it('the juz of a verse changes exactly at the 30 juz starts', () => {
    let expected = 0;
    ALL_REFS.forEach((ref, index) => {
      if (JUZ_STARTS[expected] === ALL_KEYS[index]) {
        expected += 1;
      }
      expect(structure.juzOfVerse(ref)).toBe(expected);
    });
    expect(expected).toBe(30);
  });

  it('the hizb of a verse changes exactly at the 60 hizb starts', () => {
    let expected = 0;
    ALL_REFS.forEach((ref, index) => {
      if (HIZB_STARTS[expected] === ALL_KEYS[index]) {
        expected += 1;
      }
      expect(structure.hizbOfVerse(ref)).toBe(expected);
    });
    expect(expected).toBe(60);
  });

  it('a juz is two hizb: juz = ceil(hizb / 2) for every verse', () => {
    for (const ref of ALL_REFS) {
      expect(structure.juzOfVerse(ref)).toBe(Math.ceil(structure.hizbOfVerse(ref) / 2));
    }
  });

  it('each juz and each hizb begins on its well-known page', () => {
    const pageOfKey = (key: string): number => structure.pageOfVerse(structure.verseRef(key));
    expect(JUZ_STARTS.map(pageOfKey)).toEqual(FIRST_PAGE_OF_JUZ);
    expect(HIZB_STARTS.map(pageOfKey)).toEqual(FIRST_PAGE_OF_HIZB);
  });

  it('hizb and juz of a page are those of its first verse', () => {
    for (const page of PAGES) {
      const first = structure.firstVerseOfPage(page);
      expect(structure.hizbOfPage(page)).toBe(structure.hizbOfVerse(first));
      expect(structure.juzOfPage(page)).toBe(structure.juzOfVerse(first));
    }
  });

  it('juz 7 and juz 11 begin in the middle of pages 121 and 201: those pages still belong to juz 6 and 10', () => {
    expect(structure.juzOfPage(121)).toBe(6);
    expect(structure.juzOfPage(122)).toBe(7);
    expect(structure.juzOfPage(201)).toBe(10);
    expect(structure.juzOfPage(202)).toBe(11);
    expect(structure.juzOfPage(22)).toBe(2);
    expect(structure.juzOfPage(21)).toBe(1);
  });
});

describe('Fonctions de structure — sourates présentes sur une page', () => {
  it('well-known pages', () => {
    expect(structure.surahsOnPage(1)).toEqual([1]);
    expect(structure.surahsOnPage(2)).toEqual([2]);
    expect(structure.surahsOnPage(49)).toEqual([2]);
    expect(structure.surahsOnPage(50)).toEqual([3]);
    expect(structure.surahsOnPage(106)).toEqual([4, 5]);
    expect(structure.surahsOnPage(187)).toEqual([9]);
    expect(structure.surahsOnPage(208)).toEqual([10]);
    expect(structure.surahsOnPage(596)).toEqual([92, 93, 94]);
    expect(structure.surahsOnPage(601)).toEqual([103, 104, 105]);
    expect(structure.surahsOnPage(602)).toEqual([106, 107, 108]);
    expect(structure.surahsOnPage(603)).toEqual([109, 110, 111]);
    expect(structure.surahsOnPage(604)).toEqual([112, 113, 114]);
  });

  it('for every page: the consecutive surahs from that of the first verse to that of the last', () => {
    for (const page of PAGES) {
      const first = structure.firstVerseOfPage(page).surah;
      const last = structure.lastVerseOfPage(page).surah;
      const expected = Array.from({ length: last - first + 1 }, (_, index) => first + index);
      expect(structure.surahsOnPage(page)).toEqual(expected);
    }
  });

  it('every surah is on at least one page, and on consecutive pages only', () => {
    const pagesOfSurah = new Map<number, number[]>();
    for (const page of PAGES) {
      for (const surah of structure.surahsOnPage(page)) {
        pagesOfSurah.set(surah, [...(pagesOfSurah.get(surah) ?? []), page]);
      }
    }
    expect(pagesOfSurah.size).toBe(114);
    for (const [surah, pages] of pagesOfSurah) {
      expect(itemAt(pages, 0)).toBe(itemAt(FIRST_PAGE_OF_SURAH, surah - 1));
      expect(itemAt(pages, pages.length - 1) - itemAt(pages, 0)).toBe(pages.length - 1);
    }
  });
});

describe('hizbPageRanges — Les plages de pages des hizb couvrent 1..604 sans trou', () => {
  const ranges = structure.hizbPageRanges();

  it('60 ranges { hizb, firstPage, lastPage }, numbered 1..60 in order', () => {
    expect(ranges).toHaveLength(60);
    expect(ranges.map((range) => range.hizb)).toEqual(HIZBS);
    for (const range of ranges) {
      expect(Object.keys(range).sort()).toEqual(['firstPage', 'hizb', 'lastPage']);
      expect(Number.isInteger(range.firstPage)).toBe(true);
      expect(Number.isInteger(range.lastPage)).toBe(true);
      expect(range.lastPage).toBeGreaterThanOrEqual(range.firstPage);
    }
  });

  it('covers pages 1..604 without a gap', () => {
    const covered = new Set<number>();
    for (const range of ranges) {
      for (let page = range.firstPage; page <= range.lastPage; page += 1) {
        covered.add(page);
      }
    }
    expect([...covered].sort((a, b) => a - b)).toEqual(PAGES);
    expect(itemAt(ranges, 0).firstPage).toBe(1);
    expect(itemAt(ranges, 59).lastPage).toBe(604);
  });

  it('deux hizb voisins partagent au plus une page', () => {
    for (let index = 1; index < ranges.length; index += 1) {
      const gap = itemAt(ranges, index).firstPage - itemAt(ranges, index - 1).lastPage;
      expect(gap === 0 || gap === 1).toBe(true);
    }
  });

  it('two neighbours share a page exactly when the second hizb starts in the middle of that page', () => {
    for (let index = 1; index < ranges.length; index += 1) {
      const range = itemAt(ranges, index);
      const start = itemAt(HIZB_STARTS, index);
      const startsAtTopOfPage = keyOf(structure.firstVerseOfPage(range.firstPage)) === start;
      const sharesPage = itemAt(ranges, index - 1).lastPage === range.firstPage;
      expect(sharesPage).toBe(!startsAtTopOfPage);
    }
  });

  it('each hizb begins on its well-known page and ends on the page of its last verse', () => {
    expect(ranges.map((range) => range.firstPage)).toEqual(FIRST_PAGE_OF_HIZB);
    ranges.forEach((range, index) => {
      const nextStart = HIZB_STARTS[index + 1];
      const lastKey =
        nextStart === undefined ? '114:6' : itemAt(ALL_KEYS, readingRank(nextStart) - 1);
      expect(range.lastPage).toBe(structure.pageOfVerse(structure.verseRef(lastKey)));
    });
  });

  it('well-known ranges: hizb 1 = pages 1-11, hizb 2 = 11-21, hizb 59 = 582-591, hizb 60 = 591-604', () => {
    expect(ranges[0]).toEqual({ hizb: 1, firstPage: 1, lastPage: 11 });
    expect(ranges[1]).toEqual({ hizb: 2, firstPage: 11, lastPage: 21 });
    expect(ranges[58]).toEqual({ hizb: 59, firstPage: 582, lastPage: 591 });
    expect(ranges[59]).toEqual({ hizb: 60, firstPage: 591, lastPage: 604 });
  });

  it('hizbPageRange(h) is the h-th range', () => {
    for (const hizb of HIZBS) {
      expect(structure.hizbPageRange(hizb)).toEqual(itemAt(ranges, hizb - 1));
    }
  });

  it('every page is in the range of its own hizb', () => {
    for (const page of PAGES) {
      const range = structure.hizbPageRange(structure.hizbOfPage(page));
      expect(page).toBeGreaterThanOrEqual(range.firstPage);
      expect(page).toBeLessThanOrEqual(range.lastPage);
    }
  });
});

describe('Entrées invalides (sourate 0, verset 300 de la sourate 1, page 605) : erreur explicite', () => {
  it('sourate 0: RangeError', () => {
    expect(() => structure.surah(0)).toThrow(RangeError);
    expect(() => structure.verseRef('0:1')).toThrow(RangeError);
    expect(() => structure.assertVerse({ surah: 0, verse: 1 })).toThrow(RangeError);
    expect(() => structure.pageOfVerse({ surah: 0, verse: 1 })).toThrow(RangeError);
    expect(() => structure.hizbOfVerse({ surah: 0, verse: 1 })).toThrow(RangeError);
    expect(() => structure.juzOfVerse({ surah: 0, verse: 1 })).toThrow(RangeError);
  });

  it('verset 300 de la sourate 1: RangeError', () => {
    expect(() => structure.verseRef('1:300')).toThrow(RangeError);
    expect(() => structure.assertVerse({ surah: 1, verse: 300 })).toThrow(RangeError);
    expect(() => structure.pageOfVerse({ surah: 1, verse: 300 })).toThrow(RangeError);
    expect(() => structure.hizbOfVerse({ surah: 1, verse: 300 })).toThrow(RangeError);
    expect(() => structure.juzOfVerse({ surah: 1, verse: 300 })).toThrow(RangeError);
  });

  it('page 605: RangeError', () => {
    expect(() => structure.firstVerseOfPage(605)).toThrow(RangeError);
    expect(() => structure.lastVerseOfPage(605)).toThrow(RangeError);
    expect(() => structure.hizbOfPage(605)).toThrow(RangeError);
    expect(() => structure.juzOfPage(605)).toThrow(RangeError);
    expect(() => structure.surahsOnPage(605)).toThrow(RangeError);
  });

  it('page 0, sourate 115, hizb 0 and hizb 61: RangeError', () => {
    expect(() => structure.firstVerseOfPage(0)).toThrow(RangeError);
    expect(() => structure.lastVerseOfPage(0)).toThrow(RangeError);
    expect(() => structure.hizbOfPage(0)).toThrow(RangeError);
    expect(() => structure.juzOfPage(0)).toThrow(RangeError);
    expect(() => structure.surahsOnPage(0)).toThrow(RangeError);
    expect(() => structure.surah(115)).toThrow(RangeError);
    expect(() => structure.verseRef('115:1')).toThrow(RangeError);
    expect(() => structure.hizbPageRange(0)).toThrow(RangeError);
    expect(() => structure.hizbPageRange(61)).toThrow(RangeError);
  });

  it('the verse just after the last one of a surah does not exist (every surah)', () => {
    for (const info of structure.surahs) {
      const beyond = { surah: info.surah, verse: info.verseCount + 1 };
      expect(() => structure.assertVerse(beyond)).toThrow(RangeError);
      expect(() => structure.pageOfVerse(beyond)).toThrow(RangeError);
      expect(() => structure.verseRef(`${beyond.surah}:${beyond.verse}`)).toThrow(RangeError);
      expect(structure.assertVerse({ surah: info.surah, verse: info.verseCount })).toBeUndefined();
    }
  });

  it.each([
    { surah: 1, verse: 0 },
    { surah: 1, verse: -1 },
    { surah: 1, verse: 1.5 },
    { surah: 1.5, verse: 1 },
    { surah: 1, verse: Number.NaN },
    { surah: Number.NaN, verse: 1 },
    { surah: 1, verse: Number.POSITIVE_INFINITY },
    { surah: -1, verse: 1 },
  ])('verse reference %p: explicit error from every function', (ref) => {
    expectExplicitError(() => structure.assertVerse(ref));
    expectExplicitError(() => structure.pageOfVerse(ref));
    expectExplicitError(() => structure.hizbOfVerse(ref));
    expectExplicitError(() => structure.juzOfVerse(ref));
  });

  it.each([1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 604.5])(
    'page %p: explicit error from every function',
    (page) => {
      expectExplicitError(() => structure.firstVerseOfPage(page));
      expectExplicitError(() => structure.lastVerseOfPage(page));
      expectExplicitError(() => structure.hizbOfPage(page));
      expectExplicitError(() => structure.juzOfPage(page));
      expectExplicitError(() => structure.surahsOnPage(page));
    },
  );

  it.each([1.5, -1, Number.NaN, 60.5])('hizb %p and surah %p: explicit error', (value) => {
    expectExplicitError(() => structure.hizbPageRange(value));
    expectExplicitError(() => structure.surah(value));
  });

  it.each(['', 'abc', '18', '18:', '18:10:1', ' 18:10', '18:10 ', '018:10'])(
    'verseRef refuses the malformed key %j',
    (key) => {
      expectExplicitError(() => structure.verseRef(key));
    },
  );

  it.each<unknown>([undefined, null, '18:10', 1810, {}, { surah: '18', verse: '10' }])(
    'a value that is not a verse reference (%p): explicit error',
    (value) => {
      // as: simulates an untyped caller (navigation parameter, stored JSON).
      const ref = value as VerseRef;
      expectExplicitError(() => structure.assertVerse(ref));
      expectExplicitError(() => structure.pageOfVerse(ref));
    },
  );
});

describe('Les résultats ne sont pas modifiables par l’appelant', () => {
  function tryTo(mutate: () => void): void {
    try {
      mutate();
    } catch {
      // A frozen result refuses the change: that is one of the two accepted outcomes.
    }
  }

  it('changing the list of surahs or one surah does not change later answers', () => {
    const before = JSON.stringify(structure.surahs);
    // as: the test deliberately breaks the read-only contract, like careless calling code.
    const surahs = structure.surahs as unknown as { verseCount: number; nameArabic: string }[];
    tryTo(() => {
      itemAt(surahs, 0).verseCount = 999;
    });
    tryTo(() => {
      itemAt(surahs, 1).nameArabic = 'x';
    });
    tryTo(() => {
      surahs.pop();
    });
    const one = structure.surah(3) as unknown as { verseCount: number };
    tryTo(() => {
      one.verseCount = 1;
    });
    expect(JSON.stringify(structure.surahs)).toBe(before);
    expect(structure.surah(1).verseCount).toBe(7);
    expect(structure.surah(3).verseCount).toBe(200);
    expect(structure.lastVerseOfPage(1)).toEqual({ surah: 1, verse: 7 });
  });

  it('changing hizb ranges does not change later answers', () => {
    const before = JSON.stringify(structure.hizbPageRanges());
    // as: the test deliberately breaks the read-only contract.
    const ranges = structure.hizbPageRanges() as unknown as {
      firstPage: number;
      lastPage: number;
    }[];
    tryTo(() => {
      itemAt(ranges, 0).lastPage = 604;
    });
    tryTo(() => {
      ranges.length = 0;
    });
    const single = structure.hizbPageRange(2) as unknown as { firstPage: number };
    tryTo(() => {
      single.firstPage = 1;
    });
    expect(JSON.stringify(structure.hizbPageRanges())).toBe(before);
    expect(structure.hizbPageRange(2)).toEqual({ hizb: 2, firstPage: 11, lastPage: 21 });
  });

  it('changing a verse reference or a list of surahs of a page does not change later answers', () => {
    // as: the test deliberately breaks the read-only contract.
    const first = structure.firstVerseOfPage(50) as { surah: number; verse: number };
    tryTo(() => {
      first.surah = 99;
    });
    const last = structure.lastVerseOfPage(50) as { verse: number };
    tryTo(() => {
      last.verse = 1;
    });
    const onPage = structure.surahsOnPage(604) as number[];
    tryTo(() => {
      onPage.push(1);
    });
    const ref = structure.verseRef('18:10') as { verse: number };
    tryTo(() => {
      ref.verse = 11;
    });
    expect(structure.firstVerseOfPage(50)).toEqual({ surah: 3, verse: 1 });
    expect(structure.lastVerseOfPage(50)).toEqual({ surah: 3, verse: 9 });
    expect(structure.surahsOnPage(604)).toEqual([112, 113, 114]);
    expect(structure.verseRef('18:10')).toEqual({ surah: 18, verse: 10 });
  });

  it('changing the data after the structure is built does not change its answers', () => {
    // as: JSON.parse returns untyped data; the shape is that of the file just serialised.
    const copy = JSON.parse(JSON.stringify(structureData)) as MutableData;
    const built = createQuranStructure(copy);
    itemAt(copy.surahs, 0).verseCount = 3;
    copy.pageStarts[1] = '1:5';
    copy.juzStarts[1] = '2:1';
    copy.hizbStarts[1] = '2:1';
    expect(built.surah(1).verseCount).toBe(7);
    expect(built.firstVerseOfPage(2)).toEqual({ surah: 2, verse: 1 });
    expect(built.juzOfVerse({ surah: 2, verse: 141 })).toBe(1);
    expect(built.hizbOfVerse({ surah: 2, verse: 74 })).toBe(1);
    expect(built.hizbPageRange(2)).toEqual({ hizb: 2, firstPage: 11, lastPage: 21 });
  });
});

describe('createQuranStructure — « Nothing is trusted » : données de structure invalides', () => {
  function corrupted(change: (data: MutableData) => void): MutableData {
    // as: JSON.parse returns untyped data; the shape is that of the file just serialised.
    const copy = JSON.parse(JSON.stringify(structureData)) as MutableData;
    change(copy);
    return copy;
  }

  it('accepts the generated file unchanged (control)', () => {
    expect(() => createQuranStructure(corrupted(() => undefined))).not.toThrow();
  });

  it.each<[string, (data: MutableData) => void]>([
    ['113 surahs', (data) => data.surahs.pop()],
    ['115 surahs', (data) => data.surahs.push({ ...itemAt(data.surahs, 113), surah: 115 })],
    ['a surah number repeated', (data) => (itemAt(data.surahs, 5).surah = 5)],
    ['two surahs swapped', (data) => data.surahs.reverse()],
    ['a surah with 0 verse', (data) => (itemAt(data.surahs, 107).verseCount = 0)],
    ['a surah with a negative verse count', (data) => (itemAt(data.surahs, 107).verseCount = -3)],
    ['a surah with 2.5 verses', (data) => (itemAt(data.surahs, 107).verseCount = 2.5)],
    [
      'one verse missing: 6235 verses in total',
      (data) => (itemAt(data.surahs, 113).verseCount = 5),
    ],
    [
      'one verse too many: 6237 verses in total',
      (data) => (itemAt(data.surahs, 113).verseCount = 7),
    ],
    ['an unknown revelation place', (data) => (itemAt(data.surahs, 0).revelationPlace = 'mecca')],
    ['an empty Arabic name', (data) => (itemAt(data.surahs, 0).nameArabic = '')],
    ['603 page starts', (data) => data.pageStarts.pop()],
    ['605 page starts', (data) => data.pageStarts.push('114:6')],
    ['page 1 not starting at 1:1', (data) => (data.pageStarts[0] = '1:2')],
    [
      'two page starts swapped',
      (data) => ([data.pageStarts[10], data.pageStarts[11]] = ['2:77', '2:70']),
    ],
    ['a page start repeated', (data) => (data.pageStarts[11] = '2:70')],
    ['a page start at a verse that does not exist', (data) => (data.pageStarts[1] = '1:8')],
    ['a malformed page start', (data) => (data.pageStarts[1] = '2-1')],
    ['29 juz starts', (data) => data.juzStarts.pop()],
    ['31 juz starts', (data) => data.juzStarts.push('114:1')],
    ['juz 1 not starting at 1:1', (data) => (data.juzStarts[0] = '1:2')],
    [
      'two juz starts swapped',
      (data) => ([data.juzStarts[1], data.juzStarts[2]] = ['2:253', '2:142']),
    ],
    ['a juz that does not begin with a hizb', (data) => (data.juzStarts[1] = '2:143')],
    ['59 hizb starts', (data) => data.hizbStarts.pop()],
    ['61 hizb starts', (data) => data.hizbStarts.push('114:1')],
    ['hizb 1 not starting at 1:1', (data) => (data.hizbStarts[0] = '1:2')],
    [
      'two hizb starts swapped',
      (data) => ([data.hizbStarts[1], data.hizbStarts[2]] = ['2:142', '2:75']),
    ],
    ['a hizb start repeated', (data) => (data.hizbStarts[1] = '1:1')],
    ['a hizb start at a verse that does not exist', (data) => (data.hizbStarts[59] = '87:20')],
  ])('refuses %s', (_name, change) => {
    expectExplicitError(() => createQuranStructure(corrupted(change)));
  });

  it.each<unknown>([undefined, null, 'structure', 42, [], {}, { surahs: [] }])(
    'refuses %p, which is not structure data',
    (value) => {
      // as: simulates a file that is not what the type promises.
      expectExplicitError(() => createQuranStructure(value as QuranStructureData));
    },
  );
});
