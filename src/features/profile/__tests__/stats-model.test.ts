import { EMPTY_JOURNAL } from '@/domain/khatm';
import type { SecondsByDay } from '@/domain/stats';

import { buildProfileStats, STATS_METRICS } from '../stats-model';
import { buildFixtureTable, day, FIXTURE_PAGE, journalOf } from '../test-support/stats-fixtures';

const table = buildFixtureTable();
// A Wednesday.
const today = day('2026-11-25');

const time: SecondsByDay = {
  [day('2026-11-24')]: { app: 600, reader: 300 },
  [day('2026-11-25')]: { app: 120, reader: 60 },
  [day('2026-10-02')]: { app: 1000, reader: 900 },
};

function build(
  overrides: Partial<Parameters<typeof buildProfileStats>[0]> = {},
): ReturnType<typeof buildProfileStats> {
  return buildProfileStats({
    journal: journalOf([
      ['2026-10-02', 4],
      ['2026-11-24', 2],
      ['2026-11-25', 3],
    ]),
    table,
    timeSpent: time,
    period: 'week',
    metric: 'hasanat',
    today,
    ...overrides,
  });
}

describe('buildProfileStats › counts of the period', () => {
  it('adds the pages, words, verses and hasanat of the period, from the journal', () => {
    const stats = build();
    expect(stats.counts).toEqual({
      pages: 5,
      words: 5 * FIXTURE_PAGE.words,
      verses: 5 * FIXTURE_PAGE.verses,
      letters: 5 * FIXTURE_PAGE.letters,
      hasanatEstimate: 5 * FIXTURE_PAGE.letters * 10,
    });
  });

  it('adds the time of the period, in the app and in the reader', () => {
    expect(build().time).toEqual({ app: 720, reader: 360 });
    expect(build({ period: 'all-time' }).time).toEqual({ app: 1720, reader: 1260 });
    expect(build({ period: 'today' }).time).toEqual({ app: 120, reader: 60 });
  });
});

describe('buildProfileStats › empty state', () => {
  it('says nothing was ever read nor timed on a first launch', () => {
    const stats = build({ journal: EMPTY_JOURNAL, timeSpent: {} });
    expect(stats.hasAnything).toBe(false);
    expect(stats.khatmas).toEqual([]);
  });

  it('is not empty once time was counted, even without a page', () => {
    expect(build({ journal: EMPTY_JOURNAL }).hasAnything).toBe(true);
  });

  it('is not empty in a period without reading when something was read before', () => {
    const stats = build({
      period: 'today',
      journal: journalOf([['2026-10-02', 1]]),
      timeSpent: {},
    });
    expect(stats.hasAnything).toBe(true);
    expect(stats.counts.pages).toBe(0);
  });
});

describe('buildProfileStats › chart of the daily evolution', () => {
  it('today: the last seven days, ending today', () => {
    const { chart } = build({ period: 'today', metric: 'pages' });
    expect(chart.unit).toBe('day');
    expect(chart.bars.map((bar) => bar.start)).toEqual([
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
    ]);
    expect(chart.bars.map((bar) => bar.value)).toEqual([0, 0, 0, 0, 0, 2, 3]);
    expect(chart.bars.filter((bar) => bar.isCurrent).map((bar) => bar.start)).toEqual([
      '2026-11-25',
    ]);
  });

  it('week: Monday to Sunday, the days after today marked as to come', () => {
    const { chart } = build({ metric: 'pages' });
    expect(chart.bars.map((bar) => bar.start)[0]).toBe('2026-11-23');
    expect(chart.bars).toHaveLength(7);
    expect(chart.bars.map((bar) => bar.isFuture)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
  });

  it('month: every day of the month, 30 in November', () => {
    const { chart } = build({ period: 'month', metric: 'pages' });
    expect(chart.bars).toHaveLength(30);
    expect(chart.bars[0]?.start).toBe('2026-11-01');
    expect(chart.bars[29]?.start).toBe('2026-11-30');
  });

  it('all time: the last twelve months, one bar per month', () => {
    const { chart } = build({ period: 'all-time', metric: 'pages' });
    expect(chart.unit).toBe('month');
    expect(chart.bars).toHaveLength(12);
    expect(chart.bars[0]).toMatchObject({ start: '2025-12-01', end: '2025-12-31' });
    const october = chart.bars.find((bar) => bar.start === '2026-10-01');
    expect(october?.value).toBe(4);
    expect(chart.bars[11]).toMatchObject({ start: '2026-11-01', value: 5, isCurrent: true });
  });

  it('gives each metric its own values', () => {
    const lastBar = (metric: (typeof STATS_METRICS)[number]) =>
      build({ period: 'today', metric }).chart.bars[6]?.value;
    expect(lastBar('pages')).toBe(3);
    expect(lastBar('verses')).toBe(3 * FIXTURE_PAGE.verses);
    expect(lastBar('words')).toBe(3 * FIXTURE_PAGE.words);
    expect(lastBar('hasanat')).toBe(3 * FIXTURE_PAGE.letters * 10);
    expect(lastBar('readingTime')).toBe(60);
  });

  it('names the best bar, the earliest one when two are equal, and none when all are zero', () => {
    expect(build({ period: 'today', metric: 'pages' }).chart.best?.start).toBe('2026-11-25');
    const tie = build({
      period: 'today',
      metric: 'pages',
      journal: journalOf([
        ['2026-11-24', 2],
        ['2026-11-25', 2],
      ]),
    });
    expect(tie.chart.best?.start).toBe('2026-11-24');
    expect(build({ period: 'today', journal: EMPTY_JOURNAL, timeSpent: {} }).chart.best).toBeNull();
  });

  it('refuses a metric it does not know', () => {
    // A value from outside the type, as a damaged caller could pass.
    expect(() => build({ metric: 'letters' as never })).toThrow(RangeError);
  });
});

describe('buildProfileStats › per khatma', () => {
  it('lists the khatmas, the one in progress first, with their counts and their end', () => {
    const journal = journalOf([
      ['2026-09-01', 604],
      ['2026-11-25', 10],
    ]);
    const { khatmas } = build({ journal });
    expect(khatmas.map((khatma) => khatma.khatm)).toEqual([2, 1]);
    expect(khatmas[0]).toMatchObject({ isComplete: false, lastDate: '2026-11-25' });
    expect(khatmas[0]?.counts.pages).toBe(10);
    expect(khatmas[1]).toMatchObject({ isComplete: true, lastDate: '2026-09-01' });
    expect(khatmas[1]?.counts.verses).toBe(604 * FIXTURE_PAGE.verses);
  });
});
