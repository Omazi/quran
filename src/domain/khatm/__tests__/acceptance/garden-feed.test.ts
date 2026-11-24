/**
 * Acceptance tests of what the garden receives (docs/specs/khatm.md, rule 10;
 * docs/DECISIONS.md, D9 and D10).
 *
 * Tester's hizb ranges used below (see acceptance-kit.ts):
 * hizb 1 = pages 1-11, hizb 2 = 11-21 (page 11 is shared), hizb 3 = 22-32, hizb 30 = 298-307.
 */
import {
  DEFAULT_KHATM_CONFIG,
  EMPTY_JOURNAL,
  getBadges,
  getGardenFeed,
  getKhatmProgress,
  getWateredDays,
  recordPageRead,
  type KhatmConfig,
  type ReadingJournal,
} from '@/domain/khatm';

import {
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
const MARCH_2 = day('2026-03-02');
const MARCH_3 = day('2026-03-03');
const MARCH_4 = day('2026-03-04');
const MARCH_5 = day('2026-03-05');
const MARCH_6 = day('2026-03-06');
const MARCH_7 = day('2026-03-07');
const MARCH_9 = day('2026-03-09');
const MARCH_10 = day('2026-03-10');

/** Khatma 1: hizb 1 on March 1, pages 12-603 on March 2, page 604 on March 5. */
function completedFirstKhatma(): ReadingJournal {
  let journal = readPages(EMPTY_JOURNAL, pagesFrom(1, 11), MARCH_1);
  journal = readPages(journal, pagesFrom(12, 603), MARCH_2);
  return recordPageRead(journal, { page: LAST_PAGE, date: MARCH_5 });
}

describe('Règle 10 — ce que reçoit le jardin', () => {
  it('cas à tester: journal vide — bare ground of khatma 1', () => {
    expect(getGardenFeed(EMPTY_JOURNAL, TESTER_HIZB_RANGES)).toStrictEqual({
      khatm: 1,
      hizbCompleted: 0,
      currentHizbProgress: 0,
      startDate: null,
      wateredDays: new Set(),
      firstHizbCompletedOn: null,
      completedOn: null,
    });
  });

  it('the first page gives the start date and waters that day', () => {
    // Page 1 is one of the 11 pages of hizb 1.
    const journal = recordPageRead(EMPTY_JOURNAL, { page: FIRST_PAGE, date: MARCH_3 });

    expect(getGardenFeed(journal, TESTER_HIZB_RANGES)).toStrictEqual({
      khatm: 1,
      hizbCompleted: 0,
      currentHizbProgress: 1 / 11,
      startDate: MARCH_3,
      wateredDays: new Set([MARCH_3]),
      firstHizbCompletedOn: null,
      completedOn: null,
    });
  });

  it('the fraction is the one of the first unfinished hizb', () => {
    // Page 30 belongs to hizb 3; the first unfinished hizb is hizb 1, with nothing read.
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 30, date: MARCH_3 });

    const feed = getGardenFeed(journal, TESTER_HIZB_RANGES);

    expect(feed.hizbCompleted).toBe(0);
    expect(feed.currentHizbProgress).toBe(0);
    expect(feed.startDate).toBe(MARCH_3);
  });

  it('a hizb is completed on the most recent date among its pages', () => {
    // Hizb 1: pages 1-10 on March 1, page 11 on March 4.
    let journal = readPages(EMPTY_JOURNAL, pagesFrom(1, 10), MARCH_1);
    expect(getGardenFeed(journal, TESTER_HIZB_RANGES).firstHizbCompletedOn).toBeNull();

    journal = recordPageRead(journal, { page: 11, date: MARCH_4 });
    const feed = getGardenFeed(journal, TESTER_HIZB_RANGES);

    expect(feed.hizbCompleted).toBe(1);
    expect(feed.firstHizbCompletedOn).toBe(MARCH_4);
    // Hizb 2 is 11-21 and already has the shared page 11.
    expect(feed.currentHizbProgress).toBe(1 / 11);
  });

  it('the first completed hizb is not necessarily hizb 1', () => {
    // Hizb 3 (22-32) on March 2; hizb 1: pages 1-10 on March 4 and page 11 on March 6.
    let journal = readPages(EMPTY_JOURNAL, pagesFrom(22, 32), MARCH_2);
    journal = readPages(journal, pagesFrom(1, 10), MARCH_4);
    journal = recordPageRead(journal, { page: 11, date: MARCH_6 });

    expect(getGardenFeed(journal, TESTER_HIZB_RANGES)).toStrictEqual({
      khatm: 1,
      hizbCompleted: 2,
      currentHizbProgress: 1 / 11,
      startDate: MARCH_2,
      wateredDays: new Set([MARCH_2, MARCH_4, MARCH_6]),
      firstHizbCompletedOn: MARCH_2,
      completedOn: null,
    });
  });

  it('a later hizb completed earlier in the calendar wins, whatever the order of recording', () => {
    // Hizb 1 is recorded first, dated March 6. Hizb 3 is recorded afterwards but dated March 2.
    let journal = readPages(EMPTY_JOURNAL, pagesFrom(1, 11), MARCH_6);
    journal = readPages(journal, pagesFrom(22, 32), MARCH_2);

    expect(getGardenFeed(journal, TESTER_HIZB_RANGES).firstHizbCompletedOn).toBe(MARCH_2);
  });

  it('a back-dated last page does not move the completion day of the hizb back', () => {
    // Pages 1-10 dated March 10, then page 11 recorded with the date March 3: the most
    // recent date among the pages of hizb 1 is March 10.
    let journal = readPages(EMPTY_JOURNAL, pagesFrom(1, 10), MARCH_10);
    journal = recordPageRead(journal, { page: 11, date: MARCH_3 });

    expect(getGardenFeed(journal, TESTER_HIZB_RANGES).firstHizbCompletedOn).toBe(MARCH_10);
  });

  it('cas à tester: hizb à page partagée — its date counts for both hizb', () => {
    // Pages 12-21 on March 2, shared page 11 on March 9: hizb 2 (11-21) is completed on
    // March 9. Pages 1-10 on March 3: hizb 1 (1-11) is completed on March 9 as well.
    let journal = readPages(EMPTY_JOURNAL, pagesFrom(12, 21), MARCH_2);
    journal = recordPageRead(journal, { page: 11, date: MARCH_9 });
    const onlySecondHizb = getGardenFeed(journal, TESTER_HIZB_RANGES);
    journal = readPages(journal, pagesFrom(1, 10), MARCH_3);
    const bothHizb = getGardenFeed(journal, TESTER_HIZB_RANGES);

    expect(onlySecondHizb.hizbCompleted).toBe(1);
    expect(onlySecondHizb.firstHizbCompletedOn).toBe(MARCH_9);
    expect(onlySecondHizb.currentHizbProgress).toBe(1 / 11);
    expect(bothHizb.hizbCompleted).toBe(2);
    expect(bothHizb.firstHizbCompletedOn).toBe(MARCH_9);
    expect(bothHizb.currentHizbProgress).toBe(0);
  });

  it('the ranges are injected: other ranges, another garden for the same journal', () => {
    const journal = readPages(EMPTY_JOURNAL, pagesFrom(1, 10), MARCH_1);

    expect(getGardenFeed(journal, TESTER_HIZB_RANGES).hizbCompleted).toBe(0);
    expect(getGardenFeed(journal, EVEN_HIZB_RANGES).hizbCompleted).toBe(1);
    expect(getGardenFeed(journal, EVEN_HIZB_RANGES).firstHizbCompletedOn).toBe(MARCH_1);
  });

  it('watered days follow minPagesPerWateredDay; re-reads never water', () => {
    const twoPages: KhatmConfig = { ...DEFAULT_KHATM_CONFIG, minPagesPerWateredDay: 2 };
    // March 1: 2 new pages. March 2: 1 new page. March 3: re-reads only.
    let journal = readPages(EMPTY_JOURNAL, [1, 2], MARCH_1);
    journal = readPages(journal, [3], MARCH_2);
    journal = readPages(journal, [1, 2, 3], MARCH_3);

    expect(getGardenFeed(journal, TESTER_HIZB_RANGES).wateredDays).toEqual(
      new Set([MARCH_1, MARCH_2]),
    );
    expect(getGardenFeed(journal, TESTER_HIZB_RANGES, twoPages).wateredDays).toEqual(
      new Set([MARCH_1]),
    );
    expect(getGardenFeed(journal, TESTER_HIZB_RANGES, twoPages).startDate).toBe(MARCH_1);
  });

  it('the feed and getKhatmProgress agree on the hizb count and on the fraction', () => {
    const journal = readPages(EMPTY_JOURNAL, [...pagesFrom(1, 40), 300, 604], MARCH_1);

    const feed = getGardenFeed(journal, TESTER_HIZB_RANGES);
    const progress = getKhatmProgress(journal, 1, TESTER_HIZB_RANGES);

    // Hizb 1, 2 and 3 end at page 32; hizb 4 is 33-43 with 8 pages read (33-40).
    expect(feed.hizbCompleted).toBe(3);
    expect(feed.currentHizbProgress).toBe(8 / 11);
    expect(feed.hizbCompleted).toBe(progress.hizbCompleted);
    expect(feed.currentHizbProgress).toBe(progress.currentHizbProgress);
  });
});

