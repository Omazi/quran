/**
 * "Types de rappel" of docs/specs/reminders.md: one block per kind, named after it.
 *
 * Counting from the last day read, R, the garden module gives: water stopped on R+2,
 * thirsty on R+4, wilting on R+7, dying on R+11, dead on R+15. Offsets below are counted
 * from today, a Tuesday: the Fridays of the plan are days 3, 10, 17 and 24.
 */
import { computeGardenState } from '@/domain/garden';

import { planReminders } from '../index';
import {
  ALL_REMINDERS_ON,
  bareEarth,
  DAILY_REMINDER_ONLY,
  DAILY_TIME,
  day,
  FRIDAY_REMINDER_ONLY,
  FRIDAY_TIME,
  GARDEN_KINDS,
  GARDEN_REMINDERS_ONLY,
  gardenLastReadDaysAgo,
  offsetsOf,
  readingKindsByOffset,
  remindersInput,
} from '../test-support/reminders-test-kit';

const FRIDAY = 5;

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The plan of a garden last read `daysAgo` days ago, with the garden reminders only. */
function gardenPlan(daysAgo: number) {
  return planReminders(
    remindersInput({ garden: gardenLastReadDaysAgo(daysAgo), settings: GARDEN_REMINDERS_ONLY }),
  );
}

describe('daily-goal: every day, only while the goal of the day is not reached', () => {
  const dailyOnly = (pagesReadToday: number) =>
    planReminders(
      remindersInput({ garden: bareEarth(), settings: DAILY_REMINDER_ONLY, pagesReadToday }),
    );

  it('is planned every day, at dailyTime', () => {
    const plan = dailyOnly(0);
    expect(plan.map((reminder) => reminder.date)).toEqual(
      Array.from({ length: 30 }, (_, offset) => day(offset)),
    );
    for (const reminder of plan) {
      expect(reminder.kind).toBe('daily-goal');
      expect(reminder.time).toEqual(DAILY_TIME);
    }
  });

  it('is still planned today while the goal is only partly reached', () => {
    expect(offsetsOf(dailyOnly(4), 'daily-goal')).toContain(0);
  });

  it('is not planned today once the goal of the day is reached', () => {
    const offsets = offsetsOf(dailyOnly(5), 'daily-goal');
    expect(offsets).not.toContain(0);
    // Tomorrow is another day: its goal is still to be reached.
    expect(offsets[0]).toBe(1);
    expect(offsets).toHaveLength(29);
  });

  it('is not planned today when more than the goal was read', () => {
    expect(offsetsOf(dailyOnly(12), 'daily-goal')).not.toContain(0);
  });

  it('depends on dailyEnabled', () => {
    const plan = planReminders(
      remindersInput({ settings: { ...ALL_REMINDERS_ON, dailyEnabled: false } }),
    );
    expect(offsetsOf(plan, 'daily-goal')).toEqual([]);
  });
});

describe('water-stopped: the day after a first day without reading', () => {
  it('is planned tomorrow when today is the first day without reading', () => {
    expect(offsetsOf(gardenPlan(1), 'water-stopped')).toEqual([1]);
  });

  it('is planned in two days when today was read: tomorrow would be the first day without reading', () => {
    expect(offsetsOf(gardenPlan(0), 'water-stopped')).toEqual([2]);
  });

  it('is planned today when yesterday was the first day without reading', () => {
    expect(offsetsOf(gardenPlan(2), 'water-stopped')).toEqual([0]);
  });

  it('falls on the day the garden module shows the water no longer flowing', () => {
    const garden = gardenLastReadDaysAgo(1);
    expect(computeGardenState({ ...garden, today: day(0) }).water).toBe('flowing');
    expect(computeGardenState({ ...garden, today: day(1) }).water).toBe('still');
  });

  it('is not repeated while the water stays stopped', () => {
    expect(offsetsOf(gardenPlan(3), 'water-stopped')).toEqual([]);
  });
});

