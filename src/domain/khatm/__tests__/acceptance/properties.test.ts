/**
 * Properties that must always hold (docs/specs/khatm.md): reading a new page never lowers
 * the progress, a re-read never changes anything, every answer is derived from the journal
 * alone, and no function mutates what it receives.
 */
import {
  DEFAULT_KHATM_CONFIG,
  EMPTY_JOURNAL,
  estimateFinishDate,
  getBadges,
  getCurrentKhatm,
  getGardenFeed,
  getKhatmProgress,
  getReadPages,
  getStreak,
  getTodayProgress,
  getWateredDays,
  isPageRead,
  recordPageRead,
  type HizbPageRange,
  type KhatmProgress,
  type Pause,
  type ReadingJournal,
  type ReadingPace,
} from '@/domain/khatm';
import { addDays, type LocalDate } from '@/domain/shared/local-date';

import {
  day,
  deepFreeze,
  FIRST_PAGE,
  LAST_PAGE,
  pagesFrom,
  randomInteger,
  readPages,
  readWholeKhatma,
  seededRandom,
  shuffled,
  TESTER_HIZB_RANGES,
} from './acceptance-kit';

const FIRST_DAY = day('2025-06-01');
const TODAY = day('2026-03-15');
const PAUSES: readonly Pause[] = [{ from: day('2026-03-10'), to: day('2026-03-12') }];

/** The tester's own count of completed hizb: every page of the range is in the set. */
function countCompletedHizb(pages: ReadonlySet<number>, ranges: readonly HizbPageRange[]): number {
  return ranges.filter((range) =>
    pagesFrom(range.firstPage, range.lastPage).every((page) => pages.has(page)),
  ).length;
}

/** Everything the module derives from a journal, gathered to compare two journals. */
function deriveEverything(journal: ReadingJournal): unknown {
  const currentKhatm = getCurrentKhatm(journal);
  return {
    currentKhatm,
    readPages: pagesFrom(1, currentKhatm).map((khatm) =>
      [...getReadPages(journal, khatm)].sort((a, b) => a - b),
    ),
    progress: pagesFrom(1, currentKhatm).map((khatm) =>
      getKhatmProgress(journal, khatm, TESTER_HIZB_RANGES),
    ),
    today: getTodayProgress(journal, TODAY, 5),
    wateredDays: [...getWateredDays(journal)].sort(),
    streak: getStreak(journal, TODAY, PAUSES),
    finishWithGoal: estimateFinishDate(journal, currentKhatm, TODAY, {
      kind: 'daily-goal',
      dailyGoalPages: 5,
    }),
    finishWithAverage: estimateFinishDate(journal, currentKhatm, TODAY, { kind: 'recent-average' }),
    badges: getBadges(journal),
    gardenFeed: getGardenFeed(journal, TESTER_HIZB_RANGES),
  };
}

/**
 * Two complete khatmas and a third in progress. Khatmas 1 and 2 are read 20 pages a day
 * from June 2025 (62 reading days, 186 calendar days at the very most: they end in 2025).
 * Khatma 3 is read in March 2026:
 *   March 8: pages 1-40 · March 9: 41-45 · March 7 (recorded late): 590-604
 *   March 13: 46-50 · March 14: 51-53 · March 15, today: 54-55
 */
function buildLongStory(): ReadingJournal {
  const random = seededRandom(2026);
  let journal: ReadingJournal = EMPTY_JOURNAL;
  let date: LocalDate = FIRST_DAY;
  for (let khatm = 1; khatm <= 2; khatm += 1) {
    const order = shuffled(pagesFrom(FIRST_PAGE, LAST_PAGE), random);
    for (let start = 0; start < order.length; start += 20) {
      journal = readPages(journal, order.slice(start, start + 20), date);
      // Most days are followed by the next day; some are followed by a gap.
      date = addDays(date, randomInteger(random, 1, 10) === 1 ? 3 : 1);
    }
  }
  journal = readPages(journal, pagesFrom(1, 40), day('2026-03-08'));
  journal = readPages(journal, pagesFrom(41, 45), day('2026-03-09'));
  // A back-dated read, recorded after the others.
  journal = readPages(journal, pagesFrom(590, 604), day('2026-03-07'));
  journal = readPages(journal, pagesFrom(46, 50), day('2026-03-13'));
  journal = readPages(journal, pagesFrom(51, 53), day('2026-03-14'));
  return readPages(journal, [54, 55], TODAY);
}

