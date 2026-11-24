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

/** A verse reference such as "18:10" (surah 18, verse 10). */
export type VerseKey = `${number}:${number}`;

export interface VerseRef {
  readonly surah: number;
  readonly verse: number;
}

export interface Verse extends VerseRef {
  readonly key: VerseKey;
  /** Uthmani text, word-separated by single spaces, exactly as published by the source. */
  readonly text: string;
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
  readonly juz: number;
  readonly hizb: number;
  readonly lines: readonly MushafLine[];
}

/** What the rest of the app needs from Quran storage. Implemented in src/data. */
export interface QuranRepository {
  getPage(page: number): Promise<MushafPage>;
  getVerse(key: VerseKey): Promise<Verse>;
  getSurahVerses(surah: number): Promise<readonly Verse[]>;
}
