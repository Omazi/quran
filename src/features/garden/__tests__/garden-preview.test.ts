import {
  DEFAULT_GARDEN_CONFIG,
  gardenVariant,
  REFERENCE_GARDEN_VARIANT,
  type GardenPhase,
} from '@/domain/garden';

import { previewGardenState } from '../garden-preview';

describe('previewGardenState', () => {
  it('gives the bare earth at hizb 0', () => {
    const state = previewGardenState({ hizbCompleted: 0 });
    expect(state.phase).toBe('bare');
    expect(state.hizbCompleted).toBe(0);
    expect(state.visibleElements).toHaveLength(0);
    expect(state.lastUnlocked).toBeNull();
  });

  it.each([8, 20, 30, 40, 60])('gives a well-watered garden at hizb %i', (hizbCompleted) => {
    const state = previewGardenState({ hizbCompleted });
    expect(state.phase).toBe('thriving');
    expect(state.water).toBe('flowing');
    expect(state.droughtDays).toBe(0);
    expect(state.hizbCompleted).toBe(hizbCompleted);
    expect(state.visibleElements).toHaveLength(hizbCompleted);
  });

  it('gives the complete garden at hizb 60', () => {
    const state = previewGardenState({ hizbCompleted: 60 });
    expect(state.isComplete).toBe(true);
    expect(state.nextElement).toBeNull();
  });

  // The days come from the garden module's settings: the test copies no threshold.
  const phasesByDays: readonly (readonly [number, GardenPhase])[] = [
    [DEFAULT_GARDEN_CONFIG.thirstyMinDroughtDays - 1, 'thriving'],
    [DEFAULT_GARDEN_CONFIG.thirstyMinDroughtDays, 'thirsty'],
    [DEFAULT_GARDEN_CONFIG.wiltingMinDroughtDays, 'wilting'],
    [DEFAULT_GARDEN_CONFIG.dyingMinDroughtDays, 'dying'],
    [DEFAULT_GARDEN_CONFIG.droughtDaysToDeath, 'dead'],
  ];

  it.each(phasesByDays)('after %i days without reading the garden is %s', (days, phase) => {
    const state = previewGardenState({ hizbCompleted: 40, daysWithoutReading: days });
    expect(state.droughtDays).toBe(days);
    expect(state.missedDaysInARow).toBe(days);
    expect(state.phase).toBe(phase);
    // What was read is never lost.
    expect(state.hizbCompleted).toBe(40);
  });

  it('leaves a garden of 60 hizb to the garden module, and asks it without a finishing day', () => {
    // Whether a complete garden dries is a rule of the garden module: only what does not
    // depend on that rule is checked here.
    const state = previewGardenState({ hizbCompleted: 60, daysWithoutReading: 6 });
    expect(state.isComplete).toBe(true);
    expect(state.hizbCompleted).toBe(60);
  });

  it('never dries the bare earth, however long nothing is read', () => {
    const state = previewGardenState({ hizbCompleted: 0, daysWithoutReading: 30 });
    expect(state.phase).toBe('bare');
    expect(state.droughtDays).toBe(0);
  });

  it('brings the water back when the person reads again today', () => {
    const dead = previewGardenState({
      hizbCompleted: 40,
      daysWithoutReading: DEFAULT_GARDEN_CONFIG.droughtDaysToDeath,
    });
    const revived = previewGardenState({
      hizbCompleted: 40,
      daysWithoutReading: DEFAULT_GARDEN_CONFIG.droughtDaysToDeath,
      readsToday: true,
    });
    expect(dead.visibleElements).toHaveLength(0);
    expect(revived.water).toBe('flowing');
    expect(revived.droughtDays).toBe(
      DEFAULT_GARDEN_CONFIG.droughtDaysToDeath -
        DEFAULT_GARDEN_CONFIG.droughtDaysRecoveredPerWateredDay,
    );
    expect(revived.visibleElements.length).toBeGreaterThan(0);
  });

  it('shows the reference garden unless another variant is given', () => {
    expect(previewGardenState({ hizbCompleted: 8 }).variant).toEqual(REFERENCE_GARDEN_VARIANT);
    const variant = gardenVariant(3, 12345);
    expect(previewGardenState({ hizbCompleted: 8, variant }).variant).toEqual(variant);
  });

  it('gives the same garden for the same request', () => {
    const request = { hizbCompleted: 24, daysWithoutReading: 6 };
    expect(previewGardenState(request)).toEqual(previewGardenState(request));
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %p days without reading',
    (daysWithoutReading) => {
      expect(() => previewGardenState({ hizbCompleted: 8, daysWithoutReading })).toThrow(
        RangeError,
      );
    },
  );

  it.each([-1, 61, 2.5])('lets the garden module refuse %p hizb', (hizbCompleted) => {
    expect(() => previewGardenState({ hizbCompleted })).toThrow(RangeError);
  });
});
