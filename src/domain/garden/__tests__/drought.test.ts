import { addDays, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

import {
  computeGardenState,
  DEFAULT_GARDEN_CONFIG,
  REFERENCE_GARDEN_VARIANT,
  type GardenInput,
  type GardenState,
} from '../index';
import { GARDEN_FIRST_DAY, gardenInput, type TodayKind } from '../test-support/garden-test-kit';

function droughtAfter(past: string, today: TodayKind = 'unread'): number {
  return computeGardenState(gardenInput(past, today)).droughtDays;
}

const day = (offset: number): LocalDate => addDays(GARDEN_FIRST_DAY, offset);

describe('garden drought', () => {
  it('starts at 0: a garden is born at full health', () => {
    const state = computeGardenState(gardenInput(''));
    expect(state.droughtDays).toBe(0);
    expect(state.health).toBe(1);
  });

  describe('missed day: drought + 1, capped at 14', () => {
    it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])(
      'after %i missed days in a row, the drought is that many days',
      (missedDays) => {
        expect(droughtAfter('M'.repeat(missedDays))).toBe(missedDays);
      },
    );

    it('never goes above 14', () => {
      expect(droughtAfter('M'.repeat(15))).toBe(14);
      expect(droughtAfter('M'.repeat(400))).toBe(14);
    });

    it('adds up missed days that are not in a row', () => {
      expect(droughtAfter('MMMMM W MM')).toBe(4); // 5, then 2, then 4
    });
  });

  describe('watered day: drought - 3, never below 0', () => {
    it('takes back three drought days', () => {
      expect(droughtAfter('MMMMM')).toBe(5);
      expect(droughtAfter('MMMMM W')).toBe(2);
      expect(droughtAfter('MMMMMMMMMM W')).toBe(7);
      expect(droughtAfter('MMMMMMMMMM WW')).toBe(4);
    });

    it('never goes below 0', () => {
      expect(droughtAfter('M W')).toBe(0);
      expect(droughtAfter('MM W')).toBe(0);
      expect(droughtAfter('MMM W')).toBe(0);
      expect(droughtAfter('MMM WWWW')).toBe(0);
      expect(droughtAfter('WWWWWWWWWW')).toBe(0);
    });

    it('from a dead earth, five days of reading bring back full health, and the first already revives it', () => {
      const dead = 'M'.repeat(20);
      const after = (reading: string): GardenState =>
        computeGardenState(gardenInput(`${dead} ${reading}`));
      expect(after('')).toMatchObject({ droughtDays: 14, phase: 'dead', health: 0 });
      expect(after('W')).toMatchObject({ droughtDays: 11, phase: 'dying' });
      expect(after('WW')).toMatchObject({ droughtDays: 8, phase: 'wilting' });
      expect(after('WWW')).toMatchObject({ droughtDays: 5, phase: 'thirsty' });
      expect(after('WWWW')).toMatchObject({ droughtDays: 2, phase: 'thriving' });
      expect(after('WWWWW')).toMatchObject({ droughtDays: 0, phase: 'thriving', health: 1 });
    });

    it('revives a dead earth the very day the user reads again, however long the absence', () => {
      for (const missedDays of [14, 15, 300]) {
        const state = computeGardenState(gardenInput('M'.repeat(missedDays), 'read'));
        expect(state.droughtDays).toBe(11);
        expect(state.phase).toBe('dying');
        expect(state.water).toBe('flowing');
        expect(state.visibleElements.length).toBeGreaterThan(0);
      }
    });
  });

  describe('paused day: nothing changes, the run of missed days is neither extended nor reset', () => {
    it('freezes the drought', () => {
      expect(droughtAfter('MMM PPPPPPPPPP')).toBe(3);
      expect(droughtAfter('WW PPPPPPPPPPPPPPPPPPPP')).toBe(0);
    });

    it('does not extend the run of missed days', () => {
      const state = computeGardenState(gardenInput('MMM PPPPP'));
      expect(state.missedDaysInARow).toBe(3);
      expect(state.water).toBe('dry');
    });

    it('does not reset the run: the missed day after the pause continues the count', () => {
      const state = computeGardenState(gardenInput('MM PPPPP M'));
      expect(state.missedDaysInARow).toBe(3);
      expect(state.droughtDays).toBe(3);
      expect(state.water).toBe('dry');
    });

    it('does not help either: no recovery during a pause', () => {
      expect(droughtAfter('MMMMMM PPP')).toBe(6);
    });

    it('counts a day read during a pause as watered (reading is never ignored)', () => {
      const state = computeGardenState(gardenInput('MMMM R'));
      expect(state.droughtDays).toBe(1);
      expect(state.missedDaysInARow).toBe(0);
    });

    it('accepts pauses of several days, overlapping or partly outside the garden life', () => {
      const input: GardenInput = {
        ...gardenInput('MMMMMMMMMM'),
        pauses: [
          { from: day(-30), to: day(0) }, // starts before the garden: covers day 0 only
          { from: day(3), to: day(5) },
          { from: day(4), to: day(7) }, // overlaps the previous one
          { from: day(20), to: day(40) }, // entirely in the future
        ],
      };
      // Days 0 and 3..7 are paused: only days 1, 2, 8 and 9 are missed.
      const state = computeGardenState(input);
      expect(state.missedDaysInARow).toBe(4);
      expect(state.droughtDays).toBe(4);
      expect(state.isPausedToday).toBe(false);
    });
  });

  describe('the day in progress never penalises', () => {
    it('ignores today while it is not watered', () => {
      expect(droughtAfter('WWW', 'unread')).toBe(0);
      expect(droughtAfter('MMMMM', 'unread')).toBe(5);
      expect(computeGardenState(gardenInput('MMMMM', 'unread')).missedDaysInARow).toBe(5);
    });

    it('counts today as soon as it is watered', () => {
      const state = computeGardenState(gardenInput('MMMMM', 'read'));
      expect(state.droughtDays).toBe(2);
      expect(state.missedDaysInARow).toBe(0);
    });

    it('turns an unread today into a missed day only the next day', () => {
      const todayInProgress = gardenInput('MMM', 'unread');
      const nextDay = { ...todayInProgress, today: addDays(todayInProgress.today, 1) };
      expect(computeGardenState(todayInProgress).droughtDays).toBe(3);
      expect(computeGardenState(nextDay).droughtDays).toBe(4);
      expect(computeGardenState(nextDay).missedDaysInARow).toBe(4);
    });

    it('ignores an unread today inside a pause too', () => {
      const state = computeGardenState(gardenInput('MMM', 'paused-unread'));
      expect(state.droughtDays).toBe(3);
      expect(state.missedDaysInARow).toBe(3);
    });
  });

  describe('health follows the drought: 1 - droughtDays / 14', () => {
    it.each([
      [0, 1],
      [1, 13 / 14],
      [3, 11 / 14],
      [7, 0.5],
      [13, 1 / 14],
      [14, 0],
    ])('with %i drought days, health is %f', (droughtDays, health) => {
      const state = computeGardenState(gardenInput('M'.repeat(droughtDays)));
      expect(state.droughtDays).toBe(droughtDays);
      expect(state.health).toBeCloseTo(health, 12);
    });

    it('is exactly 1 without drought and exactly 0 when dead', () => {
      expect(computeGardenState(gardenInput('W'.repeat(200), 'read')).health).toBe(1);
      expect(computeGardenState(gardenInput('M'.repeat(200))).health).toBe(0);
    });

    it('falls a little with each drought day: fourteen different values from 1 to 0', () => {
      const healths = Array.from(
        { length: 15 },
        (_, droughtDays) => computeGardenState(gardenInput('M'.repeat(droughtDays))).health,
      );
      for (let index = 1; index < healths.length; index += 1) {
        expect(healths[index]).toBeLessThan(healths[index - 1] ?? Number.NaN);
      }
    });
  });

  describe('landmarks, from a garden at full health', () => {
    it.each([
      [0, 'thriving'],
      [2, 'thriving'],
      [3, 'thirsty'], // 3 days without reading: it is thirsty
      [6, 'wilting'], // 6: it wilts
      [10, 'dying'], // 10: it is dying, elements disappear
      [14, 'dead'], // 14: dead earth
    ])('after %i days without reading, the garden is %s', (missedDays, phase) => {
      expect(computeGardenState(gardenInput('M'.repeat(missedDays))).phase).toBe(phase);
    });
  });
});

