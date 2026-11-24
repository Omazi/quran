/**
 * Acceptance tests of the estimated finish date (docs/specs/khatm.md, rule 8).
 *
 * The rule, in the tests' words:
 *   rest of the day = max(0, pace − pages already read today)
 *   remaining ≤ rest of the day → today
 *   otherwise → today + ceil((remaining − rest of the day) / pace)
 *   pace of 0 → null
 * Every expected date below is worked out by hand from that rule; today is 2026-03-15.
 */
import {
  DEFAULT_KHATM_CONFIG,
  EMPTY_JOURNAL,
  estimateFinishDate,
  type KhatmConfig,
  type ReadingJournal,
  type ReadingPace,
} from '@/domain/khatm';
import { addDays, type LocalDate } from '@/domain/shared/local-date';

import {
  day,
  journalOfDailyCounts,
  pagesFrom,
  readPages,
  readWholeKhatma,
  seededRandom,
  randomInteger,
} from './acceptance-kit';

const TODAY = day('2026-03-15');
const TOMORROW = day('2026-03-16');
const LONG_AGO = day('2026-01-15');
const RECENT_AVERAGE: ReadingPace = { kind: 'recent-average' };

function daysAgo(count: number): LocalDate {
  return addDays(TODAY, -count);
}

function dailyGoal(dailyGoalPages: number): ReadingPace {
  return { kind: 'daily-goal', dailyGoalPages };
}

function finishWithGoal(journal: ReadingJournal, dailyGoalPages: number): LocalDate | null {
  return estimateFinishDate(journal, 1, TODAY, dailyGoal(dailyGoalPages));
}

function finishWithRecentAverage(journal: ReadingJournal): LocalDate | null {
  return estimateFinishDate(journal, 1, TODAY, RECENT_AVERAGE);
}