describe('Property — reading a new page never lowers the progress', () => {
  it.each([1, 2, 3])('random reading order, with re-reads mixed in (seed %i)', (seed) => {
    const random = seededRandom(seed);
    const read = new Set<number>();
    let journal: ReadingJournal = EMPTY_JOURNAL;
    let previous: KhatmProgress = getKhatmProgress(journal, 1, TESTER_HIZB_RANGES);

    // 603 distinct pages at most: the khatma stays in progress, so khatma 1 is the subject.
    const order = shuffled(pagesFrom(FIRST_PAGE, LAST_PAGE), random).slice(0, 603);
    order.forEach((page, index) => {
      const date = addDays(FIRST_DAY, Math.floor(index / 25));
      journal = recordPageRead(journal, { page, date });
      read.add(page);
      if (randomInteger(random, 1, 4) === 1) {
        // A re-read of a page picked among those already read, on a later day.
        const again = [...read][randomInteger(random, 0, read.size - 1)] ?? page;
        journal = recordPageRead(journal, { page: again, date: addDays(date, 1) });
      }

      const progress = getKhatmProgress(journal, 1, TESTER_HIZB_RANGES);
      const lowestUnread = pagesFrom(FIRST_PAGE, LAST_PAGE).find((p) => !read.has(p)) ?? null;

      expect(journal).toHaveLength(read.size);
      expect(progress.pagesRead).toBe(read.size);
      expect(progress.pagesRead).toBe(previous.pagesRead + 1);
      expect(progress.pagesRead + progress.pagesRemaining).toBe(604);
      expect(progress.fraction).toBe(read.size / 604);
      expect(progress.fraction).toBeGreaterThan(previous.fraction);
      expect(progress.hizbCompleted).toBe(countCompletedHizb(read, TESTER_HIZB_RANGES));
      expect(progress.hizbCompleted).toBeGreaterThanOrEqual(previous.hizbCompleted);
      expect(progress.firstUnreadPage).toBe(lowestUnread);
      expect(progress.firstUnreadPage ?? 0).toBeGreaterThanOrEqual(previous.firstUnreadPage ?? 0);
      expect(progress.currentHizb ?? 0).toBeGreaterThanOrEqual(previous.currentHizb ?? 0);
      expect(progress.currentHizbProgress).toBeGreaterThanOrEqual(0);
      expect(progress.currentHizbProgress).toBeLessThan(1);
      expect(progress.isComplete).toBe(false);
      expect(isPageRead(journal, 1, page)).toBe(true);
      previous = progress;
    });

    expect(getCurrentKhatm(journal)).toBe(1);
    expect(getBadges(journal)).toEqual([]);
  });

  it('the current hizb is the hizb of the first unread page', () => {
    const random = seededRandom(77);
    const order = shuffled(pagesFrom(FIRST_PAGE, LAST_PAGE), random).slice(0, 600);
    let journal: ReadingJournal = EMPTY_JOURNAL;

    order.forEach((page, index) => {
      journal = recordPageRead(journal, { page, date: FIRST_DAY });
      if (index % 15 !== 0) return;
      const progress = getKhatmProgress(journal, 1, TESTER_HIZB_RANGES);
      const firstUnread = progress.firstUnreadPage ?? 0;
      // With a shared page, the first hizb holding the page is the first unfinished one.
      const holder = TESTER_HIZB_RANGES.find(
        (range) => range.firstPage <= firstUnread && firstUnread <= range.lastPage,
      );
      const pagesOfHolder = holder ? pagesFrom(holder.firstPage, holder.lastPage) : [];
      const readInHolder = pagesOfHolder.filter((p) => isPageRead(journal, 1, p)).length;

      expect(progress.currentHizb).toBe(holder?.hizb);
      expect(progress.currentHizbProgress).toBeCloseTo(readInHolder / pagesOfHolder.length, 12);
    });
  });
});