describe('before the first hizb, the garden does not exist yet: nothing can dry', () => {
  it('keeps a bare earth without drought, whatever the history', () => {
    const state = computeGardenState(gardenInput('M'.repeat(30), 'unread', { hizbCompleted: 0 }));
    expect(state.droughtDays).toBe(0);
    expect(state.health).toBe(1);
    expect(state.phase).toBe('bare');
  });

  it('counts no missed day on a bare earth', () => {
    const state = computeGardenState(gardenInput('W MMMMM', 'unread', { hizbCompleted: 0 }));
    expect(state.missedDaysInARow).toBe(0);
  });

  it('does not count the days before the first hizb, missed or watered', () => {
    // First page on day 0, a month away, first hizb finished on day 31.
    const living = (wateredBefore: LocalDate[], today: LocalDate): GardenState =>
      computeGardenState({
        ...gardenInput(''),
        hizbCompleted: 1,
        firstHizbCompletedOn: day(31),
        wateredDays: new Set([...wateredBefore, day(31)]),
        today,
      });
    const afterAMonthAway = living([day(0)], day(33));
    const afterAMonthOfReading = living(
      Array.from({ length: 31 }, (_, index) => day(index)),
      day(33),
    );
    // Only day 32 is missed, whatever happened before day 31.
    expect(afterAMonthAway.droughtDays).toBe(1);
    expect(afterAMonthAway.missedDaysInARow).toBe(1);
    expect(afterAMonthOfReading).toEqual(afterAMonthAway);
  });

  it('one hizb only, finished after a month of absence: the garden is born at full health', () => {
    const state = computeGardenState({
      ...gardenInput(''),
      hizbCompleted: 1,
      firstHizbCompletedOn: day(31),
      wateredDays: new Set([day(0), day(31)]),
      today: day(31),
    });
    expect(state.droughtDays).toBe(0);
    expect(state.health).toBe(1);
    expect(state.phase).toBe('thriving');
    expect(state.water).toBe('flowing');
    expect(state.missedDaysInARow).toBe(0);
    expect(state.visibleElements.map((element) => element.id)).toEqual(['channels']);
  });

  // By design (ruling of the architect): a garden that exists can die. Finishing the first
  // hizb sooner exposes the garden sooner; coming back shows it reviving.
  it('lets a garden dry from its first hizb on, however early that hizb was finished', () => {
    // Both readers read on day 0, stay away three weeks, and read again on day 22.
    const seenOnDay22 = (firstHizbDay: number, readThatDay: boolean): GardenState =>
      computeGardenState({
        ...gardenInput(''),
        hizbCompleted: 1,
        firstHizbCompletedOn: day(firstHizbDay),
        wateredDays: new Set(readThatDay ? [day(0), day(22)] : [day(0)]),
        today: day(22),
      });
    // One page short of the hizb on day 0: the garden is born on day 22, at full health.
    expect(seenOnDay22(22, true)).toMatchObject({ droughtDays: 0, phase: 'thriving' });
    expect(seenOnDay22(22, true).visibleElements).toHaveLength(1);
    // The whole hizb on day 0: the garden dried for three weeks and died...
    expect(seenOnDay22(0, false)).toMatchObject({ droughtDays: 14, phase: 'dead' });
    expect(seenOnDay22(0, false).visibleElements).toHaveLength(0);
    // ...and the reading of day 22 brings its element back.
    expect(seenOnDay22(0, true)).toMatchObject({ droughtDays: 11, phase: 'dying' });
    expect(seenOnDay22(0, true).visibleElements).toHaveLength(1);
  });

  it('starts drying only once the day after the first hizb is over', () => {
    const born = gardenInput('', 'read', { hizbCompleted: 1 });
    const onDay = (offset: number): GardenState =>
      computeGardenState({ ...born, today: day(offset) });
    expect(onDay(0).droughtDays).toBe(0);
    expect(onDay(1).droughtDays).toBe(0); // day 1 is in progress
    expect(onDay(2).droughtDays).toBe(1); // day 1 was missed
  });
});

