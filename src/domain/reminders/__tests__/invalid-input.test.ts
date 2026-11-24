/**
 * Invalid input always raises an explicit error; nothing is silently corrected.
 *
 * The values below are wrong on purpose. They are built as `unknown` and handed over
 * through `broken`, the way corrupted storage would hand them over at run time.
 */
import { planReminders, type RemindersInput } from '../index';
import {
  ALL_REMINDERS_OFF,
  ALL_REMINDERS_ON,
  at,
  bareEarth,
  day,
  gardenLastReadDaysAgo,
  remindersInput,
} from '../test-support/reminders-test-kit';

/** Lets a deliberately wrong value through the type checker, as loaded data would be. */
function broken(input: unknown): RemindersInput {
  // `as` on purpose: these tests exist to feed the function what its type forbids.
  return input as RemindersInput;
}

const valid = remindersInput();

describe('invalid input', () => {
  it('accepts the reference input of these tests', () => {
    expect(() => planReminders(valid)).not.toThrow();
  });

  describe('input object', () => {
    it.each([null, undefined, 42, 'plan'])('rejects %p instead of an input', (value) => {
      expect(() => planReminders(broken(value))).toThrow(TypeError);
    });
  });

  describe('now', () => {
    it.each([null, undefined, '2026-11-24'])('rejects %p instead of a moment', (now) => {
      expect(() => planReminders(broken({ ...valid, now }))).toThrow(TypeError);
    });

    it.each(['2026-02-30', '2026-13-01', '24/11/2026', '2026-11-24T09:00', '', 20261124, null])(
      'rejects the date %p',
      (date) => {
        const now = { date, time: at(9, 0) };
        expect(() => planReminders(broken({ ...valid, now }))).toThrow(RangeError);
      },
    );

    it.each([
      { hour: 24, minute: 0 },
      { hour: -1, minute: 0 },
      { hour: 9, minute: 60 },
      { hour: 9, minute: -1 },
      { hour: 9.5, minute: 0 },
      { hour: 9, minute: 0.5 },
      { hour: Number.NaN, minute: 0 },
      { hour: '9', minute: 0 },
      { hour: 9 },
    ])('rejects the time %p', (time) => {
      const now = { date: day(0), time };
      expect(() => planReminders(broken({ ...valid, now }))).toThrow(RangeError);
    });

    it.each([null, undefined, '09:00', 900])('rejects %p instead of a time', (time) => {
      const now = { date: day(0), time };
      expect(() => planReminders(broken({ ...valid, now }))).toThrow(TypeError);
    });

    it('accepts the first and the last minute of the day', () => {
      for (const time of [at(0, 0), at(23, 59)]) {
        expect(() => planReminders({ ...valid, now: { date: day(0), time } })).not.toThrow();
      }
    });
  });

  describe('daily goal and pages read today', () => {
    it.each([0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY, '5', null, undefined])(
      'rejects a daily goal of %p',
      (dailyGoalPages) => {
        expect(() => planReminders(broken({ ...valid, dailyGoalPages }))).toThrow(RangeError);
      },
    );

    it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, '0', null, undefined])(
      'rejects %p pages read today',
      (pagesReadToday) => {
        expect(() => planReminders(broken({ ...valid, pagesReadToday }))).toThrow(RangeError);
      },
    );

    it('accepts a goal of one page and no page read', () => {
      expect(() => planReminders({ ...valid, dailyGoalPages: 1, pagesReadToday: 0 })).not.toThrow();
    });
  });

  describe('settings', () => {
    it.each([null, undefined, 'on'])('rejects %p instead of settings', (settings) => {
      expect(() => planReminders(broken({ ...valid, settings }))).toThrow(TypeError);
    });

    it.each(['dailyEnabled', 'thirstyGardenEnabled', 'fridayKahfEnabled'])(
      'rejects a %s that is not true or false',
      (name) => {
        for (const value of [undefined, null, 1, 'true']) {
          const settings = { ...ALL_REMINDERS_ON, [name]: value };
          expect(() => planReminders(broken({ ...valid, settings }))).toThrow(TypeError);
        }
      },
    );

    it('rejects a daily time that is not a real time', () => {
      for (const dailyTime of [at(24, 0), at(20, 60), at(-1, 30), at(20.5, 0)]) {
        const settings = { ...ALL_REMINDERS_ON, dailyTime };
        expect(() => planReminders({ ...valid, settings })).toThrow(RangeError);
      }
      const settings = { ...ALL_REMINDERS_ON, dailyTime: undefined };
      expect(() => planReminders(broken({ ...valid, settings }))).toThrow(TypeError);
    });

    it('rejects a Friday time that is not a real time', () => {
      for (const fridayTime of [at(24, 0), at(9, 60), at(-1, 0), at(9, 0.5)]) {
        const settings = { ...ALL_REMINDERS_ON, fridayTime };
        expect(() => planReminders({ ...valid, settings })).toThrow(RangeError);
      }
      const settings = { ...ALL_REMINDERS_ON, fridayTime: undefined };
      expect(() => planReminders(broken({ ...valid, settings }))).toThrow(TypeError);
    });

    it('checks both times even when their reminders are off', () => {
      const wrongDaily = { ...ALL_REMINDERS_OFF, dailyTime: at(25, 0) };
      const wrongFriday = { ...ALL_REMINDERS_OFF, fridayTime: at(25, 0) };
      expect(() => planReminders({ ...valid, settings: wrongDaily })).toThrow(RangeError);
      expect(() => planReminders({ ...valid, settings: wrongFriday })).toThrow(RangeError);
    });

    it('rejects forgotten quiet hours: only null means none', () => {
      const settings = { ...ALL_REMINDERS_ON, quietHours: undefined };
      expect(() => planReminders(broken({ ...valid, settings }))).toThrow(TypeError);
    });

    it('rejects quiet hours that are not real times', () => {
      const wrongStart = { ...ALL_REMINDERS_ON, quietHours: { from: at(24, 0), to: at(7, 0) } };
      const wrongEnd = { ...ALL_REMINDERS_ON, quietHours: { from: at(22, 0), to: at(7, 75) } };
      const noEnd = { ...ALL_REMINDERS_ON, quietHours: { from: at(22, 0) } };
      expect(() => planReminders({ ...valid, settings: wrongStart })).toThrow(RangeError);
      expect(() => planReminders({ ...valid, settings: wrongEnd })).toThrow(RangeError);
      expect(() => planReminders(broken({ ...valid, settings: noEnd }))).toThrow(TypeError);
      expect(() =>
        planReminders(broken({ ...valid, settings: { ...ALL_REMINDERS_ON, quietHours: '22-7' } })),
      ).toThrow(TypeError);
    });
  });

  describe('garden input: checked by the garden module', () => {
    it.each([null, undefined, 'garden'])('rejects %p instead of a garden input', (garden) => {
      expect(() => planReminders(broken({ ...valid, garden }))).toThrow(TypeError);
    });

    it('rejects a number of hizb out of 0..60', () => {
      const garden = { ...gardenLastReadDaysAgo(1), hizbCompleted: 61 };
      expect(() => planReminders({ ...valid, garden })).toThrow(RangeError);
    });

    it('rejects a garden with a hizb finished but no first day', () => {
      const garden = { ...gardenLastReadDaysAgo(1), firstHizbCompletedOn: null };
      expect(() => planReminders({ ...valid, garden })).toThrow(RangeError);
    });

    it('rejects a pause that ends before it starts', () => {
      const garden = { ...bareEarth(), pauses: [{ from: day(5), to: day(4) }] };
      expect(() => planReminders({ ...valid, garden })).toThrow(RangeError);
    });

    it('rejects pauses that are not a list', () => {
      const garden = { ...bareEarth(), pauses: undefined };
      expect(() => planReminders(broken({ ...valid, garden }))).toThrow(TypeError);
    });

    it('rejects an invalid garden even when every reminder is off', () => {
      const garden = { ...gardenLastReadDaysAgo(1), hizbCompleted: -1 };
      expect(() => planReminders({ ...valid, garden, settings: ALL_REMINDERS_OFF })).toThrow(
        RangeError,
      );
    });
  });

  it('names the wrong field in its message', () => {
    const settings = { ...ALL_REMINDERS_ON, dailyTime: at(24, 0) };
    expect(() => planReminders({ ...valid, settings })).toThrow(/settings\.dailyTime/);
    expect(() =>
      planReminders({ ...valid, settings: { ...ALL_REMINDERS_ON, fridayTime: at(9, 99) } }),
    ).toThrow(/settings\.fridayTime/);
    expect(() => planReminders({ ...valid, dailyGoalPages: 0 })).toThrow(/dailyGoalPages/);
    expect(() => planReminders(broken({ ...valid, now: { date: 'x', time: at(9, 0) } }))).toThrow(
      /now\.date/,
    );
  });
});
