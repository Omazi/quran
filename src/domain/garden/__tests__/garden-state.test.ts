import { addDays, type LocalDate } from '@/domain/shared/local-date';

import {
  computeGardenState,
  DEFAULT_GARDEN_CONFIG,
  GARDEN_CATALOG,
  gardenVariant,
  REFERENCE_GARDEN_VARIANT,
  type GardenElement,
  type GardenInput,
  type GardenState,
  type GardenVariant,
} from '../index';
import { GARDEN_FIRST_DAY, gardenInput } from '../test-support/garden-test-kit';

/** A garden with exactly `droughtDays` drought days (0..14): that many missed days. */
function gardenAtDrought(droughtDays: number, overrides: Partial<GardenInput> = {}): GardenState {
  const state = computeGardenState(gardenInput('M'.repeat(droughtDays), 'unread', overrides));
  if (overrides.hizbCompleted !== 0) expect(state.droughtDays).toBe(droughtDays);
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

  it('follows the run of missed days, not the drought', () => {
    // A long absence, one reading, one missed day: still very dry, but the water only stopped.
    const state = computeGardenState(gardenInput('MMMMMMMMMMMM W M'));
    expect(state.droughtDays).toBe(10);
    expect(state.phase).toBe('dying');
    expect(state.water).toBe('still');
  });

  it('follows the configured number of missed days', () => {
    const config = { ...DEFAULT_GARDEN_CONFIG, dryWaterMinMissedDays: 5 };
    expect(computeGardenState(gardenInput('MMMM', 'unread', { config })).water).toBe('still');
    expect(computeGardenState(gardenInput('MMMMM', 'unread', { config })).water).toBe('dry');
  });

  describe('on a bare earth there is no water yet: dry, and no missed day', () => {
    it.each(['unread', 'read', 'paused-unread', 'paused-read'] as const)(
      'is dry when today is %s',
      (today) => {
        const state = computeGardenState(gardenInput('WW MM', today, { hizbCompleted: 0 }));
        expect(state.water).toBe('dry');
        expect(state.missedDaysInARow).toBe(0);
      },
    );

    it('flows from the day the first hizb is finished', () => {
      const state = computeGardenState(gardenInput('', 'read', { hizbCompleted: 1 }));
      expect(state.water).toBe('flowing');
    });
  });
});

describe('phases', () => {
  it('is bare while no hizb is finished', () => {
    expect(computeGardenState(gardenInput('WWW', 'read', { hizbCompleted: 0 })).phase).toBe('bare');
    expect(gardenAtDrought(14, { hizbCompleted: 0 }).phase).toBe('bare');
  });

  it.each([
    [0, 'thriving'], // thriving: 0 to 2 drought days
    [1, 'thriving'],
    [2, 'thriving'],
    [3, 'thirsty'], // thirsty: 3 to 5
    [4, 'thirsty'],
    [5, 'thirsty'],
    [6, 'wilting'], // wilting: 6 to 9
    [7, 'wilting'],
    [8, 'wilting'],
    [9, 'wilting'],
    [10, 'dying'], // dying: 10 to 13
    [11, 'dying'],
    [12, 'dying'],
    [13, 'dying'],
    [14, 'dead'], // dead: 14
  ])('with %i drought days, the garden is %s', (droughtDays, phase) => {
    expect(gardenAtDrought(droughtDays).phase).toBe(phase);
  });

  it('is dead only with at least one hizb', () => {
    expect(gardenAtDrought(14, { hizbCompleted: 1 }).phase).toBe('dead');
    expect(gardenAtDrought(14, { hizbCompleted: 0 }).phase).toBe('bare');
  });

  it('follows the configured drought days', () => {
    const config = {
      ...DEFAULT_GARDEN_CONFIG,
      thirstyMinDroughtDays: 1,
      wiltingMinDroughtDays: 2,
      dyingMinDroughtDays: 3,
      droughtDaysToDeath: 4,
    };
    const phaseAfter = (missedDays: number): string =>
      computeGardenState(gardenInput('M'.repeat(missedDays), 'unread', { config })).phase;
    expect([0, 1, 2, 3, 4, 5].map(phaseAfter)).toEqual([
      'thriving',
      'thirsty',
      'wilting',
      'dying',
      'dead',
      'dead',
    ]);
  });
});

