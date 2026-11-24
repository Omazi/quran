/**
 * The three scenarios of the mock-up, as listed at the end of the specification.
 */
import { computeGardenState, GARDEN_CATALOG } from '../index';
import { gardenInput } from '../test-support/garden-test-kit';

const TWELVE_WATERED_DAYS = 'W'.repeat(12);

describe('mock-up scenarios', () => {
  describe('hizb 24, watered 12 days in a row', () => {
    // 11 days that are over plus today already read: 12 watered days in a row.
    const state = computeGardenState(gardenInput('W'.repeat(11), 'read', { hizbCompleted: 24 }));

    it('is thriving with flowing water', () => {
      expect(state.phase).toBe('thriving');
      expect(state.water).toBe('flowing');
      expect(state.health).toBe(1);
      expect(state.missedDaysInARow).toBe(0);
    });

    it('has springs as its last element, and shows its 24 elements', () => {
      expect(state.lastUnlocked?.id).toBe('springs');
      expect(state.visibleElements).toHaveLength(24);
      expect(state.visibleElements).toEqual(GARDEN_CATALOG.slice(0, 24));
    });

    // The specification announces "tree-13, a pomegranate tree" here. Its own catalogue
    // puts 13 non-tree elements before hizb 25, which makes hizb 25 the 12th tree, an
    // orange tree; tree-13 (pomegranate) comes at hizb 26. The catalogue list is followed
    // and the contradiction is reported in README.md ("Points contestés").
    it('has the element of hizb 25 as its next element', () => {
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
    const state = computeGardenState(gardenInput(`${TWELVE_WATERED_DAYS} MMM`, 'unread'));

    it('has dry water and a health of 0.60', () => {
      expect(state.water).toBe('dry');
      expect(state.health).toBe(0.6);
      expect(state.missedDaysInARow).toBe(3);
    });

    it('is thirsty but still shows its 24 elements', () => {
      expect(state.phase).toBe('thirsty');
      expect(state.visibleElements).toHaveLength(24);
    });
  });

  describe('then 14 missed days', () => {
    const state = computeGardenState(gardenInput(`${TWELVE_WATERED_DAYS} ${'M'.repeat(14)}`));

    it('is dead, with no element', () => {
      expect(state.phase).toBe('dead');
      expect(state.health).toBe(0);
      expect(state.visibleElements).toEqual([]);
      expect(state.water).toBe('dry');
    });

    it('keeps its 24 hizb: what was read is never lost', () => {
      expect(state.hizbCompleted).toBe(24);
      expect(state.lastUnlocked?.id).toBe('springs');
      expect(state.nextElement?.element.hizb).toBe(25);
    });

    it('comes back to life when the user reads again', () => {
      const back = computeGardenState(
        gardenInput(`${TWELVE_WATERED_DAYS} ${'M'.repeat(14)}`, 'read'),
      );
      expect(back.phase).toBe('dying');
      expect(back.health).toBe(0.2);
      expect(back.water).toBe('flowing');
      expect(back.visibleElements).toHaveLength(19);
    });
  });
});