describe('complete garden: always at full health, whatever the dates', () => {
  /** 60 hizb, finished on day 10 after reading every day. */
  const completed: GardenInput = {
    ...gardenInput(''),
    hizbCompleted: 60,
    wateredDays: new Set(Array.from({ length: 11 }, (_, index) => day(index))),
    completedOn: day(10),
    today: day(10),
  };

  it('complete garden, then a month without reading: unchanged', () => {
    const onCompletionDay = computeGardenState(completed);
    const aMonthLater = computeGardenState({ ...completed, today: day(40) });
    expect(onCompletionDay).toMatchObject({ droughtDays: 0, phase: 'thriving', water: 'flowing' });
    expect(onCompletionDay.visibleElements).toHaveLength(60);
    expect(aMonthLater).toEqual(onCompletionDay);
  });

  it('stays unchanged for years', () => {
    expect(computeGardenState({ ...completed, today: day(3000) })).toEqual(
      computeGardenState(completed),
    );
  });

  it('ignores what comes after the completion day: reading, pauses', () => {
    const later: GardenInput = {
      ...completed,
      today: day(40),
      wateredDays: new Set([...completed.wateredDays, day(20), day(40)]),
      pauses: [{ from: day(30), to: day(50) }],
    };
    expect(computeGardenState(later)).toEqual(computeGardenState(completed));
  });

  it('is at full health even when today falls before the completion day (time-zone change)', () => {
    // Read on days 0 to 3, away on days 4 to 9, last page on day 10.
    const lateFinish: GardenInput = {
      ...completed,
      wateredDays: new Set([day(0), day(1), day(2), day(3), day(10)]),
    };
    const onCompletionDay = computeGardenState(lateFinish);
    expect(onCompletionDay).toMatchObject({ droughtDays: 0, phase: 'thriving', water: 'flowing' });
    for (const today of [day(9), day(5), day(-3), day(400)]) {
      expect(computeGardenState({ ...lateFinish, today })).toEqual(onCompletionDay);
    }
  });

  it('khatma finished after an absence: a complete garden at full health, not a dying one', () => {
    // Read on day 0, away for 14 days, the last pages on day 15.
    const finishedAfterAbsence: GardenInput = {
      ...completed,
      wateredDays: new Set([day(0), day(15)]),
      completedOn: day(15),
      today: day(15),
    };
    // That morning, before the last pages, the earth was dead.
    const thatMorning = computeGardenState({
      ...finishedAfterAbsence,
      hizbCompleted: 59,
      wateredDays: new Set([day(0)]),
      completedOn: null,
    });
    expect(thatMorning).toMatchObject({ droughtDays: 14, phase: 'dead' });

    const onCompletionDay = computeGardenState(finishedAfterAbsence);
    expect(onCompletionDay).toMatchObject({
      droughtDays: 0,
      health: 1,
      phase: 'thriving',
      water: 'flowing',
      missedDaysInARow: 0,
      isComplete: true,
    });
    // Every element, the last one included.
    expect(onCompletionDay.visibleElements).toHaveLength(60);
    expect(onCompletionDay.visibleElements.at(-1)?.id).toBe('full-bloom');
    expect(computeGardenState({ ...finishedAfterAbsence, today: day(200) })).toEqual(
      onCompletionDay,
    );
  });

  it('is at full health even if the completion day is not a watered day', () => {
    const state = computeGardenState({
      ...completed,
      wateredDays: new Set([day(0)]),
      today: day(30),
    });
    expect(state).toMatchObject({ droughtDays: 0, water: 'flowing', missedDaysInARow: 0 });
    expect(state.visibleElements).toHaveLength(60);
  });

  it('is never both complete and dying or dead: 60 hizb without completion day are at full health too', () => {
    for (const missedDays of [0, 3, 10, 14, 200]) {
      const state = computeGardenState(
        gardenInput('M'.repeat(missedDays), 'unread', { hizbCompleted: 60 }),
      );
      expect(state.isComplete).toBe(true);
      expect(state).toMatchObject({
        droughtDays: 0,
        health: 1,
        phase: 'thriving',
        water: 'flowing',
      });
      expect(state.visibleElements).toHaveLength(60);
    }
  });

  it('reports the complete garden as on a day just read: 0 day since watered, nothing missed, no pause', () => {
    const state = computeGardenState({
      ...gardenInput('M'.repeat(30), 'paused-unread', { hizbCompleted: 60 }),
      completedOn: day(2),
    });
    expect(state.daysSinceLastWatered).toBe(0);
    expect(state.missedDaysInARow).toBe(0);
    expect(state.isPausedToday).toBe(false);
  });

  it('is one hizb away from an ordinary garden: at 59 hizb the same history is a dead earth', () => {
    const state = computeGardenState(gardenInput('M'.repeat(14), 'unread', { hizbCompleted: 59 }));
    expect(state.isComplete).toBe(false);
    expect(state.phase).toBe('dead');
  });
});

