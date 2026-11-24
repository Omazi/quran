import { assertValidConfig, dyingStepCount, healthOf } from '../config';
import { computeGardenState, DEFAULT_GARDEN_CONFIG, type GardenConfig } from '../index';
import { gardenInput } from '../test-support/garden-test-kit';

function configWith(overrides: Partial<GardenConfig>): GardenConfig {
  return { ...DEFAULT_GARDEN_CONFIG, ...overrides };
}

describe('garden configuration', () => {
  it('defaults to the values of the specification', () => {
    expect(DEFAULT_GARDEN_CONFIG).toEqual({
      droughtDaysToDeath: 14,
      droughtDaysRecoveredPerWateredDay: 3,
      thirstyMinDroughtDays: 3,
      wiltingMinDroughtDays: 6,
      dyingMinDroughtDays: 10,
      dryWaterMinMissedDays: 3,
    });
  });

  it('cannot be modified by a caller', () => {
    expect(Object.isFrozen(DEFAULT_GARDEN_CONFIG)).toBe(true);
  });

  it('is coherent', () => {
    expect(() => assertValidConfig(DEFAULT_GARDEN_CONFIG)).not.toThrow();
  });

  it('is used by the engine when provided', () => {
    const generous = configWith({ droughtDaysRecoveredPerWateredDay: 10 });
    const strict = configWith({ droughtDaysRecoveredPerWateredDay: 1 });
    const history = 'MMMMMMMMMMMM W'; // 12 drought days, then one reading
    expect(computeGardenState(gardenInput(history)).droughtDays).toBe(9);
    expect(
      computeGardenState(gardenInput(history, 'unread', { config: generous })).droughtDays,
    ).toBe(2);
    expect(computeGardenState(gardenInput(history, 'unread', { config: strict })).droughtDays).toBe(
      11,
    );
  });

  it('lets the garden die sooner or later than in two weeks', () => {
    const oneWeek = configWith({
      thirstyMinDroughtDays: 2,
      wiltingMinDroughtDays: 3,
      dyingMinDroughtDays: 5,
      droughtDaysToDeath: 7,
    });
    const afterSixDays = computeGardenState(gardenInput('MMMMMM', 'unread', { config: oneWeek }));
    const afterAWeek = computeGardenState(gardenInput('MMMMMMM', 'unread', { config: oneWeek }));
    expect(afterSixDays.phase).toBe('dying');
    expect(afterSixDays.health).toBeCloseTo(1 / 7, 12);
    expect(afterAWeek.phase).toBe('dead');
    expect(afterAWeek.droughtDays).toBe(7);
    expect(afterAWeek.health).toBe(0);
  });
});

