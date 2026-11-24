/**
 * Acceptance tests of the daily goal, the watered days and the streak
 * (docs/specs/khatm.md, rules 5, 6 and 7; docs/DECISIONS.md, D8 and D10).
 */
import {
  DEFAULT_KHATM_CONFIG,
  EMPTY_JOURNAL,
  getStreak,
  getTodayProgress,
  getWateredDays,
  recordPageRead,
  type KhatmConfig,
  type Pause,
} from '@/domain/khatm';
import { addDays, type LocalDate } from '@/domain/shared/local-date';

import { day, journalOfDailyCounts, pagesFrom, readPages, readWholeKhatma } from './acceptance-kit';

const TODAY = day('2026-03-15');

function daysAgo(count: number): LocalDate {
  return addDays(TODAY, -count);
}

function pause(from: LocalDate, to: LocalDate): Pause {
  return { from, to };
}

function wateredWith(minPagesPerWateredDay: number): KhatmConfig {
  return { ...DEFAULT_KHATM_CONFIG, minPagesPerWateredDay };
}

describe('Règle 5 — aujourd’hui: entries dated today, compared with the user’s goal', () => {
  it('cas à tester: journal vide', () => {
    expect(getTodayProgress(EMPTY_JOURNAL, TODAY, 5)).toStrictEqual({
      pagesRead: 0,
      goalPages: 5,
      pagesRemaining: 5,
      goalReached: false,
    });
  });

  it('only the entries dated today count', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(1), 3],
      [TODAY, 2],
      [addDays(TODAY, 1), 4],
    ]);

    expect(getTodayProgress(journal, TODAY, 5)).toStrictEqual({
      pagesRead: 2,
      goalPages: 5,
      pagesRemaining: 3,
      goalReached: false,
    });
  });

  it('the goal is reached with exactly the goal, and stays reached beyond it', () => {
    const exactly = journalOfDailyCounts([[TODAY, 5]]);
    const beyond = journalOfDailyCounts([[TODAY, 7]]);

    expect(getTodayProgress(exactly, TODAY, 5)).toStrictEqual({
      pagesRead: 5,
      goalPages: 5,
      pagesRemaining: 0,
      goalReached: true,
    });
    expect(getTodayProgress(beyond, TODAY, 5)).toStrictEqual({
      pagesRead: 7,
      goalPages: 5,
      pagesRemaining: 0,
      goalReached: true,
    });
  });

  it('one page short of the goal is not reached', () => {
    const journal = journalOfDailyCounts([[TODAY, 4]]);

    expect(getTodayProgress(journal, TODAY, 5).goalReached).toBe(false);
    expect(getTodayProgress(journal, TODAY, 5).pagesRemaining).toBe(1);
  });

  it('the goal belongs to the user: smallest goal 1, and a whole juz', () => {
    const journal = journalOfDailyCounts([[TODAY, 1]]);

    expect(getTodayProgress(journal, TODAY, 1).goalReached).toBe(true);
    expect(getTodayProgress(journal, TODAY, 20)).toStrictEqual({
      pagesRead: 1,
      goalPages: 20,
      pagesRemaining: 19,
      goalReached: false,
    });
  });

  it('cas à tester: page relue le même jour — counted once', () => {
    const journal = readPages(EMPTY_JOURNAL, [10, 10, 10, 11, 10], TODAY);

    expect(getTodayProgress(journal, TODAY, 5).pagesRead).toBe(2);
  });

  it('cas à tester: page relue un autre jour — nothing counts today', () => {
    const yesterday = readPages(EMPTY_JOURNAL, [10, 11, 12], daysAgo(1));
    const rereadToday = readPages(yesterday, [10, 11, 12], TODAY);

    expect(getTodayProgress(rereadToday, TODAY, 5).pagesRead).toBe(0);
    expect(getTodayProgress(rereadToday, daysAgo(1), 5).pagesRead).toBe(3);
  });

  it('a back-dated page counts for its own day, not for today', () => {
    const journal = readPages(EMPTY_JOURNAL, [10], daysAgo(3));

    expect(getTodayProgress(journal, TODAY, 5).pagesRead).toBe(0);
    expect(getTodayProgress(journal, daysAgo(3), 5).pagesRead).toBe(1);
  });

  it('all khatmas together: the page that ends a khatma and starts the next counts twice', () => {
    // Pages 1-602 earlier. Today: 603 and 604 end khatma 1, then 604 and 1 open khatma 2.
    const before = readPages(EMPTY_JOURNAL, pagesFrom(1, 602), daysAgo(4));
    const today = readPages(before, [603, 604, 604, 1], TODAY);

    expect(today).toHaveLength(606);
    expect(getTodayProgress(today, TODAY, 3)).toStrictEqual({
      pagesRead: 4,
      goalPages: 3,
      pagesRemaining: 0,
      goalReached: true,
    });
  });
});

