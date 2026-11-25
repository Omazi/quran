/**
 * What the statistics section of the profile shows, as plain numbers: the counts of a period,
 * the time of that period, the bars of the daily evolution of one figure, and each khatma.
 * Pure: the day is a parameter, and nothing here formats a word (the screen does).
 * Every count comes from `src/domain/stats` (docs/specs/stats.md).
 */

import type { ReadingJournal } from '@/domain/khatm';
import { addDays, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';
import {
  getDailyReadingStats,
  getKhatmStats,
  getReadingStats,
  getSecondsInPeriod,
  type DayReadingStats,
  type DaySeconds,
  type PageStatsTable,
  type ReadingCounts,
  type SecondsByDay,
  type StatsPeriod,
} from '@/domain/stats';

import { PROFILE_STATS_CONFIG } from './config';

/** The figures the chart can follow. Reading time is in seconds. */
export const STATS_METRICS = ['hasanat', 'verses', 'words', 'pages', 'readingTime'] as const;
export type StatsMetric = (typeof STATS_METRICS)[number];

export const STATS_PERIODS: readonly StatsPeriod[] = ['today', 'week', 'month', 'all-time'];

/** One bar: a day, or a month for the whole history. */
export interface ChartBar {
  /** First day the bar covers; its key. */
  readonly start: LocalDate;
  /** Last day the bar covers (the same day for a day bar). */
  readonly end: LocalDate;
  readonly value: number;
  /** The bar that holds today. */
  readonly isCurrent: boolean;
  /** A day after today, shown as a slot without a bar. */
  readonly isFuture: boolean;
}

export interface StatsChart {
  readonly unit: 'day' | 'month';
  readonly bars: readonly ChartBar[];
  /** The highest bar above zero, the earliest of equals; null when every bar is zero. */
  readonly best: ChartBar | null;
}

export interface KhatmaSummary {
  readonly khatm: number;
  readonly counts: ReadingCounts;
  readonly isComplete: boolean;
  /** Day of its last page read so far: the day it ended when it is complete. */
  readonly lastDate: LocalDate;
}

export interface ProfileStats {
  /** False on a first launch: no page read and no time counted, ever. */
  readonly hasAnything: boolean;
  readonly counts: ReadingCounts;
  readonly time: DaySeconds;
  readonly chart: StatsChart;
  /** The khatma in progress first. */
  readonly khatmas: readonly KhatmaSummary[];
}

export interface ProfileStatsInput {
  readonly journal: ReadingJournal;
  readonly table: PageStatsTable;
  readonly timeSpent: SecondsByDay;
  readonly period: StatsPeriod;
  readonly metric: StatsMetric;
  readonly today: LocalDate;
}

function assertMetric(metric: string): asserts metric is StatsMetric {
  if (!(STATS_METRICS as readonly string[]).includes(metric)) {
    throw new RangeError(`Invalid metric: ${JSON.stringify(metric)}`);
  }
}

const MONTH_PREFIX_LENGTH = 'YYYY-MM'.length;

function firstOfMonth(date: LocalDate): LocalDate {
  return parseLocalDate(`${date.slice(0, MONTH_PREFIX_LENGTH)}-01`);
}

/** The first day of the month `months` months away from the month of `date`. */
function shiftMonth(date: LocalDate, months: number): LocalDate {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + months;
  const shifted = new Date(Date.UTC(year, month, 1));
  return parseLocalDate(shifted.toISOString().slice(0, 'YYYY-MM-DD'.length));
}

function lastOfMonth(date: LocalDate): LocalDate {
  return addDays(shiftMonth(date, 1), -1);
}

/** Days since Monday: 0 on a Monday, 6 on a Sunday. */
function weekdayFromMonday(date: LocalDate): number {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (weekday + 6) % 7;
}

function valueOfDay(
  metric: StatsMetric,
  counts: DayReadingStats | undefined,
  seconds: DaySeconds | undefined,
): number {
  switch (metric) {
    case 'hasanat':
      return counts?.hasanatEstimate ?? 0;
    case 'verses':
      return counts?.verses ?? 0;
    case 'words':
      return counts?.words ?? 0;
    case 'pages':
      return counts?.pages ?? 0;
    case 'readingTime':
      return seconds?.reader ?? 0;
  }
}

/** The days a chart covers for a period, and whether its bars are days or months. */
function chartRange(
  period: StatsPeriod,
  today: LocalDate,
): { unit: 'day' | 'month'; from: LocalDate; to: LocalDate } {
  switch (period) {
    case 'today':
      return {
        unit: 'day',
        from: addDays(today, 1 - PROFILE_STATS_CONFIG.daysShownForToday),
        to: today,
      };
    case 'week': {
      const monday = addDays(today, -weekdayFromMonday(today));
      return { unit: 'day', from: monday, to: addDays(monday, 6) };
    }
    case 'month':
      return { unit: 'day', from: firstOfMonth(today), to: lastOfMonth(today) };
    case 'all-time':
      return {
        unit: 'month',
        from: shiftMonth(today, 1 - PROFILE_STATS_CONFIG.monthsShownForAllTime),
        to: lastOfMonth(today),
      };
    default:
      throw new RangeError(`Invalid period: ${JSON.stringify(period)}`);
  }
}

function buildChart(input: ProfileStatsInput): StatsChart {
  const { journal, table, timeSpent, period, metric, today } = input;
  const { unit, from, to } = chartRange(period, today);
  // Days after today hold nothing yet: the domain is only asked up to today.
  const lastCounted = to < today ? to : today;
  const daily = getDailyReadingStats(journal, table, from, lastCounted);
  const countsByDay = new Map(daily.map((counts) => [counts.date, counts]));
  const dayValue = (date: LocalDate) => valueOfDay(metric, countsByDay.get(date), timeSpent[date]);

  const bars: ChartBar[] = [];
  if (unit === 'day') {
    for (let date = from; date <= to; date = addDays(date, 1)) {
      bars.push({
        start: date,
        end: date,
        value: date > today ? 0 : dayValue(date),
        isCurrent: date === today,
        isFuture: date > today,
      });
    }
  } else {
    for (let start = from; start <= to; start = shiftMonth(start, 1)) {
      const end = lastOfMonth(start);
      let value = 0;
      for (let date = start; date <= end && date <= today; date = addDays(date, 1)) {
        value += dayValue(date);
      }
      bars.push({ start, end, value, isCurrent: start <= today && today <= end, isFuture: false });
    }
  }

  const best = bars.reduce<ChartBar | null>(
    (highest, bar) => (bar.value > (highest?.value ?? 0) ? bar : highest),
    null,
  );
  return { unit, bars, best };
}

function buildKhatmas(journal: ReadingJournal, table: PageStatsTable): KhatmaSummary[] {
  const lastDates = new Map<number, LocalDate>();
  const pageCounts = new Map<number, number>();
  for (const entry of journal) {
    const previous = lastDates.get(entry.khatm);
    if (previous === undefined || entry.date > previous) lastDates.set(entry.khatm, entry.date);
    pageCounts.set(entry.khatm, (pageCounts.get(entry.khatm) ?? 0) + 1);
  }
  return [...lastDates.keys()]
    .sort((a, b) => b - a)
    .map((khatm) => ({
      khatm,
      counts: getKhatmStats(journal, table, khatm),
      isComplete: pageCounts.get(khatm) === table.length,
      // Present: the keys come from this map.
      lastDate: lastDates.get(khatm) as LocalDate,
    }));
}

/** The whole statistics section for one period and one chart figure. */
export function buildProfileStats(input: ProfileStatsInput): ProfileStats {
  assertMetric(input.metric);
  const { journal, table, timeSpent, period, today } = input;
  return {
    hasAnything: journal.length > 0 || Object.keys(timeSpent).length > 0,
    counts: getReadingStats(journal, table, period, today),
    time: getSecondsInPeriod(timeSpent, period, today),
    chart: buildChart(input),
    khatmas: buildKhatmas(journal, table),
  };
}
