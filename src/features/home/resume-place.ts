import { quranStructure } from '@/data/quran';
import type { QuranStructure } from '@/domain/quran';

/** The surah a page opens on, named as the card to resume shows it (accueil.png: "Al-Kahf · الكهف"). */
export interface ResumePlace {
  readonly surah: number;
  /** In the language of the interface: the Arabic name in Arabic, the transliteration elsewhere. */
  readonly name: string;
  /** The Arabic name, shown beside the other one in gold; null in Arabic, where it is the name. */
  readonly arabicName: string | null;
}

const STRAIGHT_APOSTROPHE = /'/g;
const TYPOGRAPHIC_APOSTROPHE = '’';

/**
 * The surah of the first verse of a page, as the data layer names it. The transliteration takes a
 * typographic apostrophe (Al-An’am): an adjustment of display, as on the listening screen.
 */
export function resumePlaceOf(
  page: number,
  language: string,
  structure: Pick<QuranStructure, 'firstVerseOfPage' | 'surah'> = quranStructure,
): ResumePlace {
  const { surah } = structure.firstVerseOfPage(page);
  const info = structure.surah(surah);
  if (language === 'ar') return { surah, name: info.nameArabic, arabicName: null };
  return {
    surah,
    name: info.nameTransliterated.replace(STRAIGHT_APOSTROPHE, TYPOGRAPHIC_APOSTROPHE),
    arabicName: info.nameArabic,
  };
}
