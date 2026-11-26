/**
 * What the text of a reminder rests on, without the words: which of its variants a day gets, and
 * how many pages of the goal are left on that day if nothing more is read.
 * See docs/specs/reminders-copy.md.
 */
import { addDays, parseLocalDate } from '@/domain/shared/local-date';

import { copyVariantIndex, readingGoalOn, type ReminderKind } from '..';

const TUESDAY = parseLocalDate('2026-11-24');
const FRIDAY = parseLocalDate('2026-11-27');

describe('copyVariantIndex', () => {
  it('is always the same for the same kind, day and number of variants', () => {
    expect(copyVariantIndex('daily-goal', TUESDAY, 8)).toBe(
      copyVariantIndex('daily-goal', TUESDAY, 8),
    );
  });

  it('stays inside the variants, before and after the year 2000', () => {
    for (const date of [parseLocalDate('1999-12-25'), TUESDAY, parseLocalDate('2099-06-30')]) {
      const index = copyVariantIndex('thirsty', date, 3);
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(3);
    }
  });

  it.each([2, 3, 6, 8, 10])(
    'gives two consecutive days different daily variants (%i variants)',
    (count) => {
      for (let day = 0; day < 60; day += 1) {
        const date = addDays(TUESDAY, day);
        expect(copyVariantIndex('daily-goal', date, count)).not.toBe(
          copyVariantIndex('daily-goal', addDays(date, 1), count),
        );
      }
    },
  );

  it('uses every daily variant over as many days', () => {
    const seen = new Set(
      Array.from({ length: 8 }, (_, day) =>
        copyVariantIndex('daily-goal', addDays(TUESDAY, day), 8),
      ),
    );
    expect(seen.size).toBe(8);
  });

  it.each<ReminderKind>(['friday-kahf', 'come-back'])(
    'gives two reminders a week apart different variants (%s)',
    (kind) => {
      for (let week = 0; week < 20; week += 1) {
        const date = addDays(FRIDAY, week * 7);
        expect(copyVariantIndex(kind, date, 3)).not.toBe(
          copyVariantIndex(kind, addDays(date, 7), 3),
        );
      }
    },
  );

  it('has a single variant to give when there is one', () => {
    expect(copyVariantIndex('dead', TUESDAY, 1)).toBe(0);
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses %p variants', (count) => {
    expect(() => copyVariantIndex('daily-goal', TUESDAY, count)).toThrow(RangeError);
  });
});

describe('readingGoalOn', () => {
  const input = { now: { date: TUESDAY, time: { hour: 8, minute: 0 } }, dailyGoalPages: 5 };

  it('today, counts what is already read', () => {
    expect(readingGoalOn({ ...input, pagesReadToday: 2 }, TUESDAY)).toEqual({
      pagesLeft: 3,
      hasStarted: true,
    });
  });

  it('today, with nothing read yet, asks for the whole goal', () => {
    expect(readingGoalOn({ ...input, pagesReadToday: 0 }, TUESDAY)).toEqual({
      pagesLeft: 5,
      hasStarted: false,
    });
  });

  it('never goes below zero once the goal is passed', () => {
    expect(readingGoalOn({ ...input, pagesReadToday: 9 }, TUESDAY).pagesLeft).toBe(0);
  });

  it('on a coming day, asks for the whole goal: nothing of that day is read yet', () => {
    expect(readingGoalOn({ ...input, pagesReadToday: 4 }, addDays(TUESDAY, 1))).toEqual({
      pagesLeft: 5,
      hasStarted: false,
    });
  });
});
