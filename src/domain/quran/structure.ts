import {
  HIZB_COUNT,
  HIZB_PER_JUZ,
  JUZ_COUNT,
  PAGE_COUNT,
  SURAH_COUNT,
  VERSE_COUNT,
  type HizbPageRange,
  type RevelationPlace,
  type SurahInfo,
  type VerseRef,
} from './types';
import { assertHizbNumber, assertPageNumber, assertSurahNumber } from './validation';
import { parseVerseKey } from './verse-key';

/** The shape of `assets/data/structure.json`. Nothing is trusted: see `createQuranStructure`. */
export interface QuranStructureData {
  readonly surahs: readonly {
    readonly surah: number;
    readonly nameArabic: string;
    readonly nameTransliterated: string;
    readonly verseCount: number;
    readonly revelationPlace: string;
  }[];
  /** Key of the first verse of each page (604 keys). A page always starts with a new verse. */
  readonly pageStarts: readonly string[];
  /** Key of the first verse of each juz (30 keys). */
  readonly juzStarts: readonly string[];
  /** Key of the first verse of each hizb (60 keys). */
  readonly hizbStarts: readonly string[];
}

/**
 * Where everything is in the mushaf. Pure and synchronous: every answer is computed from
 * the structure data given to `createQuranStructure`. Invalid input throws a RangeError
 * (or a TypeError for a malformed verse key).
 */
export interface QuranStructure {
  /** The 114 surahs in order. */
  readonly surahs: readonly SurahInfo[];
  surah(surah: number): SurahInfo;

  /** Reads a verse key such as "18:10" and checks that the verse exists. */
  verseRef(key: string): VerseRef;
  /** Throws unless the verse exists (surah 1..114, verse within the surah). */
  assertVerse(ref: VerseRef): void;

  pageOfVerse(ref: VerseRef): number;
  hizbOfVerse(ref: VerseRef): number;
  juzOfVerse(ref: VerseRef): number;

  firstVerseOfPage(page: number): VerseRef;
  lastVerseOfPage(page: number): VerseRef;
  /** Hizb of the first verse of the page (the next hizb may start lower on the page). */
  hizbOfPage(page: number): number;
  /** Juz of the first verse of the page. */
  juzOfPage(page: number): number;
  /** Surahs with at least one verse on the page, in order. */
  surahsOnPage(page: number): readonly number[];

  /** First and last page of one hizb. */
  hizbPageRange(hizb: number): HizbPageRange;
  /**
   * The 60 ranges in order. They cover pages 1..604 without a gap; two neighbours share
   * at most one page (the page on which one ends and the next starts).
   */
  hizbPageRanges(): readonly HizbPageRange[];
}

const REVELATION_PLACES: readonly RevelationPlace[] = ['meccan', 'medinan'];
const FIRST_VERSE_NUMBER = 1;

function isRevelationPlace(value: string): value is RevelationPlace {
  return REVELATION_PLACES.some((place) => place === value);
}

function assertLength(list: readonly unknown[], expected: number, label: string): void {
  if (!Array.isArray(list) || list.length !== expected) {
    throw new RangeError(`Invalid structure data: expected ${expected} ${label}`);
  }
}

function readSurahs(entries: QuranStructureData['surahs']): readonly SurahInfo[] {
  assertLength(entries, SURAH_COUNT, 'surahs');
  const surahs = entries.map((entry, index): SurahInfo => {
    const { surah, nameArabic, nameTransliterated, verseCount, revelationPlace } = entry;
    if (surah !== index + 1) {
      throw new RangeError(`Invalid structure data: surah ${index + 1} is numbered ${surah}`);
    }
    if (!Number.isInteger(verseCount) || verseCount < 1) {
      throw new RangeError(`Invalid structure data: surah ${surah} has ${verseCount} verses`);
    }
    if (!nameArabic || !nameTransliterated) {
      throw new RangeError(`Invalid structure data: surah ${surah} has no name`);
    }
    if (!isRevelationPlace(revelationPlace)) {
      throw new RangeError(
        `Invalid structure data: surah ${surah} is "${revelationPlace}" (expected meccan or medinan)`,
      );
    }
    return Object.freeze({ surah, nameArabic, nameTransliterated, verseCount, revelationPlace });
  });

  const verseCount = surahs.reduce((total, info) => total + info.verseCount, 0);
  if (verseCount !== VERSE_COUNT) {
    throw new RangeError(`Invalid structure data: ${verseCount} verses instead of ${VERSE_COUNT}`);
  }
  return Object.freeze(surahs);
}

/** Reads an item that earlier checks guarantee to exist, and fails loudly if they did not. */
function itemAt<Item>(list: readonly Item[], index: number): Item {
  const item = list[index];
  if (item === undefined) throw new RangeError(`Invalid structure data: no item at ${index}`);
  return item;
}

/**
 * `starts` is sorted and begins with 1: returns how many starts are <= value, which is the
 * 1-based number of the part (page, hizb, surah...) that holds `value`.
 */
