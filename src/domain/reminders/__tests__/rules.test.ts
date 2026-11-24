/**
 * "Règles" of docs/specs/reminders.md: one block per rule, named after it.
 *
 * Offsets are counted from today, a Tuesday: the Fridays of the plan are days 3, 10, 17
 * and 24. Counting from the last day read, R: water stopped on R+2, thirsty on R+4,
 * wilting on R+7, dying on R+11, last chance on R+14, dead on R+15.
 */
import { computeGardenState, DEFAULT_GARDEN_CONFIG } from '@/domain/garden';

import { planReminders, REMINDER_PRIORITY } from '../index';
import {
  ALL_REMINDERS_ON,
  at,
  bareEarth,
  DAILY_REMINDER_ONLY,
  DAILY_TIME,
  day,
  FRIDAY_REMINDER_ONLY,
  FRIDAY_TIME,
  GARDEN_KINDS,
  GARDEN_REMINDERS_ONLY,
  gardenFromTimeline,
  gardenLastReadDaysAgo,
  offsetsOf,
  planned,
  readingKindsByOffset,
  remindersInput,
} from '../test-support/reminders-test-kit';

type Plan = ReturnType<typeof planReminders>;

const onDay = (plan: Plan, offset: number) =>
  plan.filter((reminder) => reminder.date === day(offset));

describe('at most one reading reminder a day', () => {
  it('never plans two reading reminders on the same day, even with every reminder on', () => {
    for (const daysAgo of [0, 1, 5, 11, 14, 15, 20]) {
      const plan = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(daysAgo) }));
      const dates = plan
        .filter((reminder) => reminder.kind !== 'friday-kahf')
        .map((reminder) => reminder.date);
      expect(new Set(dates).size).toBe(dates.length);
    }
  });

  it('priority: last-chance > dead > dying > wilting > thirsty > water-stopped > come-back > daily-goal', () => {
    expect(REMINDER_PRIORITY).toEqual([
      'last-chance',
      'dead',
      'dying',
      'wilting',
      'thirsty',
      'water-stopped',
      'come-back',
      'daily-goal',
    ]);
  });

  it('a garden reminder replaces the daily one of its day', () => {
    const plan = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(1) }));
    expect(readingKindsByOffset(plan)).toMatchObject({
      0: 'daily-goal',
      1: 'water-stopped',
      2: 'daily-goal',
      3: 'thirsty',
      6: 'wilting',
      10: 'dying',
      13: 'last-chance',
      14: 'dead',
    });
  });

  describe('between two garden reminders of the same day, the most serious wins', () => {
    const gardenOnly = (garden: ReturnType<typeof gardenFromTimeline>) =>
      planReminders(remindersInput({ garden, settings: GARDEN_REMINDERS_ONLY }));

    it('thirsty wins over water-stopped', () => {
      // Five missed days then a reading leave 2 drought days: two days later the garden is
      // thirsty on the very day the water stops.
      const garden = gardenFromTimeline('MMMMM', true);
      expect(computeGardenState({ ...garden, today: day(0) }).droughtDays).toBe(2);
      expect(onDay(gardenOnly(garden), 2)).toEqual([planned(day(2), DAILY_TIME, 'thirsty')]);
    });

    it('wilting wins over water-stopped', () => {
      const garden = gardenFromTimeline('M'.repeat(8), true);
      expect(computeGardenState({ ...garden, today: day(0) }).droughtDays).toBe(5);
      expect(onDay(gardenOnly(garden), 2)).toEqual([planned(day(2), DAILY_TIME, 'wilting')]);
    });

    it('dying wins over water-stopped', () => {
      const garden = gardenFromTimeline('M'.repeat(12), true);
      expect(computeGardenState({ ...garden, today: day(0) }).droughtDays).toBe(9);
      expect(onDay(gardenOnly(garden), 2)).toEqual([planned(day(2), DAILY_TIME, 'dying')]);
    });

    it('last-chance wins over water-stopped', () => {
      // A garden where a day read takes back 2 drought days: fourteen missed days then a
      // reading leave 12, and two days later the water stops on the eve of its death.
      const config = { ...DEFAULT_GARDEN_CONFIG, droughtDaysRecoveredPerWateredDay: 2 };
      const garden = gardenFromTimeline('M'.repeat(14), true, { config });
      expect(computeGardenState({ ...garden, today: day(0) }).droughtDays).toBe(12);
      const plan = gardenOnly(garden);
      expect(onDay(plan, 2)).toEqual([planned(day(2), DAILY_TIME, 'last-chance')]);
      expect(onDay(plan, 3)).toEqual([planned(day(3), DAILY_TIME, 'dead')]);
    });

    it('dead wins over water-stopped', () => {
      // Here a day read takes back a single drought day: the water stops on the very day
      // the garden dies.
      const config = { ...DEFAULT_GARDEN_CONFIG, droughtDaysRecoveredPerWateredDay: 1 };
      const garden = gardenFromTimeline('M'.repeat(14), true, { config });
      expect(computeGardenState({ ...garden, today: day(0) }).droughtDays).toBe(13);
      const plan = gardenOnly(garden);
      expect(onDay(plan, 1)).toEqual([planned(day(1), DAILY_TIME, 'last-chance')]);
      expect(onDay(plan, 2)).toEqual([planned(day(2), DAILY_TIME, 'dead')]);
    });

    it('last-chance wins over dying when the garden starts dying on the eve of its death', () => {
      const config = { ...DEFAULT_GARDEN_CONFIG, dyingMinDroughtDays: 13 };
      const plan = gardenOnly(gardenLastReadDaysAgo(1, { config }));
      expect(onDay(plan, 13)).toEqual([planned(day(13), DAILY_TIME, 'last-chance')]);
      expect(offsetsOf(plan, 'dying')).toEqual([]);
    });
  });

  it('a reminder that loses its day is dropped, not moved to another day', () => {
    const garden = gardenFromTimeline('MMMMM', true);
    const plan = planReminders(remindersInput({ garden, settings: GARDEN_REMINDERS_ONLY }));
    expect(offsetsOf(plan, 'water-stopped')).toEqual([]);
  });
});

