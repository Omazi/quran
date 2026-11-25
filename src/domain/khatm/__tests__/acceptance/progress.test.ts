/**
 * Acceptance tests of the progress of a khatma (docs/specs/khatm.md, rules 2, 3 and 4).
 *
 * Tester's hizb ranges used below (see acceptance-kit.ts):
 * hizb 1 = pages 1-11, hizb 2 = 11-21 (page 11 is shared), hizb 3 = 22-32,
 * hizb 19 = 189-198, hizb 20 = 198-207 (page 198 is shared),
 * hizb 58 = 576-585, hizb 59 = 586-595, hizb 60 = 595-604 (page 595 is shared).
 */
import {
  EMPTY_JOURNAL,
  getKhatmProgress,
  recordPageRead,
  type KhatmProgress,
  type ReadingJournal,
} from '@/domain/khatm';

import {
  CHAINED_HIZB_RANGES,
  day,
  EVEN_HIZB_RANGES,
  FIRST_PAGE,
  LAST_PAGE,
  pagesFrom,
  readPages,
  readWholeKhatma,
  seededRandom,
  shuffled,
  TESTER_HIZB_RANGES,
} from './acceptance-kit';

const MARCH_1 = day('2026-03-01');
const MARCH_5 = day('2026-03-05');

function progressAfter(pages: readonly number[]): KhatmProgress {
  return getKhatmProgress(readPages(EMPTY_JOURNAL, pages, MARCH_1), 1, TESTER_HIZB_RANGES);
}

describe('Règle 3 — progression', () => {
  it('cas à tester: journal vide', () => {
    expect(getKhatmProgress(EMPTY_JOURNAL, 1, TESTER_HIZB_RANGES)).toStrictEqual({
      khatm: 1,
      pagesRead: 0,
      pagesRemaining: 604,
      fraction: 0,
      hizbCompleted: 0,
      currentHizb: 1,
      currentHizbProgress: 0,
      currentHizbPagesRead: 0,
      currentHizbPageCount: 11,
      firstUnreadPage: 1,
      isComplete: false,
    });
  });

  it('boundary: page 1 only', () => {
    // Hizb 1 has 11 pages (1-11), one is read: 1/11.
    expect(progressAfter([FIRST_PAGE])).toStrictEqual({
      khatm: 1,
      pagesRead: 1,
      pagesRemaining: 603,
      fraction: 1 / 604,
      hizbCompleted: 0,
      currentHizb: 1,
      currentHizbProgress: 1 / 11,
      currentHizbPagesRead: 1,
      currentHizbPageCount: 11,
      firstUnreadPage: 2,
      isComplete: false,
    });
  });

  it('boundary: page 604 only', () => {
    // Hizb 60 (595-604) is not complete; the first unfinished hizb is still hizb 1, untouched.
    expect(progressAfter([LAST_PAGE])).toStrictEqual({
      khatm: 1,
      pagesRead: 1,
      pagesRemaining: 603,
      fraction: 1 / 604,
      hizbCompleted: 0,
      currentHizb: 1,
      currentHizbProgress: 0,
      currentHizbPagesRead: 0,
      currentHizbPageCount: 11,
      firstUnreadPage: 1,
      isComplete: false,
    });
  });

  it('the first unread page is the lowest hole, wherever the reader went next', () => {
    expect(progressAfter([1, 2, 3, 5, 600]).firstUnreadPage).toBe(4);
    expect(progressAfter([2, 3]).firstUnreadPage).toBe(1);
  });

  it('the fraction is pages read out of 604', () => {
    // 151 pages = exactly a quarter of 604.
    expect(progressAfter(pagesFrom(1, 151)).fraction).toBe(0.25);
    expect(progressAfter(pagesFrom(1, 302)).fraction).toBe(0.5);
  });

  it('the current hizb is the first unfinished one and its fraction counts its own pages', () => {
    // Pages 1-11 complete hizb 1. Hizb 2 is 11-21: page 11 is already read, so 1/11.
    const progress = progressAfter(pagesFrom(1, 11));

    expect(progress.hizbCompleted).toBe(1);
    expect(progress.currentHizb).toBe(2);
    expect(progress.currentHizbProgress).toBe(1 / 11);
    expect(progress.firstUnreadPage).toBe(12);
  });

  it('a hizb read further away does not move the current hizb', () => {
    // Hizb 3 (22-32) is complete, hizb 1 has nothing: current hizb 1, fraction 0.
    const progress = progressAfter(pagesFrom(22, 32));

    expect(progress.hizbCompleted).toBe(1);
    expect(progress.currentHizb).toBe(1);
    expect(progress.currentHizbProgress).toBe(0);
    expect(progress.firstUnreadPage).toBe(1);
  });

  it('the ranges are injected: other ranges give another count for the same journal', () => {
    const journal = readPages(EMPTY_JOURNAL, pagesFrom(1, 10), MARCH_1);

    // Tester ranges: hizb 1 is 1-11, page 11 is missing. Even ranges: hizb 1 is 1-10, complete.
    expect(getKhatmProgress(journal, 1, TESTER_HIZB_RANGES).hizbCompleted).toBe(0);
    expect(getKhatmProgress(journal, 1, TESTER_HIZB_RANGES).currentHizbProgress).toBe(10 / 11);
    expect(getKhatmProgress(journal, 1, EVEN_HIZB_RANGES).hizbCompleted).toBe(1);
    expect(getKhatmProgress(journal, 1, EVEN_HIZB_RANGES).currentHizb).toBe(2);
    expect(getKhatmProgress(journal, 1, EVEN_HIZB_RANGES).currentHizbProgress).toBe(0);
  });

  it('a re-read on another day leaves the progress unchanged', () => {
    const journal = readPages(EMPTY_JOURNAL, pagesFrom(1, 15), MARCH_1);
    const reread = readPages(journal, pagesFrom(1, 15), MARCH_5);

    expect(getKhatmProgress(reread, 1, TESTER_HIZB_RANGES)).toStrictEqual(
      getKhatmProgress(journal, 1, TESTER_HIZB_RANGES),
    );
  });
});