describe('Règle 6 — jour arrosé: at least minPagesPerWateredDay new pages', () => {
  it('the default is one new page', () => {
    expect(DEFAULT_KHATM_CONFIG.minPagesPerWateredDay).toBe(1);
  });

  it('cas à tester: journal vide — no watered day', () => {
    expect(getWateredDays(EMPTY_JOURNAL).size).toBe(0);
  });

  it('every day with a new page is watered, the days in between are not', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(5), 1],
      [daysAgo(3), 4],
      [TODAY, 2],
    ]);

    expect(getWateredDays(journal)).toEqual(new Set([daysAgo(5), daysAgo(3), TODAY]));
  });

  it('cas à tester: un jour fait uniquement de relectures n’est pas arrosé', () => {
    const firstRead = readPages(EMPTY_JOURNAL, [1, 2, 3], daysAgo(2));
    const rereadOnly = readPages(firstRead, [1, 2, 3, 3, 2, 1], daysAgo(1));

    expect(getWateredDays(rereadOnly)).toEqual(new Set([daysAgo(2)]));
  });

  it('a higher minimum: a day just below it is dry, a day at it is watered', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(3), 2],
      [daysAgo(2), 3],
      [daysAgo(1), 4],
    ]);

    expect(getWateredDays(journal, wateredWith(3))).toEqual(new Set([daysAgo(2), daysAgo(1)]));
    expect(getWateredDays(journal, wateredWith(5)).size).toBe(0);
  });

  it('new pages of two khatmas read the same day add up', () => {
    // Today: pages 603 and 604 end khatma 1 and page 1 opens khatma 2: three new pages.
    const before = readPages(EMPTY_JOURNAL, pagesFrom(1, 602), daysAgo(4));
    const today = readPages(before, [603, 604, 1], TODAY);

    expect(getWateredDays(today, wateredWith(3)).has(TODAY)).toBe(true);
    expect(getWateredDays(today, wateredWith(4)).has(TODAY)).toBe(false);
  });

  it('the caller cannot corrupt later answers through the returned set', () => {
    const journal = journalOfDailyCounts([[TODAY, 1]]);
    // `as` on purpose: a JavaScript caller can ignore the ReadonlySet type and mutate it.
    const leaked = getWateredDays(journal) as Set<LocalDate>;
    leaked.clear();

    expect(getWateredDays(journal)).toEqual(new Set([TODAY]));
  });
});