describe('the Friday reminder is added, at its own time', () => {
  const plan = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(1) }));

  it('comes on top of a garden reminder, never instead of it', () => {
    expect(onDay(plan, 3)).toEqual([
      planned(day(3), FRIDAY_TIME, 'friday-kahf'),
      planned(day(3), DAILY_TIME, 'thirsty'),
    ]);
    expect(onDay(plan, 10)).toEqual([
      planned(day(10), FRIDAY_TIME, 'friday-kahf'),
      planned(day(10), DAILY_TIME, 'dying'),
    ]);
  });

  it('comes on top of the daily reminder', () => {
    const healthy = planReminders(remindersInput({ garden: bareEarth() }));
    expect(onDay(healthy, 3)).toEqual([
      planned(day(3), FRIDAY_TIME, 'friday-kahf'),
      planned(day(3), DAILY_TIME, 'daily-goal'),
    ]);
    expect(offsetsOf(healthy, 'daily-goal')).toHaveLength(30);
    expect(offsetsOf(healthy, 'friday-kahf')).toEqual([3, 10, 17, 24]);
  });

  it('is never replaced by a reading reminder: last-chance, dead and come-back Fridays keep it', () => {
    // Last chance, death, and seven days after the death, each on Friday day 3.
    for (const [daysAgo, kind] of [
      [11, 'last-chance'],
      [12, 'dead'],
      [19, 'come-back'],
    ] as const) {
      const friday = onDay(
        planReminders(remindersInput({ garden: gardenLastReadDaysAgo(daysAgo) })),
        3,
      );
      expect(friday).toEqual([
        planned(day(3), FRIDAY_TIME, 'friday-kahf'),
        planned(day(3), DAILY_TIME, kind),
      ]);
    }
  });

  it('the plan stays ordered by time inside a day: a Friday reminder set later comes second', () => {
    const settings = { ...ALL_REMINDERS_ON, fridayTime: at(21, 15) };
    const evening = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(1), settings }));
    expect(onDay(evening, 3)).toEqual([
      planned(day(3), DAILY_TIME, 'thirsty'),
      planned(day(3), at(21, 15), 'friday-kahf'),
    ]);
  });

  it('both reminders are kept when they are set at the same time, the reading one first', () => {
    const settings = { ...ALL_REMINDERS_ON, fridayTime: DAILY_TIME };
    const sameTime = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(1), settings }));
    expect(onDay(sameTime, 3)).toEqual([
      planned(day(3), DAILY_TIME, 'thirsty'),
      planned(day(3), DAILY_TIME, 'friday-kahf'),
    ]);
  });

  it('never plans more than two reminders a day', () => {
    for (let offset = 0; offset < 30; offset += 1) {
      expect(onDay(plan, offset).length).toBeLessThanOrEqual(2);
    }
  });
});

