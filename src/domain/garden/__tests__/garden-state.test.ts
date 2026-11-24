import { addDays, type LocalDate } from '@/domain/shared/local-date';

import {
  computeGardenState,
  DEFAULT_GARDEN_CONFIG,
  GARDEN_CATALOG,
  type GardenConfig,
  type GardenElement,
  type GardenInput,
  type GardenState,
} from '../index';
import { gardenInput } from '../test-support/garden-test-kit';

/** One point of health lost per missed day: n missed days lead exactly to 1 - n/100. */
const ONE_POINT_PER_MISSED_DAY: GardenConfig = {
  ...DEFAULT_GARDEN_CONFIG,
  missedDayCosts: [{ fromMissedDay: 1, cost: 0.01 }],
};

/** A garden whose health is exactly `hundredths` / 100. */
function gardenAtHealth(hundredths: number, overrides: Partial<GardenInput> = {}): GardenState {
  const state = computeGardenState(
    gardenInput('M'.repeat(100 - hundredths), 'unread', {
      config: ONE_POINT_PER_MISSED_DAY,
      ...overrides,
    }),
  );
  if (overrides.hizbCompleted !== 0) expect(state.health).toBe(hundredths / 100);
  return state;
}

function ids(elements: readonly GardenElement[]): string[] {
  return elements.map((element) => element.id);
}

describe('water', () => {
  it('is flowing when no day is missed', () => {
    expect(computeGardenState(gardenInput('WWW', 'unread')).water).toBe('flowing');
    expect(computeGardenState(gardenInput('', 'unread')).water).toBe('flowing');
  });

  it('is flowing when today is watered, whatever came before', () => {
    expect(computeGardenState(gardenInput('M'.repeat(40), 'read')).water).toBe('flowing');
  });

  it('is still after 1 or 2 missed days in a row', () => {
    expect(computeGardenState(gardenInput('W M')).water).toBe('still');
    expect(computeGardenState(gardenInput('W MM')).water).toBe('still');
  });

  it('is dry from 3 missed days in a row', () => {
    expect(computeGardenState(gardenInput('W MMM')).water).toBe('dry');
    expect(computeGardenState(gardenInput('W MMMM')).water).toBe('dry');
    expect(computeGardenState(gardenInput(`W ${'M'.repeat(200)}`)).water).toBe('dry');
  });

  it('comes back the very day the user reads', () => {
    expect(computeGardenState(gardenInput('MMMMM', 'unread')).water).toBe('dry');
    expect(computeGardenState(gardenInput('MMMMM', 'read')).water).toBe('flowing');
  });

  it('keeps its state during a pause', () => {
    expect(computeGardenState(gardenInput('W M PPPP')).water).toBe('still');
    expect(computeGardenState(gardenInput('W PPPP')).water).toBe('flowing');
  });

  it('follows the configured number of missed days', () => {
    const config = { ...DEFAULT_GARDEN_CONFIG, dryWaterMinMissedDays: 5 };
    expect(computeGardenState(gardenInput('MMMM', 'unread', { config })).water).toBe('still');
    expect(computeGardenState(gardenInput('MMMMM', 'unread', { config })).water).toBe('dry');
  });
});

describe('phases', () => {
  it('is bare while no hizb is finished', () => {
    expect(computeGardenState(gardenInput('WWW', 'read', { hizbCompleted: 0 })).phase).toBe('bare');
    expect(gardenAtHealth(0, { hizbCompleted: 0 }).phase).toBe('bare');
  });

  it.each([
    [100, 'thriving'],
    [75, 'thriving'], // thriving: health >= 0.75
    [74, 'thirsty'],
    [50, 'thirsty'], // thirsty: health >= 0.50
    [49, 'wilting'],
    [25, 'wilting'], // wilting: health >= 0.25
    [24, 'dying'],
    [1, 'dying'], // dying: health > 0
    [0, 'dead'], // dead: health 0, with at least one hizb
  ])('at %i hundredths of health, the garden is %s', (hundredths, phase) => {
    expect(gardenAtHealth(hundredths).phase).toBe(phase);
  });

  it('is dead only with at least one hizb', () => {
    expect(gardenAtHealth(0, { hizbCompleted: 1 }).phase).toBe('dead');
    expect(gardenAtHealth(0, { hizbCompleted: 0 }).phase).toBe('bare');
  });

  // With plain floating point these two histories end at 0.4999999999999999 and
  // 0.7499999999999999, one phase too low. Health is computed in whole hundredths.
  it('compares health with the thresholds exactly', () => {
    const half = computeGardenState(gardenInput('MM W MM W MMM'));
    expect(half.health).toBe(0.5);
    expect(half.phase).toBe('thirsty');

    const threeQuarters = computeGardenState(gardenInput('MM W MM W MM W M'));
    expect(threeQuarters.health).toBe(0.75);
    expect(threeQuarters.phase).toBe('thriving');
  });
});

