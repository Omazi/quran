/**
 * Acceptance tests of `forecastGardenWithoutReading` (docs/specs/garden.md: "Prévision" and
 * the property "La prévision d'un jour égale le calcul direct fait ce jour-là").
 * Histories use the notation of acceptance-kit.ts.
 */
import {
  computeGardenState,
  forecastGardenWithoutReading,
  MAX_FORECAST_DAYS,
  type GardenInput,
} from '@/domain/garden';
import { addDays } from '@/domain/shared/local-date';

import {
  bareEarthInput,
  day,
  errorThrownBy,
  expectExplicitError,
  FIRST_DAY,
  historyInput,
  randomHistory,
  randomInt,
  seededRandom,
} from './acceptance-kit';

/** The property itself: entry k is the direct computation with today moved k + 1 days on. */
function expectForecastEqualsDirectComputation(input: GardenInput, dayCount: number): void {
  const forecast = forecastGardenWithoutReading(input, dayCount);
  expect(forecast).toHaveLength(dayCount);
  forecast.forEach((forecastDay, index) => {
    const date = addDays(input.today, index + 1);
    expect(forecastDay.date).toBe(date);
    expect({ date, state: forecastDay.state }).toEqual({
      date,
      state: computeGardenState({ ...input, today: date }),
    });
  });
}

