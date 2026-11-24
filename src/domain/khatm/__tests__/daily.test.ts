import type { LocalDate } from '@/domain/shared/local-date';
import { allPagesOutOfOrder, day, pageRange, readPages } from '../__fixtures__/journal-builders';
import {
  DEFAULT_KHATM_CONFIG,
  EMPTY_JOURNAL,
  getStreak,
  getTodayProgress,
  getWateredDays,
  type KhatmConfig,
  type Pause,
  type ReadingJournal,
} from '../index';

const TODAY = day('2026-11-23');
const YESTERDAY = day('2026-11-22');
const TWO_DAYS_AGO = day('2026-11-21');
const TOMORROW = day('2026-11-24');
const LAST_MONTH = day('2026-10-01');
// Cast on purpose: forged LocalDate values are what the runtime checks must catch.
const IMPOSSIBLE_DATE = '2026-02-30' as LocalDate;

function configWith(overrides: Partial<KhatmConfig>): KhatmConfig {
  return { ...DEFAULT_KHATM_CONFIG, ...overrides };
}

/** One page read on each given day (a different page each day), in khatma 1. */
function readOnePageOn(dates: readonly string[]): ReadingJournal {
  return dates.reduce<ReadingJournal>(
    (journal, date, index) => readPages(journal, 1, [index + 1], day(date)),
    EMPTY_JOURNAL,
  );
}

/** Khatma 1 read last month except the given pages, which are still to read. */
function firstKhatmaExcept(unreadPages: readonly number[]): ReadingJournal {
  const pages = allPagesOutOfOrder().filter((page) => !unreadPages.includes(page));
  return readPages(EMPTY_JOURNAL, 1, pages, LAST_MONTH);
}

describe('Default configuration', () => {
  it('one new page waters a day and the pace window is 7 days', () => {
    expect(DEFAULT_KHATM_CONFIG).toEqual({ minPagesPerWateredDay: 1, averagePaceWindowDays: 7 });
  });

  it('holds no daily goal: the goal belongs to the user', () => {
    expect(DEFAULT_KHATM_CONFIG).not.toHaveProperty('dailyGoalPages');
  });
});