describe('thirsty: the day the garden becomes thirsty', () => {
  it('is planned on the fourth day after the last reading', () => {
    expect(offsetsOf(gardenPlan(1), 'thirsty')).toEqual([3]);
  });

  it('falls on the first day the garden module shows the garden thirsty', () => {
    const garden = gardenLastReadDaysAgo(1);
    expect(computeGardenState({ ...garden, today: day(2) }).phase).toBe('thriving');
    expect(computeGardenState({ ...garden, today: day(3) }).phase).toBe('thirsty');
  });

  it('is planned today when the garden became thirsty this morning', () => {
    expect(offsetsOf(gardenPlan(4), 'thirsty')).toEqual([0]);
  });

  it('is not repeated on the following thirsty days', () => {
    expect(offsetsOf(gardenPlan(5), 'thirsty')).toEqual([]);
  });
});

describe('wilting: the day the garden becomes wilting', () => {
  it('is planned on the seventh day after the last reading', () => {
    expect(offsetsOf(gardenPlan(1), 'wilting')).toEqual([6]);
  });

  it('falls on the first day the garden module shows the garden wilting', () => {
    const garden = gardenLastReadDaysAgo(1);
    expect(computeGardenState({ ...garden, today: day(5) }).phase).toBe('thirsty');
    expect(computeGardenState({ ...garden, today: day(6) }).phase).toBe('wilting');
  });

  it('is planned today when the garden started wilting this morning', () => {
    expect(offsetsOf(gardenPlan(7), 'wilting')).toEqual([0]);
  });

  it('is not repeated on the following wilting days', () => {
    expect(offsetsOf(gardenPlan(8), 'wilting')).toEqual([]);
  });
});

describe('dying: the day the garden becomes dying, when its elements start to disappear', () => {
  it('is planned on the eleventh day after the last reading', () => {
    expect(offsetsOf(gardenPlan(1), 'dying')).toEqual([10]);
  });

  it('falls on the first day the garden module hides elements', () => {
    const garden = gardenLastReadDaysAgo(1);
    const lastWholeDay = computeGardenState({ ...garden, today: day(9) });
    const firstDyingDay = computeGardenState({ ...garden, today: day(10) });
    expect(lastWholeDay.phase).toBe('wilting');
    expect(lastWholeDay.visibleElements).toHaveLength(20);
    expect(firstDyingDay.phase).toBe('dying');
    expect(firstDyingDay.visibleElements).toHaveLength(16);
  });

  it('is planned today when the garden started dying this morning', () => {
    expect(offsetsOf(gardenPlan(11), 'dying')).toEqual([0]);
  });

  it('is not repeated on the following dying days', () => {
    expect(offsetsOf(gardenPlan(12), 'dying')).toEqual([]);
  });

  it('is not sent when a dead garden comes back to dying because the user read', () => {
    const plan = planReminders(
      remindersInput({
        garden: gardenLastReadDaysAgo(0, {
          wateredDays: new Set([day(-120), day(0)]),
        }),
        settings: GARDEN_REMINDERS_ONLY,
      }),
    );
    expect(offsetsOf(plan, 'dying')).toEqual([]);
  });
});

describe('last-chance: the eve of the day the garden would be dead', () => {
  it('is planned the day before the garden dies', () => {
    expect(offsetsOf(gardenPlan(1), 'last-chance')).toEqual([13]);
    expect(offsetsOf(gardenPlan(1), 'dead')).toEqual([14]);
  });

  it('falls on the last day the garden module shows the garden alive', () => {
    const garden = gardenLastReadDaysAgo(1);
    expect(computeGardenState({ ...garden, today: day(13) }).phase).toBe('dying');
    expect(computeGardenState({ ...garden, today: day(14) }).phase).toBe('dead');
  });

  it('is planned today when the garden would be dead tomorrow', () => {
    expect(offsetsOf(gardenPlan(14), 'last-chance', 'dead')).toEqual([0, 1]);
  });
});

describe('dead: once, the day the garden is dried out', () => {
  it('is planned on the day the garden dies, and only once', () => {
    expect(offsetsOf(gardenPlan(1), 'dead')).toEqual([14]);
  });

  it('is planned today when the garden died this morning', () => {
    expect(offsetsOf(gardenPlan(15), 'dead')).toEqual([0]);
  });

  it('is not sent again on the days that follow the death', () => {
    for (const daysAgo of [16, 17, 22, 40]) {
      expect(offsetsOf(gardenPlan(daysAgo), 'dead')).toEqual([]);
    }
  });
});

