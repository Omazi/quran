/**
 * Shared vocabulary of the Quran domain. Every other module speaks in these terms.
 * Numbers are 1-based, exactly as readers know them (surah 1..114, page 1..604...).
 */

export const SURAH_COUNT = 114;
export const VERSE_COUNT = 6236;
export const PAGE_COUNT = 604;
export const JUZ_COUNT = 30;
export const HIZB_COUNT = 60;
export const LINES_PER_PAGE = 15;
export const HIZB_PER_JUZ = 2;

/**
 * The three texts shipped with the app:
 * - `uthmani`: fully vowelled Uthmani script, the text of the mushaf pages;
 * - `uthmani-minimal`: the same Uthmani spelling with fewer signs (Tanzil "Uthmani Minimal");
 * - `imlaei`: the everyday (imlā'ī, "simple") spelling, without vowel marks, as the King Fahd
 *   Complex publishes it next to its Uthmani text (docs/DECISIONS.md, D41).
 *
 * Mushaf pages exist in `uthmani` only.
 */
export type QuranScript = 'uthmani' | 'uthmani-minimal' | 'imlaei';
export const DEFAULT_QURAN_SCRIPT: QuranScript = 'uthmani';

/** A verse reference such as "18:10" (surah 18, verse 10). */
export type VerseKey = `${number}:${number}`;

export interface VerseRef {
  readonly surah: number;
  readonly verse: number;
}

export interface Verse extends VerseRef {
  readonly key: VerseKey;
  /**
   * Text in the requested script (Uthmani by default), exactly as published by the source.
   * Words are separated by single spaces (U+0020): split it with `splitVerseWords` only.
   */
  readonly text: string;
}

export type RevelationPlace = 'meccan' | 'medinan';

export interface SurahInfo {
  readonly surah: number;
  readonly nameArabic: string;
  readonly nameTransliterated: string;
  readonly verseCount: number;
  readonly revelationPlace: RevelationPlace;
}

/**
 * First and last mushaf page of a hizb. A page on which a hizb ends and the next one
 * starts belongs to both ranges.
 */
export interface HizbPageRange {
  /** 1-based hizb number, 1..60. */
  readonly hizb: number;
  readonly firstPage: number;
  readonly lastPage: number;
}

/** One word placed on a line of the printed mushaf. */
export interface MushafWord {
  readonly verseKey: VerseKey;
  /** 1-based position of the word inside its verse. */
  readonly position: number;
  readonly text: string;
}

export type MushafLine =
  | { readonly kind: 'surah-header'; readonly surah: number }
  | { readonly kind: 'basmala' }
  | {
      readonly kind: 'text';
      readonly words: readonly MushafWord[];
      /** Verses that end on this line, in reading order (their end-of-verse mark is drawn here). */
      readonly verseEnds: readonly { readonly afterWordIndex: number; readonly verse: number }[];
    };

export interface MushafPage {
  readonly page: number;
  /** Juz and hizb of the first verse of the page (a page can hold the start of the next one). */
  readonly juz: number;
  readonly hizb: number;
  readonly lines: readonly MushafLine[];
}

/**
 * What the rest of the app needs from Quran storage. Implemented in src/data.
 * Invalid input (page 605, surah 0, verse 300 of surah 1...) rejects with an explicit error.
 */
export interface QuranRepository {
  /** The page as printed, with its words in the Uthmani script. */
  getPage(page: number): Promise<MushafPage>;
  getVerse(key: VerseKey, script?: QuranScript): Promise<Verse>;
  getSurahVerses(surah: number, script?: QuranScript): Promise<readonly Verse[]>;
}
