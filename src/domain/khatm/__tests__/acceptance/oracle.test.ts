/**
 * Randomised comparison of the module with the tester's own, deliberately naive, reading of
 * docs/specs/khatm.md. Each scenario is a journal written directly (several khatmas, pages
 * in disorder, back-dated days, pauses) and every public function is compared with what
 * the rules give when applied by hand. The seeds make a failure replayable.
 *
 * Kept out of the scenarios, because the specification leaves them open: reading on a
 * paused day, and the estimate on a day whose pages belong to two khatmas.
 */
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
  recordPageRead,
  type GardenFeed,
  type HizbPageRange,
  type KhatmBadge,
  type KhatmProgress,
  type Pause,
  type ReadingEntry,
} from '@/domain/khatm';
import type { LocalDate } from '@/domain/shared/local-date';

import {
  day,
  EVEN_HIZB_RANGES,
  FIRST_PAGE,
  LAST_PAGE,
  pagesFrom,
  randomInteger,
  seededRandom,
  shuffled,
  TESTER_HIZB_RANGES,
} from './acceptance-kit';

const MS_PER_DAY = 86_400_000;
const FIRST_DAY_NUMBER = dayNumber(day('2025-01-01'));
const WINDOW_DAYS = 7;

/** Days since 1970-01-01: the tester's own calendar arithmetic, not the module's. */
function dayNumber(date: LocalDate): number {
  const [year = 0, month = 1, dayOfMonth = 1] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, dayOfMonth) / MS_PER_DAY;
}

function dateOfDayNumber(number: number): LocalDate {
  return day(new Date(number * MS_PER_DAY).toISOString().slice(0, 10));
}

interface Scenario {
  readonly journal: readonly ReadingEntry[];
  readonly today: LocalDate;
  readonly pauses: readonly Pause[];
  readonly minPagesPerWateredDay: number;
  readonly dailyGoalPages: number;
}

function isPaused(pauses: readonly Pause[], date: LocalDate): boolean {
  return pauses.some((pause) => pause.from <= date && date <= pause.to);
}

/**
 * A period of 1 to 120 days ending today, up to 3 pauses, reading on a share of the days
 * that are not paused (1 to 40 new pages a day). Entry number i belongs to khatma
 * floor(i / 604) + 1, and each khatma takes its pages in its own random order. One time in
 * three the days are recorded out of calendar order (back-dated reads).
 */
function buildScenario(seed: number): Scenario {
  const random = seededRandom(seed);
  const periodDays = randomInteger(random, 1, 120);
  const todayNumber = FIRST_DAY_NUMBER + periodDays;

  const pauses = Array.from({ length: randomInteger(random, 0, 3) }, () => {
    const from = FIRST_DAY_NUMBER + randomInteger(random, 0, periodDays);
    const lengthDays = randomInteger(random, 1, 10);
    return { from: dateOfDayNumber(from), to: dateOfDayNumber(from + lengthDays - 1) };
  });

  const readingShare = randomInteger(random, 30, 95) / 100;
  let readingDays = pagesFrom(FIRST_DAY_NUMBER, todayNumber)
    .map(dateOfDayNumber)
    .filter((date) => !isPaused(pauses, date) && random() < readingShare);
  if (randomInteger(random, 1, 3) === 1) readingDays = shuffled(readingDays, random);

  const journal: ReadingEntry[] = [];
  let pageOrder: number[] = [];
  for (const date of readingDays) {
    const count = randomInteger(random, 1, 40);
    for (let read = 0; read < count; read += 1) {
      const position = journal.length % LAST_PAGE;
      if (position === 0) pageOrder = shuffled(pagesFrom(FIRST_PAGE, LAST_PAGE), random);
      const page = pageOrder[position] ?? FIRST_PAGE;
      journal.push({ khatm: Math.floor(journal.length / LAST_PAGE) + 1, page, date });
    }
  }

  return {
    journal,
    today: dateOfDayNumber(todayNumber),
    pauses,
    minPagesPerWateredDay: randomInteger(random, 1, 3),
    dailyGoalPages: randomInteger(random, 1, 45),
  };
}

// ----- The rules, applied naively -----

function entriesOfKhatma(journal: readonly ReadingEntry[], khatm: number): ReadingEntry[] {
  return journal.filter((entry) => entry.khatm === khatm);
}

