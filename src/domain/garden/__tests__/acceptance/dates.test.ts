/**
 * Acceptance tests of the calendar: the day of birth, dates after "today" (docs/specs/
 * garden.md: "Jamais d'erreur pour une date dans le futur"), year change, leap day, and a
 * ten-year history that must stay fast.
 */
import {
  computeGardenState,
  forecastGardenWithoutReading,
  REFERENCE_GARDEN_VARIANT,
  type GardenInput,
  type GardenPause,
} from '@/domain/garden';
import { addDays, type LocalDate } from '@/domain/shared/local-date';

import {
  day,
  historyInput,
  modelGarden,
  randomHistory,
  seededRandom,
  summaryOf,
} from './acceptance-kit';

function gardenInput(fields: {
  readonly firstDay: string;
  readonly today: string;
  readonly wateredDays?: readonly string[];
  readonly pauses?: readonly GardenPause[];
  readonly hizbCompleted?: number;
}): GardenInput {
  return {
    hizbCompleted: fields.hizbCompleted ?? 24,
    currentHizbProgress: 0.5,
    wateredDays: new Set((fields.wateredDays ?? []).map(day)),
    firstHizbCompletedOn: day(fields.firstDay),
    completedOn: null,
    today: day(fields.today),
    pauses: fields.pauses ?? [],
    variant: REFERENCE_GARDEN_VARIANT,
  };
}

describe('the day of birth (today is firstHizbCompletedOn)', () => {
  it('read today: full health, water flowing', () => {
    const state = computeGardenState(
      gardenInput({ firstDay: '2026-05-05', today: '2026-05-05', wateredDays: ['2026-05-05'] }),
    );
    expect(state).toMatchObject({
      droughtDays: 0,
      health: 1,
      phase: 'thriving',
      water: 'flowing',
      missedDaysInARow: 0,
      daysSinceLastWatered: 0,
    });
    expect(state.visibleElements).toHaveLength(24);
  });

  it('even if the journal does not say today was read, today cannot penalise', () => {
    const state = computeGardenState(gardenInput({ firstDay: '2026-05-05', today: '2026-05-05' }));
    expect(state).toMatchObject({ droughtDays: 0, phase: 'thriving', missedDaysInARow: 0 });
  });

  it('the day after the birth, nothing read yet: still full health', () => {
    const state = computeGardenState(
      gardenInput({ firstDay: '2026-05-05', today: '2026-05-06', wateredDays: ['2026-05-05'] }),
    );
    expect(state).toMatchObject({ droughtDays: 0, water: 'flowing', daysSinceLastWatered: 1 });
  });

  it('a month of absence that ended on the day of birth is not counted', () => {
    const state = computeGardenState(
      gardenInput({
        firstDay: '2026-05-05',
        today: '2026-05-08',
        wateredDays: ['2026-04-01', '2026-05-05'],
        hizbCompleted: 1,
      }),
    );
    // 6 and 7 May missed, the 8th is today.
    expect(state.droughtDays).toBe(2);
  });
});

