/**
 * Acceptance tests of the configuration (docs/specs/garden.md: "config : toutes les
 * constantes ci-dessous, avec valeurs par défaut"; docs/CONTRIBUTING.md: "Pas de nombre
 * magique : une constante nommée dans la configuration du module").
 *
 * The default values must be those of the spec, and every rule must really follow the
 * configuration it is given: a rule that kept a hard-coded 14, 3, 6 or 10 would pass every
 * other suite and fail here.
 */
import {
  computeGardenState,
  DEFAULT_GARDEN_CONFIG,
  forecastGardenWithoutReading,
  type GardenConfig,
  type GardenState,
} from '@/domain/garden';

import { historyInput } from './acceptance-kit';

/** A deliberately different garden: slower to die, quicker to recover. */
const SLOW_CONFIG: GardenConfig = {
  droughtDaysToDeath: 20,
  droughtDaysRecoveredPerWateredDay: 5,
  thirstyMinDroughtDays: 2,
  wiltingMinDroughtDays: 4,
  dyingMinDroughtDays: 16,
  dryWaterMinMissedDays: 5,
};

/** A harsh garden: dead in a week, one drought day back per reading day. */
const HARSH_CONFIG: GardenConfig = {
  droughtDaysToDeath: 7,
  droughtDaysRecoveredPerWateredDay: 1,
  thirstyMinDroughtDays: 1,
  wiltingMinDroughtDays: 2,
  dyingMinDroughtDays: 5,
  dryWaterMinMissedDays: 1,
};

function stateWith(config: GardenConfig, history: string, hizbCompleted = 24): GardenState {
  return computeGardenState(historyInput(history, { config, hizbCompleted }));
}

describe('default configuration: the constants of the spec', () => {
  it('14 days to death, 3 days back per watered day, phases from 3, 6 and 10, dry water from 3', () => {
    expect(DEFAULT_GARDEN_CONFIG).toEqual({
      droughtDaysToDeath: 14,
      droughtDaysRecoveredPerWateredDay: 3,
      thirstyMinDroughtDays: 3,
      wiltingMinDroughtDays: 6,
      dyingMinDroughtDays: 10,
      dryWaterMinMissedDays: 3,
    });
  });

  it('cannot be changed by a caller', () => {
    // `as`: deliberately breaking the readonly contract, as untyped code could.
    const writable = DEFAULT_GARDEN_CONFIG as { droughtDaysToDeath: number };
    try {
      writable.droughtDaysToDeath = 1;
    } catch {
      // Frozen: the expected protection.
    }
    const valueAfterTheAttempt = DEFAULT_GARDEN_CONFIG.droughtDaysToDeath;
    // Back to the spec's value if the write went through, so the next tests still mean something.
    if (valueAfterTheAttempt !== 14) writable.droughtDaysToDeath = 14;
    expect(valueAfterTheAttempt).toBe(14);
  });

  it('an input without configuration uses the default one', () => {
    const history = 'W' + 'M'.repeat(11) + '.';
    expect(computeGardenState(historyInput(history))).toEqual(
      computeGardenState(historyInput(history, { config: { ...DEFAULT_GARDEN_CONFIG } })),
    );
  });
});