describe('Règle 7 — série: consecutive watered days ending today, or yesterday', () => {
  it('cas à tester: journal vide — no streak', () => {
    expect(getStreak(EMPTY_JOURNAL, TODAY)).toBe(0);
  });

  it('one page today: a streak of 1', () => {
    expect(getStreak(journalOfDailyCounts([[TODAY, 1]]), TODAY)).toBe(1);
  });

  it('three consecutive days ending today', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(2), 1],
      [daysAgo(1), 3],
      [TODAY, 2],
    ]);

    expect(getStreak(journal, TODAY)).toBe(3);
  });

  it('cas à tester: série avec aujourd’hui non lu — the day in progress does not break it', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(3), 1],
      [daysAgo(2), 1],
      [daysAgo(1), 1],
    ]);

    expect(getStreak(journal, TODAY)).toBe(3);
  });

  it('nothing today and nothing yesterday: the streak is broken', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(3), 1],
      [daysAgo(2), 1],
    ]);

    expect(getStreak(journal, TODAY)).toBe(0);
  });

  it('a missed day breaks the streak: only the days after it count', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(4), 1],
      [daysAgo(3), 1],
      [daysAgo(1), 1],
      [TODAY, 1],
    ]);

    expect(getStreak(journal, TODAY)).toBe(2);
  });

  it('cas à tester: un jour fait uniquement de relectures casse la série', () => {
    // Two days ago: pages 1-3. Yesterday: only re-reads. Today: a new page.
    const firstRead = readPages(EMPTY_JOURNAL, [1, 2, 3], daysAgo(2));
    const rereadOnly = readPages(firstRead, [1, 2, 3], daysAgo(1));
    const newPageToday = recordPageRead(rereadOnly, { page: 4, date: TODAY });

    expect(getStreak(rereadOnly, daysAgo(1))).toBe(1);
    expect(getStreak(rereadOnly, TODAY)).toBe(0);
    expect(getStreak(newPageToday, TODAY)).toBe(1);
  });

  it('re-reading today does not extend the streak, but yesterday still holds it', () => {
    const yesterday = readPages(EMPTY_JOURNAL, [1, 2, 3], daysAgo(1));
    const rereadToday = readPages(yesterday, [1, 2, 3], TODAY);

    expect(getStreak(rereadToday, TODAY)).toBe(1);
  });

  it('entries dated after today are not part of a streak ending today', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(1), 1],
      [TODAY, 1],
      [addDays(TODAY, 1), 1],
      [addDays(TODAY, 2), 1],
    ]);

    expect(getStreak(journal, TODAY)).toBe(2);
  });

  it('a higher minimum per watered day applies to the streak', () => {
    // With 2 pages needed: 3 days ago 2 pages, 2 days ago 2, yesterday 2, today only 1.
    const journal = journalOfDailyCounts([
      [daysAgo(4), 1],
      [daysAgo(3), 2],
      [daysAgo(2), 2],
      [daysAgo(1), 2],
      [TODAY, 1],
    ]);

    // Today is not watered yet: the streak ends yesterday and stops at the 1-page day.
    expect(getStreak(journal, TODAY, [], wateredWith(2))).toBe(3);
    expect(getStreak(journal, TODAY)).toBe(5);
  });

  it('the streak carries on from one khatma to the next', () => {
    const firstKhatma = readWholeKhatma(EMPTY_JOURNAL, daysAgo(1));
    const journal = readPages(firstKhatma, [1], TODAY);

    expect(getStreak(journal, TODAY)).toBe(2);
  });

  it('cas à tester: passage d’année', () => {
    const journal = journalOfDailyCounts([
      [day('2025-12-30'), 1],
      [day('2025-12-31'), 1],
      [day('2026-01-01'), 1],
    ]);

    expect(getStreak(journal, day('2026-01-01'))).toBe(3);
    expect(getStreak(journal, day('2026-01-02'))).toBe(3);
    expect(getStreak(journal, day('2026-01-03'))).toBe(0);
  });

  it('leap day: February 29 exists in 2028 and is part of the streak', () => {
    const journal = journalOfDailyCounts([
      [day('2028-02-28'), 1],
      [day('2028-02-29'), 1],
      [day('2028-03-01'), 1],
    ]);

    expect(getStreak(journal, day('2028-03-01'))).toBe(3);
  });

  it('leap day: skipping February 29 breaks the streak in 2028', () => {
    const journal = journalOfDailyCounts([
      [day('2028-02-28'), 1],
      [day('2028-03-01'), 1],
    ]);

    expect(getStreak(journal, day('2028-03-01'))).toBe(1);
  });

  it('no leap day in 2026: February 28 and March 1 are consecutive', () => {
    const journal = journalOfDailyCounts([
      [day('2026-02-28'), 1],
      [day('2026-03-01'), 1],
    ]);

    expect(getStreak(journal, day('2026-03-01'))).toBe(2);
  });

  it('century rule: 2100 is not a leap year, 2000 was one', () => {
    const in2100 = journalOfDailyCounts([
      [day('2100-02-28'), 1],
      [day('2100-03-01'), 1],
    ]);
    const in2000 = journalOfDailyCounts([
      [day('2000-02-28'), 1],
      [day('2000-03-01'), 1],
    ]);

    expect(getStreak(in2100, day('2100-03-01'))).toBe(2);
    expect(getStreak(in2000, day('2000-03-01'))).toBe(1);
  });

  it('days are calendar days: the clock changes of March and November do not cut a streak', () => {
    // In North America the clocks change on 2026-03-08 (a 23-hour day) and 2026-11-01 (25).
    const spring = journalOfDailyCounts([
      [day('2026-03-07'), 1],
      [day('2026-03-08'), 1],
      [day('2026-03-09'), 1],
    ]);
    const autumn = journalOfDailyCounts([
      [day('2026-10-31'), 1],
      [day('2026-11-01'), 1],
      [day('2026-11-02'), 1],
    ]);

    expect(getStreak(spring, day('2026-03-09'))).toBe(3);
    expect(getStreak(autumn, day('2026-11-02'))).toBe(3);
  });

  it('a streak across 1970-01-01 (the zero of the computer calendar)', () => {
    const journal = journalOfDailyCounts([
      [day('1969-12-30'), 1],
      [day('1969-12-31'), 1],
      [day('1970-01-01'), 1],
    ]);

    expect(getStreak(journal, day('1970-01-01'))).toBe(3);
    expect(getStreak(journal, day('1970-01-02'))).toBe(3);
  });

  it('a long streak is counted in full', () => {
    // One new page a day for 400 days ending today.
    const days = Array.from({ length: 400 }, (_, index) => [daysAgo(399 - index), 1] as const);

    expect(getStreak(journalOfDailyCounts(days), TODAY)).toBe(400);
  });
});