describe('silence after the death of the garden', () => {
  // Last read 15 days ago: the garden dies today.
  const gardenDyingToday = gardenLastReadDaysAgo(15);

  it('from the day after dead: no daily-goal and no garden reminder, only the four come-back', () => {
    const plan = planReminders(remindersInput({ garden: gardenDyingToday }));
    expect(readingKindsByOffset(plan)).toEqual({
      0: 'dead',
      7: 'come-back',
      14: 'come-back',
      21: 'come-back',
      28: 'come-back',
    });
  });

  it('the same silence follows a death still to come', () => {
    const plan = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(1) }));
    const afterDeath = Object.entries(readingKindsByOffset(plan)).filter(
      ([offset]) => Number(offset) > 14,
    );
    expect(afterDeath).toEqual([
      ['21', 'come-back'],
      ['28', 'come-back'],
    ]);
  });

  it('the four come-back, then nothing', () => {
    // Dead for 10 days: the last come-back is 18 days from now, nothing follows it.
    const plan = planReminders(
      remindersInput({ garden: gardenLastReadDaysAgo(25), settings: GARDEN_REMINDERS_ONLY }),
    );
    expect(plan).toEqual([
      planned(day(4), DAILY_TIME, 'come-back'),
      planned(day(11), DAILY_TIME, 'come-back'),
      planned(day(18), DAILY_TIME, 'come-back'),
    ]);
  });

  it('the last come-back falls exactly 28 days after the death', () => {
    // Last read 43 days ago: dead for 28 days today.
    const garden = gardenLastReadDaysAgo(43);
    expect(computeGardenState({ ...garden, today: day(-28) }).phase).toBe('dead');
    expect(computeGardenState({ ...garden, today: day(-29) }).phase).toBe('dying');
    const plan = planReminders(remindersInput({ garden, settings: GARDEN_REMINDERS_ONLY }));
    expect(plan).toEqual([planned(day(0), DAILY_TIME, 'come-back')]);
  });

  it('no reading reminder at all once the four weeks are over', () => {
    for (const daysAgo of [44, 45, 60, 100]) {
      const everythingOn = planReminders(
        remindersInput({ garden: gardenLastReadDaysAgo(daysAgo) }),
      );
      expect(readingKindsByOffset(everythingOn)).toEqual({});
      const noFriday = { ...ALL_REMINDERS_ON, fridayKahfEnabled: false };
      expect(
        planReminders(
          remindersInput({ garden: gardenLastReadDaysAgo(daysAgo), settings: noFriday }),
        ),
      ).toEqual([]);
    }
  });

  it('come-back depends on thirstyGardenEnabled; the daily reminder stops all the same', () => {
    const plan = planReminders(
      remindersInput({ garden: gardenDyingToday, settings: DAILY_REMINDER_ONLY }),
    );
    // The day of the death is an ordinary day; nothing follows it.
    expect(plan).toEqual([planned(day(0), DAILY_TIME, 'daily-goal')]);
  });

  it('friday-kahf is unaffected: it goes on during the silence and after it', () => {
    for (const daysAgo of [15, 25, 60]) {
      const plan = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(daysAgo) }));
      expect(offsetsOf(plan, 'friday-kahf')).toEqual([3, 10, 17, 24]);
    }
    const fridayOnly = planReminders(
      remindersInput({ garden: gardenLastReadDaysAgo(60), settings: FRIDAY_REMINDER_ONLY }),
    );
    expect(fridayOnly).toHaveLength(4);
  });

  it('ends as soon as the user reads again', () => {
    // Dead for 50 days, then read today: the garden lives again, and so do its reminders.
    const garden = gardenFromTimeline('M'.repeat(64), true);
    expect(computeGardenState({ ...garden, today: day(0) }).phase).toBe('dying');
    const plan = planReminders(remindersInput({ garden, pagesReadToday: 1 }));
    expect(readingKindsByOffset(plan)).toEqual({
      0: 'daily-goal',
      1: 'daily-goal',
      2: 'water-stopped',
      3: 'last-chance',
      4: 'dead',
      11: 'come-back',
      18: 'come-back',
      25: 'come-back',
    });
  });
});

