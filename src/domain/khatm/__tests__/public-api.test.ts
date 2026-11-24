import { HIZB_PAGE_RANGES } from '../__fixtures__/hizb-page-ranges';
import { buildCompletedKhatmas, day } from '../__fixtures__/journal-builders';
import * as khatm from '../index';
import {
  DEFAULT_KHATM_CONFIG,
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
  type Pause,
  type ReadingJournal,
} from '../index';

const TODAY = day('2026-11-23');
const DAILY_GOAL = 20;

/** Khatma 1 completed in September, then one page of khatma 2 yesterday and one today. */
function buildJournal(): ReadingJournal {
  return [
    ...buildCompletedKhatmas(1, day('2026-09-01'), 1),
    { khatm: 2, page: 1, date: day('2026-11-22') },
    { khatm: 2, page: 2, date: TODAY },
  ];
}

function freezeJournal(journal: ReadingJournal): ReadingJournal {
  journal.forEach((entry) => Object.freeze(entry));
  return Object.freeze(journal);
}

/** Every derived value of the module, computed from the same inputs. */
function deriveEverything(journal: ReadingJournal, pauses: readonly Pause[]): unknown[] {
  return [
    getCurrentKhatm(journal),
    getReadPages(journal, 2),
    isPageRead(journal, 2, 1),
    getKhatmProgress(journal, 2, HIZB_PAGE_RANGES),
    getTodayProgress(journal, TODAY, DAILY_GOAL),
    getWateredDays(journal),
    getStreak(journal, TODAY, pauses),
    estimateFinishDate(journal, 2, TODAY, { kind: 'daily-goal', dailyGoalPages: DAILY_GOAL }),
    estimateFinishDate(journal, 2, TODAY, { kind: 'recent-average' }),
    getBadges(journal),
    getGardenFeed(journal, HIZB_PAGE_RANGES),
    recordPageRead(journal, { page: 3, date: TODAY }),
  ];
}

describe('Public API — functions named by the specification', () => {
  it('exposes the functions of docs/specs/khatm.md, the garden feed and the default configuration', () => {
    expect(Object.keys(khatm).sort()).toEqual([
      'DEFAULT_KHATM_CONFIG',
      'EMPTY_JOURNAL',
      'estimateFinishDate',
      'getBadges',
      'getCurrentKhatm',
      'getGardenFeed',
      'getKhatmProgress',
      'getReadPages',
      'getStreak',
      'getTodayProgress',
      'getWateredDays',
      'isPageRead',
      'recordPageRead',
    ]);
  });

  it('the default configuration cannot be modified', () => {
    expect(Object.isFrozen(DEFAULT_KHATM_CONFIG)).toBe(true);
  });
});

describe('Public API — pure functions, immutable journal, injected time', () => {
  it('no function modifies the journal, the hizb ranges or the pauses it receives', () => {
    const journal = freezeJournal(buildJournal());
    const ranges = Object.freeze(HIZB_PAGE_RANGES.map((range) => Object.freeze({ ...range })));
    const pauses = Object.freeze([
      Object.freeze({ from: day('2026-11-10'), to: day('2026-11-12') }),
    ]);
    const snapshot = JSON.stringify(journal);

    // Writing to a frozen object throws in strict mode: a mutation would fail the test.
    expect(() => {
      deriveEverything(journal, pauses);
      getKhatmProgress(journal, 2, ranges);
      getGardenFeed(journal, ranges);
    }).not.toThrow();
    expect(JSON.stringify(journal)).toBe(snapshot);
  });

  it('same input, same output: nothing reads the clock', () => {
    const journal = buildJournal();
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2001-01-01T00:00:00Z'));
      const computedIn2001 = deriveEverything(journal, []);
      jest.setSystemTime(new Date('2040-06-15T12:00:00Z'));
      const computedIn2040 = deriveEverything(journal, []);

      expect(computedIn2040).toEqual(computedIn2001);
    } finally {
      jest.useRealTimers();
    }
  });
});