describe('Rule 5 — today (aujourd’hui)', () => {
  const GOAL_OF_FIVE = 5;

  it('empty journal: nothing read, the whole goal remains', () => {
    expect(getTodayProgress(EMPTY_JOURNAL, TODAY, GOAL_OF_FIVE)).toEqual({
      pagesRead: 0,
      goalPages: 5,
      pagesRemaining: 5,
      goalReached: false,
    });
  });

  it('counts the entries dated today and compares them with the goal', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, [10, 11, 12], TODAY);

    expect(getTodayProgress(journal, TODAY, GOAL_OF_FIVE)).toEqual({
      pagesRead: 3,
      goalPages: 5,
      pagesRemaining: 2,
      goalReached: false,
    });
  });

  it('ignores the pages read on other days', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 8), YESTERDAY);
    journal = readPages(journal, 1, [9], TODAY);
    journal = readPages(journal, 1, [10, 11], TOMORROW);

    expect(getTodayProgress(journal, TODAY, GOAL_OF_FIVE).pagesRead).toBe(1);
  });

  it('the goal is reached at exactly the goal', () => {
    const fourPages = readPages(EMPTY_JOURNAL, 1, pageRange(1, 4), TODAY);
    const fivePages = readPages(fourPages, 1, [5], TODAY);

    expect(getTodayProgress(fourPages, TODAY, GOAL_OF_FIVE).goalReached).toBe(false);
    expect(getTodayProgress(fivePages, TODAY, GOAL_OF_FIVE)).toEqual({
      pagesRead: 5,
      goalPages: 5,
      pagesRemaining: 0,
      goalReached: true,
    });
  });

  it('reading beyond the goal never gives a negative remainder', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 9), TODAY);

    const today = getTodayProgress(journal, TODAY, GOAL_OF_FIVE);

    expect(today.pagesRead).toBe(9);
    expect(today.pagesRemaining).toBe(0);
    expect(today.goalReached).toBe(true);
  });

  it('a goal of one page is reached by the first page', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, [1], TODAY);

    expect(getTodayProgress(EMPTY_JOURNAL, TODAY, 1).goalReached).toBe(false);
    expect(getTodayProgress(journal, TODAY, 1).goalReached).toBe(true);
  });

  it('the goal has no upper limit: more pages than a whole mushaf is a valid goal', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 9), TODAY);

    expect(getTodayProgress(journal, TODAY, 1000)).toEqual({
      pagesRead: 9,
      goalPages: 1000,
      pagesRemaining: 991,
      goalReached: false,
    });
  });

  it('the end of one khatma and the start of the next add up', () => {
    let journal = firstKhatmaExcept([603, 604]);
    journal = readPages(journal, 1, [603, 604], TODAY);
    journal = readPages(journal, 2, [1, 2, 3], TODAY);

    expect(getTodayProgress(journal, TODAY, GOAL_OF_FIVE).pagesRead).toBe(5);
  });

  it('the day a khatma ends and the next one starts, the same page can count twice, once in each (accepted)', () => {
    // Page 7 is the last page of khatma 1; read again the same day, it opens khatma 2.
    let journal = firstKhatmaExcept([7]);
    journal = readPages(journal, 1, [7], TODAY);
    expect(getTodayProgress(journal, TODAY, GOAL_OF_FIVE).pagesRead).toBe(1);

    journal = readPages(journal, 2, [7], TODAY);

    expect(getTodayProgress(journal, TODAY, GOAL_OF_FIVE).pagesRead).toBe(2);
    // Only once in each: a third read of the page that day is a re-read in khatma 2.
    expect(readPages(journal, 2, [7], TODAY)).toBe(journal);
  });

  it('page read again the same day: counted once', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [7], TODAY);
    journal = readPages(journal, 1, [7], TODAY);

    expect(getTodayProgress(journal, TODAY, GOAL_OF_FIVE).pagesRead).toBe(1);
  });

  it('page read again another day: no effect on the daily goal', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [7, 8], YESTERDAY);
    journal = readPages(journal, 1, [7, 8], TODAY);

    expect(getTodayProgress(journal, TODAY, GOAL_OF_FIVE).pagesRead).toBe(0);
    expect(getTodayProgress(journal, YESTERDAY, GOAL_OF_FIVE).pagesRead).toBe(2);
  });

  it.each([0, -3, 2.5, Number.NaN])('invalid input: rejects a daily goal of %p', (goal) => {
    expect(() => getTodayProgress(EMPTY_JOURNAL, TODAY, goal)).toThrow(RangeError);
  });

  it('invalid input: rejects an impossible date', () => {
    expect(() => getTodayProgress(EMPTY_JOURNAL, IMPOSSIBLE_DATE, GOAL_OF_FIVE)).toThrow(
      RangeError,
    );
  });

  it('invalid input: rejects a corrupted journal', () => {
    const duplicated: ReadingJournal = [
      { khatm: 1, page: 5, date: TODAY },
      { khatm: 1, page: 5, date: TODAY },
    ];

    expect(() => getTodayProgress(duplicated, TODAY, GOAL_OF_FIVE)).toThrow(RangeError);
  });
});