describe('visible elements', () => {
  it('shows every unlocked element when health is 0.25 or more', () => {
    expect(ids(gardenAtHealth(25).visibleElements)).toEqual(ids(GARDEN_CATALOG.slice(0, 24)));
    expect(gardenAtHealth(60).visibleElements).toHaveLength(24);
    expect(gardenAtHealth(100, { hizbCompleted: 60 }).visibleElements).toEqual(GARDEN_CATALOG);
  });

  it.each([
    // unlocked, hundredths of health, visible = floor(unlocked * health / 0.25)
    [24, 24, 23],
    [24, 19, 18],
    [24, 13, 12],
    [24, 12, 11],
    [24, 4, 3],
    [24, 1, 0],
    [60, 24, 57],
    [60, 1, 2],
    [1, 24, 0],
    [3, 9, 1],
  ])('with %i unlocked at %i hundredths of health, shows %i', (unlocked, hundredths, visible) => {
    const state = gardenAtHealth(hundredths, { hizbCompleted: unlocked });
    expect(state.visibleElements).toHaveLength(visible);
  });

  it('keeps the first elements of the catalogue: the last arrived disappear first', () => {
    const state = gardenAtHealth(4);
    expect(ids(state.visibleElements)).toEqual(['channels', 'paving', 'bed-1']);
  });

  it('shows nothing at health 0', () => {
    expect(gardenAtHealth(0).visibleElements).toEqual([]);
    expect(gardenAtHealth(0, { hizbCompleted: 60 }).visibleElements).toEqual([]);
  });

  it('shows nothing while no hizb is finished', () => {
    expect(
      computeGardenState(gardenInput('WWW', 'read', { hizbCompleted: 0 })).visibleElements,
    ).toEqual([]);
  });

  it('brings the elements back by the same rule when health rises', () => {
    const dead = 'M'.repeat(14);
    expect(computeGardenState(gardenInput(dead)).visibleElements).toHaveLength(0);
    // One day of reading: health 0.20, floor(24 * 0.20 / 0.25) = 19 elements.
    expect(ids(computeGardenState(gardenInput(dead, 'read')).visibleElements)).toEqual(
      ids(GARDEN_CATALOG.slice(0, 19)),
    );
    // Two days: health 0.40, everything is back.
    expect(computeGardenState(gardenInput(`${dead} W`, 'read')).visibleElements).toHaveLength(24);
  });
});

