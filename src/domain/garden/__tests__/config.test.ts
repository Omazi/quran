import { resolveGardenConfig } from '../config';
import { computeGardenState, DEFAULT_GARDEN_CONFIG, type GardenConfig } from '../index';
import { gardenInput } from '../test-support/garden-test-kit';

function configWith(overrides: Partial<GardenConfig>): GardenConfig {
  return { ...DEFAULT_GARDEN_CONFIG, ...overrides };
}

describe('garden configuration', () => {
  it('defaults to the values of the specification', () => {
    expect(DEFAULT_GARDEN_CONFIG).toEqual({
      recoveryPerWateredDay: 0.2,
      missedDayCosts: [
        { fromMissedDay: 1, cost: 0.1 },
        { fromMissedDay: 2, cost: 0.15 },
        { fromMissedDay: 4, cost: 0.07 },
        { fromMissedDay: 7, cost: 0.05 },
      ],
      thrivingMinHealth: 0.75,
      thirstyMinHealth: 0.5,
      wiltingMinHealth: 0.25,
      allElementsVisibleMinHealth: 0.25,
      dryWaterMinMissedDays: 3,
    });
  });

  it('cannot be modified by a caller', () => {
    expect(Object.isFrozen(DEFAULT_GARDEN_CONFIG)).toBe(true);
    expect(Object.isFrozen(DEFAULT_GARDEN_CONFIG.missedDayCosts)).toBe(true);
  });

  it('converts health fractions to exact whole points', () => {
    expect(resolveGardenConfig(DEFAULT_GARDEN_CONFIG)).toEqual({
      recoveryPoints: 20,
      missedDayCosts: [
        { fromMissedDay: 1, points: 10 },
        { fromMissedDay: 2, points: 15 },
        { fromMissedDay: 4, points: 7 },
        { fromMissedDay: 7, points: 5 },
      ],
      thrivingMinPoints: 75,
      thirstyMinPoints: 50,
      wiltingMinPoints: 25,
      allElementsVisibleMinPoints: 25,
      dryWaterMinMissedDays: 3,
    });
  });

  it('accepts every hundredth despite floating point noise (0.07 * 100 is not exactly 7)', () => {
    for (let hundredths = 1; hundredths <= 100; hundredths += 1) {
      const rules = resolveGardenConfig(configWith({ recoveryPerWateredDay: hundredths / 100 }));
      expect(rules.recoveryPoints).toBe(hundredths);
    }
  });

  it('is used by the engine when provided', () => {
    const gentle = configWith({ missedDayCosts: [{ fromMissedDay: 1, cost: 0.01 }] });
    expect(computeGardenState(gardenInput('MMM', 'unread', { config: gentle })).health).toBe(0.97);
    expect(computeGardenState(gardenInput('MMM')).health).toBe(0.6);
  });
});

describe('incoherent configuration: explicit error', () => {
  const invalidConfigs: readonly (readonly [string, Partial<GardenConfig>])[] = [
    ['a recovery of 0', { recoveryPerWateredDay: 0 }],
    ['a negative recovery', { recoveryPerWateredDay: -0.2 }],
    ['a recovery above 1', { recoveryPerWateredDay: 1.2 }],
    ['a recovery that is not a number', { recoveryPerWateredDay: Number.NaN }],
    ['a value finer than a hundredth', { recoveryPerWateredDay: 0.125 }],
    ['no missed-day cost', { missedDayCosts: [] }],
    [
      'costs that do not start at missed day 1',
      { missedDayCosts: [{ fromMissedDay: 2, cost: 0.1 }] },
    ],
    [
      'cost tiers out of order',
      {
        missedDayCosts: [
          { fromMissedDay: 1, cost: 0.1 },
          { fromMissedDay: 4, cost: 0.07 },
          { fromMissedDay: 2, cost: 0.15 },
        ],
      },
    ],
    [
      'two cost tiers for the same day',
      {
        missedDayCosts: [
          { fromMissedDay: 1, cost: 0.1 },
          { fromMissedDay: 1, cost: 0.15 },
        ],
      },
    ],
    ['a fractional missed-day rank', { missedDayCosts: [{ fromMissedDay: 1.5, cost: 0.1 }] }],
    ['a negative cost', { missedDayCosts: [{ fromMissedDay: 1, cost: -0.1 }] }],
    ['a cost above 1', { missedDayCosts: [{ fromMissedDay: 1, cost: 1.5 }] }],
    ['phase thresholds out of order', { thrivingMinHealth: 0.4 }],
    ['two equal phase thresholds', { thirstyMinHealth: 0.25 }],
    ['a wilting threshold of 0', { wiltingMinHealth: 0 }],
    ['a thriving threshold above 1', { thrivingMinHealth: 1.1 }],
    ['a visibility threshold of 0', { allElementsVisibleMinHealth: 0 }],
    ['a dry-water threshold of 0 days', { dryWaterMinMissedDays: 0 }],
    ['a fractional dry-water threshold', { dryWaterMinMissedDays: 2.5 }],
  ];

  it.each(invalidConfigs)('rejects %s', (_label, overrides) => {
    const config = configWith(overrides);
    expect(() => resolveGardenConfig(config)).toThrow(RangeError);
    expect(() => computeGardenState(gardenInput('WWW', 'read', { config }))).toThrow(RangeError);
  });

  it('names the incoherent value', () => {
    expect(() => resolveGardenConfig(configWith({ recoveryPerWateredDay: 0.125 }))).toThrow(
      /recoveryPerWateredDay must be a whole number of hundredths/,
    );
  });
});
