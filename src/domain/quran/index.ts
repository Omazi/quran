/**
 * Public API of the Quran module: shared vocabulary, structure of the mushaf and integrity
 * of the text. Everything else in this folder is private. See docs/specs/quran.md and
 * ./README.md.
 */
export { canonicalQuranText } from './integrity';
export type { VersesBySurah } from './integrity';
export { buildMushafPage } from './mushaf-page';
export type { PageLayout, PageLineLayout, WordSegment } from './mushaf-page';
export { createQuranStructure } from './structure';
export type { QuranStructure, QuranStructureData } from './structure';
export {
  DEFAULT_QURAN_SCRIPT,
  HIZB_COUNT,
  HIZB_PER_JUZ,
  JUZ_COUNT,
  LINES_PER_PAGE,
  PAGE_COUNT,
  SURAH_COUNT,
  VERSE_COUNT,
} from './types';
export type {
  HizbPageRange,
  MushafLine,
  MushafPage,
  MushafWord,
  QuranRepository,
  QuranScript,
  RevelationPlace,
  SurahInfo,
  Verse,
  VerseKey,
  VerseRef,
} from './types';
export { assertHizbNumber, assertPageNumber, assertSurahNumber } from './validation';
export { formatVerseKey, parseVerseKey } from './verse-key';
export { splitVerseWords, WORD_SEPARATOR } from './words';
