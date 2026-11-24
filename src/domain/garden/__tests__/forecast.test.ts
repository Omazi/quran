/**
 * The garden "if nothing more is read", day after day: what the reminders plan from
 * (docs/specs/reminders.md).
 */
import { addDays, type LocalDate } from '@/domain/shared/local-date';

import {
  computeGardenState,
  forecastGardenWithoutReading,
  MAX_FORECAST_DAYS,
  REFERENCE_GARDEN_VARIANT,
  type GardenForecastDay,
  type GardenInput,
  type GardenState,
} from '../index';
import {
  createSeededRandom,
  gardenInput,
  randomInteger,
  randomTimeline,
  randomTodayKind,
} from '../test-support/garden-test-kit';

const REMINDER_HORIZON_IN_DAYS = 30;

/** The direct computation: the engine run when `today` is `daysLater` days further. */
function stateOnLaterDay(input: GardenInput, daysLater: number): GardenState {
  return computeGardenState({ ...input, today: addDays(input.today, daysLater) });
}

function droughts(forecast: readonly GardenForecastDay[]): number[] {
  return forecast.map((day) => day.state.droughtDays);
}

/** Date of the first coming day on which `matches` holds, or null. */
function firstDay(
  forecast: readonly GardenForecastDay[],
  matches: (state: GardenState) => boolean,
): LocalDate | null {
  return forecast.find((day) => matches(day.state))?.date ?? null;
}