describe('GardenState output', () => {
  it('echoes hizbCompleted', () => {
    expect(
      computeGardenState(gardenInput('WWW', 'read', { hizbCompleted: 37 })).hizbCompleted,
    ).toBe(37);
  });

  it('counts missedDaysInARow up to yesterday', () => {
    expect(computeGardenState(gardenInput('WWW')).missedDaysInARow).toBe(0);
    expect(computeGardenState(gardenInput('WWW MMMMM')).missedDaysInARow).toBe(5);
    expect(computeGardenState(gardenInput('WWW MMMMM', 'read')).missedDaysInARow).toBe(0);
  });

  describe('daysSinceLastWatered', () => {
    it('is null when the user never read', () => {
      expect(computeGardenState(gardenInput('MMM')).daysSinceLastWatered).toBeNull();
    });

    it('is 0 when the user read today', () => {
      expect(computeGardenState(gardenInput('MMM', 'read')).daysSinceLastWatered).toBe(0);
    });

    it('counts calendar days, paused days included', () => {
      expect(computeGardenState(gardenInput('W')).daysSinceLastWatered).toBe(1);
      expect(computeGardenState(gardenInput('W MMM')).daysSinceLastWatered).toBe(4);
      expect(computeGardenState(gardenInput('W PPP M')).daysSinceLastWatered).toBe(5);
    });
  });

  describe('lastUnlocked', () => {
    it('is null while no hizb is finished', () => {
      expect(
        computeGardenState(gardenInput('W', 'read', { hizbCompleted: 0 })).lastUnlocked,
      ).toBeNull();
    });

    it('is the element of the last finished hizb', () => {
      expect(
        computeGardenState(gardenInput('W', 'read', { hizbCompleted: 1 })).lastUnlocked?.id,
      ).toBe('channels');
      expect(computeGardenState(gardenInput('W', 'read')).lastUnlocked).toEqual({
        hizb: 24,
        id: 'springs',
        kind: 'springs',
        verse: '55:66',
      });
      expect(
        computeGardenState(gardenInput('W', 'read', { hizbCompleted: 60 })).lastUnlocked?.id,
      ).toBe('full-bloom');
    });

    it('is still reported when low health hides it: a finished hizb is never lost', () => {
      const state = gardenAtHealth(4);
      expect(state.lastUnlocked?.id).toBe('springs');
      expect(ids(state.visibleElements)).not.toContain('springs');
      expect(gardenAtHealth(0).lastUnlocked?.id).toBe('springs');
    });
  });

  describe('nextElement', () => {
    it('is the element of the hizb in progress, with its growth', () => {
      const state = computeGardenState(gardenInput('W', 'read', { currentHizbProgress: 0.4 }));
      expect(state.nextElement).toEqual({
        element: { hizb: 25, id: 'tree-12', kind: 'orange' },
        growth: 0.4,
      });
    });

    it('is the first element of the catalogue on bare earth', () => {
      const state = computeGardenState(
        gardenInput('', 'unread', { hizbCompleted: 0, currentHizbProgress: 0 }),
      );
      expect(state.nextElement?.element.id).toBe('channels');
      expect(state.nextElement?.growth).toBe(0);
    });

    it('accepts a growth of exactly 0 and exactly 1', () => {
      const growthFor = (currentHizbProgress: number) =>
        computeGardenState(gardenInput('W', 'read', { currentHizbProgress })).nextElement?.growth;
      expect(growthFor(0)).toBe(0);
      expect(growthFor(1)).toBe(1);
    });

    it('is the last element at hizb 59', () => {
      const state = computeGardenState(gardenInput('W', 'read', { hizbCompleted: 59 }));
      expect(state.nextElement?.element.id).toBe('full-bloom');
      expect(state.isComplete).toBe(false);
    });

    it('is null once the garden is complete, whatever the progress reported', () => {
      const state = computeGardenState(
        gardenInput('W', 'read', { hizbCompleted: 60, currentHizbProgress: 0.3 }),
      );
      expect(state.nextElement).toBeNull();
      expect(state.isComplete).toBe(true);
    });
  });

  describe('isComplete', () => {
    it('is true at 60 hizb only', () => {
      expect(computeGardenState(gardenInput('W', 'read', { hizbCompleted: 0 })).isComplete).toBe(
        false,
      );
      expect(computeGardenState(gardenInput('W', 'read', { hizbCompleted: 59 })).isComplete).toBe(
        false,
      );
      expect(computeGardenState(gardenInput('W', 'read', { hizbCompleted: 60 })).isComplete).toBe(
        true,
      );
    });

    it('does not protect a complete garden from dying', () => {
      const state = computeGardenState(
        gardenInput('M'.repeat(14), 'unread', { hizbCompleted: 60 }),
      );
      expect(state.isComplete).toBe(true);
      expect(state.phase).toBe('dead');
    });
  });

  describe('isPausedToday', () => {
    it('is true when today is inside a pause, read or not', () => {
      expect(computeGardenState(gardenInput('WW', 'paused-unread')).isPausedToday).toBe(true);
      expect(computeGardenState(gardenInput('WW', 'paused-read')).isPausedToday).toBe(true);
    });

    it('is false outside any pause', () => {
      expect(computeGardenState(gardenInput('WW', 'unread')).isPausedToday).toBe(false);
      expect(computeGardenState(gardenInput('W PPP', 'unread')).isPausedToday).toBe(false);
    });

    it('includes both ends of a pause', () => {
      const input = gardenInput('WWWWW');
      const pauseAround = (fromOffset: number, toOffset: number): GardenInput => ({
        ...input,
        pauses: [{ from: addDays(input.today, fromOffset), to: addDays(input.today, toOffset) }],
      });
      expect(computeGardenState(pauseAround(-3, 0)).isPausedToday).toBe(true);
      expect(computeGardenState(pauseAround(0, 3)).isPausedToday).toBe(true);
      expect(computeGardenState(pauseAround(0, 0)).isPausedToday).toBe(true);
      expect(computeGardenState(pauseAround(-3, -1)).isPausedToday).toBe(false);
      expect(computeGardenState(pauseAround(1, 3)).isPausedToday).toBe(false);
    });
  });
});

