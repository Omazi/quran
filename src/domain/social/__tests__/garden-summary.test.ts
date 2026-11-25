import { addDays } from '@/domain/shared/local-date';

import {
  toBadge,
  toBadges,
  toDailyReading,
  toGardenSummary,
  type GardenSummary,
  type GardenSummaryInput,
} from '../index';
import { day, IMPOSSIBLE_DAY, NOT_AN_OBJECT, OMAR, TODAY } from '../test-support/social-test-kit';

const INPUT: GardenSummaryInput = {
  khatmNumber: 2,
  hizbCompleted: 17,
  health: 0.5,
  lastWateredOn: day('2026-11-23'),
  streakDays: 4,
  badgeCount: 1,
  wordsRead: 99_367,
  versesRead: 8000,
  hasanatEstimate: 4_272_781,
};

function withInput(
  changes: Partial<Record<keyof GardenSummaryInput, unknown>>,
): GardenSummaryInput {
  return { ...INPUT, ...changes } as GardenSummaryInput;
}

describe('Rule 5 — garden summary (toGardenSummary)', () => {
  it('is made of the values given by the other modules, dated today', () => {
    const expected: GardenSummary = {
      userId: OMAR,
      level: 2,
      hizbCompleted: 17,
      health: 0.5,
      lastWateredOn: day('2026-11-23'),
      streakDays: 4,
      badgeCount: 1,
      wordsRead: 99_367,
      versesRead: 8000,
      hasanatEstimate: 4_272_781,
      updatedOn: TODAY,
    };

    expect(toGardenSummary(OMAR, INPUT, TODAY)).toEqual(expected);
  });

  it('holds exactly the fields of the model: no page number, no hour, nothing else', () => {
    // An app that passes more than it should (a page, a time) does not get it published.
    const crowded = {
      ...INPUT,
      page: 12,
      lastReadAt: '2026-11-24T05:10:00Z',
    } as GardenSummaryInput;

    expect(Object.keys(toGardenSummary(OMAR, crowded, TODAY)).sort()).toEqual(
      [
        'badgeCount',
        'health',
        'hasanatEstimate',
        'hizbCompleted',
        'lastWateredOn',
        'level',
        'streakDays',
        'updatedOn',
        'userId',
        'versesRead',
        'wordsRead',
      ].sort(),
    );
    expect(JSON.stringify(toGardenSummary(OMAR, crowded, TODAY))).not.toMatch(/page|At"/);
  });

  it('a garden never watered has no last watered day', () => {
    expect(
      toGardenSummary(OMAR, withInput({ lastWateredOn: null }), TODAY).lastWateredOn,
    ).toBeNull();
  });

  it('accepts the edges: no hizb and dead earth, 60 hizb and full health', () => {
    expect(toGardenSummary(OMAR, withInput({ hizbCompleted: 0, health: 0 }), TODAY)).toMatchObject({
      hizbCompleted: 0,
      health: 0,
    });
    expect(toGardenSummary(OMAR, withInput({ hizbCompleted: 60, health: 1 }), TODAY)).toMatchObject(
      { hizbCompleted: 60, health: 1 },
    );
  });

  it('a garden watered today is accepted; one watered tomorrow is not (a phone has one day)', () => {
    expect(toGardenSummary(OMAR, withInput({ lastWateredOn: TODAY }), TODAY).lastWateredOn).toBe(
      TODAY,
    );
    expect(() =>
      toGardenSummary(OMAR, withInput({ lastWateredOn: addDays(TODAY, 1) }), TODAY),
    ).toThrow(RangeError);
  });

  it('accepts the edges of the reading counters: all zero, and the largest safe integer', () => {
    const zero = { wordsRead: 0, versesRead: 0, hasanatEstimate: 0 };
    expect(toGardenSummary(OMAR, withInput(zero), TODAY)).toMatchObject(zero);
    const largest = {
      wordsRead: Number.MAX_SAFE_INTEGER,
      versesRead: Number.MAX_SAFE_INTEGER,
      hasanatEstimate: Number.MAX_SAFE_INTEGER,
    };
    expect(toGardenSummary(OMAR, withInput(largest), TODAY)).toMatchObject(largest);
  });

  describe('invalid input', () => {
    it.each([
      ['hizbCompleted below 0', { hizbCompleted: -1 }],
      ['hizbCompleted above 60', { hizbCompleted: 61 }],
      ['a fractional hizbCompleted', { hizbCompleted: 1.5 }],
      ['health below 0', { health: -0.01 }],
      ['health above 1', { health: 1.01 }],
      ['health that is NaN', { health: Number.NaN }],
      ['level 0', { khatmNumber: 0 }],
      ['a fractional level', { khatmNumber: 1.5 }],
      ['a negative streak', { streakDays: -1 }],
      ['a streak that is infinite', { streakDays: Number.POSITIVE_INFINITY }],
      ['a negative badge count', { badgeCount: -1 }],
      ['a negative number of words read', { wordsRead: -1 }],
      ['a fractional number of words read', { wordsRead: 1.5 }],
      ['a number of words read beyond a safe integer', { wordsRead: Number.MAX_SAFE_INTEGER + 1 }],
      ['a negative number of verses read', { versesRead: -1 }],
      ['a fractional number of verses read', { versesRead: 0.5 }],
      ['verses read that are NaN', { versesRead: Number.NaN }],
      ['a negative hasanat estimate', { hasanatEstimate: -10 }],
      ['a hasanat estimate that is infinite', { hasanatEstimate: Number.POSITIVE_INFINITY }],
      ['an impossible last watered day', { lastWateredOn: IMPOSSIBLE_DAY }],
    ])('refuses %s with a RangeError', (_label, changes) => {
      expect(() => toGardenSummary(OMAR, withInput(changes), TODAY)).toThrow(RangeError);
    });

    it('refuses a reading counter given as text, or missing, with a TypeError', () => {
      expect(() => toGardenSummary(OMAR, withInput({ wordsRead: '10' }), TODAY)).toThrow(TypeError);
      expect(() => toGardenSummary(OMAR, withInput({ hasanatEstimate: undefined }), TODAY)).toThrow(
        TypeError,
      );
    });

    it('refuses a number given as text with a TypeError', () => {
      expect(() => toGardenSummary(OMAR, withInput({ hizbCompleted: '17' }), TODAY)).toThrow(
        TypeError,
      );
    });

    it('refuses an input that is not an object with a TypeError', () => {
      expect(() => toGardenSummary(OMAR, NOT_AN_OBJECT, TODAY)).toThrow(TypeError);
    });

    it('refuses an empty identifier and an impossible today', () => {
      expect(() => toGardenSummary('', INPUT, TODAY)).toThrow(RangeError);
      expect(() => toGardenSummary(OMAR, INPUT, IMPOSSIBLE_DAY)).toThrow(RangeError);
    });
  });

  describe('badge (toBadge)', () => {
    it('is the khatma number and its day, for the person', () => {
      expect(toBadge(OMAR, { khatmNumber: 1, completedOn: day('2026-08-01') }, TODAY)).toEqual({
        userId: OMAR,
        khatmNumber: 1,
        completedOn: day('2026-08-01'),
      });
    });

    it('refuses a khatma number below 1 and a day after today', () => {
      expect(() => toBadge(OMAR, { khatmNumber: 0, completedOn: TODAY }, TODAY)).toThrow(
        RangeError,
      );
      expect(() =>
        toBadge(OMAR, { khatmNumber: 1, completedOn: addDays(TODAY, 1) }, TODAY),
      ).toThrow(RangeError);
    });
  });
});

describe('Published badges and daily readings', () => {
  it('a list of badges holds each khatma once', () => {
    const once = [
      { khatmNumber: 1, completedOn: day('2026-03-01') },
      { khatmNumber: 2, completedOn: day('2026-08-01') },
    ];

    expect(toBadges(OMAR, once, TODAY).map((badge) => badge.khatmNumber)).toEqual([1, 2]);
    expect(() => toBadges(OMAR, [...once, once[0]!], TODAY)).toThrow(RangeError);
    expect(toBadges(OMAR, [], TODAY)).toEqual([]);
  });

  it('a daily reading is the pages read for the first time that day, 0 to 604', () => {
    expect(toDailyReading(OMAR, TODAY, 604, TODAY)).toEqual({
      userId: OMAR,
      day: TODAY,
      newPages: 604,
    });
    expect(toDailyReading(OMAR, TODAY, 0, TODAY).newPages).toBe(0);
    expect(() => toDailyReading(OMAR, TODAY, 605, TODAY)).toThrow(RangeError);
    expect(() => toDailyReading(OMAR, TODAY, -1, TODAY)).toThrow(RangeError);
    expect(() => toDailyReading(OMAR, TODAY, 1.5, TODAY)).toThrow(RangeError);
  });

  it('a daily reading cannot be dated after today', () => {
    expect(() => toDailyReading(OMAR, addDays(TODAY, 1), 1, TODAY)).toThrow(RangeError);
  });
});
