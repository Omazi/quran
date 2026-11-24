/**
 * The scenarios listed at the end of the specification, one after the other.
 */
import { addDays } from '@/domain/shared/local-date';

import { computeGardenState, GARDEN_CATALOG, type GardenInput } from '../index';
import { GARDEN_FIRST_DAY, gardenInput } from '../test-support/garden-test-kit';

const TWELVE_WATERED_DAYS = 'W'.repeat(12);

describe('scenarios of the specification', () => {
  describe('hizb 24, watered 12 days in a row', () => {
    // 11 days that are over plus today already read: 12 watered days in a row.
    const state = computeGardenState(gardenInput('W'.repeat(11), 'read', { hizbCompleted: 24 }));

    it('is thriving with flowing water', () => {
      expect(state.phase).toBe('thriving');
      expect(state.water).toBe('flowing');
      expect(state.droughtDays).toBe(0);
      expect(state.health).toBe(1);
      expect(state.missedDaysInARow).toBe(0);
    });

    it('has springs as its last element, and shows its 24 elements', () => {
      expect(state.lastUnlocked?.id).toBe('springs');
      expect(state.visibleElements).toEqual(GARDEN_CATALOG.slice(0, 24));
    });

    it('has tree-12, an orange tree, as its next element', () => {
      expect(state.nextElement?.element).toBe(GARDEN_CATALOG[24]);
      expect(state.nextElement?.element).toEqual({ hizb: 25, id: 'tree-12', kind: 'orange' });
      expect(state.isComplete).toBe(false);
    });

    it('is the same the next morning, before reading', () => {
      const nextMorning = computeGardenState(gardenInput(TWELVE_WATERED_DAYS, 'unread'));
      expect(nextMorning.phase).toBe('thriving');
      expect(nextMorning.water).toBe('flowing');
    });
  });

  describe('then 3 missed days', () => {
    const state = computeGardenState(gardenInput(`${TWELVE_WATERED_DAYS} MMM`));

    it('is thirsty, with dry water and 3 drought days', () => {
      expect(state.phase).toBe('thirsty');
      expect(state.water).toBe('dry');
      expect(state.droughtDays).toBe(3);
      expect(state.missedDaysInARow).toBe(3);
    });

    it('still shows its 24 elements', () => {
      expect(state.visibleElements).toHaveLength(24);
    });
  });

  describe('then 6 missed days', () => {
    const state = computeGardenState(gardenInput(`${TWELVE_WATERED_DAYS} ${'M'.repeat(6)}`));

    it('is wilting, and still shows its 24 elements', () => {
      expect(state.phase).toBe('wilting');
      expect(state.droughtDays).toBe(6);
      expect(state.visibleElements).toHaveLength(24);
    });
  });

  describe('then 10 missed days', () => {
    const state = computeGardenState(gardenInput(`${TWELVE_WATERED_DAYS} ${'M'.repeat(10)}`));

    it('is dying, with 80 % of its elements: 20 of 24', () => {
      expect(state.phase).toBe('dying');
      expect(state.droughtDays).toBe(10);
      // 80 % of 24 elements is 19.2, rounded up.
      expect(state.visibleElements).toEqual(GARDEN_CATALOG.slice(0, 20));
      expect(state.nextElement?.isVisible).toBe(false);
    });
  });

  describe('then 14 missed days', () => {
    const state = computeGardenState(gardenInput(`${TWELVE_WATERED_DAYS} ${'M'.repeat(14)}`));

    it('is dead, with no element', () => {
      expect(state.phase).toBe('dead');
      expect(state.droughtDays).toBe(14);
      expect(state.health).toBe(0);
      expect(state.visibleElements).toEqual([]);
      expect(state.water).toBe('dry');
    });

    it('keeps its 24 hizb: what was read is never lost', () => {
      expect(state.hizbCompleted).toBe(24);
      expect(state.lastUnlocked?.id).toBe('springs');
      expect(state.nextElement?.element.hizb).toBe(25);
    });

    it('then one day of reading: 11 drought days, flowing water', () => {
      const back = computeGardenState(
        gardenInput(`${TWELVE_WATERED_DAYS} ${'M'.repeat(14)}`, 'read'),
      );
      expect(back.droughtDays).toBe(11);
      expect(back.water).toBe('flowing');
      expect(back.phase).toBe('dying');
      expect(back.visibleElements).toHaveLength(15);
    });
  });

  describe('one hizb only, finished after a month of absence', () => {
    // A first page on day 0, nothing for a month, the rest of the hizb on day 31.
    const firstHizbDay = addDays(GARDEN_FIRST_DAY, 31);
    const input: GardenInput = {
      ...gardenInput(''),
      hizbCompleted: 1,
      firstHizbCompletedOn: firstHizbDay,
      wateredDays: new Set([GARDEN_FIRST_DAY, firstHizbDay]),
      today: firstHizbDay,
    };

    it('is a bare earth during the absence: nothing can dry', () => {
      const duringAbsence = computeGardenState({
        ...input,
        hizbCompleted: 0,
        firstHizbCompletedOn: null,
        wateredDays: new Set([GARDEN_FIRST_DAY]),
        today: addDays(GARDEN_FIRST_DAY, 30),
      });
      expect(duringAbsence.phase).toBe('bare');
      expect(duringAbsence.droughtDays).toBe(0);
      expect(duringAbsence.missedDaysInARow).toBe(0);
    });

    it('is born at full health', () => {
      const state = computeGardenState(input);
      expect(state.phase).toBe('thriving');
      expect(state.droughtDays).toBe(0);
      expect(state.health).toBe(1);
      expect(state.water).toBe('flowing');
      expect(state.visibleElements).toEqual(GARDEN_CATALOG.slice(0, 1));
    });
  });

  describe('khatma finished after an absence', () => {
    // Read on day 0, away for 14 days (the garden is dead), the last pages on day 15.
    const completionDay = addDays(GARDEN_FIRST_DAY, 15);
    const input: GardenInput = {
      ...gardenInput(''),
      hizbCompleted: 60,
      wateredDays: new Set([GARDEN_FIRST_DAY, completionDay]),
      completedOn: completionDay,
      today: completionDay,
    };

    it('was a dead earth that very morning, before the last pages', () => {
      const thatMorning = computeGardenState({
        ...input,
        hizbCompleted: 59,
        wateredDays: new Set([GARDEN_FIRST_DAY]),
        completedOn: null,
      });
      expect(thatMorning.phase).toBe('dead');
      expect(thatMorning.visibleElements).toEqual([]);
    });

    it('is a complete garden at full health, not a dying one', () => {
      const state = computeGardenState(input);
      expect(state.isComplete).toBe(true);
      expect(state.droughtDays).toBe(0);
      expect(state.health).toBe(1);
      expect(state.phase).toBe('thriving');
      expect(state.water).toBe('flowing');
      expect(state.visibleElements).toEqual(GARDEN_CATALOG);
      expect(state.visibleElements.at(-1)?.id).toBe('full-bloom');
    });

    it('stays so until the next khatma', () => {
      const later = computeGardenState({ ...input, today: addDays(completionDay, 200) });
      expect(later).toEqual(computeGardenState(input));
    });
  });

  describe('one element only, dead garden, then one day of reading', () => {
    it('shows the element again', () => {
      const dead = computeGardenState(gardenInput('M'.repeat(14), 'unread', { hizbCompleted: 1 }));
      const back = computeGardenState(gardenInput('M'.repeat(14), 'read', { hizbCompleted: 1 }));
      expect(dead.phase).toBe('dead');
      expect(dead.visibleElements).toEqual([]);
      expect(back.droughtDays).toBe(11);
      expect(back.visibleElements).toEqual(GARDEN_CATALOG.slice(0, 1));
    });
  });

  describe('complete garden, then a month without reading', () => {
    const completionDay = addDays(GARDEN_FIRST_DAY, 2);
    const input: GardenInput = {
      ...gardenInput('WW', 'read', { hizbCompleted: 60 }),
      completedOn: completionDay,
    };

    it('is unchanged', () => {
      const onCompletionDay = computeGardenState(input);
      const aMonthLater = computeGardenState({ ...input, today: addDays(completionDay, 30) });
      expect(aMonthLater).toEqual(onCompletionDay);
      expect(aMonthLater.phase).toBe('thriving');
      expect(aMonthLater.water).toBe('flowing');
      expect(aMonthLater.visibleElements).toHaveLength(60);
    });
  });
});