describe('Rule 6 — watered day (jour arrosé)', () => {
  it('empty journal: no watered day', () => {
    expect(getWateredDays(EMPTY_JOURNAL).size).toBe(0);
  });

  it('by default one new page is enough to water a day', () => {
    const journal = readOnePageOn(['2026-11-21', '2026-11-23']);

    expect(getWateredDays(journal)).toEqual(new Set([TWO_DAYS_AGO, TODAY]));
  });

  it('a day needs at least minPagesPerWateredDay new pages', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [1, 2], YESTERDAY);
    journal = readPages(journal, 1, [3, 4, 5], TODAY);

    const wateredDays = getWateredDays(journal, configWith({ minPagesPerWateredDay: 3 }));

    expect(wateredDays).toEqual(new Set([TODAY]));
  });

  it('page read again another day: a re-read does not water the day', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [1], YESTERDAY);
    journal = readPages(journal, 1, [1], TODAY);

    expect(getWateredDays(journal)).toEqual(new Set([YESTERDAY]));
  });

  it('re-reads do not help to reach minPagesPerWateredDay', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [1, 2], YESTERDAY);
    journal = readPages(journal, 1, [1, 2, 3], TODAY);

    const wateredDays = getWateredDays(journal, configWith({ minPagesPerWateredDay: 2 }));

    expect(wateredDays).toEqual(new Set([YESTERDAY]));
  });

  it('new pages of two khatmas on the same day add up', () => {
    let journal = firstKhatmaExcept([604]);
    journal = readPages(journal, 1, [604], TODAY);
    journal = readPages(journal, 2, [1], TODAY);

    const wateredDays = getWateredDays(journal, configWith({ minPagesPerWateredDay: 2 }));

    expect(wateredDays.has(TODAY)).toBe(true);
  });

  it('the same page number read as the end of one khatma and the start of the next is two new pages', () => {
    let journal = firstKhatmaExcept([7]);
    journal = readPages(journal, 1, [7], TODAY);
    const endOnly = journal;
    journal = readPages(journal, 2, [7], TODAY);
    const twoPagesNeeded = configWith({ minPagesPerWateredDay: 2 });

    expect(getWateredDays(endOnly, twoPagesNeeded).has(TODAY)).toBe(false);
    expect(getWateredDays(journal, twoPagesNeeded).has(TODAY)).toBe(true);
  });

  it('keeps the watered days of every khatma', () => {
    let journal = firstKhatmaExcept([604]);
    journal = readPages(journal, 1, [604], YESTERDAY);
    journal = readPages(journal, 2, [1], TODAY);

    expect(getWateredDays(journal)).toEqual(new Set([LAST_MONTH, YESTERDAY, TODAY]));
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'invalid input: rejects minPagesPerWateredDay = %p',
    (minPages) => {
      expect(() =>
        getWateredDays(EMPTY_JOURNAL, configWith({ minPagesPerWateredDay: minPages })),
      ).toThrow(RangeError);
    },
  );

  it('invalid input: rejects a corrupted journal instead of watering a day with a page counted twice', () => {
    const duplicated: ReadingJournal = [
      { khatm: 1, page: 5, date: YESTERDAY },
      { khatm: 1, page: 5, date: TODAY },
    ];

    expect(() => getWateredDays(duplicated)).toThrow(RangeError);
  });
});

