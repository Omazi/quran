/**
 * The edges of docs/specs/reminders.md ("À tester"): horizon, time already passed today,
 * bare earth, complete garden, garden already dead, every reminder off, shape of the output.
 */
import { computeGardenState, DEFAULT_GARDEN_CONFIG } from '@/domain/garden';
import { addDays, parseLocalDate } from '@/domain/shared/local-date';

import { planReminders, REMINDERS_CONFIG } from '../index';
import {
  ALL_REMINDERS_OFF,
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

describe('horizon of the plan: 30 days', () => {
  it('is 30 days', () => {
    expect(REMINDERS_CONFIG.planHorizonDays).toBe(30);
  });

  it('covers today and the 29 days that follow, never the 30th', () => {
    const plan = planReminders(
      remindersInput({ garden: bareEarth(), settings: DAILY_REMINDER_ONLY }),
    );
    expect(plan).toHaveLength(30);
    expect(plan[0]?.date).toBe(day(0));
    expect(plan[29]?.date).toBe(day(29));
  });

  it('is ordered from the earliest reminder to the latest, by day then by time', () => {
    const plan = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(1) }));
    const moments = plan.map(
      (reminder) => `${reminder.date} ${String(reminder.time.hour).padStart(2, '0')}`,
    );
    expect(moments).toEqual([...moments].sort());
  });

  it('a Friday on the first day of the plan is planned', () => {
    const friday = day(3);
    const plan = planReminders(
      remindersInput({
        garden: bareEarth(),
        now: { date: friday, time: at(8, 0) },
        settings: FRIDAY_REMINDER_ONLY,
      }),
    );
    expect(plan.map((reminder) => reminder.date)).toEqual([
      friday,
      addDays(friday, 7),
      addDays(friday, 14),
      addDays(friday, 21),
      addDays(friday, 28),
    ]);
  });

  it('a Friday on the last day of the plan is planned, the next one is not', () => {
    const lastDay = day(3);
    const firstDay = addDays(lastDay, -29);
    const plan = planReminders(
      remindersInput({
        garden: bareEarth(),
        now: { date: firstDay, time: at(8, 0) },
        settings: FRIDAY_REMINDER_ONLY,
      }),
    );
    expect(plan.map((reminder) => reminder.date)).toEqual([
      addDays(lastDay, -28),
      addDays(lastDay, -21),
      addDays(lastDay, -14),
      addDays(lastDay, -7),
      lastDay,
    ]);
  });

  it('a garden reminder on the last day is planned, the one of the day after is not', () => {
    // Read today, then paused for 15 days: the eve of the death is day 29, the death day 30.
    const garden = gardenFromTimeline('', true, { pauses: [{ from: day(1), to: day(15) }] });
    expect(computeGardenState({ ...garden, today: day(30) }).phase).toBe('dead');
    const plan = planReminders(remindersInput({ garden, settings: GARDEN_REMINDERS_ONLY }));
    expect(readingKindsByOffset(plan)).toEqual({
      17: 'water-stopped',
      19: 'thirsty',
      22: 'wilting',
      26: 'dying',
      29: 'last-chance',
    });
  });

  it('a garden that dies on the last day gets its dead reminder', () => {
    const garden = gardenFromTimeline('', true, { pauses: [{ from: day(1), to: day(14) }] });
    const plan = planReminders(remindersInput({ garden, settings: GARDEN_REMINDERS_ONLY }));
    expect(offsetsOf(plan, 'last-chance', 'dead')).toEqual([28, 29]);
  });

  it('a come-back on the last day is planned', () => {
    // The garden dies tomorrow: its fourth come-back falls on the last day of the plan.
    expect(
      offsetsOf(
        planReminders(
          remindersInput({ garden: gardenLastReadDaysAgo(14), settings: GARDEN_REMINDERS_ONLY }),
        ),
        'come-back',
      ),
    ).toEqual([8, 15, 22, 29]);
  });

  it('crosses the end of a month, of a year, and a leap day', () => {
    const endOfYear = planReminders(
      remindersInput({
        garden: bareEarth(),
        now: { date: parseLocalDate('2027-12-20'), time: at(9, 0) },
        settings: DAILY_REMINDER_ONLY,
      }),
    );
    expect(endOfYear[11]?.date).toBe('2027-12-31');
    expect(endOfYear[12]?.date).toBe('2028-01-01');
    expect(endOfYear[29]?.date).toBe('2028-01-18');

    const leapYear = planReminders(
      remindersInput({
        garden: bareEarth(),
        now: { date: parseLocalDate('2028-02-20'), time: at(9, 0) },
        settings: DAILY_REMINDER_ONLY,
      }),
    );
    expect(leapYear[9]?.date).toBe('2028-02-29');
    expect(leapYear[10]?.date).toBe('2028-03-01');
  });
});

