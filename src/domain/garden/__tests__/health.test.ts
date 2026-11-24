import { addDays, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

import { computeGardenState, type GardenInput } from '../index';
import { GARDEN_START_DATE, gardenInput, type TodayKind } from '../test-support/garden-test-kit';

function healthAfter(past: string, today: TodayKind = 'unread'): number {
  return computeGardenState(gardenInput(past, today)).health;
}

describe('garden health', () => {
  it('starts at 1', () => {
    expect(healthAfter('')).toBe(1);
  });

  describe('watered day: health + 0.20, capped at 1', () => {
    it('adds 0.20', () => {
      expect(healthAfter('MMM')).toBe(0.6);
      expect(healthAfter('MMM W')).toBe(0.8);
    });

    it('never goes above 1', () => {
      expect(healthAfter('MMM WW')).toBe(1);
      expect(healthAfter('MMM WWW')).toBe(1);
      expect(healthAfter('M W')).toBe(1);
      expect(healthAfter('WWWWWWWWWW')).toBe(1);
    });

    it('revives a dead garden in five days of reading', () => {
      const dead = 'M'.repeat(20);
      expect(healthAfter(dead)).toBe(0);
      expect(healthAfter(`${dead} W`)).toBe(0.2);
      expect(healthAfter(`${dead} WW`)).toBe(0.4);
      expect(healthAfter(`${dead} WWW`)).toBe(0.6);
      expect(healthAfter(`${dead} WWWW`)).toBe(0.8);
      expect(healthAfter(`${dead} WWWWW`)).toBe(1);
    });
  });

  describe('missed day: health - cost, by rank in the run of missed days, floor 0', () => {
    it.each([
      [1, 0.9], // 1st missed day costs 0.10
      [2, 0.75], // 2nd and 3rd cost 0.15
      [3, 0.6],
      [4, 0.53], // 4th to 6th cost 0.07
      [5, 0.46],
      [6, 0.39],
      [7, 0.34], // from the 7th on, 0.05
      [8, 0.29],
      [9, 0.24],
      [10, 0.19],
      [11, 0.14],
      [12, 0.09],
      [13, 0.04],
      [14, 0],
    ])('after %i missed days in a row from full health, health is %f', (missedDays, health) => {
      expect(healthAfter('M'.repeat(missedDays))).toBe(health);
    });

    it('never goes below 0', () => {
      expect(healthAfter('M'.repeat(15))).toBe(0);
      expect(healthAfter('M'.repeat(400))).toBe(0);
    });

    it('from a health of 1, the garden is dead on the 14th missed day, not before', () => {
      const thirteen = computeGardenState(gardenInput('M'.repeat(13)));
      const fourteen = computeGardenState(gardenInput('M'.repeat(14)));
      expect(thirteen.phase).toBe('dying');
      expect(thirteen.health).toBeGreaterThan(0);
      expect(fourteen.phase).toBe('dead');
      expect(fourteen.health).toBe(0);
    });

    it('restarts the run after a watered day: the next missed day costs 0.10 again', () => {
      expect(healthAfter('MMM W M')).toBe(0.7); // 0.60 + 0.20 - 0.10
      expect(healthAfter('MMM W MM')).toBe(0.55); // then - 0.15
      expect(computeGardenState(gardenInput('MMM W MM')).missedDaysInARow).toBe(2);
    });
  });

  describe('paused day: nothing changes, the run of missed days is neither extended nor reset', () => {
    it('freezes the health', () => {
      expect(healthAfter('MMM PPPPPPPPPP')).toBe(0.6);
      expect(healthAfter('WW PPPPPPPPPPPPPPPPPPPP')).toBe(1);
    });

    it('does not extend the run of missed days', () => {
      const state = computeGardenState(gardenInput('MMM PPPPP'));
      expect(state.missedDaysInARow).toBe(3);
      expect(state.water).toBe('dry');
    });

    it('does not reset the run: the missed day after the pause continues the count', () => {
      const state = computeGardenState(gardenInput('MMM PPPPP M'));
      expect(state.missedDaysInARow).toBe(4);
      expect(state.health).toBe(0.53); // 4th missed day: 0.07, not 0.10
    });

    it('does not help either: no recovery during a pause', () => {
      expect(healthAfter('MMMMMM PPP')).toBe(0.39);
    });

    it('counts a day read during a pause as watered (reading is never ignored)', () => {
      const state = computeGardenState(gardenInput('MMM R'));
      expect(state.health).toBe(0.8);
      expect(state.missedDaysInARow).toBe(0);
    });

    it('accepts pauses of several days, overlapping or partly outside the garden life', () => {
      const day = (offset: number): LocalDate => addDays(GARDEN_START_DATE, offset);
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
      expect(state.health).toBe(0.53);
      expect(state.isPausedToday).toBe(false);
    });
  });

  describe('the day in progress never penalises', () => {
    it('ignores today while it is not watered', () => {
      expect(healthAfter('WWW', 'unread')).toBe(1);
      expect(healthAfter('MMM', 'unread')).toBe(0.6);
      expect(computeGardenState(gardenInput('MMM', 'unread')).missedDaysInARow).toBe(3);
    });

    it('counts today as soon as it is watered', () => {
      const state = computeGardenState(gardenInput('MMM', 'read'));
      expect(state.health).toBe(0.8);
      expect(state.missedDaysInARow).toBe(0);
    });

    it('turns an unread today into a missed day only the next day', () => {
      const todayInProgress = gardenInput('MMM', 'unread');
      const nextDay = { ...todayInProgress, today: addDays(todayInProgress.today, 1) };
      expect(computeGardenState(todayInProgress).health).toBe(0.6);
      expect(computeGardenState(nextDay).health).toBe(0.53);
      expect(computeGardenState(nextDay).missedDaysInARow).toBe(4);
    });

    it('ignores an unread today inside a pause too', () => {
      const state = computeGardenState(gardenInput('MMM', 'paused-unread'));
      expect(state.health).toBe(0.6);
      expect(state.missedDaysInARow).toBe(3);
    });
  });

  describe('garden created today (start date equal to today)', () => {
    it('is at full health with nothing missed when not read yet', () => {
      const state = computeGardenState(gardenInput('', 'unread'));
      expect(state.health).toBe(1);
      expect(state.missedDaysInARow).toBe(0);
      expect(state.water).toBe('flowing');
      expect(state.daysSinceLastWatered).toBeNull();
    });

    it('is at full health when already read', () => {
      const state = computeGardenState(gardenInput('', 'read'));
      expect(state.health).toBe(1);
      expect(state.daysSinceLastWatered).toBe(0);
    });

    it('counts the start date as a missed day from the next day on', () => {
      expect(healthAfter('M')).toBe(0.9);
    });
  });

  describe('while hizbCompleted is 0, there is nothing to damage: health 1', () => {
    it('stays at 1 whatever the history', () => {
      const state = computeGardenState(gardenInput('M'.repeat(30), 'unread', { hizbCompleted: 0 }));
      expect(state.health).toBe(1);
      expect(state.phase).toBe('bare');
    });

    it('still reports the missed days and the water (decision: only health is protected)', () => {
      const state = computeGardenState(gardenInput('M'.repeat(30), 'unread', { hizbCompleted: 0 }));
      expect(state.missedDaysInARow).toBe(30);
      expect(state.water).toBe('dry');
    });

    // Decision recorded in README.md, and contested there: the engine does not know WHEN
    // the first hizb was finished, so days missed before it start counting at that moment.
    it('applies the whole history as soon as the first hizb is finished', () => {
      const history = 'M'.repeat(30);
      expect(computeGardenState(gardenInput(history, 'read', { hizbCompleted: 0 })).health).toBe(1);
      expect(computeGardenState(gardenInput(history, 'read', { hizbCompleted: 1 })).health).toBe(
        0.2,
      );
    });
  });

  describe('watered days outside [startDate, today]', () => {
    it('ignores days before the start date and after today', () => {
      const input = gardenInput('MMM W MM');
      const withOutsiders: GardenInput = {
        ...input,
        wateredDays: new Set([
          ...input.wateredDays,
          addDays(input.startDate, -1),
          addDays(input.startDate, -400),
          addDays(input.today, 1),
          addDays(input.today, 30),
        ]),
      };
      expect(computeGardenState(withOutsiders)).toEqual(computeGardenState(input));
    });

    it('reports no last watered day when the only watered days are outside', () => {
      const input = gardenInput('MMM');
      const state = computeGardenState({
        ...input,
        wateredDays: new Set([addDays(input.startDate, -1), addDays(input.today, 1)]),
      });
      expect(state.daysSinceLastWatered).toBeNull();
      expect(state.health).toBe(0.6);
    });

    it('counts the start date and today themselves', () => {
      const input = gardenInput('MMM');
      const state = computeGardenState({
        ...input,
        wateredDays: new Set([input.startDate, input.today]),
      });
      // W M M then today read: 1 - 0.10 - 0.15 + 0.20
      expect(state.health).toBe(0.95);
    });
  });

  describe('very long histories', () => {
    const start = parseLocalDate('1996-01-01');
    const today = parseLocalDate('2026-11-23');

    it('handles thirty years of daily reading', () => {
      const wateredDays = new Set<LocalDate>();
      for (let day = start; day <= today; day = addDays(day, 1)) wateredDays.add(day);
      const state = computeGardenState({
        hizbCompleted: 60,
        currentHizbProgress: 0,
        wateredDays,
        startDate: start,
        today,
        pauses: [],
      });
      expect(state.health).toBe(1);
      expect(state.visibleElements).toHaveLength(60);
    });

    it('handles thirty years without reading, then a return', () => {
      const yesterday = addDays(today, -1);
      const state = computeGardenState({
        hizbCompleted: 10,
        currentHizbProgress: 0,
        wateredDays: new Set([yesterday, today]),
        startDate: start,
        today,
        pauses: [{ from: parseLocalDate('2000-01-01'), to: parseLocalDate('2019-12-31') }],
      });
      expect(state.health).toBe(0.4);
      expect(state.phase).toBe('wilting');
    });
  });
});