describe('no reminder during a pause, of any kind', () => {
  const between = (plan: Plan, from: number, to: number) =>
    plan.filter((reminder) => reminder.date >= day(from) && reminder.date <= day(to));

  it('plans nothing on the days of a pause, both ends included', () => {
    const garden = { ...bareEarth(), pauses: [{ from: day(2), to: day(5) }] };
    const plan = planReminders(remindersInput({ garden }));
    expect(between(plan, 2, 5)).toEqual([]);
    expect(onDay(plan, 1)).toEqual([planned(day(1), DAILY_TIME, 'daily-goal')]);
    expect(onDay(plan, 6)).toEqual([planned(day(6), DAILY_TIME, 'daily-goal')]);
    expect(offsetsOf(plan, 'daily-goal')).toHaveLength(26);
  });

  it('silences the Friday reminder too', () => {
    const garden = { ...bareEarth(), pauses: [{ from: day(3), to: day(3) }] };
    const plan = planReminders(remindersInput({ garden, settings: FRIDAY_REMINDER_ONLY }));
    expect(offsetsOf(plan, 'friday-kahf')).toEqual([10, 17, 24]);
  });

  it('a pause that starts today silences today', () => {
    const garden = { ...bareEarth(), pauses: [{ from: day(0), to: day(1) }] };
    const plan = planReminders(remindersInput({ garden, settings: DAILY_REMINDER_ONLY }));
    expect(plan[0]?.date).toBe(day(2));
  });

  it('a pause that ends today still silences today, and tomorrow is an ordinary day', () => {
    const garden = { ...bareEarth(), pauses: [{ from: day(-6), to: day(0) }] };
    const plan = planReminders(remindersInput({ garden, settings: DAILY_REMINDER_ONLY }));
    expect(plan[0]?.date).toBe(day(1));
    expect(plan).toHaveLength(29);
  });

  it('a pause that ended yesterday no longer silences anything', () => {
    const garden = { ...bareEarth(), pauses: [{ from: day(-6), to: day(-1) }] };
    const plan = planReminders(remindersInput({ garden, settings: DAILY_REMINDER_ONLY }));
    expect(plan).toHaveLength(30);
  });

  it('a pause that starts tomorrow leaves today alone', () => {
    const garden = { ...bareEarth(), pauses: [{ from: day(1), to: day(40) }] };
    const plan = planReminders(remindersInput({ garden, settings: DAILY_REMINDER_ONLY }));
    expect(plan.map((reminder) => reminder.date)).toEqual([day(0)]);
  });

  it('handles pauses that overlap or lie outside the plan', () => {
    const pauses = [
      { from: day(-100), to: day(-90) },
      { from: day(4), to: day(8) },
      { from: day(6), to: day(10) },
      { from: day(200), to: day(210) },
    ];
    const plan = planReminders(
      remindersInput({ garden: { ...bareEarth(), pauses }, settings: DAILY_REMINDER_ONLY }),
    );
    expect(between(plan, 4, 10)).toEqual([]);
    expect(plan).toHaveLength(23);
  });

  it('the garden does not dry during a pause: its reminders come that much later', () => {
    const garden = gardenFromTimeline('', false, { pauses: [{ from: day(2), to: day(6) }] });
    const plan = planReminders(remindersInput({ garden, settings: GARDEN_REMINDERS_ONLY }));
    // Without the pause: water stopped on day 1, thirsty on 3, wilting on 6, dying on 10,
    // dead on 14.
    expect(readingKindsByOffset(plan)).toEqual({
      1: 'water-stopped',
      8: 'thirsty',
      11: 'wilting',
      15: 'dying',
      18: 'last-chance',
      19: 'dead',
      26: 'come-back',
    });
  });

  it('a reminder that falls on a paused day is dropped, not postponed', () => {
    // The garden becomes thirsty on day 3, the first day of the pause.
    const garden = gardenFromTimeline('', false, { pauses: [{ from: day(3), to: day(5) }] });
    const plan = planReminders(remindersInput({ garden, settings: GARDEN_REMINDERS_ONLY }));
    expect(offsetsOf(plan, 'thirsty')).toEqual([]);
    expect(readingKindsByOffset(plan)).toEqual({
      1: 'water-stopped',
      9: 'wilting',
      13: 'dying',
      16: 'last-chance',
      17: 'dead',
      24: 'come-back',
    });
  });

  it('a come-back that falls on a paused day is dropped; the weeks are calendar weeks', () => {
    const garden = gardenLastReadDaysAgo(15, { pauses: [{ from: day(5), to: day(16) }] });
    const plan = planReminders(remindersInput({ garden, settings: GARDEN_REMINDERS_ONLY }));
    expect(readingKindsByOffset(plan)).toEqual({ 0: 'dead', 21: 'come-back', 28: 'come-back' });
  });

  it('a pause taken after the khatma is finished silences the daily reminder too', () => {
    const garden = gardenFromTimeline('', true, {
      hizbCompleted: 60,
      currentHizbProgress: 0,
      completedOn: day(0),
      pauses: [{ from: day(5), to: day(9) }],
    });
    const plan = planReminders(remindersInput({ garden, settings: DAILY_REMINDER_ONLY }));
    expect(between(plan, 5, 9)).toEqual([]);
    expect(plan).toHaveLength(25);
  });
});