function partHolding(starts: readonly number[], value: number): number {
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (itemAt(starts, middle) <= value) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function createQuranStructure(data: QuranStructureData): QuranStructure {
  const surahs = readSurahs(data.surahs);

  // Verses are numbered 1..6236 in reading order: comparing two places is comparing numbers.
  const firstVerseNumberOfSurah: number[] = [];
  let nextVerseNumber = FIRST_VERSE_NUMBER;
  for (const info of surahs) {
    firstVerseNumberOfSurah.push(nextVerseNumber);
    nextVerseNumber += info.verseCount;
  }

  function surah(surahNumber: number): SurahInfo {
    assertSurahNumber(surahNumber);
    return itemAt(surahs, surahNumber - 1);
  }

  function assertVerse(ref: VerseRef): void {
    const { verseCount } = surah(ref.surah);
    if (!Number.isInteger(ref.verse) || ref.verse < 1 || ref.verse > verseCount) {
      throw new RangeError(
        `Invalid verse: ${ref.surah}:${ref.verse} (surah ${ref.surah} has ${verseCount} verses)`,
      );
    }
  }

  function verseRef(key: string): VerseRef {
    const ref = parseVerseKey(key);
    assertVerse(ref);
    return ref;
  }

  function verseNumber(ref: VerseRef): number {
    assertVerse(ref);
    return itemAt(firstVerseNumberOfSurah, ref.surah - 1) + ref.verse - 1;
  }

  function verseAt(number: number): VerseRef {
    const surahNumber = partHolding(firstVerseNumberOfSurah, number);
    const verse = number - itemAt(firstVerseNumberOfSurah, surahNumber - 1) + 1;
    return { surah: surahNumber, verse };
  }

  /** Reads a list of "first verse of each part" keys into verse numbers, and checks it. */
  function readStarts(keys: readonly string[], expected: number, label: string): number[] {
    assertLength(keys, expected, `${label} starts`);
    const starts = keys.map((key) => verseNumber(verseRef(key)));
    starts.forEach((start, index) => {
      const previous = index === 0 ? FIRST_VERSE_NUMBER - 1 : itemAt(starts, index - 1);
      const isFirstVerseOfQuran = start === FIRST_VERSE_NUMBER;
      if (!(start > previous) || (index === 0) !== isFirstVerseOfQuran) {
        throw new RangeError(
          `Invalid structure data: ${label} ${index + 1} starts at ${keys[index]}, ` +
            `which does not follow ${label} ${index} (the first one must start at 1:1)`,
        );
      }
    });
    return starts;
  }

  const pageStarts = readStarts(data.pageStarts, PAGE_COUNT, 'page');
  const hizbStarts = readStarts(data.hizbStarts, HIZB_COUNT, 'hizb');
  const juzStarts = readStarts(data.juzStarts, JUZ_COUNT, 'juz');
  juzStarts.forEach((start, index) => {
    if (start !== hizbStarts[index * HIZB_PER_JUZ]) {
      throw new RangeError(
        `Invalid structure data: juz ${index + 1} does not start with hizb ${index * HIZB_PER_JUZ + 1}`,
      );
    }
  });

  const juzOfHizb = (hizb: number): number => Math.ceil(hizb / HIZB_PER_JUZ);
  const pageOfVerseNumber = (number: number): number => partHolding(pageStarts, number);

  /** Last verse of part `index` (0-based): the verse before the next start, or the last verse. */
  function lastVerseNumberOfPart(starts: readonly number[], index: number): number {
    const nextStart = starts[index + 1];
    return nextStart === undefined ? VERSE_COUNT : nextStart - 1;
  }

  function firstVerseNumberOfPage(page: number): number {
    assertPageNumber(page);
    return itemAt(pageStarts, page - 1);
  }

  function lastVerseNumberOfPage(page: number): number {
    assertPageNumber(page);
    return lastVerseNumberOfPart(pageStarts, page - 1);
  }

  // A hizb goes from the page of its first verse to the page of its last verse. When the
  // next hizb starts lower on that last page, both ranges hold the page.
  const ranges: readonly HizbPageRange[] = Object.freeze(
    hizbStarts.map((start, index): HizbPageRange =>
      Object.freeze({
        hizb: index + 1,
        firstPage: pageOfVerseNumber(start),
        lastPage: pageOfVerseNumber(lastVerseNumberOfPart(hizbStarts, index)),
      }),
    ),
  );

  function hizbPageRange(hizb: number): HizbPageRange {
    assertHizbNumber(hizb);
    return itemAt(ranges, hizb - 1);
  }

  function surahsOnPage(page: number): readonly number[] {
    const first = verseAt(firstVerseNumberOfPage(page)).surah;
    const last = verseAt(lastVerseNumberOfPage(page)).surah;
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }

  const hizbOfVerse = (ref: VerseRef): number => partHolding(hizbStarts, verseNumber(ref));
  const hizbOfPage = (page: number): number =>
    partHolding(hizbStarts, firstVerseNumberOfPage(page));

  return Object.freeze({
    surahs,
    surah,
    verseRef,
    assertVerse,
    pageOfVerse: (ref: VerseRef) => pageOfVerseNumber(verseNumber(ref)),
    hizbOfVerse,
    juzOfVerse: (ref: VerseRef) => juzOfHizb(hizbOfVerse(ref)),
    firstVerseOfPage: (page: number) => verseAt(firstVerseNumberOfPage(page)),
    lastVerseOfPage: (page: number) => verseAt(lastVerseNumberOfPage(page)),
    hizbOfPage,
    juzOfPage: (page: number) => juzOfHizb(hizbOfPage(page)),
    surahsOnPage,
    hizbPageRange,
    hizbPageRanges: () => ranges,
  });
}