describe('Règle 2 — hizb terminé: every page from firstPage to lastPage is read', () => {
  it('a hizb missing its last page is not completed', () => {
    const progress = progressAfter(pagesFrom(1, 10));

    expect(progress.hizbCompleted).toBe(0);
    expect(progress.currentHizb).toBe(1);
    expect(progress.currentHizbProgress).toBe(10 / 11);
  });

  it('a hizb missing its first page is not completed', () => {
    // Hizb 3 is 22-32; 23-32 are read.
    expect(progressAfter(pagesFrom(23, 32)).hizbCompleted).toBe(0);
  });

  it('cas à tester: hizb à page partagée — the shared page counts for both hizb', () => {
    // Pages 11-21 complete hizb 2. Hizb 1 (1-11) only has the shared page 11: 1/11.
    const progress = progressAfter(pagesFrom(11, 21));

    expect(progress.hizbCompleted).toBe(1);
    expect(progress.currentHizb).toBe(1);
    expect(progress.currentHizbProgress).toBe(1 / 11);
    expect(progress.firstUnreadPage).toBe(1);
  });

  it('without the shared page neither neighbour is completed; reading it completes both', () => {
    // Pages 1-10 and 12-21: 20 pages, page 11 is missing from hizb 1 and from hizb 2.
    const withoutSharedPage = readPages(
      EMPTY_JOURNAL,
      [...pagesFrom(1, 10), ...pagesFrom(12, 21)],
      MARCH_1,
    );
    const before = getKhatmProgress(withoutSharedPage, 1, TESTER_HIZB_RANGES);
    const after = getKhatmProgress(
      recordPageRead(withoutSharedPage, { page: 11, date: MARCH_5 }),
      1,
      TESTER_HIZB_RANGES,
    );

    expect(before.hizbCompleted).toBe(0);
    expect(before.currentHizb).toBe(1);
    expect(before.currentHizbProgress).toBe(10 / 11);
    expect(before.firstUnreadPage).toBe(11);

    expect(after.pagesRead).toBe(21);
    expect(after.hizbCompleted).toBe(2);
    expect(after.currentHizb).toBe(3);
    expect(after.currentHizbProgress).toBe(0);
    expect(after.firstUnreadPage).toBe(22);
  });

  it('a shared page in the middle of the mushaf: 19 pages complete two hizb', () => {
    // Hizb 19 = 189-198 and hizb 20 = 198-207: pages 189-207 are 19 pages.
    const progress = progressAfter(pagesFrom(189, 207));

    expect(progress.pagesRead).toBe(19);
    expect(progress.hizbCompleted).toBe(2);
  });

  it('a hizb that shares its first page and its last page with its neighbours', () => {
    // Chained ranges: hizb 1 = 1-11, hizb 2 = 11-21, hizb 3 = 21-31, each of 11 pages.
    const onlySecond = readPages(EMPTY_JOURNAL, pagesFrom(11, 21), MARCH_1);
    const firstTwo = readPages(onlySecond, pagesFrom(1, 10), MARCH_5);

    // Pages 11-21 complete hizb 2 alone; hizb 1 and hizb 3 each hold one of its pages.
    expect(getKhatmProgress(onlySecond, 1, CHAINED_HIZB_RANGES)).toMatchObject({
      hizbCompleted: 1,
      currentHizb: 1,
      currentHizbProgress: 1 / 11,
      firstUnreadPage: 1,
    });
    // Pages 1-21 complete hizb 1 and 2; hizb 3 (21-31) has its shared page 21: 1/11.
    expect(getKhatmProgress(firstTwo, 1, CHAINED_HIZB_RANGES)).toMatchObject({
      hizbCompleted: 2,
      currentHizb: 3,
      currentHizbProgress: 1 / 11,
      firstUnreadPage: 22,
    });
    expect(
      getKhatmProgress(readWholeKhatma(EMPTY_JOURNAL, MARCH_1), 1, CHAINED_HIZB_RANGES),
    ).toMatchObject({ hizbCompleted: 60, currentHizb: null, isComplete: true });
  });

  it('the last hizb shares page 595 with hizb 59', () => {
    // Pages 1-585 complete hizb 1 to 58; 595-604 complete hizb 60: 59 hizb. Hizb 59
    // (586-595, 10 pages) only has its shared page 595: 1/10.
    const progress = progressAfter([...pagesFrom(1, 585), ...pagesFrom(595, 604)]);

    expect(progress.pagesRead).toBe(595);
    expect(progress.hizbCompleted).toBe(59);
    expect(progress.currentHizb).toBe(59);
    expect(progress.currentHizbProgress).toBe(1 / 10);
    expect(progress.firstUnreadPage).toBe(586);
    expect(progress.isComplete).toBe(false);
  });
});