describe('quiet hours: a reminder that falls inside them is moved to their end, on the same day', () => {
  const quiet = (from: readonly [number, number], to: readonly [number, number]) => ({
    from: at(from[0], from[1]),
    to: at(to[0], to[1]),
  });
  const NIGHT = quiet([22, 0], [7, 0]);
  const AFTERNOON = quiet([13, 0], [15, 0]);

  /** The single time of a daily-only plan computed at midnight with these settings. */
  const dailyTimeWith = (dailyTime: ReturnType<typeof at>, quietHours: typeof NIGHT) => {
    const plan = planReminders(
      remindersInput({
        garden: bareEarth(),
        now: { date: day(0), time: at(0, 0) },
        settings: { ...DAILY_REMINDER_ONLY, dailyTime, quietHours },
      }),
    );
    const times = new Set(plan.map((reminder) => `${reminder.time.hour}:${reminder.time.minute}`));
    expect(plan.map((reminder) => reminder.date)).toEqual(
      Array.from({ length: 30 }, (_, offset) => day(offset)),
    );
    return [...times].join(' ');
  };

  it('moves a reminder inside the quiet hours to their end, and keeps its day', () => {
    expect(dailyTimeWith(at(14, 0), AFTERNOON)).toBe('15:0');
  });

  it('leaves a reminder outside the quiet hours where it is', () => {
    expect(dailyTimeWith(at(20, 30), AFTERNOON)).toBe('20:30');
    expect(dailyTimeWith(at(12, 59), AFTERNOON)).toBe('12:59');
  });

  it('the start of the quiet hours is quiet, their end is not', () => {
    expect(dailyTimeWith(at(13, 0), AFTERNOON)).toBe('15:0');
    expect(dailyTimeWith(at(14, 59), AFTERNOON)).toBe('15:0');
    expect(dailyTimeWith(at(15, 0), AFTERNOON)).toBe('15:0');
    expect(dailyTimeWith(at(15, 1), AFTERNOON)).toBe('15:1');
  });

  describe('quiet hours that span midnight (22:00 to 07:00)', () => {
    it('moves a late evening reminder to the morning', () => {
      expect(dailyTimeWith(at(23, 30), NIGHT)).toBe('7:0');
      expect(dailyTimeWith(at(22, 0), NIGHT)).toBe('7:0');
      expect(dailyTimeWith(at(23, 59), NIGHT)).toBe('7:0');
    });

    it('moves a reminder after midnight to the morning', () => {
      expect(dailyTimeWith(at(0, 0), NIGHT)).toBe('7:0');
      expect(dailyTimeWith(at(5, 0), NIGHT)).toBe('7:0');
      expect(dailyTimeWith(at(6, 59), NIGHT)).toBe('7:0');
    });

    it('leaves a reminder of the day where it is', () => {
      expect(dailyTimeWith(at(7, 0), NIGHT)).toBe('7:0');
      expect(dailyTimeWith(at(7, 1), NIGHT)).toBe('7:1');
      expect(dailyTimeWith(at(21, 59), NIGHT)).toBe('21:59');
    });

    it('each morning carries the reminder of that very day', () => {
      // A late evening reminder moved to the morning must not announce the "last chance"
      // on the morning the garden is already dead.
      const garden = gardenLastReadDaysAgo(1);
      const plan = planReminders(
        remindersInput({
          garden,
          now: { date: day(0), time: at(6, 0) },
          settings: { ...GARDEN_REMINDERS_ONLY, dailyTime: at(23, 30), quietHours: NIGHT },
        }),
      );
      expect(readingKindsByOffset(plan)).toEqual({
        1: 'water-stopped',
        3: 'thirsty',
        6: 'wilting',
        10: 'dying',
        13: 'last-chance',
        14: 'dead',
        21: 'come-back',
        28: 'come-back',
      });
      for (const reminder of plan) expect(reminder.time).toEqual(at(7, 0));
      expect(computeGardenState({ ...garden, today: day(13) }).phase).not.toBe('dead');
    });

    it('this morning is in the plan before the end of the quiet hours, and no longer after', () => {
      const settings = { ...DAILY_REMINDER_ONLY, dailyTime: at(23, 30), quietHours: NIGHT };
      const before = planReminders(
        remindersInput({ garden: bareEarth(), now: { date: day(0), time: at(6, 59) }, settings }),
      );
      const after = planReminders(
        remindersInput({ garden: bareEarth(), now: { date: day(0), time: at(7, 0) }, settings }),
      );
      expect(before[0]).toEqual(planned(day(0), at(7, 0), 'daily-goal'));
      expect(after[0]).toEqual(planned(day(1), at(7, 0), 'daily-goal'));
    });
  });

  it('applies to each reminder at its own time: only the one inside the quiet hours moves', () => {
    const settings = { ...ALL_REMINDERS_ON, fridayTime: at(6, 0), quietHours: NIGHT };
    const plan = planReminders(remindersInput({ garden: bareEarth(), settings }));
    expect(onDay(plan, 3)).toEqual([
      planned(day(3), at(7, 0), 'friday-kahf'),
      planned(day(3), DAILY_TIME, 'daily-goal'),
    ]);
  });

  it('two reminders moved to the same end are both kept', () => {
    const settings = {
      ...ALL_REMINDERS_ON,
      dailyTime: at(23, 0),
      fridayTime: at(5, 0),
      quietHours: NIGHT,
    };
    const plan = planReminders(
      remindersInput({ garden: bareEarth(), now: { date: day(0), time: at(0, 0) }, settings }),
    );
    expect(onDay(plan, 3)).toEqual([
      planned(day(3), at(7, 0), 'daily-goal'),
      planned(day(3), at(7, 0), 'friday-kahf'),
    ]);
  });

  it('quiet hours that start and end at the same time are empty', () => {
    expect(dailyTimeWith(at(22, 0), quiet([22, 0], [22, 0]))).toBe('22:0');
    expect(dailyTimeWith(at(3, 0), quiet([22, 0], [22, 0]))).toBe('3:0');
  });

  it('no quiet hours: the chosen times are kept', () => {
    const plan = planReminders(remindersInput({ garden: bareEarth() }));
    for (const reminder of plan) {
      expect(reminder.time).toEqual(reminder.kind === 'friday-kahf' ? FRIDAY_TIME : DAILY_TIME);
    }
  });
});