describe('forecast: worked examples', () => {
  it('healthy garden, read today: 0 tomorrow, then one more drought day each day, dead on day 15', () => {
    const forecast = forecastGardenWithoutReading(historyInput('WWW'), 17);
    // Tomorrow, tomorrow itself is "today" and does not count: 0. Then 1, 2, ... capped at 14.
    expect(forecast.map((forecastDay) => forecastDay.state.droughtDays)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14, 14,
    ]);
    expect(forecast.map((forecastDay) => forecastDay.state.phase)).toEqual([
      'thriving',
      'thriving',
      'thriving',
      'thirsty',
      'thirsty',
      'thirsty',
      'wilting',
      'wilting',
      'wilting',
      'wilting',
      'dying',
      'dying',
      'dying',
      'dying',
      'dead',
      'dead',
      'dead',
    ]);
    expect(forecast[0]?.date).toBe(addDays(FIRST_DAY, 3));
    expect(forecast[16]?.date).toBe(addDays(FIRST_DAY, 19));
  });

  it('healthy garden, nothing read today: today becomes a missed day tomorrow', () => {
    const forecast = forecastGardenWithoutReading(historyInput('WWW.'), 4);
    expect(forecast.map((forecastDay) => forecastDay.state.droughtDays)).toEqual([1, 2, 3, 4]);
    expect(forecast.map((forecastDay) => forecastDay.state.water)).toEqual([
      'still',
      'still',
      'dry',
      'dry',
    ]);
  });

  it('the elements disappear in the forecast as they would on the day', () => {
    // Drought 9 today (today open): 10, 11, 12, 13, 14 on the next five days.
    const forecast = forecastGardenWithoutReading(historyInput('W' + 'M'.repeat(9) + '.'), 5);
    expect(forecast.map((forecastDay) => forecastDay.state.visibleElements.length)).toEqual([
      20, 15, 10, 5, 0,
    ]);
  });

  it('a pause planned for the coming days freezes the forecast', () => {
    const input = historyInput('WMM.', {
      // Today is day 3. Paused from day 5 to day 8.
      extraPauses: [{ from: addDays(FIRST_DAY, 5), to: addDays(FIRST_DAY, 8) }],
    });
    const forecast = forecastGardenWithoutReading(input, 8);
    // Day 4: day 3 missed → 3. Day 5 (paused today): day 4 missed → 4. Days 6, 7, 8: frozen.
    // Day 9: day 8 was paused → 4. Day 10: day 9 missed → 5. Day 11: 6.
    expect(forecast.map((forecastDay) => forecastDay.state.droughtDays)).toEqual([
      3, 4, 4, 4, 4, 4, 5, 6,
    ]);
    expect(forecast.map((forecastDay) => forecastDay.state.isPausedToday)).toEqual([
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

  it('a dead garden stays dead, and keeps its hizb', () => {
    const forecast = forecastGardenWithoutReading(historyInput('W' + 'M'.repeat(30) + '.'), 10);
    for (const forecastDay of forecast) {
      expect(forecastDay.state).toMatchObject({
        droughtDays: 14,
        phase: 'dead',
        hizbCompleted: 24,
      });
    }
  });

  it('a bare earth stays bare', () => {
    const forecast = forecastGardenWithoutReading(
      bareEarthInput(day('2026-03-10'), [day('2026-03-10')]),
      20,
    );
    for (const forecastDay of forecast) {
      expect(forecastDay.state).toMatchObject({ phase: 'bare', droughtDays: 0, water: 'dry' });
    }
  });

  it('the forecast never changes what was read: hizb, growth and variant are those of today', () => {
    const input = historyInput('WW', { hizbCompleted: 37, currentHizbProgress: 0.25 });
    for (const forecastDay of forecastGardenWithoutReading(input, 20)) {
      expect(forecastDay.state.hizbCompleted).toBe(37);
      expect(forecastDay.state.nextElement?.growth).toBe(0.25);
      expect(forecastDay.state.variant).toEqual(input.variant);
    }
  });
});

describe('property: each forecast day equals the direct computation on that day', () => {
  it.each([
    ['read today', 'WWW'],
    ['nothing read today', 'WWW.'],
    ['thirsty', 'WMMM.'],
    ['dying', 'W' + 'M'.repeat(11) + '.'],
    ['dead', 'W' + 'M'.repeat(20) + '.'],
    ['dead, read today', 'W' + 'M'.repeat(20) + 'W'],
    ['paused today', 'WMMPP'],
    ['never watered', 'MMM.'],
    ['first day', '.'],
  ])('%s', (_name, history) => {
    expectForecastEqualsDirectComputation(historyInput(history), 30);
  });

  it('with pauses in the coming days, overlapping each other', () => {
    const input = historyInput('WMMMM.', {
      extraPauses: [
        { from: addDays(FIRST_DAY, 6), to: addDays(FIRST_DAY, 9) },
        { from: addDays(FIRST_DAY, 8), to: addDays(FIRST_DAY, 12) },
        { from: addDays(FIRST_DAY, 20), to: addDays(FIRST_DAY, 20) },
        { from: addDays(FIRST_DAY, 25), to: addDays(FIRST_DAY, 400) },
      ],
    });
    expectForecastEqualsDirectComputation(input, 40);
  });

  it('with days already watered "in the future" (time-zone change)', () => {
    const input = historyInput('WMMMMMM.', {
      extraWateredDays: [addDays(FIRST_DAY, 8), addDays(FIRST_DAY, 11)],
    });
    expectForecastEqualsDirectComputation(input, 20);
  });

  it('when today is before the first day of the garden (time-zone change)', () => {
    const input: GardenInput = { ...historyInput('WMM.'), today: addDays(FIRST_DAY, -3) };
    expectForecastEqualsDirectComputation(input, 12);
  });

  it('on the bare earth and on a complete garden', () => {
    expectForecastEqualsDirectComputation(
      bareEarthInput(day('2026-03-10'), [day('2026-03-08')]),
      30,
    );
    const history = 'W' + 'M'.repeat(20) + 'W';
    expectForecastEqualsDirectComputation(
      historyInput(history, {
        hizbCompleted: 60,
        currentHizbProgress: 0,
        completedOn: addDays(FIRST_DAY, history.length - 1),
      }),
      30,
    );
  });

  it('on 300 generated histories, every hizb count, pauses and reading scattered in the future', () => {
    const random = seededRandom(366);
    for (let run = 0; run < 300; run += 1) {
      const history = randomHistory(random, randomInt(random, 1, 60));
      const futureStart = history.length + randomInt(random, 0, 10);
      const input = historyInput(history, {
        hizbCompleted: randomInt(random, 1, 59),
        pauseStyle: 'overlapping',
        extraPauses: [
          {
            from: addDays(FIRST_DAY, futureStart),
            to: addDays(FIRST_DAY, futureStart + randomInt(random, 0, 8)),
          },
        ],
        extraWateredDays: random() < 0.3 ? [addDays(FIRST_DAY, history.length + 2)] : [],
      });
      expectForecastEqualsDirectComputation(input, randomInt(random, 1, 35));
    }
  });

  it('over the longest forecast, from a ten-year history', () => {
    const history = randomHistory(seededRandom(10), 3653);
    expectForecastEqualsDirectComputation(historyInput(history), MAX_FORECAST_DAYS);
  });
});

describe('forecast length limits', () => {
  const input = historyInput('WWW.');

  it('the reminders need 30 days: the limit allows at least that', () => {
    expect(MAX_FORECAST_DAYS).toBeGreaterThanOrEqual(30);
  });

  it('one day', () => {
    const forecast = forecastGardenWithoutReading(input, 1);
    expect(forecast).toHaveLength(1);
    expect(forecast[0]?.date).toBe(addDays(input.today, 1));
  });

  it('exactly the longest forecast', () => {
    const forecast = forecastGardenWithoutReading(input, MAX_FORECAST_DAYS);
    expect(forecast).toHaveLength(MAX_FORECAST_DAYS);
    expect(forecast[MAX_FORECAST_DAYS - 1]?.date).toBe(addDays(input.today, MAX_FORECAST_DAYS));
  });

  it('zero days: an empty forecast, not an error', () => {
    expect(forecastGardenWithoutReading(input, 0)).toEqual([]);
  });

  it.each([MAX_FORECAST_DAYS + 1, 100_000, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'day count %d is refused with an explicit error',
    (dayCount) => {
      expectExplicitError(() => forecastGardenWithoutReading(input, dayCount));
    },
  );

  it('an invalid garden input is refused by the forecast as by the direct computation', () => {
    const invalid: GardenInput = { ...input, hizbCompleted: 61 };
    expectExplicitError(() => forecastGardenWithoutReading(invalid, 5), /hizb/i);
    // Even when no day is asked for: the input is wrong all the same.
    expect(errorThrownBy(() => computeGardenState(invalid))).toBeInstanceOf(Error);
  });

  it('a forecast is the same each time it is asked for, and does not change the input', () => {
    const before = JSON.stringify({ ...input, wateredDays: [...input.wateredDays] });
    const first = forecastGardenWithoutReading(input, 30);
    const second = forecastGardenWithoutReading(input, 30);
    expect(second).toEqual(first);
    expect(JSON.stringify({ ...input, wateredDays: [...input.wateredDays] })).toBe(before);
  });
});
