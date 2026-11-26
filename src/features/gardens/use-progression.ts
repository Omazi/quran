import { useMemo } from 'react';

import { quranStructure } from '@/data/quran';
import { getProgression, type Progression } from '@/domain/levels';
import { useAppStore } from '@/store';

/**
 * Where the person stands (level, badges, garden in progress), derived from the journal of the
 * store. Null when the journal cannot be read by the rules: the screens then go without it, as
 * the home screen says why.
 */
export function useProgression(): Progression | null {
  const journal = useAppStore((state) => state.journal);
  return useMemo(() => {
    try {
      return getProgression(journal, quranStructure.hizbPageRanges());
    } catch {
      return null;
    }
  }, [journal]);
}