describe('reading today makes the plan be recomputed', () => {
  const gardenOnly = (timeline: string, readToday: boolean) =>
    planReminders(
      remindersInput({
        garden: gardenFromTimeline(timeline, readToday),
        settings: GARDEN_REMINDERS_ONLY,
      }),
    );

  it('the garden reminder of today disappears and the following ones move back', () => {
    // The garden became thirsty this morning.
    expect(readingKindsByOffset(gardenOnly('MMM', false))).toEqual({
      0: 'thirsty',
      3: 'wilting',
      7: 'dying',
      10: 'last-chance',
      11: 'dead',
      18: 'come-back',
      25: 'come-back',
    });
    // Three missed days minus the three a day read takes back: the garden starts afresh.
    expect(readingKindsByOffset(gardenOnly('MMM', true))).toEqual({
      2: 'water-stopped',
      4: 'thirsty',
      7: 'wilting',
      11: 'dying',
      14: 'last-chance',
      15: 'dead',
      22: 'come-back',
      29: 'come-back',
    });
  });

  it('the last chance of today disappears, but one day read does not save the garden for long', () => {
    expect(readingKindsByOffset(gardenOnly('M'.repeat(13), false))).toMatchObject({
      0: 'last-chance',
      1: 'dead',
    });
    // One day read takes back three drought days only.
    expect(readingKindsByOffset(gardenOnly('M'.repeat(13), true))).toEqual({
      2: 'water-stopped',
      4: 'last-chance',
      5: 'dead',
      12: 'come-back',
      19: 'come-back',
      26: 'come-back',
    });
  });

  it('never leaves a garden reminder on a day that was read, whatever the garden', () => {
    for (let missedDays = 0; missedDays <= 40; missedDays += 1) {
      const garden = gardenFromTimeline('M'.repeat(missedDays), true);
      const plan = planReminders(remindersInput({ garden, pagesReadToday: 1 }));
      expect(readingKindsByOffset(plan)[0]).toBe('daily-goal');
      expect(readingKindsByOffset(plan)[1]).toBe('daily-goal');
    }
  });

  it('the daily-goal of today stays while the goal is not reached', () => {
    const plan = planReminders(
      remindersInput({ garden: gardenLastReadDaysAgo(0), dailyGoalPages: 5, pagesReadToday: 2 }),
    );
    expect(readingKindsByOffset(plan)[0]).toBe('daily-goal');
  });

  it('the daily-goal of today disappears once the goal is reached', () => {
    const plan = planReminders(
      remindersInput({ garden: gardenLastReadDaysAgo(0), dailyGoalPages: 5, pagesReadToday: 5 }),
    );
    expect(readingKindsByOffset(plan)[0]).toBeUndefined();
    expect(readingKindsByOffset(plan)[1]).toBe('daily-goal');
  });

  it('the Friday reminder of today stays: reading is not reading Al-Kahf', () => {
    const friday = day(3);
    const plan = planReminders(
      remindersInput({
        garden: bareEarth([friday]),
        now: { date: friday, time: at(8, 0) },
        dailyGoalPages: 5,
        pagesReadToday: 5,
      }),
    );
    expect(plan[0]).toEqual(planned(friday, FRIDAY_TIME, 'friday-kahf'));
    expect(plan[1]?.date).toBe(day(4));
  });
});

describe('bare earth and complete garden: no garden reminder', () => {
  it('bare earth, even after weeks without reading', () => {
    const plan = planReminders(remindersInput({ garden: bareEarth([day(-40), day(-39)]) }));
    expect(offsetsOf(plan, ...GARDEN_KINDS)).toEqual([]);
  });

  it('complete garden, even a month after the khatma', () => {
    const garden = gardenFromTimeline(`W${'M'.repeat(34)}`, false, {
      hizbCompleted: 60,
      currentHizbProgress: 0,
      completedOn: day(-35),
    });
    const plan = planReminders(remindersInput({ garden }));
    expect(offsetsOf(plan, ...GARDEN_KINDS)).toEqual([]);
  });
});