describe('invalid input: explicit error', () => {
  // `as` on purpose below: a branded LocalDate cannot hold these values in typed code,
  // but they can arrive from storage or JSON at run time.
  const notADate = (value: string): LocalDate => value as LocalDate;
  const valid = gardenInput('WW MM', 'read');

  it('accepts the valid input used by these tests', () => {
    expect(() => computeGardenState(valid)).not.toThrow();
  });

  it.each([-1, 61, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects hizbCompleted = %d (outside the whole numbers 0..60)',
    (hizbCompleted) => {
      expect(() => computeGardenState({ ...valid, hizbCompleted })).toThrow(RangeError);
    },
  );

  it('accepts hizbCompleted at both ends, 0 and 60', () => {
    expect(() => computeGardenState({ ...valid, hizbCompleted: 0 })).not.toThrow();
    expect(() => computeGardenState({ ...valid, hizbCompleted: 60 })).not.toThrow();
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects currentHizbProgress = %d (outside 0..1)',
    (currentHizbProgress) => {
      expect(() => computeGardenState({ ...valid, currentHizbProgress })).toThrow(RangeError);
    },
  );

  it('rejects today before startDate', () => {
    expect(() => computeGardenState({ ...valid, today: addDays(valid.startDate, -1) })).toThrow(
      /is before startDate/,
    );
  });

  it('rejects a pause whose end is before its start', () => {
    const pause = { from: addDays(valid.startDate, 3), to: addDays(valid.startDate, 2) };
    expect(() => computeGardenState({ ...valid, pauses: [pause] })).toThrow(/before it starts/);
  });

  it('accepts a one-day pause (from equal to to)', () => {
    const day = addDays(valid.startDate, 3);
    expect(() => computeGardenState({ ...valid, pauses: [{ from: day, to: day }] })).not.toThrow();
  });

  it('rejects dates that are not real calendar days', () => {
    const realDay = valid.startDate;
    expect(() => computeGardenState({ ...valid, startDate: notADate('2026-02-30') })).toThrow(
      RangeError,
    );
    expect(() => computeGardenState({ ...valid, today: notADate('tomorrow') })).toThrow(RangeError);
    expect(() =>
      computeGardenState({ ...valid, pauses: [{ from: notADate('2026-1-1'), to: realDay }] }),
    ).toThrow(RangeError);
    expect(() =>
      computeGardenState({ ...valid, pauses: [{ from: realDay, to: notADate('') }] }),
    ).toThrow(RangeError);
    expect(() =>
      computeGardenState({ ...valid, wateredDays: new Set([notADate('2026-13-01')]) }),
    ).toThrow(RangeError);
  });

  it('rejects an invalid catalogue', () => {
    expect(() => computeGardenState({ ...valid, catalog: GARDEN_CATALOG.slice(0, 10) })).toThrow(
      RangeError,
    );
  });
});

describe('engine and catalogue are independent', () => {
  const otherCatalog: readonly GardenElement[] = Array.from({ length: 60 }, (_, index) => ({
    hizb: index + 1,
    id: `stone-${index + 1}`,
    kind: 'paving',
  }));

  it('works with any valid 60-step catalogue', () => {
    const state = computeGardenState(
      gardenInput('WWW', 'read', { catalog: otherCatalog, currentHizbProgress: 0.5 }),
    );
    expect(state.lastUnlocked?.id).toBe('stone-24');
    expect(state.nextElement).toEqual({ element: otherCatalog[24], growth: 0.5 });
    expect(ids(state.visibleElements)).toEqual(ids(otherCatalog.slice(0, 24)));
  });
});

describe('purity', () => {
  it('does not modify its input', () => {
    const input = gardenInput('WW MMM PP W MMMMMMMMMMMM', 'read');
    const wateredBefore = [...input.wateredDays];
    const pausesBefore = input.pauses.map((pause) => ({ ...pause }));
    Object.freeze(input);
    Object.freeze(input.pauses);

    computeGardenState(input);

    expect([...input.wateredDays]).toEqual(wateredBefore);
    expect(input.pauses).toEqual(pausesBefore);
  });
});
