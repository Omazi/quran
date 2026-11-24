/**
 * Acceptance tests of docs/specs/garden.md, section "Eau", and of the three fields that
 * describe the recent days: `missedDaysInARow`, `daysSinceLastWatered`, `isPausedToday`.
 * Histories use the notation of acceptance-kit.ts.
 */
import { computeGardenState, type GardenState } from '@/domain/garden';
import { addDays } from '@/domain/shared/local-date';

import { bareEarthInput, day, FIRST_DAY, historyInput } from './acceptance-kit';

function stateAfter(history: string): GardenState {
  return computeGardenState(historyInput(history));
}

describe('water: flowing if today is watered or no day is missed', () => {
  it.each([
    'W',
    'WW',
    'WMW',
    'WMMMMMW', // "Arroser fait revenir l'eau le jour même", even after five missed days
    'W' + 'M'.repeat(14) + 'W', // even on the day after the dead earth
    'W' + 'M'.repeat(40) + 'W',
    'MMMW',
  ])('%s (today is watered): flowing', (history) => {
    expect(stateAfter(history).water).toBe('flowing');
  });

  it.each([
    'W.',
    'WWWW.',
    'WMMMW.', // the morning after a watered day: the run of missed days is over
    'W' + 'M'.repeat(14) + 'W.',
    'WPPPP.', // paused days are not missed days
    'P.',
    '.', // the very first day, nothing read yet
  ])('%s (no missed day in the current run): flowing', (history) => {
    const state = stateAfter(history);
    expect(state.missedDaysInARow).toBe(0);
    expect(state.water).toBe('flowing');
  });
});

describe('water: still after 1 or 2 missed days in a row, dry from 3', () => {
  it.each([
    ['WM.', 1, 'still'],
    ['WMM.', 2, 'still'], // boundary 2 / 3
    ['WMMM.', 3, 'dry'],
    ['WMMMM.', 4, 'dry'],
    ['W' + 'M'.repeat(14) + '.', 14, 'dry'],
    ['W' + 'M'.repeat(100) + '.', 100, 'dry'],
    ['WMMMWM.', 1, 'still'], // a watered day starts a new run
    ['WMMMWMM.', 2, 'still'],
    ['WMMMWMMM.', 3, 'dry'],
    ['M.', 1, 'still'], // the first day itself can be missed
    ['MMM.', 3, 'dry'],
  ] as const)('%s: %i missed in a row, %s', (history, missedDaysInARow, water) => {
    const state = stateAfter(history);
    expect(state.missedDaysInARow).toBe(missedDaysInARow);
    expect(state.water).toBe(water);
  });

  it.each([
    ['WMPPPM.', 2, 'still'], // a pause neither extends nor resets the run
    ['WMMPM.', 3, 'dry'],
    ['WMMP.', 2, 'still'],
    ['WMMMPPPP.', 3, 'dry'],
    ['WPMPMP.', 2, 'still'],
    ['WMMP', 2, 'still'], // today is paused and nothing is read
    ['WMMMP', 3, 'dry'],
  ] as const)('%s with paused days: %i missed in a row, %s', (history, missedDaysInARow, water) => {
    const state = stateAfter(history);
    expect(state.missedDaysInARow).toBe(missedDaysInARow);
    expect(state.water).toBe(water);
  });

  it('the water and the health are two different things: dry water in a thriving garden cannot happen, flowing water in a dying one can', () => {
    // 3 missed days: drought 3 (thirsty), water dry.
    expect(stateAfter('WMMM.')).toMatchObject({ phase: 'thirsty', water: 'dry' });
    // Dead earth then one day of reading: drought 11 (dying), water flowing.
    expect(stateAfter('W' + 'M'.repeat(14) + 'W')).toMatchObject({
      phase: 'dying',
      water: 'flowing',
    });
  });

  it('watering resets the run of missed days the same day', () => {
    expect(stateAfter('WMMMMM' + 'W').missedDaysInARow).toBe(0);
  });
});

describe('water on the bare earth: dry, and no missed day', () => {
  it('nothing read', () => {
    const state = computeGardenState(bareEarthInput(day('2026-03-10')));
    expect(state.water).toBe('dry');
    expect(state.missedDaysInARow).toBe(0);
  });

  it('read today and every day before: still dry, there is no water yet', () => {
    const today = day('2026-03-10');
    const wateredDays = [0, -1, -2, -3].map((offset) => addDays(today, offset));
    const state = computeGardenState(bareEarthInput(today, wateredDays));
    expect(state.water).toBe('dry');
    expect(state.missedDaysInARow).toBe(0);
  });

  it('read long ago: still no missed day', () => {
    const state = computeGardenState(bareEarthInput(day('2026-03-10'), [day('2025-11-02')]));
    expect(state.water).toBe('dry');
    expect(state.missedDaysInARow).toBe(0);
  });
});

describe('daysSinceLastWatered: calendar days since the last watered day, or null', () => {
  it.each([
    ['W', 0],
    ['WMMMW', 0],
    ['W.', 1],
    ['WMMM.', 4],
    ['WPPP.', 4], // paused days are calendar days too
    ['WMPMP', 4],
    ['W' + 'M'.repeat(364) + '.', 365],
  ])('%s: %i', (history, expected) => {
    expect(stateAfter(history).daysSinceLastWatered).toBe(expected);
  });

  it('null when no day was ever watered', () => {
    expect(stateAfter('MMM.').daysSinceLastWatered).toBeNull();
    expect(computeGardenState(bareEarthInput(day('2026-03-10'))).daysSinceLastWatered).toBeNull();
  });

  it('on the bare earth, the days of reading count as well', () => {
    const today = day('2026-03-10');
    expect(computeGardenState(bareEarthInput(today, [today])).daysSinceLastWatered).toBe(0);
    expect(
      computeGardenState(bareEarthInput(today, [day('2026-03-03'), day('2026-02-01')]))
        .daysSinceLastWatered,
    ).toBe(7);
  });

  it('a day read before the first hizb was finished is still a day of reading', () => {
    // The first day of the garden is not in the watered days here: last reading 2 days before.
    const input = historyInput('MM.', { extraWateredDays: [addDays(FIRST_DAY, -2)] });
    expect(computeGardenState(input).daysSinceLastWatered).toBe(4);
  });
});

describe('isPausedToday', () => {
  it.each([
    ['WMMP', true],
    ['WPPP', true],
    ['WPPP.', false], // the pause ended yesterday
    ['WMM.', false],
    ['WMMW', false],
    ['P', true],
  ])('%s: %s', (history, expected) => {
    expect(stateAfter(history).isPausedToday).toBe(expected);
  });

  it('a pause is inclusive on both ends', () => {
    const today = addDays(FIRST_DAY, 3);
    const endsToday = historyInput('WMM.', {
      extraPauses: [{ from: addDays(today, -1), to: today }],
    });
    const startsToday = historyInput('WMM.', {
      extraPauses: [{ from: today, to: addDays(today, 5) }],
    });
    const startsTomorrow = historyInput('WMM.', {
      extraPauses: [{ from: addDays(today, 1), to: addDays(today, 5) }],
    });
    expect(computeGardenState(endsToday).isPausedToday).toBe(true);
    expect(computeGardenState(startsToday).isPausedToday).toBe(true);
    expect(computeGardenState(startsTomorrow).isPausedToday).toBe(false);
  });

  it('is reported on the bare earth too', () => {
    const today = day('2026-03-10');
    const state = computeGardenState(bareEarthInput(today, [], [{ from: today, to: today }]));
    expect(state.isPausedToday).toBe(true);
  });
});