describe('incoherent configuration: explicit error', () => {
  const invalidConfigs: readonly (readonly [string, Partial<GardenConfig>])[] = [
    ['a death after 0 drought days', { droughtDaysToDeath: 0 }],
    ['a negative number of drought days to death', { droughtDaysToDeath: -14 }],
    ['a fractional number of drought days to death', { droughtDaysToDeath: 13.5 }],
    ['drought days to death that are not a number', { droughtDaysToDeath: Number.NaN }],
    ['an infinite number of drought days to death', { droughtDaysToDeath: Infinity }],
    ['a watered day that recovers nothing', { droughtDaysRecoveredPerWateredDay: 0 }],
    ['a watered day that adds drought', { droughtDaysRecoveredPerWateredDay: -1 }],
    ['a fractional recovery', { droughtDaysRecoveredPerWateredDay: 2.5 }],
    ['a thirsty phase from 0 drought days (no thriving phase)', { thirstyMinDroughtDays: 0 }],
    ['a fractional phase threshold', { wiltingMinDroughtDays: 6.5 }],
    ['thirsty not before wilting', { thirstyMinDroughtDays: 6 }],
    ['wilting not before dying', { wiltingMinDroughtDays: 10 }],
    ['wilting before thirsty', { wiltingMinDroughtDays: 2 }],
    ['dying not before death (no dying phase)', { dyingMinDroughtDays: 14 }],
    ['dying after death', { dyingMinDroughtDays: 20 }],
    ['a death before the dying phase', { droughtDaysToDeath: 8 }],
    ['a dry-water threshold of 0 days', { dryWaterMinMissedDays: 0 }],
    ['a fractional dry-water threshold', { dryWaterMinMissedDays: 2.5 }],
  ];

  it.each(invalidConfigs)('rejects %s', (_label, overrides) => {
    const config = configWith(overrides);
    expect(() => assertValidConfig(config)).toThrow(RangeError);
    expect(() => computeGardenState(gardenInput('WWW', 'read', { config }))).toThrow(RangeError);
  });

  it('names the incoherent value', () => {
    expect(() => assertValidConfig(configWith({ droughtDaysRecoveredPerWateredDay: 2.5 }))).toThrow(
      /droughtDaysRecoveredPerWateredDay must be a whole number of at least 1, got 2.5/,
    );
    expect(() => assertValidConfig(configWith({ dyingMinDroughtDays: 14 }))).toThrow(
      /thirstyMinDroughtDays < wiltingMinDroughtDays < dyingMinDroughtDays < droughtDaysToDeath/,
    );
  });

  it('rejects what is not a configuration at all', () => {
    // `as` on purpose: these values cannot be written in typed code, but can arrive from JSON.
    const notAConfig = (value: unknown): GardenConfig => value as GardenConfig;
    expect(() => assertValidConfig(notAConfig(null))).toThrow(TypeError);
    expect(() => assertValidConfig(notAConfig('gentle'))).toThrow(TypeError);
    expect(() => assertValidConfig(notAConfig({}))).toThrow(RangeError);
    expect(() =>
      assertValidConfig(notAConfig({ ...DEFAULT_GARDEN_CONFIG, droughtDaysToDeath: '14' })),
    ).toThrow(RangeError);
    expect(() =>
      computeGardenState(gardenInput('WWW', 'read', { config: notAConfig(null) })),
    ).toThrow(TypeError);
  });
});

describe('the numbers of the specification follow from the default configuration', () => {
  it('health is 1 - droughtDays / 14', () => {
    expect(healthOf(0, DEFAULT_GARDEN_CONFIG)).toBe(1);
    expect(healthOf(7, DEFAULT_GARDEN_CONFIG)).toBe(0.5);
    expect(healthOf(14, DEFAULT_GARDEN_CONFIG)).toBe(0);
    for (let droughtDays = 0; droughtDays <= 14; droughtDays += 1) {
      expect(healthOf(droughtDays, DEFAULT_GARDEN_CONFIG)).toBe(1 - droughtDays / 14);
    }
  });

  it('a dying garden loses its elements in five equal steps: 80 %, 60 %, 40 %, 20 %, nothing', () => {
    expect(dyingStepCount(DEFAULT_GARDEN_CONFIG)).toBe(5);
    const shareLeft = (droughtDays: number): number =>
      (DEFAULT_GARDEN_CONFIG.droughtDaysToDeath - droughtDays) /
      dyingStepCount(DEFAULT_GARDEN_CONFIG);
    expect([10, 11, 12, 13, 14].map(shareLeft)).toEqual([0.8, 0.6, 0.4, 0.2, 0]);
    // The last day before the dying phase keeps everything.
    expect(shareLeft(9)).toBe(1);
  });

  it('five watered days bring a dead earth back to full health, four do not', () => {
    const { droughtDaysToDeath, droughtDaysRecoveredPerWateredDay } = DEFAULT_GARDEN_CONFIG;
    expect(5 * droughtDaysRecoveredPerWateredDay).toBeGreaterThanOrEqual(droughtDaysToDeath);
    expect(4 * droughtDaysRecoveredPerWateredDay).toBeLessThan(droughtDaysToDeath);
  });
});