describe('come-back: after the death, once a week for four weeks, then nothing', () => {
  it('is planned 7, 14, 21 and 28 days after the death', () => {
    // Last read 15 days ago: the garden dies today.
    expect(readingKindsByOffset(gardenPlan(15))).toEqual({
      0: 'dead',
      7: 'come-back',
      14: 'come-back',
      21: 'come-back',
      28: 'come-back',
    });
  });

  it('is planned at dailyTime', () => {
    for (const reminder of gardenPlan(15)) expect(reminder.time).toEqual(DAILY_TIME);
  });

  it('counts from the day of the death when the garden died in the past', () => {
    // Dead for 10 days: 14, 21 and 28 days after the death are 4, 11 and 18 days from now.
    expect(readingKindsByOffset(gardenPlan(25))).toEqual({
      4: 'come-back',
      11: 'come-back',
      18: 'come-back',
    });
  });

  it('follows a death still to come', () => {
    expect(offsetsOf(gardenPlan(1), 'dead', 'come-back')).toEqual([14, 21, 28]);
  });
});

describe('kinds 2 to 8 depend on thirstyGardenEnabled', () => {
  it('plans the seven garden reminders when it is on', () => {
    expect(readingKindsByOffset(gardenPlan(1))).toEqual({
      1: 'water-stopped',
      3: 'thirsty',
      6: 'wilting',
      10: 'dying',
      13: 'last-chance',
      14: 'dead',
      21: 'come-back',
      28: 'come-back',
    });
  });

  it('plans none of them when it is off', () => {
    for (const daysAgo of [1, 15, 25]) {
      const plan = planReminders(
        remindersInput({
          garden: gardenLastReadDaysAgo(daysAgo),
          settings: { ...ALL_REMINDERS_ON, thirstyGardenEnabled: false },
        }),
      );
      expect(offsetsOf(plan, ...GARDEN_KINDS)).toEqual([]);
    }
  });

  it('does not depend on the daily and the Friday reminders', () => {
    const everything = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(1) }));
    expect(offsetsOf(everything, ...GARDEN_KINDS)).toEqual(
      offsetsOf(gardenPlan(1), ...GARDEN_KINDS),
    );
  });
});

describe('friday-kahf: every Friday, when the option is on', () => {
  it('is planned on every Friday of the plan, at fridayTime', () => {
    const plan = planReminders(
      remindersInput({ garden: bareEarth(), settings: FRIDAY_REMINDER_ONLY }),
    );
    expect(offsetsOf(plan, 'friday-kahf')).toEqual([3, 10, 17, 24]);
    expect(plan).toHaveLength(4);
    for (const reminder of plan) {
      expect(weekdayOf(reminder.date)).toBe(FRIDAY);
      expect(reminder.time).toEqual(FRIDAY_TIME);
    }
  });

  it('is never planned on another day of the week', () => {
    const plan = planReminders(remindersInput({ garden: bareEarth() }));
    for (const reminder of plan) {
      if (reminder.kind === 'friday-kahf') expect(weekdayOf(reminder.date)).toBe(FRIDAY);
    }
  });

  it('depends on fridayKahfEnabled', () => {
    const plan = planReminders(
      remindersInput({
        garden: bareEarth(),
        settings: { ...ALL_REMINDERS_ON, fridayKahfEnabled: false },
      }),
    );
    expect(offsetsOf(plan, 'friday-kahf')).toEqual([]);
  });

  it('does not depend on the garden: it goes on whatever its state', () => {
    // Read today, dying, dead since this morning, dead for 10 days, dead for months.
    for (const daysAgo of [0, 12, 15, 25, 100]) {
      const plan = planReminders(
        remindersInput({ garden: gardenLastReadDaysAgo(daysAgo), settings: ALL_REMINDERS_ON }),
      );
      expect(offsetsOf(plan, 'friday-kahf')).toEqual([3, 10, 17, 24]);
    }
  });

  it('does not depend on thirstyGardenEnabled nor on dailyEnabled', () => {
    const plan = planReminders(
      remindersInput({ garden: gardenLastReadDaysAgo(1), settings: FRIDAY_REMINDER_ONLY }),
    );
    expect(plan.map((reminder) => reminder.kind)).toEqual(Array(4).fill('friday-kahf'));
  });
});