describe('Règle 10 — le jardin complet reste affiché', () => {
  it('a khatma just completed: the garden receives it, with its 60 hizb', () => {
    expect(getGardenFeed(completedFirstKhatma(), TESTER_HIZB_RANGES)).toStrictEqual({
      khatm: 1,
      hizbCompleted: 60,
      currentHizbProgress: 0,
      startDate: MARCH_1,
      wateredDays: new Set([MARCH_1, MARCH_2, MARCH_5]),
      firstHizbCompletedOn: MARCH_1,
      completedOn: MARCH_5,
    });
  });

  it('the first page of the next khatma switches to the new garden', () => {
    // Page 300 is in hizb 30: hizb 1 of the new garden has nothing yet.
    const next = recordPageRead(completedFirstKhatma(), { page: 300, date: MARCH_7 });

    expect(getGardenFeed(next, TESTER_HIZB_RANGES)).toStrictEqual({
      khatm: 2,
      hizbCompleted: 0,
      currentHizbProgress: 0,
      startDate: MARCH_7,
      wateredDays: new Set([MARCH_7]),
      firstHizbCompletedOn: null,
      completedOn: null,
    });
  });

  it('a re-read attempt of the last page after the end is the first page of the new garden', () => {
    const next = recordPageRead(completedFirstKhatma(), { page: LAST_PAGE, date: MARCH_5 });

    const feed = getGardenFeed(next, TESTER_HIZB_RANGES);

    expect(feed.khatm).toBe(2);
    expect(feed.hizbCompleted).toBe(0);
    expect(feed.startDate).toBe(MARCH_5);
    expect(feed.wateredDays).toEqual(new Set([MARCH_5]));
    expect(feed.completedOn).toBeNull();
  });

  it('the new garden only receives the watered days from its own first page onwards', () => {
    let journal = completedFirstKhatma();
    journal = readPages(journal, [1, 2], MARCH_7);
    journal = readPages(journal, [3], MARCH_9);

    expect(getGardenFeed(journal, TESTER_HIZB_RANGES).wateredDays).toEqual(
      new Set([MARCH_7, MARCH_9]),
    );
  });

  it('the day a khatma ends and the next starts: watered by the new pages of both', () => {
    // Rule 6 counts the new pages of the day. March 5: page 604 ends khatma 1 and page 1
    // opens khatma 2, so two new pages. With 2 pages needed, March 5 is watered, and it is
    // the first day of the new garden.
    const twoPages: KhatmConfig = { ...DEFAULT_KHATM_CONFIG, minPagesPerWateredDay: 2 };
    let journal = readPages(EMPTY_JOURNAL, pagesFrom(1, 603), MARCH_1);
    journal = readPages(journal, [604, 1], MARCH_5);

    const feed = getGardenFeed(journal, TESTER_HIZB_RANGES, twoPages);

    expect(feed.khatm).toBe(2);
    expect(feed.startDate).toBe(MARCH_5);
    expect(feed.wateredDays).toEqual(new Set([MARCH_5]));
  });

  it('"les jours arrosés depuis cette date", read literally, with a back-dated first page', () => {
    // Khatma 1 ends on March 5. The first page of khatma 2 is recorded afterwards but
    // dated March 2: the new garden starts on March 2 and receives the watered days from
    // March 2 onwards, March 5 included although its only page belongs to khatma 1.
    const next = recordPageRead(completedFirstKhatma(), { page: 1, date: MARCH_2 });

    const feed = getGardenFeed(next, TESTER_HIZB_RANGES);

    expect(feed.khatm).toBe(2);
    expect(feed.startDate).toBe(MARCH_2);
    expect(feed.wateredDays).toEqual(new Set([MARCH_2, MARCH_5]));
  });

  it('the caller cannot corrupt later answers through the feed it received', () => {
    const journal = completedFirstKhatma();
    const pristine = getGardenFeed(journal, TESTER_HIZB_RANGES);
    // `as` on purpose: a JavaScript caller can ignore the ReadonlySet type and mutate it.
    const leaked = getGardenFeed(journal, TESTER_HIZB_RANGES).wateredDays as Set<unknown>;
    try {
      leaked.clear();
    } catch {
      // A frozen or guarded set is fine too.
    }

    expect(getGardenFeed(journal, TESTER_HIZB_RANGES)).toStrictEqual(pristine);
    expect(getWateredDays(journal)).toEqual(new Set([MARCH_1, MARCH_2, MARCH_5]));
  });

  it('the completed khatma shown in the garden matches its badge', () => {
    const journal = completedFirstKhatma();

    const feed = getGardenFeed(journal, TESTER_HIZB_RANGES);
    const badge = getBadges(journal)[0];

    expect(feed.khatm).toBe(badge?.khatm);
    expect(feed.startDate).toBe(badge?.startedOn);
    expect(feed.completedOn).toBe(badge?.completedOn);
  });

  it('completedOn is the most recent date, even when the last recorded page is back-dated', () => {
    // Pages 2-603 dated March 10, page 1 dated March 5, page 604 recorded last, dated March 7.
    let journal = readPages(EMPTY_JOURNAL, pagesFrom(2, 603), MARCH_10);
    journal = recordPageRead(journal, { page: 1, date: MARCH_5 });
    journal = recordPageRead(journal, { page: 604, date: MARCH_7 });

    const feed = getGardenFeed(journal, TESTER_HIZB_RANGES);

    expect(feed.khatm).toBe(1);
    expect(feed.hizbCompleted).toBe(60);
    expect(feed.completedOn).toBe(MARCH_10);
    // Hizb 60 (595-604) has its pages on March 10 and March 7: completed on March 10, like
    // hizb 2 to 59. Hizb 1 holds page 1 (March 5) and pages 2-11 (March 10): March 10 too.
    expect(feed.firstHizbCompletedOn).toBe(MARCH_10);
  });

  it('the start date is the oldest date of the khatma, like startedOn on its badge', () => {
    // Page 2 is recorded first, dated March 10; page 1 is recorded next, dated March 5.
    // "Les jours arrosés depuis cette date" must keep March 5, a day of this very khatma.
    let journal = recordPageRead(EMPTY_JOURNAL, { page: 2, date: MARCH_10 });
    journal = recordPageRead(journal, { page: 1, date: MARCH_5 });

    const feed = getGardenFeed(journal, TESTER_HIZB_RANGES);

    expect(feed.startDate).toBe(MARCH_5);
    expect(feed.wateredDays).toEqual(new Set([MARCH_5, MARCH_10]));
  });

  it('three khatmas: the garden follows the khatma in progress', () => {
    let journal = readWholeKhatma(EMPTY_JOURNAL, MARCH_1);
    journal = readWholeKhatma(journal, MARCH_3);
    expect(getGardenFeed(journal, TESTER_HIZB_RANGES)).toStrictEqual({
      khatm: 2,
      hizbCompleted: 60,
      currentHizbProgress: 0,
      startDate: MARCH_3,
      wateredDays: new Set([MARCH_3]),
      firstHizbCompletedOn: MARCH_3,
      completedOn: MARCH_3,
    });

    journal = readPages(journal, pagesFrom(1, 11), MARCH_6);
    expect(getGardenFeed(journal, TESTER_HIZB_RANGES)).toStrictEqual({
      khatm: 3,
      hizbCompleted: 1,
      currentHizbProgress: 1 / 11,
      startDate: MARCH_6,
      wateredDays: new Set([MARCH_6]),
      firstHizbCompletedOn: MARCH_6,
      completedOn: null,
    });
  });
});

