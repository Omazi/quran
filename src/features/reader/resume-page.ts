import {
  getCurrentKhatm,
  getKhatmProgress,
  type HizbPageRange,
  type ReadingJournal,
} from '@/domain/khatm';
import { assertPageNumber } from '@/domain/quran';

import { FIRST_PAGE } from './page-order';

export interface ResumePageInput {
  /** The last page opened in the reader, or null when the reader was never opened. */
  readonly lastOpenedPage: number | null;
  readonly journal: ReadingJournal;
  readonly hizbPageRanges: readonly HizbPageRange[];
}

/**
 * Where to resume (spec 1): the last page opened in the reader; otherwise the first unread page
 * of the khatma in progress, which is page 1 at the first opening and after a complete khatma.
 * Which pages are read is the khatm module's answer, never recomputed here.
 */
export function resolveResumePage({
  lastOpenedPage,
  journal,
  hizbPageRanges,
}: ResumePageInput): number {
  if (lastOpenedPage !== null) {
    assertPageNumber(lastOpenedPage);
    return lastOpenedPage;
  }
  const progress = getKhatmProgress(journal, getCurrentKhatm(journal), hizbPageRanges);
  // The khatma in progress always has an unread page: a complete one gives way to the next.
  return progress.firstUnreadPage ?? FIRST_PAGE;
}