describe('what the rules mean for a regular reader', () => {
  /** The drought seen each morning of a year by someone who repeats `habit` for ever. */
  const droughtsOverAYear = (habit: string): number[] => {
    const year = habit.repeat(Math.ceil(365 / habit.length)).slice(0, 365);
    return Array.from(
      { length: 365 },
      (_, index) => computeGardenState(gardenInput(year.slice(0, index + 1))).droughtDays,
    );
  };

  it('reading every day, or every other day, keeps the garden thriving for ever', () => {
    expect(Math.max(...droughtsOverAYear('W'))).toBe(0);
    expect(Math.max(...droughtsOverAYear('WM'))).toBe(1);
  });

  // A tuning question for the owner: the threshold below is set by one constant.
  it('droughtDaysRecoveredPerWateredDay = 3: reading one day in four is enough never to go past thirsty', () => {
    expect(DEFAULT_GARDEN_CONFIG.droughtDaysRecoveredPerWateredDay).toBe(3);
    expect(Math.max(...droughtsOverAYear('WMMM'))).toBe(3);
  });

  it('droughtDaysRecoveredPerWateredDay = 3: reading one day in five is not, the garden ends up dying, and dead two mornings in five', () => {
    const droughts = droughtsOverAYear('WMMMM');
    expect(droughts.slice(-5)).toEqual([11, 12, 13, 14, 14]);
  });

  it('droughtDaysRecoveredPerWateredDay moves that threshold: with 4, one day in five holds', () => {
    const config = { ...DEFAULT_GARDEN_CONFIG, droughtDaysRecoveredPerWateredDay: 4 };
    const year = 'WMMMM'.repeat(73);
    const worst = Math.max(
      ...Array.from(
        { length: 365 },
        (_, index) =>
          computeGardenState(gardenInput(year.slice(0, index + 1), 'unread', { config }))
            .droughtDays,
      ),
    );
    expect(worst).toBe(4);
  });
});

