import type { LocalDate } from '@/domain/shared/local-date';
import { day, pageRange, readPages } from '../__fixtures__/journal-builders';
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

describe('Default configuration', () => {
  it('one page waters a day, the goal is at least one page, the pace window is 7 days', () => {
    expect(DEFAULT_KHATM_CONFIG.minPagesPerWateredDay).toBe(1);
    expect(DEFAULT_KHATM_CONFIG.dailyGoalPages).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_KHATM_CONFIG.averagePaceWindowDays).toBe(7);
  });
});

describe('Rule 5 — today (aujourd’hui)', () => {
  const goalOfFive = configWith({ dailyGoalPages: 5 });

  it('empty journal: nothing read, the whole goal remains', () => {
    expect(getTodayProgress(EMPTY_JOURNAL, TODAY, goalOfFive)).toEqual({
      pagesRead: 0,
      goalPages: 5,
      pagesRemaining: 5,
      goalReached: false,
    });
  });

  it('counts the pages read today and compares them with the goal', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, [10, 11, 12], TODAY);

    expect(getTodayProgress(journal, TODAY, goalOfFive)).toEqual({
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

    expect(getTodayProgress(journal, TODAY, goalOfFive).pagesRead).toBe(1);
  });

  it('the goal is reached at exactly dailyGoalPages pages', () => {
    const fourPages = readPages(EMPTY_JOURNAL, 1, pageRange(1, 4), TODAY);
    const fivePages = readPages(fourPages, 1, [5], TODAY);

    expect(getTodayProgress(fourPages, TODAY, goalOfFive).goalReached).toBe(false);
    expect(getTodayProgress(fivePages, TODAY, goalOfFive)).toEqual({
      pagesRead: 5,
      goalPages: 5,
      pagesRemaining: 0,
      goalReached: true,
    });
  });

  it('reading beyond the goal never gives a negative remainder', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 9), TODAY);

    const today = getTodayProgress(journal, TODAY, goalOfFive);

    expect(today.pagesRead).toBe(9);
    expect(today.pagesRemaining).toBe(0);
    expect(today.goalReached).toBe(true);
  });

  it('all khatmas merged: the end of one khatma and the start of the next add up', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [603, 604], TODAY);
    journal = readPages(journal, 2, [1, 2, 3], TODAY);

    expect(getTodayProgress(journal, TODAY, goalOfFive).pagesRead).toBe(5);
  });

  it('distinct pages: the same page number in two khatmas on the same day counts once', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [7], TODAY);
    journal = readPages(journal, 2, [7], TODAY);

    expect(getTodayProgress(journal, TODAY, goalOfFive).pagesRead).toBe(1);
  });

  it('page read again the same day: counted once', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [7], TODAY);
    journal = readPages(journal, 1, [7], TODAY);

    expect(getTodayProgress(journal, TODAY, goalOfFive).pagesRead).toBe(1);
  });

  it('page read again another day: the re-read counts as reading of the day', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [7, 8], YESTERDAY);
    journal = readPages(journal, 1, [7, 8], TODAY);

    expect(getTodayProgress(journal, TODAY, goalOfFive).pagesRead).toBe(2);
  });

  it('uses the default configuration when none is given', () => {
    const today = getTodayProgress(EMPTY_JOURNAL, TODAY);

    expect(today.goalPages).toBe(DEFAULT_KHATM_CONFIG.dailyGoalPages);
  });

  it.each([0, -3, 2.5, Number.NaN])('invalid input: rejects a daily goal of %p', (goal) => {
    expect(() =>
      getTodayProgress(EMPTY_JOURNAL, TODAY, configWith({ dailyGoalPages: goal })),
    ).toThrow(RangeError);
  });

  it('invalid input: rejects an impossible date', () => {
    expect(() => getTodayProgress(EMPTY_JOURNAL, IMPOSSIBLE_DATE)).toThrow(RangeError);
  });
});

describe('Rule 6 — watered day (jour arrosé)', () => {
  it('empty journal: no watered day', () => {
    expect(getWateredDays(EMPTY_JOURNAL).size).toBe(0);
  });

  it('by default one page is enough to water a day', () => {
    const journal = readOnePageOn(['2026-11-21', '2026-11-23']);

    expect(getWateredDays(journal)).toEqual(new Set([TWO_DAYS_AGO, TODAY]));
  });

  it('a day needs at least minPagesPerWateredDay pages', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [1, 2], YESTERDAY);
    journal = readPages(journal, 1, [3, 4, 5], TODAY);

    const wateredDays = getWateredDays(journal, configWith({ minPagesPerWateredDay: 3 }));

    expect(wateredDays).toEqual(new Set([TODAY]));
  });

  it('page read again another day: a re-read waters the day', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [1], YESTERDAY);
    journal = readPages(journal, 1, [1], TODAY);

    expect(getWateredDays(journal)).toEqual(new Set([YESTERDAY, TODAY]));
  });

  it('counts distinct pages, all khatmas merged', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [604], TODAY);
    journal = readPages(journal, 2, [1], TODAY);
    let samePageTwice = readPages(EMPTY_JOURNAL, 1, [7], YESTERDAY);
    samePageTwice = readPages(samePageTwice, 2, [7], YESTERDAY);
    const twoPagesNeeded = configWith({ minPagesPerWateredDay: 2 });

    expect(getWateredDays(journal, twoPagesNeeded)).toEqual(new Set([TODAY]));
    expect(getWateredDays(samePageTwice, twoPagesNeeded).size).toBe(0);
  });

  it.each([0, -1, 1.5])('invalid input: rejects minPagesPerWateredDay = %p', (minPages) => {
    expect(() =>
      getWateredDays(EMPTY_JOURNAL, configWith({ minPagesPerWateredDay: minPages })),
    ).toThrow(RangeError);
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

  it('a day below minPagesPerWateredDay is a missed day', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [1, 2], TWO_DAYS_AGO);
    journal = readPages(journal, 1, [3], YESTERDAY);
    journal = readPages(journal, 1, [4, 5], TODAY);

    expect(getStreak(journal, TODAY, [], configWith({ minPagesPerWateredDay: 2 }))).toBe(1);
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