describe('Property — everything is derived from the journal', () => {
  const story = buildLongStory();

  it('the long story is what the tester meant: 2 khatmas done, the third in progress', () => {
    // 2 × 604 pages, then pages 1-55 and 590-604 of khatma 3: 70 pages.
    expect(story).toHaveLength(2 * 604 + 70);
    expect(getCurrentKhatm(story)).toBe(3);
    expect(getBadges(story).map((badge) => badge.khatm)).toEqual([1, 2]);
    expect(getKhatmProgress(story, 3, TESTER_HIZB_RANGES).pagesRead).toBe(70);
    expect(getTodayProgress(story, TODAY, 5).pagesRead).toBe(2);
  });

  it('the streak of the long story, worked out by hand', () => {
    // New pages on March 7, 8, 9, then the pause of March 10-12, then March 13, 14, 15;
    // nothing on March 6.
    expect(getStreak(story, TODAY, PAUSES)).toBe(6);
    expect(getStreak(story, TODAY, [])).toBe(3);
    expect(getStreak(story, day('2026-03-09'), [])).toBe(3);
    expect(getStreak(story, day('2026-03-12'), PAUSES)).toBe(3);
    expect(getStreak(story, day('2026-03-12'), [])).toBe(0);
  });

  it('the garden feed of the long story, worked out by hand', () => {
    // Khatma 3 holds pages 1-55 and 590-604. Completed: hizb 1 to 5 (pages 1-54) and hizb
    // 60 (595-604), so 6. Hizb 6 is 55-65 with page 55 read: 1/11. Hizb 60 was read in
    // full on March 7, before any other hizb was completed.
    expect(getGardenFeed(story, TESTER_HIZB_RANGES)).toStrictEqual({
      khatm: 3,
      hizbCompleted: 6,
      currentHizbProgress: 1 / 11,
      startDate: day('2026-03-07'),
      wateredDays: new Set(
        ['07', '08', '09', '13', '14', '15'].map((dayOfMarch) => day(`2026-03-${dayOfMarch}`)),
      ),
      firstHizbCompletedOn: day('2026-03-07'),
      completedOn: null,
    });
  });

  it('the finish dates of the long story, worked out by hand', () => {
    // Khatma 3: 70 pages read, 534 left, 2 read today.
    // Goal 5: rest 3, (534 − 3) / 5 = 106.2 → 107 days → June 30.
    expect(estimateFinishDate(story, 3, TODAY, { kind: 'daily-goal', dailyGoalPages: 5 })).toBe(
      day('2026-06-30'),
    );
    // Last 7 complete days, March 8-14: 40 + 5 + 5 + 3 = 53 pages, pace 53/7. Rest
    // 53/7 − 2 = 39/7: (534 − 39/7) / (53/7) = 3699 / 53 = 69.8 → 70 days → May 24.
    expect(estimateFinishDate(story, 3, TODAY, { kind: 'recent-average' })).toBe(day('2026-05-24'));
  });

  it.each([11, 12, 13])(
    'the same entries stored in another order give the same answers (seed %i)',
    (seed) => {
      const stored = shuffled(story, seededRandom(seed));

      expect(deriveEverything(stored)).toStrictEqual(deriveEverything(story));
    },
  );

  it('re-reading every page of the khatma in progress changes no answer', () => {
    const before = deriveEverything(story);

    const reread = readPages(story, pagesFrom(1, 55), TODAY);

    expect(reread).toStrictEqual(story);
    expect(deriveEverything(reread)).toStrictEqual(before);
  });

  it('asking twice gives the same answer (no hidden state between calls)', () => {
    const first = deriveEverything(story);
    deriveEverything(readWholeKhatma(EMPTY_JOURNAL, FIRST_DAY));

    expect(deriveEverything(story)).toStrictEqual(first);
  });

  it('the answers about today agree with each other', () => {
    for (const goal of [1, 2, 3, 5, 20]) {
      const today = getTodayProgress(story, TODAY, goal);

      expect(today.goalPages).toBe(goal);
      expect(today.pagesRemaining).toBe(Math.max(0, goal - today.pagesRead));
      expect(today.goalReached).toBe(today.pagesRead >= goal);
    }
    expect(getWateredDays(story).has(TODAY)).toBe(true);
    expect(getStreak(story, TODAY)).toBeLessThanOrEqual(getWateredDays(story).size);
  });
});

