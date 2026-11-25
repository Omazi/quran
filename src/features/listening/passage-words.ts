import type { TFunction } from 'i18next';

import { locatePassage } from '@/domain/listening';
import type { QuranStructure } from '@/domain/quran';
import type { PassageCandidate } from '@/domain/recognition';

export interface PassageWords {
  /** "Sourate Al-Baqara", "سورة البقرة": the name as the data layer gives it. */
  readonly surah: string;
  /** "Verset 255", "Versets 255 à 257", or both ends of a passage over two surahs. */
  readonly verses: string;
  /** The verse where the passage starts. */
  readonly firstVerse: number;
  /** The mushaf page the reader opens. */
  readonly page: number;
}

/**
 * How a passage is named on the screen. The surah's name is the Arabic one in Arabic and the
 * transliterated one elsewhere, both as the data layer provides them.
 */
export function describePassage(
  passage: PassageCandidate,
  structure: Pick<QuranStructure, 'pageOfVerse' | 'surah'>,
  t: TFunction<'listening'>,
  language: string,
): PassageWords {
  const { firstVerse, lastVerse, page } = locatePassage(passage, structure);
  const info = structure.surah(firstVerse.surah);
  const name = language === 'ar' ? info.nameArabic : info.nameTransliterated;
  let verses: string;
  if (firstVerse.surah !== lastVerse.surah) {
    verses = t('acrossSurahs', {
      first: `${firstVerse.surah}:${firstVerse.verse}`,
      last: `${lastVerse.surah}:${lastVerse.verse}`,
    });
  } else if (firstVerse.verse === lastVerse.verse) {
    verses = t('verse', { verse: firstVerse.verse });
  } else {
    verses = t('verses', { first: firstVerse.verse, last: lastVerse.verse });
  }
  return { surah: t('surah', { name }), verses, firstVerse: firstVerse.verse, page };
}