describe('dates after "today" (time-zone change) never throw and are ignored', () => {
  it('today before firstHizbCompletedOn: no day has been lived yet, the garden is healthy', () => {
    const state = computeGardenState(
      gardenInput({ firstDay: '2026-05-05', today: '2026-05-04', wateredDays: ['2026-05-05'] }),
    );
    expect(state).toMatchObject({
      hizbCompleted: 24,
      droughtDays: 0,
      health: 1,
      phase: 'thriving',
      missedDaysInARow: 0,
    });
    expect(state.visibleElements).toHaveLength(24);
  });

  it('today long before firstHizbCompletedOn', () => {
    const state = computeGardenState(
      gardenInput({ firstDay: '2026-05-05', today: '2025-01-01', wateredDays: ['2026-05-05'] }),
    );
    expect(state).toMatchObject({ droughtDays: 0, phase: 'thriving', missedDaysInARow: 0 });
  });

  it('a watered day after today is ignored: same garden as without it', () => {
    const withoutIt = gardenInput({
      firstDay: '2026-05-01',
      today: '2026-05-06',
      wateredDays: ['2026-05-01'],
    });
    const withIt: GardenInput = {
      ...withoutIt,
      wateredDays: new Set([day('2026-05-01'), day('2026-05-07'), day('2026-06-30')]),
    };
    // 2, 3, 4, 5 May missed.
    expect(computeGardenState(withoutIt).droughtDays).toBe(4);
    expect(computeGardenState(withIt)).toEqual(computeGardenState(withoutIt));
  });

  it('daysSinceLastWatered is never negative: only watered days up to today count', () => {
    const onlyFuture = gardenInput({
      firstDay: '2026-05-01',
      today: '2026-05-03',
      wateredDays: ['2026-05-04'],
    });
    expect(computeGardenState(onlyFuture).daysSinceLastWatered).toBeNull();

    const pastAndFuture = gardenInput({
      firstDay: '2026-05-01',
      today: '2026-05-03',
      wateredDays: ['2026-05-01', '2026-05-04'],
    });
    expect(computeGardenState(pastAndFuture).daysSinceLastWatered).toBe(2);
  });

  it('a pause after today is ignored today', () => {
    const state = computeGardenState(
      gardenInput({
        firstDay: '2026-05-01',
        today: '2026-05-04',
        wateredDays: ['2026-05-01'],
        pauses: [{ from: day('2026-05-05'), to: day('2026-05-20') }],
      }),
    );
    expect(state).toMatchObject({ droughtDays: 2, isPausedToday: false });
  });

  it('the traveller who flies west: the day already read lies "tomorrow" for a few hours', () => {
    // Read on the 1st to the 6th. After the flight the phone says the 5th again.
    const wateredDays = ['01', '02', '03', '04', '05', '06'].map((d) => `2026-05-${d}`);
    const state = computeGardenState(
      gardenInput({ firstDay: '2026-05-01', today: '2026-05-05', wateredDays }),
    );
    expect(state).toMatchObject({
      droughtDays: 0,
      water: 'flowing',
      missedDaysInARow: 0,
      daysSinceLastWatered: 0,
    });
  });

  it('every odd order of the dates gives a state, never an error', () => {
    const dates = ['2026-04-28', '2026-05-01', '2026-05-04'];
    for (const firstDay of dates) {
      for (const today of dates) {
        for (const watered of dates) {
          for (const pauseFrom of dates) {
            const input = gardenInput({
              firstDay,
              today,
              wateredDays: [watered],
              pauses: [{ from: day(pauseFrom), to: day('2026-05-04') }],
            });
            const state = computeGardenState(input);
            expect(state.droughtDays).toBeGreaterThanOrEqual(0);
            expect(state.droughtDays).toBeLessThanOrEqual(14);
            expect(state.missedDaysInARow).toBeGreaterThanOrEqual(0);
            expect(state.daysSinceLastWatered ?? 0).toBeGreaterThanOrEqual(0);
            expect(forecastGardenWithoutReading(input, 3)).toHaveLength(3);
          }
        }
      }
    }
  });
});

describe('year change and leap day', () => {
  it('missed days are counted across 31 December', () => {
    // Read on 29 December 2026; 30, 31 December and 1, 2 January missed; today 3 January.
    const state = computeGardenState(
      gardenInput({ firstDay: '2026-12-29', today: '2027-01-03', wateredDays: ['2026-12-29'] }),
    );
    expect(state).toMatchObject({
      droughtDays: 4,
      phase: 'thirsty',
      missedDaysInARow: 4,
      daysSinceLastWatered: 5,
    });
  });

  it('a watered 1 January is found', () => {
    const state = computeGardenState(
      gardenInput({
        firstDay: '2026-12-25',
        today: '2027-01-02',
        wateredDays: ['2026-12-25', '2027-01-01'],
      }),
    );
    // 26..31 December: 6 missed days; 1 January watered: 6 − 3 = 3.
    expect(state).toMatchObject({ droughtDays: 3, missedDaysInARow: 0, water: 'flowing' });
  });

  it('a pause across the new year covers both sides', () => {
    const state = computeGardenState(
      gardenInput({
        firstDay: '2026-12-25',
        today: '2027-01-05',
        wateredDays: ['2026-12-25'],
        pauses: [{ from: day('2026-12-28'), to: day('2027-01-02') }],
      }),
    );
    // Missed: 26, 27 December, 3, 4 January.
    expect(state.droughtDays).toBe(4);
  });

  it('29 February exists in 2028: three missed days from 27 February to 2 March', () => {
    const state = computeGardenState(
      gardenInput({ firstDay: '2028-02-27', today: '2028-03-02', wateredDays: ['2028-02-27'] }),
    );
    // 28 February, 29 February, 1 March.
    expect(state).toMatchObject({ droughtDays: 3, daysSinceLastWatered: 4 });
  });

  it('29 February does not exist in 2027: two missed days from 27 February to 2 March', () => {
    const state = computeGardenState(
      gardenInput({ firstDay: '2027-02-27', today: '2027-03-02', wateredDays: ['2027-02-27'] }),
    );
    expect(state).toMatchObject({ droughtDays: 2, daysSinceLastWatered: 3 });
  });

  it('a watered 29 February and a pause that ends on it are both found', () => {
    const watered = computeGardenState(
      gardenInput({
        firstDay: '2028-02-20',
        today: '2028-03-01',
        wateredDays: ['2028-02-20', '2028-02-29'],
      }),
    );
    // 21..28 February: 8 missed days; the 29th watered: 8 − 3 = 5.
    expect(watered.droughtDays).toBe(5);

    const paused = computeGardenState(
      gardenInput({
        firstDay: '2028-02-20',
        today: '2028-03-02',
        wateredDays: ['2028-02-20'],
        pauses: [{ from: day('2028-02-25'), to: day('2028-02-29') }],
      }),
    );
    // Missed: 21, 22, 23, 24 February and 1 March.
    expect(paused.droughtDays).toBe(5);
  });

  it('the forecast walks through 28, 29 February and 1 March 2028', () => {
    const forecast = forecastGardenWithoutReading(
      gardenInput({ firstDay: '2028-02-27', today: '2028-02-27', wateredDays: ['2028-02-27'] }),
      4,
    );
    expect(forecast.map((forecastDay) => forecastDay.date)).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
      '2028-03-02',
    ]);
    expect(forecast.map((forecastDay) => forecastDay.state.droughtDays)).toEqual([0, 1, 2, 3]);
  });
});

