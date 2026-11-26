import { useEffect, useState } from 'react';

import { quranRepository } from '@/data/quran';
import type { MushafPage, QuranRepository } from '@/domain/quran';

import { RECITED_SURAH } from './recitation';

/**
 * Page 1 of the mushaf, where Al-Fatiha is printed, as the data layer gives it: the line recited
 * under the garden and the page of the voice page are read from it. Loaded as the introduction
 * opens, so the first page's verse is there when the garden arrives. Null until then, or if it
 * cannot be loaded (the stage then shows no verse, never a made-up one).
 */
export function useFatihaPage(repository: QuranRepository = quranRepository): MushafPage | null {
  const [page, setPage] = useState<MushafPage | null>(null);
  useEffect(() => {
    let isCurrent = true;
    repository.getPage(RECITED_SURAH).then(
      (loaded) => {
        if (isCurrent) setPage(loaded);
      },
      (error: unknown) => {
        console.error('Al-Fatiha could not be loaded for the introduction.', error);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [repository]);
  return page;
}