function oldestDate(entries: readonly ReadingEntry[]): LocalDate | null {
  return entries.reduce<LocalDate | null>(
    (oldest, entry) => (oldest === null || entry.date < oldest ? entry.date : oldest),
    null,
  );
}

function latestDate(entries: readonly ReadingEntry[]): LocalDate | null {
  return entries.reduce<LocalDate | null>(
    (latest, entry) => (latest === null || entry.date > latest ? entry.date : latest),
    null,
  );
}

function newPagesPerDay(journal: readonly ReadingEntry[]): Map<LocalDate, number> {
  const counts = new Map<LocalDate, number>();
  for (const entry of journal) counts.set(entry.date, (counts.get(entry.date) ?? 0) + 1);
  return counts;
}

/** Rule 6. */
function expectedWateredDays(journal: readonly ReadingEntry[], minPages: number): Set<LocalDate> {
  const watered = new Set<LocalDate>();
  for (const [date, count] of newPagesPerDay(journal)) if (count >= minPages) watered.add(date);
  return watered;
}

/** Rule 7. No scenario has an entry before FIRST_DAY_NUMBER, so the walk stops there. */
function expectedStreak(scenario: Scenario, watered: ReadonlySet<LocalDate>): number {
  const todayNumber = dayNumber(scenario.today);
  let streak = 0;
  // "ou hier si aujourd'hui n'est pas encore arrosé": the day in progress never breaks it.
  let cursor = watered.has(scenario.today) ? todayNumber : todayNumber - 1;
  while (cursor >= FIRST_DAY_NUMBER) {
    const date = dateOfDayNumber(cursor);
    if (watered.has(date)) streak += 1;
    else if (!isPaused(scenario.pauses, date)) break;
    cursor -= 1;
  }
  return streak;
}

/** Rules 2 and 3. */
function expectedProgress(
  journal: readonly ReadingEntry[],
  khatm: number,
  ranges: readonly HizbPageRange[],
): KhatmProgress {
  const read = new Set(entriesOfKhatma(journal, khatm).map((entry) => entry.page));
  const readIn = (range: HizbPageRange): number =>
    pagesFrom(range.firstPage, range.lastPage).filter((page) => read.has(page)).length;
  const sizeOf = (range: HizbPageRange): number => range.lastPage - range.firstPage + 1;
  const unfinished = ranges.filter((range) => readIn(range) < sizeOf(range));
  const current = unfinished[0];
  return {
    khatm,
    pagesRead: read.size,
    pagesRemaining: LAST_PAGE - read.size,
    fraction: read.size / LAST_PAGE,
    hizbCompleted: ranges.length - unfinished.length,
    currentHizb: current ? current.hizb : null,
    currentHizbProgress: current ? readIn(current) / sizeOf(current) : 0,
    firstUnreadPage: pagesFrom(FIRST_PAGE, LAST_PAGE).find((page) => !read.has(page)) ?? null,
    isComplete: read.size === LAST_PAGE,
  };
}

/** Rule 9. */
function expectedBadges(journal: readonly ReadingEntry[]): KhatmBadge[] {
  const completedCount = Math.floor(journal.length / LAST_PAGE);
  return pagesFrom(1, completedCount).map((khatm) => {
    const entries = entriesOfKhatma(journal, khatm);
    const startedOn = oldestDate(entries) ?? day('1970-01-01');
    const completedOn = latestDate(entries) ?? day('1970-01-01');
    return {
      khatm,
      startedOn,
      completedOn,
      daysTaken: dayNumber(completedOn) - dayNumber(startedOn) + 1,
    };
  });
}

