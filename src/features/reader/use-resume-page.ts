import { useMemo } from 'react';

import { quranStructure } from '@/data/quran';
import { useAppStore } from '@/store';

import { resolveResumePage } from './resume-page';

/**
 * The page to resume, kept up to date (spec 1): the Quran tab shows it, and "Lire et arroser"
 * on the home screen opens the reader there (spec 4).
 */
export function useResumePage(): number {
  const journal = useAppStore((state) => state.journal);
  const lastOpenedPage = useAppStore((state) => state.settings.lastOpenedPage);
  return useMemo(
    () =>
      resolveResumePage({
        lastOpenedPage,
        journal,
        hizbPageRanges: quranStructure.hizbPageRanges(),
      }),
    [journal, lastOpenedPage],
  );
}