describe('one element per finished hizb', () => {
  it('starts from a bare earth: no element, the first one about to grow', () => {
    const state = computeGardenState(gardenInput('', 'unread', { hizbCompleted: 0 }));
    expect(state.phase).toBe('bare');
    expect(state.visibleElements).toEqual([]);
    expect(state.lastUnlocked).toBeNull();
    expect(state.nextElement?.element).toBe(GARDEN_CATALOG[0]);
  });

  it('unlocks exactly one more element with each finished hizb, from 0 to 60', () => {
    for (let hizbCompleted = 0; hizbCompleted <= 60; hizbCompleted += 1) {
      const state = computeGardenState(gardenInput('WW', 'read', { hizbCompleted }));
      expect(state.visibleElements).toEqual(GARDEN_CATALOG.slice(0, hizbCompleted));
      expect(state.lastUnlocked?.hizb ?? 0).toBe(hizbCompleted);
      expect(state.nextElement?.element.hizb ?? 61).toBe(hizbCompleted + 1);
      expect(state.isComplete).toBe(hizbCompleted === 60);
    }
  });

  it('is complete at 60 hizb: the 60 elements, nothing left to grow', () => {
    const state = computeGardenState(gardenInput('WW', 'read', { hizbCompleted: 60 }));
    expect(state.visibleElements).toHaveLength(60);
    expect(state.lastUnlocked?.id).toBe('full-bloom');
    expect(state.nextElement).toBeNull();
    expect(state.isComplete).toBe(true);
  });

  it('never loses a finished hizb, whatever happens to the garden', () => {
    for (const missedDays of [0, 3, 9, 14, 200]) {
      const state = computeGardenState(gardenInput('M'.repeat(missedDays)));
      expect(state.hizbCompleted).toBe(24);
      expect(state.lastUnlocked?.id).toBe('springs');
    }
  });
});