describe('Property — no function mutates what it receives', () => {
  it('every function accepts deeply frozen inputs and leaves them as they were', () => {
    const journal = deepFreeze([...buildLongStory()]);
    const ranges = deepFreeze(TESTER_HIZB_RANGES.map((range) => ({ ...range })));
    const pauses = deepFreeze(PAUSES.map((pause) => ({ ...pause })));
    const config = deepFreeze({ ...DEFAULT_KHATM_CONFIG });
    const pageRead = deepFreeze({ page: 100, date: TODAY });
    const snapshot = JSON.stringify([journal, ranges, pauses, config]);

    expect(() => {
      recordPageRead(journal, pageRead);
      recordPageRead(journal, deepFreeze({ page: 1, date: TODAY }));
      getCurrentKhatm(journal);
      getReadPages(journal, 3);
      isPageRead(journal, 3, 100);
      getKhatmProgress(journal, 3, ranges);
      getTodayProgress(journal, TODAY, 5);
      getWateredDays(journal, config);
      getStreak(journal, TODAY, pauses, config);
      estimateFinishDate(
        journal,
        3,
        TODAY,
        deepFreeze<ReadingPace>({ kind: 'recent-average' }),
        config,
      );
      getBadges(journal);
      getGardenFeed(journal, ranges, config);
    }).not.toThrow();
    expect(JSON.stringify([journal, ranges, pauses, config])).toBe(snapshot);
  });
});

describe('Property — an answer handed out cannot be used to change later answers', () => {
  it('mutating every returned value leaves the next answers intact', () => {
    const story = buildLongStory();
    const pristine = deriveEverything(story);

    /** Tries to wreck a returned value the way a careless JavaScript caller could. */
    function wreck(value: unknown): void {
      try {
        if (value instanceof Set) value.clear();
        else if (Array.isArray(value)) value.length = 0;
        else if (typeof value === 'object' && value !== null) {
          for (const [key, nested] of Object.entries(value)) {
            wreck(nested);
            Reflect.set(value, key, -1);
          }
        }
      } catch {
        // A frozen value refuses the change: that is a fine answer too.
      }
    }

    wreck(getReadPages(story, 3));
    wreck(getKhatmProgress(story, 3, TESTER_HIZB_RANGES));
    wreck(getTodayProgress(story, TODAY, 5));
    wreck(getWateredDays(story));
    wreck(getBadges(story));
    getBadges(story).forEach(wreck);
    wreck(getGardenFeed(story, TESTER_HIZB_RANGES));

    expect(deriveEverything(story)).toStrictEqual(pristine);
    expect(story).toHaveLength(2 * 604 + 70);
  });
});

describe('Points the specification leaves open — a khatma that has not started', () => {
  // Khatma 1 is in progress; the spec only rejects a khatma number below 1. For a number
  // beyond the khatma in progress, an explicit error or "nothing read" are both accepted.
  const journal = readPages(EMPTY_JOURNAL, [1, 2, 3], TODAY);

  it('getReadPages of a future khatma: explicit error or no page', () => {
    let size: number | null = null;
    try {
      size = getReadPages(journal, 5).size;
    } catch (error) {
      expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
    }
    expect([null, 0]).toContain(size);
  });

  it('getKhatmProgress of a future khatma: explicit error or zero progress', () => {
    let pagesRead: number | null = null;
    try {
      pagesRead = getKhatmProgress(journal, 5, TESTER_HIZB_RANGES).pagesRead;
    } catch (error) {
      expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
    }
    expect([null, 0]).toContain(pagesRead);
  });
});