describe('Règle 8 — date de fin estimée, pace = the daily goal', () => {
  it('spec example: 10 pages left, 5 pages a day, nothing read today → tomorrow', () => {
    const journal = journalOfDailyCounts([[LONG_AGO, 594]]);

    expect(finishWithGoal(journal, 5)).toBe(TOMORROW);
  });

  it('the remaining pages fit in the rest of the day → today', () => {
    // 10 pages left. Goal 10: rest of the day 10, it fits exactly. Goal 11: it fits.
    const journal = journalOfDailyCounts([[LONG_AGO, 594]]);

    expect(finishWithGoal(journal, 10)).toBe(TODAY);
    expect(finishWithGoal(journal, 11)).toBe(TODAY);
  });

  it('one page more than the rest of the day → tomorrow', () => {
    // 11 pages left, goal 10: (11 − 10) / 10 = 0.1 → 1 day.
    const journal = journalOfDailyCounts([[LONG_AGO, 593]]);

    expect(finishWithGoal(journal, 10)).toBe(TOMORROW);
  });

  it('the result is rounded up to the next day', () => {
    // 11 pages left, goal 5: (11 − 5) / 5 = 1.2 → 2 days.
    const journal = journalOfDailyCounts([[LONG_AGO, 593]]);

    expect(finishWithGoal(journal, 5)).toBe(day('2026-03-17'));
  });

  it('pages already read today are taken off the rest of the day', () => {
    // 594 pages read, 3 of them today: 10 left. Goal 5: rest 2, (10 − 2) / 5 = 1.6 → 2 days.
    const journal = journalOfDailyCounts([
      [LONG_AGO, 591],
      [TODAY, 3],
    ]);

    expect(finishWithGoal(journal, 5)).toBe(day('2026-03-17'));
  });

  it('the rest of the day is never negative', () => {
    // 594 pages read, 8 of them today: 10 left. Goal 5: rest 0 (not −3), 10 / 5 = 2 days.
    const journal = journalOfDailyCounts([
      [LONG_AGO, 586],
      [TODAY, 8],
    ]);

    expect(finishWithGoal(journal, 5)).toBe(day('2026-03-17'));
  });

  it('today’s goal exactly reached: the remaining pages start tomorrow', () => {
    // 594 pages read, 5 of them today: 10 left. Goal 5: rest 0, 10 / 5 = 2 days.
    const journal = journalOfDailyCounts([
      [LONG_AGO, 589],
      [TODAY, 5],
    ]);

    expect(finishWithGoal(journal, 5)).toBe(day('2026-03-17'));
  });

  it('cas à tester: journal vide', () => {
    // 604 pages left. Goal 20: (604 − 20) / 20 = 29.2 → 30 days.
    expect(finishWithGoal(EMPTY_JOURNAL, 20)).toBe(day('2026-04-14'));
    // Goal 1: (604 − 1) / 1 = 603 days.
    expect(finishWithGoal(EMPTY_JOURNAL, 1)).toBe(day('2027-11-08'));
    // Goal 604 or more: everything fits today.
    expect(finishWithGoal(EMPTY_JOURNAL, 604)).toBe(TODAY);
    expect(finishWithGoal(EMPTY_JOURNAL, 1000)).toBe(TODAY);
    // Goal 603: one page is left for tomorrow.
    expect(finishWithGoal(EMPTY_JOURNAL, 603)).toBe(TOMORROW);
  });

  it('the estimate is about the khatma asked for', () => {
    // Khatma 1 complete 10 days ago, 4 pages of khatma 2 read 9 days ago: 600 left.
    // Goal 10, nothing today: (600 − 10) / 10 = 59 days.
    const firstKhatma = readWholeKhatma(EMPTY_JOURNAL, daysAgo(10));
    const journal = readPages(firstKhatma, [1, 2, 3, 4], daysAgo(9));

    expect(estimateFinishDate(journal, 2, TODAY, dailyGoal(10))).toBe(day('2026-05-13'));
  });

  it('cas à tester: passage d’année, landing on a leap day', () => {
    // 604 pages left, goal 10: (604 − 10) / 10 = 59.4 → 60 days.
    // From 2027-12-31: 31 days to January 31, 29 more to February 29, 2028.
    expect(estimateFinishDate(EMPTY_JOURNAL, 1, day('2027-12-31'), dailyGoal(10))).toBe(
      day('2028-02-29'),
    );
    // From 2026-12-31 there is no February 29: 60 days later is March 1, 2027.
    expect(estimateFinishDate(EMPTY_JOURNAL, 1, day('2026-12-31'), dailyGoal(10))).toBe(
      day('2027-03-01'),
    );
  });

  it('re-reads today do not use up the rest of the day', () => {
    // 594 pages read long ago, 10 left; today only re-reads. Goal 5 → tomorrow, as in the
    // spec example.
    const read = journalOfDailyCounts([[LONG_AGO, 594]]);
    const reread = readPages(read, pagesFrom(1, 30), TODAY);

    expect(finishWithGoal(reread, 5)).toBe(TOMORROW);
  });
});

