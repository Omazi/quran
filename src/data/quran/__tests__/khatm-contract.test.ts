import { EMPTY_JOURNAL, getKhatmProgress, type HizbPageRange } from '@/domain/khatm';

import { quranStructure } from '../index';

/**
 * The khatm module receives its 60 hizb page ranges from here. This test is the meeting
 * point of the two modules: the real ranges must be accepted by the real progress rules.
 */
describe('hizbPageRanges — the ranges the khatm module needs', () => {
  // Assignment on purpose: it fails to compile if the two modules stop agreeing on the shape.
  const ranges: readonly HizbPageRange[] = quranStructure.hizbPageRanges();

  it('are accepted by the khatm progress rules', () => {
    const progress = getKhatmProgress(EMPTY_JOURNAL, 1, ranges);

    expect(progress.pagesRead).toBe(0);
    expect(progress.hizbCompleted).toBe(0);
    expect(progress.currentHizb).toBe(1);
  });
});