describe('day boundaries', () => {
  const date = (value: string): LocalDate => parseLocalDate(value);
  const gardenBetween = (firstDay: LocalDate, today: LocalDate, watered: string[]): GardenState =>
    computeGardenState({
      hizbCompleted: 24,
      currentHizbProgress: 0,
      firstHizbCompletedOn: firstDay,
      completedOn: null,
      today,
      wateredDays: new Set(watered.map(date)),
      pauses: [],
      variant: REFERENCE_GARDEN_VARIANT,
    });

  it('counts the days across the end of a month and of a year', () => {
    // Read on 30 December; 31 December and 1 January are missed; today is 2 January.
    const state = gardenBetween(date('2026-12-30'), date('2027-01-02'), ['2026-12-30']);
    expect(state.missedDaysInARow).toBe(2);
    expect(state.daysSinceLastWatered).toBe(3);
    expect(state.droughtDays).toBe(2);
  });

  it('counts 29 February in a leap year, and only then', () => {
    const leapYear = gardenBetween(date('2028-02-28'), date('2028-03-01'), ['2028-02-28']);
    const commonYear = gardenBetween(date('2027-02-28'), date('2027-03-01'), ['2027-02-28']);
    expect(leapYear.missedDaysInARow).toBe(1); // 29 February was missed
    expect(commonYear.missedDaysInARow).toBe(0); // 28 February is the day before 1 March
  });

  it('is not shifted by a daylight-saving change (days are calendar days, not 24 hours)', () => {
    // 29 March 2026 lasts 23 hours in Europe: it must still count as one day.
    const state = gardenBetween(date('2026-03-28'), date('2026-03-31'), ['2026-03-28']);
    expect(state.missedDaysInARow).toBe(2);
    expect(state.daysSinceLastWatered).toBe(3);
  });

  it('changes at midnight only: the same today gives the same garden all day long', () => {
    const input = gardenInput('W MM', 'unread');
    const tomorrow = { ...input, today: addDays(input.today, 1) };
    expect(computeGardenState(input).droughtDays).toBe(2);
    expect(computeGardenState(input).phase).toBe('thriving');
    expect(computeGardenState(tomorrow).droughtDays).toBe(3);
    expect(computeGardenState(tomorrow).phase).toBe('thirsty');
  });

  it('lets a reading late on the last day cancel that day entirely', () => {
    const unread = gardenInput('W MM', 'unread');
    const readJustBeforeMidnight = gardenInput('W MM', 'read');
    const nextMorning = (input: GardenInput): GardenInput => ({
      ...input,
      today: addDays(input.today, 1),
    });
    expect(computeGardenState(nextMorning(unread)).droughtDays).toBe(3);
    expect(computeGardenState(nextMorning(readJustBeforeMidnight)).droughtDays).toBe(0);
  });
});