describe('Règle 4 — khatma terminée', () => {
  const order = shuffled(pagesFrom(FIRST_PAGE, LAST_PAGE), seededRandom(4));
  const lastPageRead = order[order.length - 1] ?? FIRST_PAGE;
  const almostComplete = readPages(EMPTY_JOURNAL, order.slice(0, -1), MARCH_1);
  const complete = recordPageRead(almostComplete, { page: lastPageRead, date: MARCH_5 });

  it('603 pages read in disorder: not complete, the missing page is the first unread one', () => {
    const progress = getKhatmProgress(almostComplete, 1, TESTER_HIZB_RANGES);

    expect(progress.pagesRead).toBe(603);
    expect(progress.pagesRemaining).toBe(1);
    expect(progress.fraction).toBe(603 / 604);
    expect(progress.isComplete).toBe(false);
    expect(progress.firstUnreadPage).toBe(lastPageRead);
    expect(progress.hizbCompleted).toBeLessThan(60);
  });

  it('cas à tester: 604 pages lues en désordre', () => {
    expect(getKhatmProgress(complete, 1, TESTER_HIZB_RANGES)).toStrictEqual({
      khatm: 1,
      pagesRead: 604,
      pagesRemaining: 0,
      fraction: 1,
      hizbCompleted: 60,
      currentHizb: null,
      currentHizbProgress: 0,
      currentHizbPagesRead: 0,
      currentHizbPageCount: 0,
      firstUnreadPage: null,
      isComplete: true,
    });
  });

  it('the next khatma starts from zero right after the end', () => {
    expect(getKhatmProgress(complete, 2, TESTER_HIZB_RANGES)).toStrictEqual({
      khatm: 2,
      pagesRead: 0,
      pagesRemaining: 604,
      fraction: 0,
      hizbCompleted: 0,
      currentHizb: 1,
      currentHizbProgress: 0,
      currentHizbPagesRead: 0,
      currentHizbPageCount: 11,
      firstUnreadPage: 1,
      isComplete: false,
    });
  });

  it('cas à tester: khatma terminée puis nouvelle khatma — the 60 hizb are never removed', () => {
    const next = readPages(complete, pagesFrom(1, 11), day('2026-03-09'));

    const first = getKhatmProgress(next, 1, TESTER_HIZB_RANGES);
    const second = getKhatmProgress(next, 2, TESTER_HIZB_RANGES);

    expect(first.hizbCompleted).toBe(60);
    expect(first.isComplete).toBe(true);
    expect(first.pagesRead).toBe(604);
    expect(second.pagesRead).toBe(11);
    expect(second.hizbCompleted).toBe(1);
    expect(second.currentHizb).toBe(2);
    expect(second.isComplete).toBe(false);
  });

  it('three khatmas: each one has its own progress', () => {
    let journal: ReadingJournal = readWholeKhatma(EMPTY_JOURNAL, MARCH_1);
    journal = readWholeKhatma(journal, MARCH_5);
    journal = readPages(journal, pagesFrom(595, 604), day('2026-03-09'));

    expect(getKhatmProgress(journal, 1, TESTER_HIZB_RANGES).isComplete).toBe(true);
    expect(getKhatmProgress(journal, 2, TESTER_HIZB_RANGES).isComplete).toBe(true);
    expect(getKhatmProgress(journal, 3, TESTER_HIZB_RANGES)).toStrictEqual({
      khatm: 3,
      pagesRead: 10,
      pagesRemaining: 594,
      fraction: 10 / 604,
      hizbCompleted: 1,
      currentHizb: 1,
      currentHizbProgress: 0,
      currentHizbPagesRead: 0,
      currentHizbPageCount: 11,
      firstUnreadPage: 1,
      isComplete: false,
    });
  });
});