describe('same input, same plan', () => {
  it('gives the same plan twice', () => {
    const input = remindersInput({ garden: gardenLastReadDaysAgo(3) });
    expect(planReminders(input)).toEqual(planReminders(input));
  });

  it('does not modify its input', () => {
    const garden = gardenFromTimeline('WMPMW', false);
    const input = remindersInput({
      garden,
      settings: { ...ALL_REMINDERS_ON, quietHours: { from: at(22, 0), to: at(7, 0) } },
    });
    const wateredBefore = [...garden.wateredDays];
    const snapshot = JSON.stringify(input);
    planReminders(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect([...garden.wateredDays]).toEqual(wateredBefore);
  });

  it('ignores a `today` left in the garden input: the only clock is `now`', () => {
    const garden = gardenLastReadDaysAgo(1);
    const withStaleToday = { ...garden, today: day(-200) };
    expect(planReminders(remindersInput({ garden: withStaleToday }))).toEqual(
      planReminders(remindersInput({ garden })),
    );
  });
});

describe('a reminder whose time has already passed today is not in the plan', () => {
  const planAt = (hour: number, minute: number) =>
    planReminders(
      remindersInput({
        garden: bareEarth(),
        now: { date: day(0), time: at(hour, minute) },
        settings: DAILY_REMINDER_ONLY,
      }),
    );

  it('keeps the reminder of today one minute before its time', () => {
    expect(planAt(20, 29)[0]).toEqual(planned(day(0), DAILY_TIME, 'daily-goal'));
  });

  it('drops it at its exact time: it has just been delivered', () => {
    expect(planAt(20, 30)[0]?.date).toBe(day(1));
  });

  it('drops it after its time', () => {
    expect(planAt(20, 31)[0]?.date).toBe(day(1));
    expect(planAt(23, 59)[0]?.date).toBe(day(1));
  });

  it('keeps the 29 following days unchanged', () => {
    expect(planAt(23, 59)).toEqual(planAt(0, 0).slice(1));
  });

  it('each reminder is compared with its own time: on a Friday noon, only the evening one is left', () => {
    const friday = day(3);
    const planOn = (hour: number) =>
      planReminders(
        remindersInput({ garden: bareEarth(), now: { date: friday, time: at(hour, 0) } }),
      ).filter((reminder) => reminder.date === friday);
    expect(planOn(8)).toEqual([
      planned(friday, FRIDAY_TIME, 'friday-kahf'),
      planned(friday, DAILY_TIME, 'daily-goal'),
    ]);
    expect(planOn(9)).toEqual([planned(friday, DAILY_TIME, 'daily-goal')]);
    expect(planOn(12)).toEqual([planned(friday, DAILY_TIME, 'daily-goal')]);
    expect(planOn(21)).toEqual([]);
  });

  it('does not move a passed garden reminder to tomorrow', () => {
    // The garden became thirsty this morning; it is now 21:00.
    const plan = planReminders(
      remindersInput({
        garden: gardenLastReadDaysAgo(4),
        now: { date: day(0), time: at(21, 0) },
        settings: GARDEN_REMINDERS_ONLY,
      }),
    );
    expect(offsetsOf(plan, 'thirsty')).toEqual([]);
    expect(readingKindsByOffset(plan)).toEqual({
      3: 'wilting',
      7: 'dying',
      10: 'last-chance',
      11: 'dead',
      18: 'come-back',
      25: 'come-back',
    });
  });

  it('does not send dead a second time on the evening of the death', () => {
    const plan = planReminders(
      remindersInput({
        garden: gardenLastReadDaysAgo(15),
        now: { date: day(0), time: at(22, 0) },
        settings: GARDEN_REMINDERS_ONLY,
      }),
    );
    expect(offsetsOf(plan, 'dead')).toEqual([]);
    expect(offsetsOf(plan, 'come-back')).toEqual([7, 14, 21, 28]);
  });

  it('compares with the time after the quiet hours moved it', () => {
    const settings = {
      ...DAILY_REMINDER_ONLY,
      dailyTime: at(14, 0),
      quietHours: { from: at(13, 0), to: at(15, 0) },
    };
    const stillToCome = planReminders(
      remindersInput({ garden: bareEarth(), now: { date: day(0), time: at(14, 30) }, settings }),
    );
    expect(stillToCome[0]).toEqual(planned(day(0), at(15, 0), 'daily-goal'));
  });
});

describe('bare earth: only daily-goal and friday-kahf exist', () => {
  it('plans no garden reminder, even after weeks without reading', () => {
    const garden = bareEarth([day(-40), day(-39)]);
    const plan = planReminders(remindersInput({ garden }));
    expect(offsetsOf(plan, ...GARDEN_KINDS)).toEqual([]);
    expect(offsetsOf(plan, 'friday-kahf')).toEqual([3, 10, 17, 24]);
    expect(offsetsOf(plan, 'daily-goal')).toHaveLength(30);
    expect(plan).toHaveLength(34);
  });

  it('plans nothing when only the garden reminders are on', () => {
    expect(
      planReminders(remindersInput({ garden: bareEarth(), settings: GARDEN_REMINDERS_ONLY })),
    ).toEqual([]);
  });

  it('is never silenced: a garden that is not born cannot die', () => {
    const plan = planReminders(
      remindersInput({ garden: bareEarth([day(-300)]), settings: DAILY_REMINDER_ONLY }),
    );
    expect(plan).toHaveLength(30);
  });
});

describe('a garden born a moment ago', () => {
  it('first hizb finished today: the water stops in two days', () => {
    const garden = {
      ...bareEarth([day(-2), day(-1), day(0)]),
      hizbCompleted: 1,
      firstHizbCompletedOn: day(0),
    };
    const plan = planReminders(remindersInput({ garden, settings: GARDEN_REMINDERS_ONLY }));
    expect(readingKindsByOffset(plan)).toEqual({
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

  it('first hizb finished after a month of absence: no reminder about the days before', () => {
    const garden = {
      ...bareEarth([day(-45), day(0)]),
      hizbCompleted: 1,
      firstHizbCompletedOn: day(0),
    };
    const plan = planReminders(remindersInput({ garden, settings: GARDEN_REMINDERS_ONLY }));
    expect(plan[0]).toEqual(planned(day(2), DAILY_TIME, 'water-stopped'));
  });
});

describe('complete garden: only daily-goal and friday-kahf exist', () => {
  // The khatma was finished `completedDaysAgo` days ago, and nothing was read since.
  const completeGarden = (completedDaysAgo: number) =>
    gardenFromTimeline(`W${'M'.repeat(completedDaysAgo - 1)}`, false, {
      hizbCompleted: 60,
      currentHizbProgress: 0,
      completedOn: day(-completedDaysAgo),
    });

  it('plans no garden reminder the day after the khatma is finished', () => {
    const plan = planReminders(
      remindersInput({ garden: completeGarden(1), settings: GARDEN_REMINDERS_ONLY }),
    );
    expect(plan).toEqual([]);
  });

  it('plans no garden reminder a month later either', () => {
    const plan = planReminders(
      remindersInput({ garden: completeGarden(35), settings: GARDEN_REMINDERS_ONLY }),
    );
    expect(plan).toEqual([]);
  });

  it('keeps the daily and the Friday reminders, without any silence', () => {
    const plan = planReminders(remindersInput({ garden: completeGarden(60) }));
    expect(offsetsOf(plan, 'friday-kahf')).toEqual([3, 10, 17, 24]);
    expect(offsetsOf(plan, 'daily-goal')).toHaveLength(30);
    expect(plan).toHaveLength(34);
  });

  it('a khatma finished after a long absence: no silence, the garden is complete', () => {
    // 30 days of absence, then the khatma was finished 3 days ago.
    const garden = gardenFromTimeline(`${'M'.repeat(30)}WMM`, false, {
      hizbCompleted: 60,
      currentHizbProgress: 0,
      completedOn: day(-3),
    });
    expect(computeGardenState({ ...garden, today: day(0) }).phase).toBe('thriving');
    const plan = planReminders(remindersInput({ garden }));
    expect(offsetsOf(plan, 'daily-goal')).toHaveLength(30);
    expect(offsetsOf(plan, ...GARDEN_KINDS)).toEqual([]);
  });

  it('60 hizb without a completion day: the garden module shows it complete all the same', () => {
    const garden = gardenLastReadDaysAgo(20, { hizbCompleted: 60, currentHizbProgress: 0 });
    expect(computeGardenState({ ...garden, today: day(0) }).phase).toBe('thriving');
    const plan = planReminders(remindersInput({ garden }));
    expect(offsetsOf(plan, ...GARDEN_KINDS)).toEqual([]);
    expect(offsetsOf(plan, 'daily-goal')).toHaveLength(30);
  });
});

describe('garden already dead', () => {
  it('dead since yesterday: dead is not sent again, the four come-back are still to come', () => {
    const plan = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(16) }));
    expect(readingKindsByOffset(plan)).toEqual({
      6: 'come-back',
      13: 'come-back',
      20: 'come-back',
      27: 'come-back',
    });
    expect(offsetsOf(plan, 'friday-kahf')).toEqual([3, 10, 17, 24]);
  });

  it('dead for exactly three weeks: today carries the third come-back, one more is left', () => {
    const plan = planReminders(
      remindersInput({ garden: gardenLastReadDaysAgo(36), settings: GARDEN_REMINDERS_ONLY }),
    );
    expect(readingKindsByOffset(plan)).toEqual({ 0: 'come-back', 7: 'come-back' });
  });

  it('dead for 22 days: a single come-back is left', () => {
    const plan = planReminders(
      remindersInput({ garden: gardenLastReadDaysAgo(37), settings: GARDEN_REMINDERS_ONLY }),
    );
    expect(readingKindsByOffset(plan)).toEqual({ 6: 'come-back' });
  });

  it('dead for months: only the Friday reminder is left', () => {
    const plan = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(119) }));
    expect(plan.map((reminder) => reminder.kind)).toEqual(Array(4).fill('friday-kahf'));
    const noFriday = { ...ALL_REMINDERS_ON, fridayKahfEnabled: false };
    expect(
      planReminders(remindersInput({ garden: gardenLastReadDaysAgo(119), settings: noFriday })),
    ).toEqual([]);
  });

  it('dies on a paused day: dead is dropped, the come-back still count from that day', () => {
    const garden = gardenLastReadDaysAgo(15, { pauses: [{ from: day(0), to: day(0) }] });
    const plan = planReminders(remindersInput({ garden, settings: GARDEN_REMINDERS_ONLY }));
    expect(readingKindsByOffset(plan)).toEqual({
      7: 'come-back',
      14: 'come-back',
      21: 'come-back',
      28: 'come-back',
    });
  });
});