describe('pauses, at their edges', () => {
  /** Ten days that are over (0..9), none read, with one pause; today is day 10. */
  const droughtWithPause = (from: number, to: number): number =>
    computeGardenState({
      ...gardenInput('MMMMMMMMMM'),
      pauses: [{ from: day(from), to: day(to) }],
    }).droughtDays;

  it('includes its first and its last day', () => {
    expect(droughtWithPause(3, 5)).toBe(7); // days 3, 4 and 5 are frozen
    expect(droughtWithPause(4, 4)).toBe(9); // a one-day pause freezes exactly one day
  });

  it('protects yesterday when it ends yesterday, and not when it ends the day before', () => {
    expect(droughtWithPause(0, 9)).toBe(0); // everything is frozen
    expect(droughtWithPause(0, 8)).toBe(1); // only yesterday is missed
  });

  it('has no effect once it is entirely before the garden or after today', () => {
    expect(droughtWithPause(-10, -1)).toBe(10);
    expect(droughtWithPause(11, 20)).toBe(10);
    expect(droughtWithPause(10, 20)).toBe(10); // starts today: today never counts anyway
  });

  it('resumes the decline where it stopped: the pause does not forgive what came before', () => {
    const short = computeGardenState(gardenInput('MMM P M'));
    const long = computeGardenState(gardenInput(`MMM ${'P'.repeat(120)} M`));
    expect(short.droughtDays).toBe(4);
    expect(long.droughtDays).toBe(4);
    expect(long.missedDaysInARow).toBe(4);
  });

  it('lets a reading inside a pause restart the run of missed days', () => {
    const state = computeGardenState(gardenInput('MMMMM PP R PP M'));
    expect(state.missedDaysInARow).toBe(1);
    expect(state.droughtDays).toBe(3); // 5, then 2, then 3
  });
});

