import * as stats from '../index';

describe('Public API of the stats module', () => {
  it('exposes the functions and constants of docs/specs/stats.md, and nothing else', () => {
    expect(Object.keys(stats).sort()).toEqual([
      'HASANAT_PER_LETTER',
      'HASANAT_SOURCE',
      'MAX_DAILY_RANGE_DAYS',
      'MAX_SECONDS_PER_DAY',
      'buildPageStatsTable',
      'countLetters',
      'getDailyReadingStats',
      'getKhatmStats',
      'getMushafTotals',
      'getPeriodRange',
      'getReadingStats',
      'getSecondsInPeriod',
      'isDateInRange',
      'isDaySeconds',
    ]);
  });
});