describe('every reminder off', () => {
  it('gives an empty plan, whatever the garden', () => {
    for (const daysAgo of [0, 1, 4, 14, 15, 16, 60]) {
      const plan = planReminders(
        remindersInput({ garden: gardenLastReadDaysAgo(daysAgo), settings: ALL_REMINDERS_OFF }),
      );
      expect(plan).toEqual([]);
    }
    expect(
      planReminders(remindersInput({ garden: bareEarth(), settings: ALL_REMINDERS_OFF })),
    ).toEqual([]);
  });
});

describe('the garden rules come from the garden module', () => {
  it('follows a garden configuration with other thresholds', () => {
    const config = {
      ...DEFAULT_GARDEN_CONFIG,
      thirstyMinDroughtDays: 2,
      wiltingMinDroughtDays: 4,
      dyingMinDroughtDays: 5,
      droughtDaysToDeath: 7,
      dryWaterMinMissedDays: 1,
    };
    const garden = gardenLastReadDaysAgo(1, { config });
    const plan = planReminders(remindersInput({ garden, settings: GARDEN_REMINDERS_ONLY }));
    expect(readingKindsByOffset(plan)).toEqual({
      1: 'water-stopped',
      2: 'thirsty',
      4: 'wilting',
      5: 'dying',
      6: 'last-chance',
      7: 'dead',
      14: 'come-back',
      21: 'come-back',
      28: 'come-back',
    });
  });

  it('does not fail when a day read lies after today (time-zone change)', () => {
    const garden = gardenLastReadDaysAgo(1);
    const withFutureDay = { ...garden, wateredDays: new Set([...garden.wateredDays, day(2)]) };
    const plan = planReminders(
      remindersInput({ garden: withFutureDay, settings: GARDEN_REMINDERS_ONLY }),
    );
    // The water stops tomorrow, flows again on the day already read, stops again after it.
    expect(offsetsOf(plan, 'water-stopped')).toEqual([1, 4]);
  });
});