describe('forecastGardenWithoutReading: the garden on each coming day if nothing is read', () => {
  const readToday = gardenInput('WWWW', 'read', { currentHizbProgress: 0.3 });
  const notReadToday = gardenInput('WWWW', 'unread', { currentHizbProgress: 0.3 });

  it('returns one entry per coming day, from tomorrow on, in order', () => {
    const forecast = forecastGardenWithoutReading(readToday, REMINDER_HORIZON_IN_DAYS);
    expect(forecast).toHaveLength(30);
    expect(forecast.map((day) => day.date)).toEqual(
      Array.from({ length: 30 }, (_, index) => addDays(readToday.today, index + 1)),
    );
  });

  it('returns nothing when asked for 0 days', () => {
    expect(forecastGardenWithoutReading(readToday, 0)).toEqual([]);
  });

  it('the forecast of a day equals the direct computation made that day', () => {
    for (const input of [readToday, notReadToday]) {
      const forecast = forecastGardenWithoutReading(input, REMINDER_HORIZON_IN_DAYS);
      forecast.forEach((day, index) => {
        expect(day.state).toEqual(stateOnLaterDay(input, index + 1));
      });
    }
  });

  it('dries by one day a day after a day that was read', () => {
    const forecast = forecastGardenWithoutReading(readToday, 16);
    // Tomorrow nothing is missed yet: today was read.
    expect(droughts(forecast)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14]);
    expect(forecast.map((day) => day.state.missedDaysInARow)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
  });

  it('dries one day earlier when today has not been read', () => {
    const forecast = forecastGardenWithoutReading(notReadToday, 15);
    expect(droughts(forecast)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14]);
  });

  it('tells on which day each change of the garden happens', () => {
    const forecast = forecastGardenWithoutReading(readToday, REMINDER_HORIZON_IN_DAYS);
    const daysFromToday = (date: LocalDate | null): number | null =>
      date === null ? null : forecast.findIndex((day) => day.date === date) + 1;

    expect(daysFromToday(firstDay(forecast, (state) => state.water === 'still'))).toBe(2);
    expect(daysFromToday(firstDay(forecast, (state) => state.water === 'dry'))).toBe(4);
    expect(daysFromToday(firstDay(forecast, (state) => state.phase === 'thirsty'))).toBe(4);
    expect(daysFromToday(firstDay(forecast, (state) => state.phase === 'wilting'))).toBe(7);
    expect(daysFromToday(firstDay(forecast, (state) => state.phase === 'dying'))).toBe(11);
    expect(daysFromToday(firstDay(forecast, (state) => state.phase === 'dead'))).toBe(15);
  });

  it('makes the elements disappear progressively, then keeps the earth dead', () => {
    const forecast = forecastGardenWithoutReading(readToday, REMINDER_HORIZON_IN_DAYS);
    const visible = forecast.map((day) => day.state.visibleElements.length);
    expect(visible.slice(0, 10)).toEqual([24, 24, 24, 24, 24, 24, 24, 24, 24, 24]);
    expect(visible.slice(10, 15)).toEqual([20, 15, 10, 5, 0]);
    expect(visible.slice(15).every((count) => count === 0)).toBe(true);
    expect(forecast.slice(14).every((day) => day.state.phase === 'dead')).toBe(true);
  });

  it('keeps what reading alone can change: hizb, growth, last and next element, variant', () => {
    const today = computeGardenState(readToday);
    for (const { state } of forecastGardenWithoutReading(readToday, REMINDER_HORIZON_IN_DAYS)) {
      expect(state.hizbCompleted).toBe(today.hizbCompleted);
      expect(state.lastUnlocked).toEqual(today.lastUnlocked);
      expect(state.nextElement?.element).toEqual(today.nextElement?.element);
      expect(state.nextElement?.growth).toBe(0.3);
      expect(state.isComplete).toBe(false);
      expect(state.variant).toEqual(REFERENCE_GARDEN_VARIANT);
    }
  });

  it('counts the days since the last watered day onwards', () => {
    const forecast = forecastGardenWithoutReading(notReadToday, 3);
    expect(computeGardenState(notReadToday).daysSinceLastWatered).toBe(1);
    expect(forecast.map((day) => day.state.daysSinceLastWatered)).toEqual([2, 3, 4]);
  });

  it('keeps "never read" as it is', () => {
    const neverRead = gardenInput('MM', 'unread');
    const forecast = forecastGardenWithoutReading(neverRead, 3);
    expect(forecast.map((day) => day.state.daysSinceLastWatered)).toEqual([null, null, null]);
  });

  describe('pauses to come', () => {
    const day = (offset: number): LocalDate => addDays(readToday.today, offset);
    // Paused from the day after tomorrow, for four days.
    const withPause: GardenInput = { ...readToday, pauses: [{ from: day(2), to: day(5) }] };
    const forecast = forecastGardenWithoutReading(withPause, 8);

    it('freezes the garden during the pause and resumes the decline after it', () => {
      // Tomorrow is missed; the four paused days change nothing; then it dries again.
      expect(droughts(forecast)).toEqual([0, 1, 1, 1, 1, 1, 2, 3]);
      expect(forecast.map((entry) => entry.state.missedDaysInARow)).toEqual([
        0, 1, 1, 1, 1, 1, 2, 3,
      ]);
    });

    it('says on which coming days the garden is paused, both ends included', () => {
      expect(forecast.map((entry) => entry.state.isPausedToday)).toEqual([
        false,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
      ]);
    });

    it('keeps the water as it was when the pause began', () => {
      expect(forecast.map((entry) => entry.state.water)).toEqual([
        'flowing',
        'still',
        'still',
        'still',
        'still',
        'still',
        'still',
        'dry',
      ]);
    });

    it('never lets a garden dry during a pause', () => {
      const longPause: GardenInput = { ...readToday, pauses: [{ from: day(1), to: day(400) }] };
      const paused = forecastGardenWithoutReading(longPause, MAX_FORECAST_DAYS);
      expect(paused.every((entry) => entry.state.droughtDays === 0)).toBe(true);
      expect(paused.every((entry) => entry.state.isPausedToday)).toBe(true);
    });
  });

  it('counts a day already read but dated after today when its turn comes (time-zone change)', () => {
    const withLaterDays: GardenInput = {
      ...readToday,
      wateredDays: new Set([
        ...readToday.wateredDays,
        addDays(readToday.today, 2),
        addDays(readToday.today, 5),
      ]),
    };
    const forecast = forecastGardenWithoutReading(withLaterDays, 7);
    // Day 1 is missed; day 2 is read; days 3 and 4 are missed; day 5 is read; day 6 is missed.
    expect(droughts(forecast)).toEqual([0, 0, 0, 1, 0, 0, 1]);
    forecast.forEach((entry, index) => {
      expect(entry.state).toEqual(stateOnLaterDay(withLaterDays, index + 1));
    });
  });

  describe('gardens that cannot dry', () => {
    it('keeps a bare earth as it is: no drought, no missed day, no water yet', () => {
      const bare = gardenInput('W', 'read', { hizbCompleted: 0 });
      const today = computeGardenState(bare);
      const forecast = forecastGardenWithoutReading(bare, REMINDER_HORIZON_IN_DAYS);
      forecast.forEach((day, index) => {
        expect(day.state).toEqual({ ...today, daysSinceLastWatered: index + 1 });
      });
      expect(today).toMatchObject({ phase: 'bare', droughtDays: 0, water: 'dry' });
      expect(today.missedDaysInARow).toBe(0);
    });

    it('keeps a complete garden at full health, as on its completion day', () => {
      const lastDay = gardenInput('WW MMMMMMMMMMMM', 'read', { hizbCompleted: 60 });
      const complete: GardenInput = { ...lastDay, completedOn: lastDay.today };
      const today = computeGardenState(complete);
      const forecast = forecastGardenWithoutReading(complete, REMINDER_HORIZON_IN_DAYS);
      expect(today).toMatchObject({ droughtDays: 0, water: 'flowing', isComplete: true });
      expect(today.visibleElements).toHaveLength(60);
      for (const day of forecast) expect(day.state).toEqual(today);
    });

    it('lets a garden dry until its completion day when that day is still to come', () => {
      // Possible after a time-zone change: the last page is dated three days from "today".
      const base = gardenInput('WW', 'read', { hizbCompleted: 60 });
      const completesInThreeDays: GardenInput = { ...base, completedOn: addDays(base.today, 3) };
      const forecast = forecastGardenWithoutReading(completesInThreeDays, 6);
      forecast.forEach((day, index) => {
        expect(day.state).toEqual(stateOnLaterDay(completesInThreeDays, index + 1));
      });
      // Two days of drought, then the completion day: full health, for good.
      expect(droughts(forecast)).toEqual([0, 1, 0, 0, 0, 0]);
    });
  });

  it('keeps a dead garden dead, with its hizb', () => {
    const dead = gardenInput('M'.repeat(40), 'unread');
    const forecast = forecastGardenWithoutReading(dead, REMINDER_HORIZON_IN_DAYS);
    expect(forecast.every((day) => day.state.phase === 'dead')).toBe(true);
    expect(forecast.every((day) => day.state.hizbCompleted === 24)).toBe(true);
  });

  describe('properties, on many random gardens', () => {
    const RANDOM_GARDEN_COUNT = 300;

    /**
     * A random garden: living, bare or complete; sometimes with a pause around today,
     * and, when `withLaterReadings` is set, sometimes with days read "after today".
     */
    function forEachRandomGarden(
      seed: number,
      withLaterReadings: boolean,
      check: (input: GardenInput) => void,
    ): void {
      const random = createSeededRandom(seed);
      for (let index = 0; index < RANDOM_GARDEN_COUNT; index += 1) {
        const kind = random();
        const hizbCompleted = kind < 0.1 ? 0 : kind < 0.3 ? 60 : randomInteger(random, 1, 59);
        let input = gardenInput(randomTimeline(random, 120), randomTodayKind(random), {
          hizbCompleted,
          currentHizbProgress: randomInteger(random, 0, 100) / 100,
        });
        if (hizbCompleted === 60 && random() < 0.7) {
          // Completed a few days ago, today, or (time-zone change) in a few days.
          input = { ...input, completedOn: addDays(input.today, randomInteger(random, -5, 5)) };
        }
        if (random() < 0.5) {
          const from = addDays(input.today, randomInteger(random, -3, 20));
          const comingPause = { from, to: addDays(from, randomInteger(random, 0, 9)) };
          input = { ...input, pauses: [...input.pauses, comingPause] };
        }
        if (withLaterReadings && random() < 0.4) {
          const { today } = input;
          const later = [1, 2, 3].map(() => addDays(today, randomInteger(random, 1, 25)));
          input = { ...input, wateredDays: new Set([...input.wateredDays, ...later]) };
        }
        try {
          check(input);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`Seed ${seed}, garden #${index}: ${reason}`);
        }
      }
    }

    it('the forecast of a day always equals the direct computation made that day', () => {
      forEachRandomGarden(30, true, (input) => {
        const forecast = forecastGardenWithoutReading(input, REMINDER_HORIZON_IN_DAYS);
        expect(forecast).toHaveLength(REMINDER_HORIZON_IN_DAYS);
        forecast.forEach((day, index) => {
          expect(day.date).toBe(addDays(input.today, index + 1));
          expect(day.state).toEqual(stateOnLaterDay(input, index + 1));
        });
      });
    });

    it('never improves without reading: drought only rises, visible elements only go', () => {
      forEachRandomGarden(31, false, (input) => {
        // The one exception is not a day without reading: a completion day still to come
        // (time-zone change) brings the garden back to full health.
        if (input.completedOn !== null && input.completedOn > input.today) return;
        let previous = computeGardenState(input);
        for (const { state } of forecastGardenWithoutReading(input, REMINDER_HORIZON_IN_DAYS)) {
          expect(state.droughtDays).toBeGreaterThanOrEqual(previous.droughtDays);
          expect(state.health).toBeLessThanOrEqual(previous.health);
          expect(state.visibleElements.length).toBeLessThanOrEqual(previous.visibleElements.length);
          previous = state;
        }
      });
    });

    it('a longer forecast starts with the shorter one', () => {
      forEachRandomGarden(32, true, (input) => {
        const long = forecastGardenWithoutReading(input, REMINDER_HORIZON_IN_DAYS);
        expect(forecastGardenWithoutReading(input, 7)).toEqual(long.slice(0, 7));
      });
    });
  });

  describe('purity', () => {
    it('gives the same forecast for the same input, whatever the clock says', () => {
      const first = forecastGardenWithoutReading(readToday, REMINDER_HORIZON_IN_DAYS);
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2099-12-31T23:59:59Z'));
      const second = forecastGardenWithoutReading(readToday, REMINDER_HORIZON_IN_DAYS);
      jest.useRealTimers();
      expect(second).toEqual(first);
    });

    it('does not modify its input', () => {
      const input = gardenInput('WW MMM PP W', 'read');
      const wateredBefore = [...input.wateredDays];
      const pausesBefore = input.pauses.map((pause) => ({ ...pause }));
      Object.freeze(input);
      Object.freeze(input.pauses);

      forecastGardenWithoutReading(input, REMINDER_HORIZON_IN_DAYS);

      expect([...input.wateredDays]).toEqual(wateredBefore);
      expect(input.pauses).toEqual(pausesBefore);
    });

    it('is plain data, like the state of today', () => {
      const forecast = forecastGardenWithoutReading(readToday, 5);
      expect(JSON.parse(JSON.stringify(forecast))).toStrictEqual(forecast);
    });
  });

  describe('invalid input: explicit error', () => {
    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_FORECAST_DAYS + 1])(
      'rejects dayCount = %d (a whole number from 0 to the longest forecast)',
      (dayCount) => {
        expect(() => forecastGardenWithoutReading(readToday, dayCount)).toThrow(RangeError);
      },
    );

    it('accepts the longest forecast, one year', () => {
      expect(MAX_FORECAST_DAYS).toBe(366);
      expect(forecastGardenWithoutReading(readToday, MAX_FORECAST_DAYS)).toHaveLength(366);
    });

    it('rejects the same invalid gardens as the engine', () => {
      expect(() => forecastGardenWithoutReading({ ...readToday, hizbCompleted: 61 }, 30)).toThrow(
        RangeError,
      );
      expect(() =>
        forecastGardenWithoutReading({ ...readToday, completedOn: readToday.today }, 30),
      ).toThrow(/completedOn must be null/);
    });
  });
});
