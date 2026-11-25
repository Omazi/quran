import type { QuranStructure } from '@/domain/quran';

const FIRST_VERSE = 1;

/**
 * The surah a page is named after in the reader's bar and the resume card: the first surah that
 * begins on the page, otherwise the surah the page continues. The validated mockups name page 293,
 * which opens with the last verses of Al-Isra, "Al-Kahf" (docs/design/mushaf.png, accueil.png).
 */
export function pageSurah(structure: QuranStructure, page: number): number {
  const first = structure.firstVerseOfPage(page);
  if (first.verse === FIRST_VERSE) return first.surah;
  const next = first.surah + 1;
  if (
    next <= structure.surahs.length &&
    structure.pageOfVerse({ surah: next, verse: FIRST_VERSE }) === page
  ) {
    return next;
  }
  return first.surah;
}