describe('Règle 10 — properties', () => {
  it('while pages are read in disorder the feed stays coherent', () => {
    const order = shuffled(pagesFrom(FIRST_PAGE, LAST_PAGE), seededRandom(10));
    let journal: ReadingJournal = EMPTY_JOURNAL;
    let previousHizbCompleted = 0;

    order.forEach((page, index) => {
      // A new day every 40 pages, from March 1.
      const date = day(`2026-03-${String(1 + Math.floor(index / 40)).padStart(2, '0')}`);
      journal = recordPageRead(journal, { page, date });
      const feed = getGardenFeed(journal, TESTER_HIZB_RANGES);

      expect(feed.khatm).toBe(1);
      expect(feed.hizbCompleted).toBeGreaterThanOrEqual(previousHizbCompleted);
      expect(feed.currentHizbProgress).toBeGreaterThanOrEqual(0);
      expect(feed.currentHizbProgress).toBeLessThan(1);
      expect(feed.startDate).toBe(MARCH_1);
      expect(feed.firstHizbCompletedOn === null).toBe(feed.hizbCompleted === 0);
      expect(feed.completedOn === null).toBe(index < LAST_PAGE - 1);
      expect(feed.wateredDays).toEqual(getWateredDays(journal));
      previousHizbCompleted = feed.hizbCompleted;
    });

    expect(previousHizbCompleted).toBe(60);
  });
});
