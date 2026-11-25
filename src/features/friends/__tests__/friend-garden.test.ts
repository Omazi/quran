import { parseLocalDate } from '@/domain/shared/local-date';
import type { SharedGarden } from '@/domain/social';

import { gardenStateOf, waterStatusOf } from '../friend-garden';

const TODAY = parseLocalDate('2026-11-25');

function garden(overrides: Partial<SharedGarden>): SharedGarden {
  return {
    hizbCompleted: 20,
    health: 1,
    lastWateredOn: TODAY,
    streakDays: 3,
    updatedOn: TODAY,
    ...overrides,
  };
}

describe('waterStatusOf', () => {
  it('says today, a number of days, or never', () => {
    expect(waterStatusOf(TODAY, TODAY)).toEqual({ kind: 'today' });
    expect(waterStatusOf(parseLocalDate('2026-11-19'), TODAY)).toEqual({
      kind: 'days-ago',
      days: 6,
    });
    expect(waterStatusOf(null, TODAY)).toEqual({ kind: 'never' });
  });

  it('takes a friend whose day is ahead of mine as having watered today', () => {
    expect(waterStatusOf(parseLocalDate('2026-11-26'), TODAY)).toEqual({ kind: 'today' });
  });
});

describe('gardenStateOf', () => {
  it('keeps the hizb of the summary', () => {
    expect(gardenStateOf(garden({ hizbCompleted: 42 }), TODAY).hizbCompleted).toBe(42);
  });

  it('shows the health the friend published', () => {
    for (const health of [1, 0.75, 0.5, 0.25, 0]) {
      const state = gardenStateOf(
        garden({ health, lastWateredOn: parseLocalDate('2026-11-10') }),
        TODAY,
      );
      expect(state.health).toBeCloseTo(health, 1);
    }
  });

  it('shows a garden in full health watered today with flowing water', () => {
    const state = gardenStateOf(garden({ health: 1 }), TODAY);
    expect(state.water).toBe('flowing');
    expect(state.phase).toBe('thriving');
  });

  it('shows a thirsty garden as the garden module draws one', () => {
    const state = gardenStateOf(
      garden({ health: 0.25, lastWateredOn: parseLocalDate('2026-11-19') }),
      TODAY,
    );
    expect(state.water).toBe('dry');
    expect(state.phase).not.toBe('thriving');
  });

  it('lets a garden watered today come back to the health it published', () => {
    const state = gardenStateOf(garden({ health: 0.5 }), TODAY);
    expect(state.health).toBeCloseTo(0.5, 1);
  });

  it('shows bare earth before the first hizb, and the complete garden at 60', () => {
    expect(
      gardenStateOf(garden({ hizbCompleted: 0, lastWateredOn: null }), TODAY).hizbCompleted,
    ).toBe(0);
    expect(gardenStateOf(garden({ hizbCompleted: 60 }), TODAY).isComplete).toBe(true);
  });
});
