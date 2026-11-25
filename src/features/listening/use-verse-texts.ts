import { useEffect, useState } from 'react';

import { formatVerseKey, type VerseRef } from '@/domain/quran';

/** Reads the text of one verse from the data layer, exactly as it is stored. */
export type LoadVerseText = (verse: VerseRef) => Promise<string>;

/**
 * The texts of these verses, in the same order, or null until all of them are read. A failed
 * read leaves null: a result still names the surah, the verses and the page without the text,
 * and the reader shows it. The text is never made up or shortened here.
 */
export function useVerseTexts(
  verses: readonly VerseRef[],
  load: LoadVerseText,
): readonly string[] | null {
  const key = verses.map(formatVerseKey).join(',');
  const [loaded, setLoaded] = useState<{ key: string; texts: readonly string[] } | null>(null);

  useEffect(() => {
    let isCurrent = true;
    Promise.all(verses.map(load)).then(
      (texts) => {
        if (isCurrent) setLoaded({ key, texts });
      },
      (error: unknown) => {
        console.error('A verse of the result could not be read.', error);
      },
    );
    return () => {
      isCurrent = false;
    };
    // `key` names the verses: a new array of the same verses must not read them again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, load]);

  return loaded !== null && loaded.key === key ? loaded.texts : null;
}