describe('dates "in the future" never throw (time-zone change)', () => {
  it('shows a newborn garden when today falls before the day of the first hizb', () => {
    const input: GardenInput = { ...gardenInput('', 'read', { hizbCompleted: 1 }), today: day(-1) };
    const state = computeGardenState(input);
    expect(state.droughtDays).toBe(0);
    expect(state.phase).toBe('thriving');
    expect(state.missedDaysInARow).toBe(0);
    expect(state.water).toBe('flowing');
    // The reading of "tomorrow" is not counted yet.
    expect(state.daysSinceLastWatered).toBeNull();
  });

  it('ignores a watered day dated after today, until that day comes', () => {
    const input = gardenInput('W MM', 'unread');
    const withTomorrowRead: GardenInput = {
      ...input,
      wateredDays: new Set([...input.wateredDays, addDays(input.today, 1)]),
    };
    expect(computeGardenState(withTomorrowRead)).toEqual(computeGardenState(input));
    const tomorrow = addDays(input.today, 1);
    expect(computeGardenState({ ...withTomorrowRead, today: tomorrow }).droughtDays).toBe(0);
  });

  it('accepts a completion day and pauses dated after today', () => {
    const input: GardenInput = {
      ...gardenInput('WW', 'read', { hizbCompleted: 60 }),
      completedOn: day(5),
      pauses: [{ from: day(30), to: day(40) }],
    };
    expect(() => computeGardenState(input)).not.toThrow();
    expect(computeGardenState(input).droughtDays).toBe(0);
  });

  it('accepts a completion day dated before the first hizb: the garden is simply newborn', () => {
    const input: GardenInput = {
      ...gardenInput('MMMM', 'unread', { hizbCompleted: 60 }),
      completedOn: day(-3),
    };
    expect(computeGardenState(input).droughtDays).toBe(0);
  });
});

describe('very long histories', () => {
  const start = parseLocalDate('1996-01-01');
  const today = parseLocalDate('2026-11-23');

  it('handles thirty years of daily reading', () => {
    const wateredDays = new Set<LocalDate>();
    for (let current = start; current <= today; current = addDays(current, 1)) {
      wateredDays.add(current);
    }
    const state = computeGardenState({
      hizbCompleted: 59,
      currentHizbProgress: 0,
      wateredDays,
      firstHizbCompletedOn: start,
      completedOn: null,
      today,
      pauses: [],
      variant: REFERENCE_GARDEN_VARIANT,
    });
    expect(state.droughtDays).toBe(0);
    expect(state.visibleElements).toHaveLength(59);
  });

  it('handles thirty years without reading, then a return', () => {
    const yesterday = addDays(today, -1);
    const state = computeGardenState({
      hizbCompleted: 10,
      currentHizbProgress: 0,
      wateredDays: new Set([yesterday, today]),
      firstHizbCompletedOn: start,
      completedOn: null,
      today,
      pauses: [{ from: parseLocalDate('2000-01-01'), to: parseLocalDate('2019-12-31') }],
      variant: REFERENCE_GARDEN_VARIANT,
    });
    expect(state.droughtDays).toBe(8);
    expect(state.phase).toBe('wilting');
  });
});