describe('Règle 7 — série: a paused day neither breaks the streak nor moves it forward', () => {
  it('cas à tester: série à cheval sur une pause', () => {
    // Watered 4 and 3 days ago, paused 2 days ago and yesterday, watered today.
    const journal = journalOfDailyCounts([
      [daysAgo(4), 1],
      [daysAgo(3), 1],
      [TODAY, 1],
    ]);

    expect(getStreak(journal, TODAY, [pause(daysAgo(2), daysAgo(1))])).toBe(3);
    expect(getStreak(journal, TODAY, [])).toBe(1);
    expect(getStreak(journal, TODAY)).toBe(1);
  });

  it('a pause does not hide a missed day next to it', () => {
    // 5 days ago watered, 4 days ago missed, then a pause until yesterday, today watered.
    const journal = journalOfDailyCounts([
      [daysAgo(5), 1],
      [TODAY, 1],
    ]);

    expect(getStreak(journal, TODAY, [pause(daysAgo(3), daysAgo(1))])).toBe(1);
  });

  it('today not read yet, with a pause just before', () => {
    // Watered 4 and 3 days ago, paused 2 days ago and yesterday, nothing today yet.
    const journal = journalOfDailyCounts([
      [daysAgo(4), 1],
      [daysAgo(3), 1],
    ]);

    expect(getStreak(journal, TODAY, [pause(daysAgo(2), daysAgo(1))])).toBe(2);
  });

  it('a pause that starts today', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(2), 1],
      [daysAgo(1), 1],
    ]);

    expect(getStreak(journal, TODAY, [pause(TODAY, addDays(TODAY, 6))])).toBe(2);
  });

  it('a pause that starts today does not hide a missed yesterday', () => {
    // Watered 2 days ago, nothing yesterday (not paused), paused from today on.
    const journal = journalOfDailyCounts([[daysAgo(2), 1]]);

    expect(getStreak(journal, TODAY, [pause(TODAY, addDays(TODAY, 6))])).toBe(0);
  });

  it('a pause that ends today', () => {
    // Watered 5 and 4 days ago, paused from 3 days ago to today, nothing read meanwhile.
    const journal = journalOfDailyCounts([
      [daysAgo(5), 1],
      [daysAgo(4), 1],
    ]);

    expect(getStreak(journal, TODAY, [pause(daysAgo(3), TODAY)])).toBe(2);
  });

  it('a pause that ended yesterday, reading resumed today', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(4), 1],
      [TODAY, 1],
    ]);

    expect(getStreak(journal, TODAY, [pause(daysAgo(3), daysAgo(1))])).toBe(2);
  });

  it('a one-day pause (from and to are the same day, both ends included)', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(2), 1],
      [TODAY, 1],
    ]);

    expect(getStreak(journal, TODAY, [pause(daysAgo(1), daysAgo(1))])).toBe(2);
  });

  it('both ends of a pause are included, the days around it are not', () => {
    // Paused 3 and 2 days ago only: yesterday is a plain missed day.
    const journal = journalOfDailyCounts([
      [daysAgo(4), 1],
      [TODAY, 1],
    ]);

    expect(getStreak(journal, TODAY, [pause(daysAgo(3), daysAgo(2))])).toBe(1);
  });

  it('several pauses, overlapping and in any order', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(6), 1],
      [TODAY, 1],
    ]);
    const pauses = [
      pause(daysAgo(2), daysAgo(1)),
      pause(daysAgo(5), daysAgo(4)),
      pause(daysAgo(4), daysAgo(2)),
    ];

    expect(getStreak(journal, TODAY, pauses)).toBe(2);
  });

  it('a pause without any reading before it gives no streak', () => {
    expect(getStreak(EMPTY_JOURNAL, TODAY, [pause(daysAgo(30), TODAY)])).toBe(0);
  });

  it('a pause in the future or long over changes nothing', () => {
    const journal = journalOfDailyCounts([
      [daysAgo(1), 1],
      [TODAY, 1],
    ]);
    const pauses = [pause(addDays(TODAY, 3), addDays(TODAY, 9)), pause(daysAgo(40), daysAgo(30))];

    expect(getStreak(journal, TODAY, pauses)).toBe(2);
  });

  it('a pause of many years is crossed without breaking the streak', () => {
    const longAgo = day('1999-12-31');
    const journal = journalOfDailyCounts([
      [longAgo, 1],
      [TODAY, 1],
    ]);

    expect(getStreak(journal, TODAY, [pause(day('2000-01-01'), daysAgo(1))])).toBe(2);
  });

  it('a pause across the new year', () => {
    const journal = journalOfDailyCounts([
      [day('2025-12-28'), 1],
      [day('2026-01-03'), 1],
    ]);
    const holidays = [pause(day('2025-12-29'), day('2026-01-02'))];

    expect(getStreak(journal, day('2026-01-03'), holidays)).toBe(2);
  });

  it('spec ambiguity: a paused day on which the user did read', () => {
    // 3 days ago watered, 2 days ago paused AND read, yesterday and today watered.
    // "Un jour en pause ... ne la fait pas avancer" read literally gives 3; counting the
    // reading of that day gives 4. The spec does not say: both are accepted here, and the
    // streak must never be broken by that day.
    const journal = journalOfDailyCounts([
      [daysAgo(3), 1],
      [daysAgo(2), 1],
      [daysAgo(1), 1],
      [TODAY, 1],
    ]);

    expect([3, 4]).toContain(getStreak(journal, TODAY, [pause(daysAgo(2), daysAgo(2))]));
  });

  it('spec ambiguity: today is paused and the user did read today', () => {
    // Yesterday watered, today paused AND read: 1 if a paused day never counts, 2 if the
    // reading of that day counts. Both are accepted; 0 would be a broken streak.
    const journal = journalOfDailyCounts([
      [daysAgo(1), 1],
      [TODAY, 1],
    ]);

    expect([1, 2]).toContain(getStreak(journal, TODAY, [pause(TODAY, TODAY)]));
  });

  it('a pause combined with a higher minimum per watered day', () => {
    // 2 pages needed. 4 days ago: 2 pages. 3 days ago: paused. 2 days ago: 1 page (dry,
    // not paused). Yesterday and today: 2 pages each. The dry day breaks the streak.
    const journal = journalOfDailyCounts([
      [daysAgo(4), 2],
      [daysAgo(2), 1],
      [daysAgo(1), 2],
      [TODAY, 2],
    ]);

    expect(getStreak(journal, TODAY, [pause(daysAgo(3), daysAgo(3))], wateredWith(2))).toBe(2);
    expect(getStreak(journal, TODAY, [pause(daysAgo(3), daysAgo(2))], wateredWith(2))).toBe(3);
  });
});
