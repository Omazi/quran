import { quranStructure } from '@/data/quran';
import { getDisplayedLanguage } from '@/i18n';

/** The name of a surah in the language of the interface. */
export function surahDisplayName(surah: number): string {
  const info = quranStructure.surah(surah);
  return getDisplayedLanguage() === 'ar' ? info.nameArabic : info.nameTransliterated;
}