describe('Rule 7 — streak (série)', () => {
  it('empty journal: no streak', () => {
    expect(getStreak(EMPTY_JOURNAL, TODAY)).toBe(0);
  });

  it('counts the consecutive watered days ending today', () => {
    const journal = readOnePageOn(['2026-11-21', '2026-11-22', '2026-11-23']);

    expect(getStreak(journal, TODAY)).toBe(3);
  });

  it('a first day of reading is a streak of one', () => {
    expect(getStreak(readOnePageOn(['2026-11-23']), TODAY)).toBe(1);
  });

  it('streak with today not read yet: it ends yesterday, the day in progress does not break it', () => {
    const journal = readOnePageOn(['2026-11-20', '2026-11-21', '2026-11-22']);

    expect(getStreak(journal, TODAY)).toBe(3);
  });

  it('today not read and yesterday missed: the streak is lost', () => {
    const journal = readOnePageOn(['2026-11-19', '2026-11-20', '2026-11-21']);

    expect(getStreak(journal, TODAY)).toBe(0);
  });

  it('a missed day breaks the streak', () => {
    // 2026-11-20 is missed.
    const journal = readOnePageOn([
      '2026-11-18',
      '2026-11-19',
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
    ]);

    expect(getStreak(journal, TODAY)).toBe(3);
  });

  it('a day made only of re-reads is not watered and breaks the streak', () => {
    // New pages on the 20th and 21st, only re-reads on the 22nd, a new page today.
    let journal = readPages(EMPTY_JOURNAL, 1, [1], day('2026-11-20'));
    journal = readPages(journal, 1, [2], TWO_DAYS_AGO);
    const beforeRereads = journal;
    journal = readPages(journal, 1, [1, 2], YESTERDAY);

    expect(journal).toBe(beforeRereads);
    expect(getWateredDays(journal).has(YESTERDAY)).toBe(false);
    expect(getStreak(journal, TODAY)).toBe(0);
    expect(getStreak(readPages(journal, 1, [3], TODAY), TODAY)).toBe(1);
  });

  it('re-reading today does not extend the streak', () => {
    let journal = readOnePageOn(['2026-11-21', '2026-11-22']);
    journal = readPages(journal, 1, [1, 2], TODAY);

    expect(getStreak(journal, TODAY)).toBe(2);
    expect(getStreak(journal, TOMORROW)).toBe(0);
  });

  it('a day below minPagesPerWateredDay is a missed day', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [1, 2], TWO_DAYS_AGO);
    journal = readPages(journal, 1, [3], YESTERDAY);
    journal = readPages(journal, 1, [4, 5], TODAY);

    expect(getStreak(journal, TODAY, [], configWith({ minPagesPerWateredDay: 2 }))).toBe(1);
    expect(getStreak(journal, TODAY)).toBe(3);
  });

  it('the streak goes on from one khatma to the next', () => {
    let journal = firstKhatmaExcept([603, 604]);
    journal = readPages(journal, 1, [603], TWO_DAYS_AGO);
    journal = readPages(journal, 1, [604], YESTERDAY);
    journal = readPages(journal, 2, [1], TODAY);

    expect(getStreak(journal, TODAY)).toBe(3);
  });

  it('streak across a pause: a paused day does not break the streak and does not advance it', () => {
    // Read on the 17th and 18th, paused from the 19th to the 21st, read on the 22nd and 23rd.
    const journal = readOnePageOn(['2026-11-17', '2026-11-18', '2026-11-22', '2026-11-23']);
    const pause: Pause = { from: day('2026-11-19'), to: day('2026-11-21') };

    expect(getStreak(journal, TODAY, [pause])).toBe(4);
    expect(getStreak(journal, TODAY)).toBe(2);
  });

  it('streak across a pause: a missed day outside the pause still breaks it', () => {
    // The pause covers the 20th and 21st only: the 19th is a plain missed day.
    const journal = readOnePageOn(['2026-11-17', '2026-11-18', '2026-11-22', '2026-11-23']);
    const pause: Pause = { from: day('2026-11-20'), to: day('2026-11-21') };

    expect(getStreak(journal, TODAY, [pause])).toBe(2);
  });

  it('a one-day pause and several pauses are honoured', () => {
    // Paused on the 19th and on the 21st.
    const journal = readOnePageOn(['2026-11-18', '2026-11-20', '2026-11-22', '2026-11-23']);
    const pauses: Pause[] = [
      { from: day('2026-11-21'), to: day('2026-11-21') },
      { from: day('2026-11-19'), to: day('2026-11-19') },
    ];

    expect(getStreak(journal, TODAY, pauses)).toBe(4);
  });

  it('reading during a pause still counts: a pause forgives, it does not erase reading', () => {
    // Read every day from the 19th to the 23rd, although the 20th and 21st are paused.
    const journal = readOnePageOn([
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
    ]);
    const pause: Pause = { from: day('2026-11-20'), to: day('2026-11-21') };

    expect(getStreak(journal, TODAY, [pause])).toBe(5);
  });

  it('a pause read only in part: the unread paused days are skipped, the read one counts', () => {
    // Paused from the 19th to the 21st, read on the 20th only.
    const journal = readOnePageOn(['2026-11-18', '2026-11-20', '2026-11-22', '2026-11-23']);
    const pause: Pause = { from: day('2026-11-19'), to: day('2026-11-21') };

    expect(getStreak(journal, TODAY, [pause])).toBe(4);
  });

  it('today paused and not read: the streak is kept as it was before the pause', () => {
    const journal = readOnePageOn(['2026-11-19', '2026-11-20']);
    const pause: Pause = { from: day('2026-11-21'), to: day('2026-11-30') };

    expect(getStreak(journal, TODAY, [pause])).toBe(2);
  });

  it('today paused and read: today counts', () => {
    const journal = readOnePageOn(['2026-11-21', '2026-11-22', '2026-11-23']);
    const pause: Pause = { from: TODAY, to: TODAY };

    expect(getStreak(journal, TODAY, [pause])).toBe(3);
  });

  it('a pause is not a streak: paused days alone never count', () => {
    // Read once on the 10th, then paused until today.
    const journal = readOnePageOn(['2026-11-10']);
    const pause: Pause = { from: day('2026-11-11'), to: TODAY };

    expect(getStreak(journal, TODAY, [pause])).toBe(1);
  });

  it('a very long pause ends: the walk stops at the first day ever read', () => {
    const journal = readOnePageOn(['2026-11-22', '2026-11-23']);
    const pause: Pause = { from: day('1900-01-01'), to: day('2100-12-31') };

    expect(getStreak(journal, TODAY, [pause])).toBe(2);
  });

  it('a pause before any reading gives no streak', () => {
    const pause: Pause = { from: day('1900-01-01'), to: day('2100-12-31') };

    expect(getStreak(EMPTY_JOURNAL, TODAY, [pause])).toBe(0);
  });

  it('year change: the streak continues from December to January', () => {
    const journal = readOnePageOn(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);

    expect(getStreak(journal, day('2027-01-02'))).toBe(4);
    expect(getStreak(journal, day('2027-01-03'))).toBe(4);
    expect(getStreak(journal, day('2027-01-04'))).toBe(0);
  });

  it('leap day: the streak goes through February 29th', () => {
    const journal = readOnePageOn(['2028-02-28', '2028-02-29', '2028-03-01']);

    expect(getStreak(journal, day('2028-03-01'))).toBe(3);
  });

  it('ignores the days after today', () => {
    const journal = readOnePageOn(['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25']);

    expect(getStreak(journal, TODAY)).toBe(2);
  });

  it('reading entered out of date order gives the same streak', () => {
    const journal = readOnePageOn(['2026-11-23', '2026-11-21', '2026-11-22']);

    expect(getStreak(journal, TODAY)).toBe(3);
  });

  it('invalid input: rejects a pause that ends before it starts', () => {
    const pause: Pause = { from: TODAY, to: YESTERDAY };

    expect(() => getStreak(EMPTY_JOURNAL, TODAY, [pause])).toThrow(RangeError);
  });

  it('invalid input: rejects a corrupted journal and an invalid configuration', () => {
    const duplicated: ReadingJournal = [
      { khatm: 1, page: 5, date: YESTERDAY },
      { khatm: 1, page: 5, date: TODAY },
    ];

    expect(() => getStreak(duplicated, TODAY)).toThrow(RangeError);
    expect(() =>
      getStreak(EMPTY_JOURNAL, TODAY, [], configWith({ minPagesPerWateredDay: 0 })),
    ).toThrow(RangeError);
  });

  it('invalid input: rejects impossible dates', () => {
    expect(() => getStreak(EMPTY_JOURNAL, IMPOSSIBLE_DATE)).toThrow(RangeError);
    expect(() => getStreak(EMPTY_JOURNAL, TODAY, [{ from: IMPOSSIBLE_DATE, to: TODAY }])).toThrow(
      RangeError,
    );
    expect(() =>
      getStreak(EMPTY_JOURNAL, TODAY, [{ from: YESTERDAY, to: IMPOSSIBLE_DATE }]),
    ).toThrow(RangeError);
  });
});
