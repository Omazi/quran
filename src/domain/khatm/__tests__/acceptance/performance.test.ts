/**
 * A long journal (docs/specs/khatm.md, rule 9: the list of badges "peut devenir très longue
 * (des centaines) : le calcul reste linéaire").
 *
 * The journal is written directly, as storage would hand it back: N complete khatmas read
 * 20 pages a day without a missed day (31 days each: 30 days of 20 pages and one of 4),
 * then 10 pages of khatma N + 1 on the following day, which is "today".
 *
 * Linear means: 4 times the entries cost about 4 times the time. A quadratic computation
 * would cost 16 times; the tests fail above 10 times, and above a fixed budget.
 */
import {
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
  type ReadingEntry,
  type ReadingJournal,
} from '@/domain/khatm';
import { addDays, type LocalDate } from '@/domain/shared/local-date';

import { day, LAST_PAGE, seededRandom, shuffled, TESTER_HIZB_RANGES } from './acceptance-kit';

const FIRST_DAY = day('1980-01-01');
const PAGES_PER_DAY = 20;
const DAYS_PER_KHATMA = 31;
const PAGES_OF_LAST_KHATMA = 10;

const SMALL_KHATMA_COUNT = 100;
const LARGE_KHATMA_COUNT = 400;
const SIZE_RATIO = LARGE_KHATMA_COUNT / SMALL_KHATMA_COUNT;

/** A quadratic computation would give SIZE_RATIO² = 16; linear gives about 4. */
const MAX_TIME_RATIO = 10;
/** Below this, a measure is mostly noise: the ratio is computed from this floor instead. */
const NOISE_FLOOR_MS = 5;
/** Far above any linear pass over 60 400 entries, far below a quadratic one. */
const SMALL_BUDGET_MS = 1_500;
const LARGE_BUDGET_MS = 4_000;
const TEST_TIMEOUT_MS = 120_000;
const RUNS = 3;

interface LongJournal {
  readonly journal: ReadingJournal;
  readonly today: LocalDate;
  readonly khatmaCount: number;
}

function buildLongJournal(khatmaCount: number): LongJournal {
  const entries: ReadingEntry[] = [];
  let date = FIRST_DAY;
  for (let khatm = 1; khatm <= khatmaCount; khatm += 1) {
    for (let page = 1; page <= LAST_PAGE; page += 1) {
      entries.push({ khatm, page, date });
      if (page % PAGES_PER_DAY === 0 || page === LAST_PAGE) date = addDays(date, 1);
    }
  }
  for (let page = 1; page <= PAGES_OF_LAST_KHATMA; page += 1) {
    entries.push({ khatm: khatmaCount + 1, page, date });
  }
  return { journal: entries, today: date, khatmaCount };
}

/** Best time of a few runs, in milliseconds: the least disturbed by the rest of the machine. */
function bestTimeOf(action: () => unknown): number {
  let best = Number.POSITIVE_INFINITY;
  for (let run = 0; run < RUNS; run += 1) {
    const start = Date.now();
    action();
    best = Math.min(best, Date.now() - start);
  }
  return best;
}

const FUNCTIONS: readonly (readonly [string, (long: LongJournal) => unknown])[] = [
  ['getBadges', ({ journal }) => getBadges(journal)],
  ['getCurrentKhatm', ({ journal }) => getCurrentKhatm(journal)],
  ['getReadPages', ({ journal, khatmaCount }) => getReadPages(journal, khatmaCount)],
  ['isPageRead', ({ journal, khatmaCount }) => isPageRead(journal, khatmaCount, LAST_PAGE)],
  [
    'getKhatmProgress',
    ({ journal, khatmaCount }) => getKhatmProgress(journal, khatmaCount, TESTER_HIZB_RANGES),
  ],
  ['getTodayProgress', ({ journal, today }) => getTodayProgress(journal, today, 5)],
  ['getWateredDays', ({ journal }) => getWateredDays(journal)],
  ['getStreak', ({ journal, today }) => getStreak(journal, today)],
  [
    'estimateFinishDate (daily goal)',
    ({ journal, today, khatmaCount }) =>
      estimateFinishDate(journal, khatmaCount + 1, today, {
        kind: 'daily-goal',
        dailyGoalPages: 5,
      }),
  ],
  [
    'estimateFinishDate (recent average)',
    ({ journal, today, khatmaCount }) =>
      estimateFinishDate(journal, khatmaCount + 1, today, { kind: 'recent-average' }),
  ],
  ['getGardenFeed', ({ journal }) => getGardenFeed(journal, TESTER_HIZB_RANGES)],
  [
    'recordPageRead (one new page)',
    ({ journal, today }) => recordPageRead(journal, { page: LAST_PAGE, date: today }),
  ],
  [
    'recordPageRead (one re-read)',
    ({ journal, today }) => recordPageRead(journal, { page: 1, date: today }),
  ],
];

const SMALL = buildLongJournal(SMALL_KHATMA_COUNT);
const LARGE = buildLongJournal(LARGE_KHATMA_COUNT);