/** Rule 10. */
function expectedGardenFeed(
  journal: readonly ReadingEntry[],
  ranges: readonly HizbPageRange[],
  minPages: number,
): GardenFeed {
  const khatmaInProgress = Math.floor(journal.length / LAST_PAGE) + 1;
  const hasStarted = journal.length % LAST_PAGE > 0;
  // The complete garden stays on display until the first page of the next khatma.
  const khatm = hasStarted || khatmaInProgress === 1 ? khatmaInProgress : khatmaInProgress - 1;
  const entries = entriesOfKhatma(journal, khatm);
  const progress = expectedProgress(journal, khatm, ranges);
  const startDate = oldestDate(entries);

  const dateOfPage = new Map(entries.map((entry) => [entry.page, entry.date]));
  const completionDays = ranges
    .map((range) => pagesFrom(range.firstPage, range.lastPage).map((page) => dateOfPage.get(page)))
    .filter((dates): dates is LocalDate[] => dates.every((date) => date !== undefined))
    // A hizb is completed on the most recent date among its pages.
    .map((dates) => dates.reduce((latest, date) => (date > latest ? date : latest)));
  const firstHizbCompletedOn = completionDays.reduce<LocalDate | null>(
    (first, date) => (first === null || date < first ? date : first),
    null,
  );

  return {
    khatm,
    hizbCompleted: progress.hizbCompleted,
    currentHizbProgress: progress.currentHizbProgress,
    startDate,
    wateredDays: new Set(
      [...expectedWateredDays(journal, minPages)].filter(
        (date) => startDate !== null && date >= startDate,
      ),
    ),
    firstHizbCompletedOn,
    completedOn: progress.isComplete ? latestDate(entries) : null,
  };
}

/**
 * Rule 8 in whole numbers, so that no rounding can hide in the expected value. The pace is
 * `pagesPerPeriod / periodDays` (a daily goal G is G / 1; the recent average is S / 7).
 * Returns the number of days after today, or null when the pace is zero.
 */
function expectedDaysToFinish(
  remaining: number,
  readToday: number,
  pagesPerPeriod: number,
  periodDays: number,
): number | null {
  if (pagesPerPeriod === 0) return null;
  // Everything is multiplied by periodDays: rest of the day = max(0, pace − readToday).
  const restOfDay = Math.max(0, pagesPerPeriod - readToday * periodDays);
  const stillToRead = remaining * periodDays - restOfDay;
  if (stillToRead <= 0) return 0;
  return Math.floor((stillToRead + pagesPerPeriod - 1) / pagesPerPeriod);
}

const SEEDS = pagesFrom(1, 150);