describe('Règle 8 — date de fin estimée, pace = average of the last 7 complete days', () => {
  it('the default window is 7 days', () => {
    expect(DEFAULT_KHATM_CONFIG.averagePaceWindowDays).toBe(7);
  });

  it('14 pages over the last 7 days make a pace of 2 pages a day', () => {
    // 594 pages read, 10 left. Pace 14 / 7 = 2, rest 2: (10 − 2) / 2 = 4 days.
    const journal = journalOfDailyCounts([
      [LONG_AGO, 580],
      [daysAgo(3), 14],
    ]);

    expect(finishWithRecentAverage(journal)).toBe(day('2026-03-19'));
  });

  it('the days without reading count in the average', () => {
    // Same 14 pages spread on 2 of the 7 days: still 2 pages a day.
    const journal = journalOfDailyCounts([
      [LONG_AGO, 580],
      [daysAgo(6), 10],
      [daysAgo(1), 4],
    ]);

    expect(finishWithRecentAverage(journal)).toBe(day('2026-03-19'));
  });

  it('today is not one of the complete days', () => {
    // 50 pages today and nothing before: the pace is 0.
    expect(finishWithRecentAverage(journalOfDailyCounts([[TODAY, 50]]))).toBeNull();
  });

  it('pages read today still shorten the rest of the day', () => {
    // 595 pages read (1 today), 9 left. Pace 2, rest 2 − 1 = 1: (9 − 1) / 2 = 4 days.
    const journal = journalOfDailyCounts([
      [LONG_AGO, 580],
      [daysAgo(3), 14],
      [TODAY, 1],
    ]);

    expect(finishWithRecentAverage(journal)).toBe(day('2026-03-19'));
  });

  it('the window starts 7 days ago: a day inside counts, the day before does not', () => {
    // 7 pages 7 days ago: pace 1, 597 left, rest 1: 596 days.
    expect(finishWithRecentAverage(journalOfDailyCounts([[daysAgo(7), 7]]))).toBe(
      day('2027-11-01'),
    );
    // The same 7 pages 8 days ago are outside the window: pace 0.
    expect(finishWithRecentAverage(journalOfDailyCounts([[daysAgo(8), 7]]))).toBeNull();
  });

  it('null when the pace is zero', () => {
    expect(finishWithRecentAverage(EMPTY_JOURNAL)).toBeNull();
    expect(finishWithRecentAverage(journalOfDailyCounts([[LONG_AGO, 300]]))).toBeNull();
  });

  it('a pace that is not a whole number', () => {
    // 10 pages yesterday: pace 10 / 7. 594 left, rest 10 / 7:
    // (594 − 10/7) / (10/7) = 594 × 7 / 10 − 1 = 414.8 → 415 days.
    expect(finishWithRecentAverage(journalOfDailyCounts([[daysAgo(1), 10]]))).toBe(
      day('2027-05-04'),
    );
  });

  it('a rest of the day smaller than one page', () => {
    // 603 pages read (10 yesterday, 1 today), 1 left. Pace 10 / 7, rest 10/7 − 1 = 3/7:
    // (1 − 3/7) / (10/7) = 0.4 → 1 day.
    const journal = journalOfDailyCounts([
      [LONG_AGO, 592],
      [daysAgo(1), 10],
      [TODAY, 1],
    ]);

    expect(finishWithRecentAverage(journal)).toBe(TOMORROW);
  });

  // The division is exact here, so "arrondi au jour supérieur" must not add a day. With
  // S pages in the window and R pages left: (R − S/7) / (S/7) = 7R/S − 1.
  it.each([
    { inWindow: 1, remaining: 1, days: 6, expected: '2026-03-21' }, // 7 × 1 / 1 − 1
    { inWindow: 3, remaining: 3, days: 6, expected: '2026-03-21' }, // 7 × 3 / 3 − 1
    { inWindow: 6, remaining: 36, days: 41, expected: '2026-04-25' }, // 7 × 36 / 6 − 1
    { inWindow: 30, remaining: 270, days: 62, expected: '2026-05-16' }, // 7 × 270 / 30 − 1
    { inWindow: 10, remaining: 130, days: 90, expected: '2026-06-13' }, // 7 × 130 / 10 − 1
  ])(
    'exact division: $inWindow pages last week, $remaining left → $days days, not one more',
    ({ inWindow, remaining, expected }) => {
      const journal = journalOfDailyCounts([
        [LONG_AGO, 604 - remaining - inWindow],
        [daysAgo(1), inWindow],
      ]);

      expect(finishWithRecentAverage(journal)).toBe(day(expected));
    },
  );

  it('the window length comes from the configuration', () => {
    const threeDays: KhatmConfig = { ...DEFAULT_KHATM_CONFIG, averagePaceWindowDays: 3 };
    // 6 pages 3 days ago: pace 6 / 3 = 2. 598 left, rest 2: (598 − 2) / 2 = 298 days.
    const inside = journalOfDailyCounts([[daysAgo(3), 6]]);
    // 6 pages 4 days ago: outside a 3-day window, pace 0.
    const outside = journalOfDailyCounts([[daysAgo(4), 6]]);

    expect(estimateFinishDate(inside, 1, TODAY, RECENT_AVERAGE, threeDays)).toBe(day('2027-01-07'));
    expect(estimateFinishDate(outside, 1, TODAY, RECENT_AVERAGE, threeDays)).toBeNull();
  });

  it('the smallest window is yesterday alone', () => {
    const oneDay: KhatmConfig = { ...DEFAULT_KHATM_CONFIG, averagePaceWindowDays: 1 };
    // 4 pages yesterday: pace 4. 600 left, rest 4: (600 − 4) / 4 = 149 days.
    const yesterday = journalOfDailyCounts([[daysAgo(1), 4]]);
    // 4 pages two days ago: outside the window, pace 0.
    const twoDaysAgo = journalOfDailyCounts([[daysAgo(2), 4]]);

    expect(estimateFinishDate(yesterday, 1, TODAY, RECENT_AVERAGE, oneDay)).toBe(
      addDays(TODAY, 149),
    );
    expect(estimateFinishDate(twoDaysAgo, 1, TODAY, RECENT_AVERAGE, oneDay)).toBeNull();
  });

  it('the pace is the reader’s pace, whatever khatma the pages of the week belong to', () => {
    // 14 pages 3 days ago end khatma 1 (pages 591-604); nothing of khatma 2 is read yet.
    // Pace 14 / 7 = 2. Khatma 2: 604 left, rest 2: (604 − 2) / 2 = 301 days.
    const journal = journalOfDailyCounts([
      [LONG_AGO, 590],
      [daysAgo(3), 14],
    ]);

    expect(estimateFinishDate(journal, 2, TODAY, RECENT_AVERAGE)).toBe(addDays(TODAY, 301));
  });
});