describe('a ten-year history', () => {
  const TEN_YEARS_IN_DAYS = 3653;
  const history = randomHistory(seededRandom(2016), TEN_YEARS_IN_DAYS);
  const firstDay: LocalDate = day('2016-11-24');
  const input = historyInput(history, { firstDay, pauseStyle: 'one-per-day' });

  function millisecondsFor(work: () => void): number {
    const start = Date.now();
    work();
    return Date.now() - start;
  }

  it('gives the garden the reference model gives', () => {
    expect(input.today).toBe(addDays(firstDay, TEN_YEARS_IN_DAYS - 1));
    expect(summaryOf(computeGardenState(input))).toEqual(modelGarden(history, 24));
  });

  it('is computed in well under a frame budget of the home screen (50 computations < 2 s)', () => {
    const elapsed = millisecondsFor(() => {
      for (let run = 0; run < 50; run += 1) computeGardenState(input);
    });
    expect(elapsed).toBeLessThan(2000);
  });

  it('a 366-day forecast on top of it costs about one computation, not 366 (< 1 s)', () => {
    const elapsed = millisecondsFor(() => {
      expect(forecastGardenWithoutReading(input, 366)).toHaveLength(366);
    });
    expect(elapsed).toBeLessThan(1000);
  });

  it('ten years of absence: dead earth, hizb kept, one reading revives it', () => {
    const absent = historyInput('W' + 'M'.repeat(TEN_YEARS_IN_DAYS) + '.', { firstDay });
    const dead = computeGardenState(absent);
    expect(dead).toMatchObject({ droughtDays: 14, phase: 'dead', hizbCompleted: 24 });
    expect(dead.missedDaysInARow).toBe(TEN_YEARS_IN_DAYS);
    expect(dead.daysSinceLastWatered).toBe(TEN_YEARS_IN_DAYS + 1);

    const back = computeGardenState(
      historyInput('W' + 'M'.repeat(TEN_YEARS_IN_DAYS) + 'W', { firstDay }),
    );
    expect(back).toMatchObject({ droughtDays: 11, phase: 'dying', water: 'flowing' });
  });

  it('one pause of ten years, and a thousand pauses of one week, stay fast', () => {
    const longPause: GardenPause = { from: firstDay, to: addDays(firstDay, TEN_YEARS_IN_DAYS) };
    const manyPauses: GardenPause[] = Array.from({ length: 1000 }, (_, index) => ({
      from: addDays(firstDay, index * 3),
      to: addDays(firstDay, index * 3 + 6),
    }));
    const elapsed = millisecondsFor(() => {
      expect(computeGardenState({ ...input, pauses: [longPause] }).isPausedToday).toBe(true);
      expect(computeGardenState({ ...input, pauses: manyPauses }).droughtDays).toBeLessThanOrEqual(
        14,
      );
    });
    expect(elapsed).toBeLessThan(1000);
  });
});
