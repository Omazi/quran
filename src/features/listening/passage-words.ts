import type { TFunction } from 'i18next';

import { locatePassage } from '@/domain/listening';
import type { QuranStructure, VerseRef } from '@/domain/quran';
import type { PassageCandidate } from '@/domain/recognition';

import { RESULT_TEXT } from './config';

export interface PassageWords {
  /** "Sourate Al-Baqarah", "سورة البقرة": the name of the interface's language. */
  readonly surah: string;
  /**
   * The place as the card titles it (shazam.png): "Al-Kahf, verset 10", "الكهف، الآية 10".
   */
  readonly place: string;
  /** The surah's Arabic name, as the data layer gives it, for the title in the Quran's script. */
  readonly surahArabic: string;
  /** "Verset 255", "Versets 255 à 257", or both ends of a passage over two surahs. */
  readonly verses: string;
  /** The verse where the passage starts. */
  readonly firstVerse: VerseRef;
  /** The mushaf page the reader opens. */
  readonly page: number;
  /**
   * The verses a result shows, in order: those of the passage in its first surah, at most
   * `RESULT_TEXT.maxVerses`. The reader shows the rest.
   */
  readonly shownVerses: readonly VerseRef[];
  /** The passage goes on past the verses shown. */
  readonly continues: boolean;
}

/** The apostrophe of the data (`Al-An'am`) and the typographic one French and English print. */
const STRAIGHT_APOSTROPHE = /'/g;
const TYPOGRAPHIC_APOSTROPHE = '’';

/**
 * How a passage is named on the screen. The surah's name is the Arabic one in Arabic and the
 * transliterated one elsewhere, both as the data layer provides them; the transliteration is
 * printed with a typographic apostrophe (Al-An’am), an adjustment of display, not of the data.
 */
export function describePassage(
  passage: PassageCandidate,
  structure: Pick<QuranStructure, 'pageOfVerse' | 'surah'>,
  t: TFunction<'listening'>,
  language: string,
): PassageWords {
  const { firstVerse, lastVerse, page } = locatePassage(passage, structure);
  const info = structure.surah(firstVerse.surah);
  const name =
    language === 'ar'
      ? info.nameArabic
      : info.nameTransliterated.replace(STRAIGHT_APOSTROPHE, TYPOGRAPHIC_APOSTROPHE);
  let verses: string;
  let versesInline: string;
  if (firstVerse.surah !== lastVerse.surah) {
    verses = t('acrossSurahs', {
      first: `${firstVerse.surah}:${firstVerse.verse}`,
      last: `${lastVerse.surah}:${lastVerse.verse}`,
    });
    versesInline = verses;
  } else if (firstVerse.verse === lastVerse.verse) {
    verses = t('verse', { verse: firstVerse.verse });
    versesInline = t('verseInline', { verse: firstVerse.verse });
  } else {
    verses = t('verses', { first: firstVerse.verse, last: lastVerse.verse });
    versesInline = t('versesInline', { first: firstVerse.verse, last: lastVerse.verse });
  }
  const lastInSurah = firstVerse.surah === lastVerse.surah ? lastVerse.verse : info.verseCount;
  const shownCount = Math.min(RESULT_TEXT.maxVerses, lastInSurah - firstVerse.verse + 1);
  const shownVerses = Array.from({ length: shownCount }, (_, index) => ({
    surah: firstVerse.surah,
    verse: firstVerse.verse + index,
  }));
  const continues =
    firstVerse.surah !== lastVerse.surah || lastInSurah > firstVerse.verse + shownCount - 1;
  return {
    surah: t('surah', { name }),
    place: t('place', { name, verses: versesInline }),
    surahArabic: info.nameArabic,
    verses,
    firstVerse,
    page,
    shownVerses,
    continues,
  };
}

/** The digits the mushaf numbers its verses with. */
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * The number that ends a verse, as the reader writes it after the verse (Arabic-Indic digits,
 * which the Quran font draws inside its verse ornament). The reader's own function is private to
 * it; this is the same rule.
 */
export function verseMarkText(verse: number): string {
  if (!Number.isInteger(verse) || verse < 1) throw new RangeError(`Invalid verse number: ${verse}`);
  return String(verse)
    .split('')
    .map((digit) => ARABIC_INDIC_DIGITS.charAt(Number(digit)))
    .join('');
}