describe('output: an ordered list of { date, time, kind, params }, without any text', () => {
  const plan = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(1) }));

  it('each reminder has exactly a date, a time, a kind and params', () => {
    for (const reminder of plan) {
      expect(Object.keys(reminder).sort()).toEqual(['date', 'kind', 'params', 'time']);
      expect(Object.keys(reminder.time).sort()).toEqual(['hour', 'minute']);
      expect(parseLocalDate(reminder.date)).toBe(reminder.date);
    }
  });

  it('is plain data: it survives JSON as it is', () => {
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });

  it('params stays empty: nothing sensitive can reach a locked screen', () => {
    const gardens = [0, 1, 2, 4, 7, 11, 14, 15, 16, 30].map((daysAgo) =>
      gardenLastReadDaysAgo(daysAgo),
    );
    for (const garden of [...gardens, bareEarth()]) {
      for (const pagesReadToday of [0, 3, 5]) {
        for (const reminder of planReminders(remindersInput({ garden, pagesReadToday }))) {
          expect(reminder.params).toEqual({});
        }
      }
    }
  });

  it('the example of the report: 20 hizb, last read yesterday, reading at 20:30, Friday at 09:00', () => {
    const line = (reminder: (typeof plan)[number]) =>
      `${reminder.date} ${String(reminder.time.hour).padStart(2, '0')}:${String(reminder.time.minute).padStart(2, '0')} ${reminder.kind}`;
    expect(plan.map(line)).toEqual([
      '2026-11-24 20:30 daily-goal',
      '2026-11-25 20:30 water-stopped',
      '2026-11-26 20:30 daily-goal',
      '2026-11-27 09:00 friday-kahf',
      '2026-11-27 20:30 thirsty',
      '2026-11-28 20:30 daily-goal',
      '2026-11-29 20:30 daily-goal',
      '2026-11-30 20:30 wilting',
      '2026-12-01 20:30 daily-goal',
      '2026-12-02 20:30 daily-goal',
      '2026-12-03 20:30 daily-goal',
      '2026-12-04 09:00 friday-kahf',
      '2026-12-04 20:30 dying',
      '2026-12-05 20:30 daily-goal',
      '2026-12-06 20:30 daily-goal',
      '2026-12-07 20:30 last-chance',
      '2026-12-08 20:30 dead',
      '2026-12-11 09:00 friday-kahf',
      '2026-12-15 20:30 come-back',
      '2026-12-18 09:00 friday-kahf',
      '2026-12-22 20:30 come-back',
    ]);
  });
});
