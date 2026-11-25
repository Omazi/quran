/**
 * The table of contents of the Quran tab (docs/specs/reader.md, section 1). Every name and number
 * comes from `QuranStructure`: no list is written in the screen.
 */

import { normalizeArabic } from '@/domain/recognition';
import { HIZB_PER_JUZ, JUZ_COUNT, type QuranStructure, type RevelationPlace } from '@/domain/quran';

export interface SurahEntry {
  readonly surah: number;
  readonly nameArabic: string;
  readonly nameTransliterated: string;
  readonly revelationPlace: RevelationPlace;
  readonly verseCount: number;
  /** The page of its first verse. */
  readonly page: number;
}

export interface HizbEntry {
  readonly hizb: number;
  /** The page on which the hizb starts. */
  readonly page: number;
}

export interface JuzEntry {
  readonly juz: number;
  readonly page: number;
  readonly hizbs: readonly HizbEntry[];
}

const FIRST_VERSE = 1;
const DIGITS_ONLY = /^[0-9]+$/;
/** Combining marks left by Unicode decomposition: accents in Latin names. */
const COMBINING_MARKS = /\p{M}/gu;
const NOT_LETTER_OR_DIGIT = /[^\p{L}\p{N}]/gu;

export function buildSurahEntries(structure: QuranStructure): readonly SurahEntry[] {
  return structure.surahs.map((info) => ({
    surah: info.surah,
    nameArabic: info.nameArabic,
    nameTransliterated: info.nameTransliterated,
    revelationPlace: info.revelationPlace,
    verseCount: info.verseCount,
    page: structure.pageOfVerse({ surah: info.surah, verse: FIRST_VERSE }),
  }));
}

export function buildJuzEntries(structure: QuranStructure): readonly JuzEntry[] {
  return Array.from({ length: JUZ_COUNT }, (_, index) => {
    const juz = index + 1;
    const hizbs = Array.from({ length: HIZB_PER_JUZ }, (__, offset) => {
      const range = structure.hizbPageRange(index * HIZB_PER_JUZ + offset + 1);
      return { hizb: range.hizb, page: range.firstPage };
    });
    // A juz starts with its first hizb (checked by createQuranStructure).
    return { juz, page: hizbs[0]?.page ?? FIRST_VERSE, hizbs };
  });
}

/** A Latin name as it is compared: lower case, without accents, hyphens or spaces. */
function latinKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(NOT_LETTER_OR_DIGIT, '');
}

/** An Arabic name as it is compared: the letters only, as the recognition module spells them. */
function arabicKey(text: string): string {
  return normalizeArabic(text).join('');
}

/**
 * The surahs that match a search (spec 1: by name or by number). A number matches its surah
 * only; a name matches when the search is part of the transliterated or the Arabic name,
 * whatever the case, accents, hyphens or vowel signs. An empty search keeps every surah.
 *
 * The system search field that will call this is not in this lot (known gap): the rule is ready
 * and tested.
 */
export function filterSurahs(entries: readonly SurahEntry[], query: string): readonly SurahEntry[] {
  const trimmed = query.trim();
  if (trimmed === '') return entries;
  if (DIGITS_ONLY.test(trimmed)) {
    const surah = Number(trimmed);
    return entries.filter((entry) => entry.surah === surah);
  }
  const latin = latinKey(trimmed);
  const arabic = arabicKey(trimmed);
  return entries.filter(
    (entry) =>
      (latin !== '' && latinKey(entry.nameTransliterated).includes(latin)) ||
      (arabic !== '' && arabicKey(entry.nameArabic).includes(arabic)),
  );
}