describe('Règle 8 — properties', () => {
  it('reading one more page today never pushes the finish date back', () => {
    const random = seededRandom(8);
    for (let round = 0; round < 40; round += 1) {
      const before = randomInteger(random, 0, 500);
      const today = randomInteger(random, 0, 40);
      const goal = randomInteger(random, 1, 30);
      const journal = journalOfDailyCounts([
        [LONG_AGO, before],
        [TODAY, today],
      ]);
      const onePageMore = journalOfDailyCounts([
        [LONG_AGO, before],
        [TODAY, today + 1],
      ]);

      const estimate = finishWithGoal(journal, goal);
      const estimateAfter = finishWithGoal(onePageMore, goal);

      expect(estimate).not.toBeNull();
      expect(estimateAfter).not.toBeNull();
      // LocalDate values are YYYY-MM-DD strings: they compare as calendar days.
      expect(String(estimateAfter) <= String(estimate)).toBe(true);
    }
  });

  it('a larger daily goal never pushes the finish date back, and it is never before today', () => {
    const journal = journalOfDailyCounts([
      [LONG_AGO, 123],
      [TODAY, 4],
    ]);
    let previous = finishWithGoal(journal, 1);

    for (let goal = 2; goal <= 60; goal += 1) {
      const estimate = finishWithGoal(journal, goal);
      expect(String(estimate) <= String(previous)).toBe(true);
      expect(String(estimate) >= String(TODAY)).toBe(true);
      previous = estimate;
    }
  });
});

describe('Règle 8 — the estimate is a date or null, never anything else', () => {
  it('at the end of the calendar: a real YYYY-MM-DD day, null or an explicit error', () => {
    // 9999-12-31 is a valid LocalDate. 604 pages at 1 page a day end 603 days later, in
    // the year 10001, which YYYY-MM-DD cannot write.
    let outcome: string;
    try {
      outcome = String(estimateFinishDate(EMPTY_JOURNAL, 1, day('9999-12-31'), dailyGoal(1)));
    } catch (error) {
      outcome = error instanceof RangeError || error instanceof TypeError ? 'explicit error' : '?';
    }

    expect(outcome).toMatch(/^(\d{4}-\d{2}-\d{2}|null|explicit error)$/);
  });
});

describe('Règle 8 — points the specification leaves open (both readings accepted)', () => {
  it('spec ambiguity: the day a khatma ends and the next starts', () => {
    // Today: 3 pages end khatma 1 and 2 pages open khatma 2 (602 left), goal 5.
    // "Pages déjà lues aujourd'hui" counted over all khatmas (rule 5): rest 0, 602 / 5 → 121
    // days. Counted in khatma 2 only: rest 3, 599 / 5 → 120 days.
    const journal = journalOfDailyCounts([
      [LONG_AGO, 601],
      [TODAY, 5],
    ]);

    expect([day('2026-07-13'), day('2026-07-14')]).toContain(
      estimateFinishDate(journal, 2, TODAY, dailyGoal(5)),
    );
  });

  it('spec ambiguity: a khatma that is already complete has no later finish date', () => {
    // 0 pages left "fit in the rest of the day" (today), yet the khatma ended 10 days ago.
    const journal = readWholeKhatma(EMPTY_JOURNAL, daysAgo(10));

    const estimate = estimateFinishDate(journal, 1, TODAY, dailyGoal(5));

    expect([null, daysAgo(10), TODAY]).toContain(estimate);
  });
});