describe('Long journal — the answers are still right after hundreds of khatmas', () => {
  const { journal, today } = LARGE;

  it('the fixture is what the tester meant', () => {
    // 400 × 604 + 10 entries; 400 × 31 days after 1980-01-01.
    expect(journal).toHaveLength(241_610);
    expect(LARGE_KHATMA_COUNT * DAYS_PER_KHATMA).toBe(12_400);
    expect(today).toBe(addDays(FIRST_DAY, 12_400));
  });

  it(
    'journal, progress and badges',
    () => {
      const badges = getBadges(journal);

      expect(getCurrentKhatm(journal)).toBe(401);
      expect(getReadPages(journal, 400).size).toBe(604);
      expect(getReadPages(journal, 401).size).toBe(10);
      expect(isPageRead(journal, 401, 10)).toBe(true);
      expect(isPageRead(journal, 401, 11)).toBe(false);
      expect(getKhatmProgress(journal, 1, TESTER_HIZB_RANGES).hizbCompleted).toBe(60);
      expect(getKhatmProgress(journal, 401, TESTER_HIZB_RANGES).pagesRead).toBe(10);
      expect(badges).toHaveLength(400);
      expect(badges[0]).toStrictEqual({
        khatm: 1,
        startedOn: FIRST_DAY,
        completedOn: addDays(FIRST_DAY, DAYS_PER_KHATMA - 1),
        daysTaken: 31,
      });
      expect(badges[399]).toStrictEqual({
        khatm: 400,
        startedOn: addDays(FIRST_DAY, 399 * DAYS_PER_KHATMA),
        completedOn: addDays(today, -1),
        daysTaken: 31,
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'today, watered days, streak and estimate',
    () => {
      // Every day from 1980-01-01 to today has new pages: 12 400 days + today.
      expect(getTodayProgress(journal, today, 5).pagesRead).toBe(10);
      expect(getWateredDays(journal).size).toBe(12_401);
      expect(getStreak(journal, today)).toBe(12_401);
      // 594 pages left, goal 20, 10 read today: rest 10, (594 − 10) / 20 = 29.2 → 30 days.
      expect(
        estimateFinishDate(journal, 401, today, { kind: 'daily-goal', dailyGoalPages: 20 }),
      ).toBe(addDays(today, 30));
      // Last 7 complete days: the end of khatma 400, 6 days of 20 pages are not all in the
      // window. Its last 7 days are 20 × 6 + 4 = 124 pages: pace 124/7. Rest 124/7 − 10 =
      // 54/7: (594 − 54/7) / (124/7) = 4104 / 124 = 33.1 → 34 days.
      expect(estimateFinishDate(journal, 401, today, { kind: 'recent-average' })).toBe(
        addDays(today, 34),
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'garden feed',
    () => {
      // Khatma 401 has pages 1-10 of hizb 1 (1-11), all read today.
      expect(getGardenFeed(journal, TESTER_HIZB_RANGES)).toStrictEqual({
        khatm: 401,
        hizbCompleted: 0,
        currentHizbProgress: 10 / 11,
        currentHizbPagesRead: 10,
        currentHizbPageCount: 11,
        startDate: today,
        wateredDays: new Set([today]),
        firstHizbCompletedOn: null,
        completedOn: null,
      });
    },
    TEST_TIMEOUT_MS,
  );
});

describe('Long journal — the computation stays linear', () => {
  it.each(FUNCTIONS)(
    '%s: 4 times the entries, well under 16 times the time',
    (_name, call) => {
      const smallTime = bestTimeOf(() => call(SMALL));
      // Checked first, so that a quadratic computation fails here instead of running the
      // large journal for minutes.
      expect(smallTime).toBeLessThan(SMALL_BUDGET_MS);

      const largeTime = bestTimeOf(() => call(LARGE));

      expect(largeTime).toBeLessThan(LARGE_BUDGET_MS);
      expect(largeTime / Math.max(smallTime, NOISE_FLOOR_MS)).toBeLessThan(
        MAX_TIME_RATIO * (SIZE_RATIO / 4),
      );
    },
    TEST_TIMEOUT_MS,
  );
});

describe('Long journal — entries stored in no particular order', () => {
  it(
    'the same 241 610 entries, shuffled, give the same answers in about the same time',
    () => {
      const mixed: LongJournal = {
        ...LARGE,
        journal: shuffled(LARGE.journal, seededRandom(241_610)),
      };

      for (const [name, call] of FUNCTIONS) {
        if (name.startsWith('recordPageRead')) continue;
        const start = Date.now();
        const answer = call(mixed);
        const elapsed = Date.now() - start;

        expect({ name, answer }).toStrictEqual({ name, answer: call(LARGE) });
        expect({ name, withinBudget: elapsed < LARGE_BUDGET_MS }).toStrictEqual({
          name,
          withinBudget: true,
        });
      }
    },
    TEST_TIMEOUT_MS,
  );
});
