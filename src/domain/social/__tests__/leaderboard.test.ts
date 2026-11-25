import {
  computeLeaderboard,
  periodRange,
  type DailyReading,
  type LeaderboardPeriod,
} from '../index';
import {
  day,
  IMPOSSIBLE_DAY,
  MUSTAPHA,
  OMAR,
  SARAH,
  TAGHREAD,
  TODAY,
} from '../test-support/social-test-kit';

const WEEK: LeaderboardPeriod = { kind: 'week', day: TODAY };
const MONTH: LeaderboardPeriod = { kind: 'month', day: TODAY };

function reading(userId: string, date: string, newPages: number): DailyReading {
  return { userId, day: day(date), newPages };
}

describe('Rule 9 — group leaderboard (classement)', () => {
  describe('the period', () => {
    it('a week runs from Monday to Sunday, around any day of it', () => {
      const expected = { from: day('2026-11-23'), to: day('2026-11-29') };

      for (const date of ['2026-11-23', '2026-11-24', '2026-11-29']) {
        expect(periodRange({ kind: 'week', day: day(date) })).toEqual(expected);
      }
    });

    it('the Monday after a Sunday starts a new week', () => {
      expect(periodRange({ kind: 'week', day: day('2026-11-30') })).toEqual({
        from: day('2026-11-30'),
        to: day('2026-12-06'),
      });
    });

    it('a week can cross the new year', () => {
      expect(periodRange({ kind: 'week', day: day('2026-12-31') })).toEqual({
        from: day('2026-12-28'),
        to: day('2027-01-03'),
      });
    });

    it('a week before the reference Monday is still Monday to Sunday', () => {
      expect(periodRange({ kind: 'week', day: day('2023-12-31') })).toEqual({
        from: day('2023-12-25'),
        to: day('2023-12-31'),
      });
    });

    it('a month runs from its first day to its last, whatever its length', () => {
      expect(periodRange(MONTH)).toEqual({ from: day('2026-11-01'), to: day('2026-11-30') });
      expect(periodRange({ kind: 'month', day: day('2026-12-15') })).toEqual({
        from: day('2026-12-01'),
        to: day('2026-12-31'),
      });
      expect(periodRange({ kind: 'month', day: day('2024-02-10') })).toEqual({
        from: day('2024-02-01'),
        to: day('2024-02-29'),
      });
      expect(periodRange({ kind: 'month', day: day('2026-02-10') })).toEqual({
        from: day('2026-02-01'),
        to: day('2026-02-28'),
      });
    });

    it('refuses an unknown kind and an impossible day', () => {
      expect(() => periodRange({ kind: 'year' as 'week', day: TODAY })).toThrow(RangeError);
      expect(() => periodRange({ kind: 'week', day: IMPOSSIBLE_DAY })).toThrow(RangeError);
    });
  });

  describe('the sums', () => {
    const MEMBERS = [OMAR, MUSTAPHA, SARAH];

    it('adds the new pages of each member over the period, both ends included', () => {
      const entries = computeLeaderboard(
        MEMBERS,
        [
          reading(OMAR, '2026-11-23', 10), // Monday
          reading(OMAR, '2026-11-29', 5), // Sunday
          reading(OMAR, '2026-11-22', 100), // the Sunday before: out
          reading(OMAR, '2026-11-30', 100), // the Monday after: out
          reading(MUSTAPHA, '2026-11-24', 20),
        ],
        WEEK,
      );

      expect(entries).toEqual([
        { userId: MUSTAPHA, newPages: 20, rank: 1 },
        { userId: OMAR, newPages: 15, rank: 2 },
        { userId: SARAH, newPages: 0, rank: 3 },
      ]);
    });

    it('a member who read nothing is listed with 0', () => {
      expect(computeLeaderboard(MEMBERS, [], WEEK)).toEqual([
        { userId: MUSTAPHA, newPages: 0, rank: 1 },
        { userId: OMAR, newPages: 0, rank: 1 },
        { userId: SARAH, newPages: 0, rank: 1 },
      ]);
    });

    it('a month counts the whole month, which a week does not', () => {
      const readings = [reading(OMAR, '2026-11-02', 30), reading(OMAR, '2026-11-24', 10)];

      expect(computeLeaderboard([OMAR], readings, MONTH)).toEqual([
        { userId: OMAR, newPages: 40, rank: 1 },
      ]);
      expect(computeLeaderboard([OMAR], readings, WEEK)).toEqual([
        { userId: OMAR, newPages: 10, rank: 1 },
      ]);
    });

    it('rank 1 goes to the most pages; equal sums share a rank and the next rank skips', () => {
      const entries = computeLeaderboard(
        [OMAR, MUSTAPHA, SARAH, TAGHREAD],
        [
          reading(OMAR, '2026-11-24', 20),
          reading(MUSTAPHA, '2026-11-24', 20),
          reading(SARAH, '2026-11-24', 5),
        ],
        WEEK,
      );

      expect(entries.map((entry) => [entry.userId, entry.rank])).toEqual([
        [MUSTAPHA, 1],
        [OMAR, 1],
        [SARAH, 3],
        [TAGHREAD, 4],
      ]);
    });

    it('readings of people who are not members are ignored', () => {
      expect(computeLeaderboard([OMAR], [reading(SARAH, '2026-11-24', 99)], WEEK)).toEqual([
        { userId: OMAR, newPages: 0, rank: 1 },
      ]);
    });

    it('a group without member has an empty leaderboard', () => {
      expect(computeLeaderboard([], [], WEEK)).toEqual([]);
    });

    it('does not change what it receives', () => {
      const members = [SARAH, OMAR];
      const readings = [reading(OMAR, '2026-11-24', 1)];
      computeLeaderboard(members, readings, WEEK);

      expect(members).toEqual([SARAH, OMAR]);
    });
  });

  describe('invalid data is refused, wherever it is', () => {
    it.each([
      ['a negative number of pages', -1],
      ['more than 604 pages', 605],
      ['a fractional number of pages', 1.5],
      ['pages that are NaN', Number.NaN],
    ])('%s is a RangeError', (_label, newPages) => {
      expect(() =>
        computeLeaderboard([OMAR], [reading(OMAR, '2026-11-24', newPages)], WEEK),
      ).toThrow(RangeError);
    });

    it('even outside the period or for a person who is not a member', () => {
      expect(() => computeLeaderboard([OMAR], [reading(OMAR, '2025-01-01', -1)], WEEK)).toThrow(
        RangeError,
      );
      expect(() => computeLeaderboard([OMAR], [reading(SARAH, '2026-11-24', 605)], WEEK)).toThrow(
        RangeError,
      );
    });

    it('0 and 604 pages in a day are accepted', () => {
      const entries = computeLeaderboard(
        [OMAR, SARAH],
        [reading(OMAR, '2026-11-24', 0), reading(SARAH, '2026-11-24', 604)],
        WEEK,
      );

      expect(entries.map((entry) => entry.newPages)).toEqual([604, 0]);
    });

    it('a number given as text is a TypeError', () => {
      const bad = { userId: OMAR, day: TODAY, newPages: '5' } as unknown as DailyReading;

      expect(() => computeLeaderboard([OMAR], [bad], WEEK)).toThrow(TypeError);
    });

    it('two rows for one person and one day are a RangeError: one row per person and per day', () => {
      const twice = [reading(OMAR, '2026-11-24', 1), reading(OMAR, '2026-11-24', 2)];

      expect(() => computeLeaderboard([OMAR], twice, WEEK)).toThrow(RangeError);
    });

    it('the same member twice is a RangeError', () => {
      expect(() => computeLeaderboard([OMAR, OMAR], [], WEEK)).toThrow(RangeError);
    });

    it('an impossible reading day is a RangeError', () => {
      const bad: DailyReading = { userId: OMAR, day: IMPOSSIBLE_DAY, newPages: 1 };

      expect(() => computeLeaderboard([OMAR], [bad], WEEK)).toThrow(RangeError);
    });
  });
});