/** Runs a check on every scenario; a failure says which seed replays it. */
function forEachScenario(check: (scenario: Scenario) => void): void {
  for (const seed of SEEDS) {
    try {
      check(buildScenario(seed));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Scenario of seed ${seed} breaks a rule:\n${reason}`);
    }
  }
}

describe('Randomised scenarios against the rules applied by hand (150 seeds each)', () => {
  it('the scenarios cover what they are meant to cover', () => {
    const scenarios = SEEDS.map(buildScenario);
    const isBackDated = ({ journal }: Scenario): boolean =>
      journal.some((entry, index) => entry.date < (journal[index - 1]?.date ?? entry.date));

    expect(scenarios.some((scenario) => scenario.journal.length > 2 * LAST_PAGE)).toBe(true);
    expect(scenarios.some((scenario) => scenario.journal.length < LAST_PAGE)).toBe(true);
    expect(scenarios.some((scenario) => scenario.pauses.length > 0)).toBe(true);
    expect(scenarios.some((scenario) => scenario.pauses.length === 0)).toBe(true);
    expect(scenarios.some(isBackDated)).toBe(true);
    expect(scenarios.some((scenario) => !isBackDated(scenario))).toBe(true);
  });

  it('journal, progress of every khatma, today and watered days', () => {
    forEachScenario(({ journal, today, minPagesPerWateredDay, dailyGoalPages }) => {
      const config = { ...DEFAULT_KHATM_CONFIG, minPagesPerWateredDay };
      const khatmaInProgress = Math.floor(journal.length / LAST_PAGE) + 1;
      const readToday = newPagesPerDay(journal).get(today) ?? 0;

      expect(getCurrentKhatm(journal)).toBe(khatmaInProgress);
      for (let khatm = 1; khatm <= khatmaInProgress; khatm += 1) {
        const pages = entriesOfKhatma(journal, khatm).map((entry) => entry.page);
        expect(getReadPages(journal, khatm)).toEqual(new Set(pages));
        for (const ranges of [TESTER_HIZB_RANGES, EVEN_HIZB_RANGES]) {
          expect(getKhatmProgress(journal, khatm, ranges)).toStrictEqual(
            expectedProgress(journal, khatm, ranges),
          );
        }
      }
      expect(getTodayProgress(journal, today, dailyGoalPages)).toStrictEqual({
        pagesRead: readToday,
        goalPages: dailyGoalPages,
        pagesRemaining: Math.max(0, dailyGoalPages - readToday),
        goalReached: readToday >= dailyGoalPages,
      });
      expect(getWateredDays(journal, config)).toEqual(
        expectedWateredDays(journal, minPagesPerWateredDay),
      );
    });
  });

  it('streak, with today moved back day by day over the last 12 days', () => {
    forEachScenario((scenario) => {
      const config = {
        ...DEFAULT_KHATM_CONFIG,
        minPagesPerWateredDay: scenario.minPagesPerWateredDay,
      };
      const watered = expectedWateredDays(scenario.journal, scenario.minPagesPerWateredDay);

      // Entries dated after the "today" that is asked about must not count.
      for (let daysBack = 0; daysBack <= 12; daysBack += 1) {
        const today = dateOfDayNumber(dayNumber(scenario.today) - daysBack);
        expect({
          today,
          streak: getStreak(scenario.journal, today, scenario.pauses, config),
        }).toStrictEqual({ today, streak: expectedStreak({ ...scenario, today }, watered) });
      }
    });
  });

  it('badges and garden feed', () => {
    forEachScenario(({ journal, minPagesPerWateredDay }) => {
      const config = { ...DEFAULT_KHATM_CONFIG, minPagesPerWateredDay };

      expect(getBadges(journal)).toStrictEqual(expectedBadges(journal));
      for (const ranges of [TESTER_HIZB_RANGES, EVEN_HIZB_RANGES]) {
        expect(getGardenFeed(journal, ranges, config)).toStrictEqual(
          expectedGardenFeed(journal, ranges, minPagesPerWateredDay),
        );
      }
    });
  });

  it('estimated finish date, with the daily goal and with the recent average', () => {
    let compared = 0;
    forEachScenario(({ journal, today, dailyGoalPages }) => {
      const khatm = Math.floor(journal.length / LAST_PAGE) + 1;
      const todayNumber = dayNumber(today);
      const perDay = newPagesPerDay(journal);
      const readToday = perDay.get(today) ?? 0;
      const khatmasReadToday = new Set(
        journal.filter((entry) => entry.date === today).map((entry) => entry.khatm),
      );
      // Left open by the specification: see the header of this file.
      if (khatmasReadToday.size > 1) return;

      const remaining = LAST_PAGE - entriesOfKhatma(journal, khatm).length;
      const readInWindow = pagesFrom(1, WINDOW_DAYS)
        .map((daysBack) => perDay.get(dateOfDayNumber(todayNumber - daysBack)) ?? 0)
        .reduce((sum, count) => sum + count, 0);
      const toDate = (days: number | null): LocalDate | null =>
        days === null ? null : dateOfDayNumber(todayNumber + days);

      expect(
        estimateFinishDate(journal, khatm, today, { kind: 'daily-goal', dailyGoalPages }),
      ).toBe(toDate(expectedDaysToFinish(remaining, readToday, dailyGoalPages, 1)));
      expect(estimateFinishDate(journal, khatm, today, { kind: 'recent-average' })).toBe(
        toDate(expectedDaysToFinish(remaining, readToday, readInWindow, WINDOW_DAYS)),
      );
      compared += 1;
    });

    expect(compared).toBeGreaterThan(140);
  });

  it('the next page goes to the khatma in progress; a page already read changes nothing', () => {
    forEachScenario(({ journal, today }) => {
      const khatm = Math.floor(journal.length / LAST_PAGE) + 1;
      const read = getReadPages(journal, khatm);
      const unreadPage = pagesFrom(FIRST_PAGE, LAST_PAGE).find((page) => !read.has(page));
      const readPage = [...read][0];

      if (unreadPage !== undefined) {
        const after = recordPageRead(journal, { page: unreadPage, date: today });
        expect(after).toHaveLength(journal.length + 1);
        expect(after).toContainEqual({ khatm, page: unreadPage, date: today });
      }
      if (readPage !== undefined) {
        expect(recordPageRead(journal, { page: readPage, date: today })).toStrictEqual(journal);
      }
    });
  });
});
