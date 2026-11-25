import { useEffect, useState } from 'react';

import { quranRepository, quranStructure } from '@/data/quran';
import type { QuranRepository, QuranStructure } from '@/domain/quran';

/**
 * The verse the listening page shows as found: Al-Kahf 18:10, the passage of the validated
 * mockups (docs/design/shazam.png, the prototype's `.found`).
 */
export const SAMPLE_VERSE_KEY = '18:10';

export interface SamplePassage {
  readonly surahArabic: string;
  readonly surahName: string;
  readonly verse: number;
  readonly page: number;
  /** The verse exactly as the data layer gives it; null until it is loaded, or if it cannot be. */
  readonly text: string | null;
}

export interface SamplePassageSources {
  readonly repository?: QuranRepository;
  readonly structure?: QuranStructure;
}

/**
 * The sample passage of the listening page: where it is, from the structure of the mushaf, and its
 * text, loaded from the bundled data once `shouldLoad` is true (the page is about to be seen). The
 * text is never typed by hand (docs/ARCHITECTURE.md: the Quran text is generated data).
 */
export function useSamplePassage(
  shouldLoad: boolean,
  { repository = quranRepository, structure = quranStructure }: SamplePassageSources = {},
): SamplePassage {
  const ref = structure.verseRef(SAMPLE_VERSE_KEY);
  const surah = structure.surah(ref.surah);
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!shouldLoad || text !== null) return;
    let isCurrent = true;
    repository.getVerse(SAMPLE_VERSE_KEY).then(
      (verse) => {
        if (isCurrent) setText(verse.text);
      },
      (error: unknown) => {
        // The card then shows where the passage is, without its words.
        console.error('The sample verse of the introduction could not be loaded.', error);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [shouldLoad, text, repository]);
  return {
    surahArabic: surah.nameArabic,
    surahName: surah.nameTransliterated,
    verse: ref.verse,
    page: structure.pageOfVerse(ref),
    text,
  };
}