describe('visible elements', () => {
  it.each([0, 2, 3, 5, 6, 9])(
    'shows every unlocked element up to wilting included: %i drought days',
    (droughtDays) => {
      expect(ids(gardenAtDrought(droughtDays).visibleElements)).toEqual(
        ids(GARDEN_CATALOG.slice(0, 24)),
      );
      expect(gardenAtDrought(droughtDays, { hizbCompleted: 60 }).visibleElements).toEqual(
        GARDEN_CATALOG,
      );
    },
  );

  it.each([
    // unlocked, drought days, visible = ceil(unlocked * (14 - drought days) / 5)
    [60, 10, 48],
    [60, 11, 36],
    [60, 12, 24],
    [60, 13, 12],
    [24, 10, 20],
    [24, 11, 15],
    [24, 12, 10],
    [24, 13, 5],
    [5, 10, 4],
    [5, 13, 1],
    [4, 10, 4],
    [3, 11, 2],
    [2, 12, 1],
    [1, 10, 1],
    [1, 13, 1],
  ])('dying: with %i unlocked and %i drought days, shows %i', (unlocked, droughtDays, visible) => {
    const state = gardenAtDrought(droughtDays, { hizbCompleted: unlocked });
    expect(state.phase).toBe('dying');
    expect(state.visibleElements).toHaveLength(visible);
  });

  it('dying: rounds up, so a garden that is not dead always keeps at least one element', () => {
    for (let unlocked = 1; unlocked <= 60; unlocked += 1) {
      for (const droughtDays of [10, 11, 12, 13]) {
        const visible = gardenAtDrought(droughtDays, { hizbCompleted: unlocked }).visibleElements;
        expect(visible.length).toBeGreaterThanOrEqual(1);
        expect(visible.length).toBeLessThanOrEqual(unlocked);
        expect(visible.length).toBe(Math.ceil((unlocked * (14 - droughtDays)) / 5));
      }
    }
  });

  it('the first reading after death always brings an element back, whatever the garden', () => {
    for (let unlocked = 1; unlocked <= 60; unlocked += 1) {
      const dead = gardenInput('M'.repeat(14), 'unread', { hizbCompleted: unlocked });
      const readAgain = gardenInput('M'.repeat(14), 'read', { hizbCompleted: unlocked });
      expect(computeGardenState(dead).visibleElements).toHaveLength(0);
      expect(computeGardenState(readAgain).visibleElements.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('one element only, dead garden, then one day of reading: the element is visible again', () => {
    const dead = computeGardenState(gardenInput('M'.repeat(20), 'unread', { hizbCompleted: 1 }));
    const back = computeGardenState(gardenInput('M'.repeat(20), 'read', { hizbCompleted: 1 }));
    expect(dead.phase).toBe('dead');
    expect(dead.visibleElements).toEqual([]);
    expect(back.phase).toBe('dying');
    expect(ids(back.visibleElements)).toEqual(['channels']);
  });

  it('dying: keeps 80 %, 60 %, 40 % then 20 % of the elements', () => {
    const shareAt = (droughtDays: number): number =>
      gardenAtDrought(droughtDays, { hizbCompleted: 60 }).visibleElements.length / 60;
    expect([10, 11, 12, 13].map(shareAt)).toEqual([0.8, 0.6, 0.4, 0.2]);
  });

  it('keeps the first elements of the catalogue: the last arrived disappear first', () => {
    const state = gardenAtDrought(13);
    expect(ids(state.visibleElements)).toEqual(['channels', 'paving', 'bed-1', 'bed-2', 'tree-1']);
  });

  it('dead: shows nothing', () => {
    expect(gardenAtDrought(14).visibleElements).toEqual([]);
    expect(gardenAtDrought(14, { hizbCompleted: 60 }).visibleElements).toEqual([]);
  });

  it('shows nothing while no hizb is finished', () => {
    expect(
      computeGardenState(gardenInput('WWW', 'read', { hizbCompleted: 0 })).visibleElements,
    ).toEqual([]);
  });

  it('makes the elements disappear progressively, day after day, once the garden is dying', () => {
    const visibleAfter = (missedDays: number): number =>
      computeGardenState(gardenInput('M'.repeat(missedDays))).visibleElements.length;
    expect([9, 10, 11, 12, 13, 14].map(visibleAfter)).toEqual([24, 20, 15, 10, 5, 0]);
  });

  it('never shows more elements on a later day of the same absence', () => {
    let previous = 60;
    for (let missedDays = 0; missedDays <= 20; missedDays += 1) {
      const state = computeGardenState(
        gardenInput('M'.repeat(missedDays), 'unread', { hizbCompleted: 60 }),
      );
      expect(state.visibleElements.length).toBeLessThanOrEqual(previous);
      previous = state.visibleElements.length;
    }
    expect(previous).toBe(0);
  });

  it('brings the elements back by the same rule when the drought recedes', () => {
    const dead = 'M'.repeat(14);
    expect(computeGardenState(gardenInput(dead)).visibleElements).toHaveLength(0);
    // One day of reading: 11 drought days, ceil(24 * 3 / 5) = 15 elements.
    expect(ids(computeGardenState(gardenInput(dead, 'read')).visibleElements)).toEqual(
      ids(GARDEN_CATALOG.slice(0, 15)),
    );
    // Two days: 8 drought days, everything is back.
    expect(computeGardenState(gardenInput(`${dead} W`, 'read')).visibleElements).toHaveLength(24);
  });
});

describe('GardenState output', () => {
  it('echoes hizbCompleted', () => {
    expect(
      computeGardenState(gardenInput('WWW', 'read', { hizbCompleted: 37 })).hizbCompleted,
    ).toBe(37);
  });

  it('gives droughtDays and the health that follows from it', () => {
    const state = computeGardenState(gardenInput('MMMMMMM'));
    expect(state.droughtDays).toBe(7);
    expect(state.health).toBe(0.5);
  });

  it('counts missedDaysInARow up to yesterday', () => {
    expect(computeGardenState(gardenInput('WWW')).missedDaysInARow).toBe(0);
    expect(computeGardenState(gardenInput('WWW MMMMM')).missedDaysInARow).toBe(5);
    expect(computeGardenState(gardenInput('WWW MMMMM', 'read')).missedDaysInARow).toBe(0);
  });

  it('keeps counting missedDaysInARow after the drought has reached its maximum', () => {
    const state = computeGardenState(gardenInput('M'.repeat(40)));
    expect(state.droughtDays).toBe(14);
    expect(state.missedDaysInARow).toBe(40);
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

    it('is told on a bare earth too: reading is reading, garden or not', () => {
      const state = computeGardenState(gardenInput('W MM', 'unread', { hizbCompleted: 0 }));
      expect(state.daysSinceLastWatered).toBe(3);
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
        verse: { key: '55:66', validatedByTeacher: false },
      });
      expect(
        computeGardenState(gardenInput('W', 'read', { hizbCompleted: 60 })).lastUnlocked?.id,
      ).toBe('full-bloom');
    });

    it('is still reported when the drought hides it: a finished hizb is never lost', () => {
      const state = gardenAtDrought(13);
      expect(state.lastUnlocked?.id).toBe('springs');
      expect(ids(state.visibleElements)).not.toContain('springs');
      expect(gardenAtDrought(14).lastUnlocked?.id).toBe('springs');
    });
  });

  describe('nextElement', () => {
    it('is the element of the hizb in progress, with its growth', () => {
      const state = computeGardenState(gardenInput('W', 'read', { currentHizbProgress: 0.4 }));
      expect(state.nextElement).toEqual({
        element: { hizb: 25, id: 'tree-12', kind: 'orange' },
        growth: 0.4,
        isVisible: true,
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

    it.each([0, 0.05, 0.25, 0.5, 0.999, 1])(
      'grows with the pages read in the hizb in progress: a progress of %d gives that growth',
      (currentHizbProgress) => {
        const state = computeGardenState(gardenInput('W', 'read', { currentHizbProgress }));
        expect(state.nextElement?.growth).toBe(currentHizbProgress);
      },
    );

    it('grows without changing anything else: the element is only earned by the full hizb', () => {
      const barely = computeGardenState(gardenInput('W', 'read', { currentHizbProgress: 0.01 }));
      const almost = computeGardenState(gardenInput('W', 'read', { currentHizbProgress: 0.99 }));
      expect(almost).toEqual({ ...barely, nextElement: { ...barely.nextElement, growth: 0.99 } });
      expect(ids(almost.visibleElements)).not.toContain('tree-12');
      expect(almost.hizbCompleted).toBe(24);
    });

    it('starts again from the next element once the hizb is finished', () => {
      const finished = computeGardenState(
        gardenInput('W', 'read', { hizbCompleted: 25, currentHizbProgress: 0 }),
      );
      expect(finished.lastUnlocked?.id).toBe('tree-12');
      expect(ids(finished.visibleElements)).toContain('tree-12');
      expect(finished.nextElement).toEqual({
        element: GARDEN_CATALOG[25],
        growth: 0,
        isVisible: true,
      });
    });

    it('does not depend on the drought: reading still makes it grow in a dying garden', () => {
      const state = gardenAtDrought(12, { currentHizbProgress: 0.6 });
      expect(state.nextElement?.growth).toBe(0.6);
    });

    it.each([0, 5, 9])(
      'is drawn while every unlocked element is visible: %i drought days',
      (droughtDays) => {
        expect(gardenAtDrought(droughtDays).nextElement?.isVisible).toBe(true);
      },
    );

    it.each([10, 11, 12, 13, 14])(
      'is the first to disappear, as soon as one unlocked element is hidden: %i drought days',
      (droughtDays) => {
        expect(gardenAtDrought(droughtDays).nextElement?.isVisible).toBe(false);
        expect(gardenAtDrought(droughtDays, { hizbCompleted: 59 }).nextElement?.isVisible).toBe(
          false,
        );
      },
    );

    // Rounding up keeps the few elements of a very young garden visible while it is dying:
    // by the rule, the growing element is then still drawn.
    it.each([
      // unlocked, drought days, is the growing element drawn?
      [1, 10, true],
      [1, 13, true],
      [2, 11, true],
      [2, 12, false],
      [4, 10, true],
      [4, 11, false],
      [5, 10, false],
      [1, 14, false],
    ])(
      'follows the unlocked elements in a very young garden: %i unlocked, %i drought days',
      (unlocked, droughtDays, isVisible) => {
        const state = gardenAtDrought(droughtDays, { hizbCompleted: unlocked });
        expect(state.nextElement?.isVisible).toBe(isVisible);
        expect(state.visibleElements.length === unlocked).toBe(isVisible);
      },
    );

    it('is drawn on bare earth, whatever the history: nothing can dry yet', () => {
      const state = computeGardenState(
        gardenInput('M'.repeat(30), 'unread', { hizbCompleted: 0, currentHizbProgress: 0.5 }),
      );
      expect(state.nextElement).toEqual({
        element: GARDEN_CATALOG[0],
        growth: 0.5,
        isVisible: true,
      });
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

    it('is told on a bare earth too', () => {
      expect(
        computeGardenState(gardenInput('WW', 'paused-unread', { hizbCompleted: 0 })).isPausedToday,
      ).toBe(true);
    });
  });
});

describe('the variant of the garden', () => {
  it('is handed to the renderer as received', () => {
    const variant = gardenVariant(7, 123456);
    expect(computeGardenState(gardenInput('W', 'read', { variant })).variant).toEqual(variant);
    expect(computeGardenState(gardenInput('W', 'read')).variant).toEqual(REFERENCE_GARDEN_VARIANT);
  });

  it('shifts the species of the trees and nothing else', () => {
    const shiftedByOne: GardenVariant = { cycle: 2, themeId: 'theme-2', seed: 1 };
    const reference = computeGardenState(gardenInput('W', 'read', { hizbCompleted: 26 }));
    const shifted = computeGardenState(
      gardenInput('W', 'read', { hizbCompleted: 26, variant: shiftedByOne }),
    );
    expect(ids(shifted.visibleElements)).toEqual(ids(reference.visibleElements));
    // tree-13: a pomegranate tree in the reference variant, a date palm one species further.
    expect(reference.lastUnlocked).toMatchObject({ id: 'tree-13', kind: 'pomegranate' });
    expect(shifted.lastUnlocked).toMatchObject({ id: 'tree-13', kind: 'date-palm' });
    expect({ ...shifted, visibleElements: [], lastUnlocked: null, nextElement: null }).toEqual({
      ...reference,
      visibleElements: [],
      lastUnlocked: null,
      nextElement: null,
      variant: shiftedByOne,
    });
  });

  it('does not change the rules: same drought, phase and water for every variant', () => {
    const history = 'WW MMM PP W MMMMMMMMMMM';
    const reference = computeGardenState(gardenInput(history));
    for (let cycle = 1; cycle <= 12; cycle += 1) {
      const state = computeGardenState(
        gardenInput(history, 'unread', { variant: gardenVariant(cycle, 99) }),
      );
      expect(state.droughtDays).toBe(reference.droughtDays);
      expect(state.phase).toBe(reference.phase);
      expect(state.water).toBe(reference.water);
      expect(state.visibleElements).toHaveLength(reference.visibleElements.length);
    }
  });

  it('leaves a catalogue given by the caller as it is', () => {
    const state = computeGardenState(
      gardenInput('W', 'read', {
        hizbCompleted: 26,
        catalog: GARDEN_CATALOG,
        variant: { cycle: 2, themeId: 'theme-2', seed: 1 },
      }),
    );
    expect(state.lastUnlocked).toMatchObject({ id: 'tree-13', kind: 'pomegranate' });
  });
});

describe('GardenState is a plain, serialisable description', () => {
  const states: readonly GardenState[] = [
    computeGardenState(gardenInput('', 'unread', { hizbCompleted: 0 })),
    computeGardenState(gardenInput('WW MMM PP W', 'read', { currentHizbProgress: 0.35 })),
    computeGardenState(gardenInput('M'.repeat(14), 'paused-unread', { hizbCompleted: 60 })),
    computeGardenState(gardenInput('W', 'read', { variant: gardenVariant(3, 2026) })),
  ];

  it('survives a round trip through JSON unchanged', () => {
    for (const state of states) {
      expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
    }
  });

  it('has exactly the fields of the specification', () => {
    const expectedFields = [
      'hizbCompleted',
      'droughtDays',
      'health',
      'phase',
      'water',
      'missedDaysInARow',
      'daysSinceLastWatered',
      'visibleElements',
      'lastUnlocked',
      'nextElement',
      'isComplete',
      'isPausedToday',
      'variant',
    ];
    for (const state of states) {
      expect(Object.keys(state).sort()).toEqual([...expectedFields].sort());
    }
  });

  it('exposes continuous values, not only a phase', () => {
    // Two gardens in the same phase: the renderer can still tell them apart.
    const freshlyWilting = gardenAtDrought(6);
    const nearlyDying = gardenAtDrought(9);
    expect(freshlyWilting.phase).toBe('wilting');
    expect(nearlyDying.phase).toBe('wilting');
    expect(freshlyWilting.health).toBeGreaterThan(nearlyDying.health);
    expect(freshlyWilting.health).toBeCloseTo(8 / 14, 12);
    expect(nearlyDying.health).toBeCloseTo(5 / 14, 12);
  });
});

describe('bare earth (no hizb finished)', () => {
  const bare = gardenInput('', 'unread', { hizbCompleted: 0 });

  it('is a bare earth at full health, with no water yet and nothing missed', () => {
    expect(computeGardenState(bare)).toEqual({
      hizbCompleted: 0,
      droughtDays: 0,
      health: 1,
      phase: 'bare',
      water: 'dry',
      missedDaysInARow: 0,
      daysSinceLastWatered: null,
      visibleElements: [],
      lastUnlocked: null,
      nextElement: { element: GARDEN_CATALOG[0], growth: 0, isVisible: true },
      isComplete: false,
      isPausedToday: false,
      variant: REFERENCE_GARDEN_VARIANT,
    });
  });

  it('stays the same however long the first hizb takes, read or not', () => {
    const afterAMonthAway = computeGardenState(
      gardenInput('M'.repeat(30), 'unread', { hizbCompleted: 0 }),
    );
    expect(afterAMonthAway).toEqual(computeGardenState(bare));
    const afterAMonthOfReading = computeGardenState(
      gardenInput('W'.repeat(30), 'unread', { hizbCompleted: 0 }),
    );
    expect(afterAMonthOfReading).toEqual({ ...afterAMonthAway, daysSinceLastWatered: 1 });
  });

  it('lets the first element grow with the pages read', () => {
    const state = computeGardenState(
      gardenInput('W', 'read', { hizbCompleted: 0, currentHizbProgress: 0.7 }),
    );
    expect(state.nextElement).toEqual({
      element: GARDEN_CATALOG[0],
      growth: 0.7,
      isVisible: true,
    });
  });
});

describe('invalid input: explicit error', () => {
  // `as` on purpose below: a branded LocalDate cannot hold these values in typed code,
  // but they can arrive from storage or JSON at run time.
  const notADate = (value: string): LocalDate => value as LocalDate;
  const valid = gardenInput('WW MM', 'read');
  const complete = gardenInput('WW', 'read', { hizbCompleted: 60, completedOn: GARDEN_FIRST_DAY });

  it('accepts the valid inputs used by these tests', () => {
    expect(() => computeGardenState(valid)).not.toThrow();
    expect(() => computeGardenState(complete)).not.toThrow();
  });

  it.each([-1, 61, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects hizbCompleted = %d (outside the whole numbers 0..60)',
    (hizbCompleted) => {
      expect(() => computeGardenState({ ...valid, hizbCompleted })).toThrow(RangeError);
    },
  );

  it('accepts hizbCompleted at both ends, 0 and 60', () => {
    expect(() =>
      computeGardenState({ ...valid, hizbCompleted: 0, firstHizbCompletedOn: null }),
    ).not.toThrow();
    expect(() => computeGardenState({ ...valid, hizbCompleted: 60 })).not.toThrow();
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects currentHizbProgress = %d (outside 0..1)',
    (currentHizbProgress) => {
      expect(() => computeGardenState({ ...valid, currentHizbProgress })).toThrow(RangeError);
    },
  );

  it('rejects a missing firstHizbCompletedOn once a hizb is finished', () => {
    for (const hizbCompleted of [1, 24, 60]) {
      expect(() =>
        computeGardenState({ ...valid, hizbCompleted, firstHizbCompletedOn: null }),
      ).toThrow(/firstHizbCompletedOn is required/);
    }
  });

  it('rejects a firstHizbCompletedOn while no hizb is finished', () => {
    expect(() => computeGardenState({ ...valid, hizbCompleted: 0 })).toThrow(
      /firstHizbCompletedOn must be null/,
    );
  });

  it('rejects a completedOn without the 60 hizb', () => {
    for (const hizbCompleted of [1, 24, 59]) {
      expect(() =>
        computeGardenState({ ...valid, hizbCompleted, completedOn: valid.today }),
      ).toThrow(/completedOn must be null/);
    }
    expect(() =>
      computeGardenState({
        ...valid,
        hizbCompleted: 0,
        firstHizbCompletedOn: null,
        completedOn: valid.today,
      }),
    ).toThrow(RangeError);
  });

  it('rejects a pause whose end is before its start', () => {
    const pause = { from: addDays(GARDEN_FIRST_DAY, 3), to: addDays(GARDEN_FIRST_DAY, 2) };
    expect(() => computeGardenState({ ...valid, pauses: [pause] })).toThrow(/before it starts/);
  });

  it('accepts a one-day pause (from equal to to)', () => {
    const day = addDays(GARDEN_FIRST_DAY, 3);
    expect(() => computeGardenState({ ...valid, pauses: [{ from: day, to: day }] })).not.toThrow();
  });

  it('rejects dates that are not real calendar days', () => {
    const realDay = GARDEN_FIRST_DAY;
    expect(() =>
      computeGardenState({ ...valid, firstHizbCompletedOn: notADate('2026-02-30') }),
    ).toThrow(RangeError);
    expect(() => computeGardenState({ ...complete, completedOn: notADate('2026-00-10') })).toThrow(
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

  it('rejects forgotten dates: only an explicit null means "not yet"', () => {
    const { firstHizbCompletedOn: _first, ...withoutFirstHizb } = valid;
    const { completedOn: _completed, ...withoutCompletion } = complete;
    // `as` on purpose: a field cannot be forgotten in typed code, but can be in stored data.
    expect(() => computeGardenState(withoutFirstHizb as GardenInput)).toThrow(RangeError);
    expect(() => computeGardenState(withoutCompletion as GardenInput)).toThrow(RangeError);
  });

  describe('values of the wrong type, as they can arrive from storage or JSON', () => {
    // `as` on purpose in this block: none of these values can be written in typed code.
    const broken = <Field extends keyof GardenInput>(value: unknown): GardenInput[Field] =>
      value as GardenInput[Field];

    it('rejects an input that is not an object', () => {
      expect(() => computeGardenState(null as unknown as GardenInput)).toThrow(TypeError);
      expect(() => computeGardenState(undefined as unknown as GardenInput)).toThrow(TypeError);
    });

    it('rejects numbers given as text', () => {
      expect(() =>
        computeGardenState({ ...valid, hizbCompleted: broken<'hizbCompleted'>('24') }),
      ).toThrow(RangeError);
      expect(() =>
        computeGardenState({
          ...valid,
          currentHizbProgress: broken<'currentHizbProgress'>('0.5'),
        }),
      ).toThrow(RangeError);
    });

    it('rejects watered days that are not a Set', () => {
      const asList = broken<'wateredDays'>([...valid.wateredDays]);
      expect(() => computeGardenState({ ...valid, wateredDays: asList })).toThrow(TypeError);
      expect(() =>
        computeGardenState({ ...valid, wateredDays: broken<'wateredDays'>(null) }),
      ).toThrow(TypeError);
    });

    it('rejects pauses that are not a list of pauses', () => {
      expect(() => computeGardenState({ ...valid, pauses: broken<'pauses'>(null) })).toThrow(
        TypeError,
      );
      expect(() => computeGardenState({ ...valid, pauses: broken<'pauses'>([null]) })).toThrow(
        TypeError,
      );
    });

    it('rejects a date given as a Date object or a timestamp', () => {
      expect(() =>
        computeGardenState({ ...valid, today: broken<'today'>(new Date('2026-01-05')) }),
      ).toThrow(RangeError);
      expect(() =>
        computeGardenState({ ...valid, today: broken<'today'>(1_767_571_200_000) }),
      ).toThrow(RangeError);
    });
  });

  describe('invalid variant', () => {
    const withVariant = (variant: unknown): GardenInput => ({
      ...valid,
      // `as` on purpose: these variants cannot be written in typed code.
      variant: variant as GardenVariant,
    });

    it('rejects a missing variant', () => {
      expect(() => computeGardenState(withVariant(undefined))).toThrow(TypeError);
      expect(() => computeGardenState(withVariant(null))).toThrow(TypeError);
    });

    it.each([0, -1, 1.5, Number.NaN])('rejects cycle = %d (cycles start at 1)', (cycle) => {
      expect(() => computeGardenState(withVariant({ ...REFERENCE_GARDEN_VARIANT, cycle }))).toThrow(
        RangeError,
      );
    });

    it('rejects an unknown theme', () => {
      expect(() =>
        computeGardenState(withVariant({ ...REFERENCE_GARDEN_VARIANT, themeId: 'theme-9' })),
      ).toThrow(/unknown theme "theme-9"/);
      expect(() => computeGardenState(withVariant({ cycle: 1, seed: 0 }))).toThrow(RangeError);
    });

    it.each([-1, 0.5, 4_294_967_296, Number.NaN])(
      'rejects seed = %d (outside the whole numbers 0..4294967295)',
      (seed) => {
        expect(() =>
          computeGardenState(withVariant({ ...REFERENCE_GARDEN_VARIANT, seed })),
        ).toThrow(RangeError);
      },
    );

    it('accepts the seed at both ends', () => {
      for (const seed of [0, 4_294_967_295]) {
        expect(() =>
          computeGardenState(withVariant({ ...REFERENCE_GARDEN_VARIANT, seed })),
        ).not.toThrow();
      }
    });
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
    expect(state.nextElement).toEqual({
      element: otherCatalog[24],
      growth: 0.5,
      isVisible: true,
    });
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