describe('every rule follows the configuration it is given', () => {
  it('droughtDaysToDeath: the cap and the health', () => {
    const afterTwoWeeks = stateWith(SLOW_CONFIG, 'W' + 'M'.repeat(14) + '.');
    expect(afterTwoWeeks).toMatchObject({ droughtDays: 14, phase: 'wilting' });
    expect(afterTwoWeeks.health).toBeCloseTo(1 - 14 / 20, 12);
    expect(stateWith(SLOW_CONFIG, 'W' + 'M'.repeat(20) + '.')).toMatchObject({
      droughtDays: 20,
      health: 0,
      phase: 'dead',
    });
    expect(stateWith(SLOW_CONFIG, 'W' + 'M'.repeat(50) + '.').droughtDays).toBe(20);
    expect(stateWith(HARSH_CONFIG, 'W' + 'M'.repeat(50) + '.')).toMatchObject({
      droughtDays: 7,
      health: 0,
      phase: 'dead',
    });
  });

  it('droughtDaysRecoveredPerWateredDay', () => {
    // 20 − 5 = 15 ; 7 − 1 = 6.
    expect(stateWith(SLOW_CONFIG, 'W' + 'M'.repeat(50) + 'W').droughtDays).toBe(15);
    expect(stateWith(HARSH_CONFIG, 'W' + 'M'.repeat(50) + 'W').droughtDays).toBe(6);
    // 3 − 5 → 0.
    expect(stateWith(SLOW_CONFIG, 'WMMM' + 'W').droughtDays).toBe(0);
  });

  it('phase thresholds', () => {
    const slowPhases = [1, 2, 3, 4, 15, 16, 19, 20].map(
      (missedDays) => stateWith(SLOW_CONFIG, 'W' + 'M'.repeat(missedDays) + '.').phase,
    );
    expect(slowPhases).toEqual([
      'thriving',
      'thirsty',
      'thirsty',
      'wilting',
      'wilting',
      'dying',
      'dying',
      'dead',
    ]);
    const harshPhases = [0, 1, 2, 4, 5, 6, 7].map(
      (missedDays) => stateWith(HARSH_CONFIG, 'W' + 'M'.repeat(missedDays) + '.').phase,
    );
    expect(harshPhases).toEqual([
      'thriving',
      'thirsty',
      'wilting',
      'wilting',
      'dying',
      'dying',
      'dead',
    ]);
  });

  it('dryWaterMinMissedDays', () => {
    expect(stateWith(SLOW_CONFIG, 'WMMMM.').water).toBe('still');
    expect(stateWith(SLOW_CONFIG, 'WMMMMM.').water).toBe('dry');
    expect(stateWith(HARSH_CONFIG, 'WM.').water).toBe('dry');
    expect(stateWith(HARSH_CONFIG, 'W.').water).toBe('flowing');
  });

  it('visible elements: all of them before dying, none when dead, some in between, never growing with the drought', () => {
    for (const config of [SLOW_CONFIG, HARSH_CONFIG]) {
      let previousCount = 24;
      for (let missedDays = 0; missedDays <= config.droughtDaysToDeath; missedDays += 1) {
        const state = stateWith(config, 'W' + 'M'.repeat(missedDays) + '.');
        const count = state.visibleElements.length;
        if (state.phase === 'dead') expect(count).toBe(0);
        else if (state.phase === 'dying') {
          expect(count).toBeGreaterThanOrEqual(1);
          expect(count).toBeLessThan(24);
        } else expect(count).toBe(24);
        expect(count).toBeLessThanOrEqual(previousCount);
        previousCount = count;
      }
    }
  });

  it('visible elements while dying: equal steps down to nothing, as with the default values', () => {
    // SLOW: dying from 16 to 19, dead at 20: 5 steps like the default. 80 %, 60 %, 40 %, 20 %.
    const slowCounts = [16, 17, 18, 19, 20].map(
      (missedDays) =>
        stateWith(SLOW_CONFIG, 'W' + 'M'.repeat(missedDays) + '.', 10).visibleElements.length,
    );
    expect(slowCounts).toEqual([8, 6, 4, 2, 0]);
    // HARSH: dying at 5 and 6, dead at 7: 3 steps. ceil(9 × 2 / 3) = 6, ceil(9 × 1 / 3) = 3.
    const harshCounts = [5, 6, 7].map(
      (missedDays) =>
        stateWith(HARSH_CONFIG, 'W' + 'M'.repeat(missedDays) + '.', 9).visibleElements.length,
    );
    expect(harshCounts).toEqual([6, 3, 0]);
  });

  it('the forecast follows the configuration too', () => {
    const forecast = forecastGardenWithoutReading(historyInput('W', { config: HARSH_CONFIG }), 9);
    expect(forecast.map((forecastDay) => forecastDay.state.droughtDays)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 7,
    ]);
  });

  it('reading never harms with another configuration either (every history of 1 to 7 days)', () => {
    const letters = ['M', 'W', 'P'];
    const failures: string[] = [];
    const droughtOf = (config: GardenConfig, history: string): number =>
      stateWith(config, history).droughtDays;
    for (const config of [SLOW_CONFIG, HARSH_CONFIG]) {
      let histories = [''];
      for (let length = 1; length <= 7; length += 1) {
        histories = histories.flatMap((shorter) => letters.map((letter) => shorter + letter));
        for (const history of histories) {
          for (let index = 0; index < history.length; index += 1) {
            if (history[index] !== 'M') continue;
            const watered = history.slice(0, index) + 'W' + history.slice(index + 1);
            const before = droughtOf(config, 'W' + 'M'.repeat(5) + history);
            const after = droughtOf(config, 'W' + 'M'.repeat(5) + watered);
            if (after > before) failures.push(`${history} -> ${watered}: ${before} -> ${after}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
