import { HIZB_COUNT } from '@/domain/quran/types';

import {
  computeGardenState,
  GROWTH_STAGE_STARTS,
  growthStageOf,
  hasSprouted,
  stageProgressOf,
} from '../index';
import { gardenInput } from '../test-support/garden-test-kit';

describe('Growth of the element of the hizb in progress (owner, 25 November 2026)', () => {
  describe('the growth follows the counted pages of the hizb', () => {
    it('no page counted: nothing has sprouted yet', () => {
      const state = computeGardenState(gardenInput('W', 'read', { currentHizbProgress: 0 }));

      expect(state.nextElement?.growth).toBe(0);
      expect(hasSprouted(state.nextElement)).toBe(false);
      expect(growthStageOf(0)).toBe('none');
    });

    it('one counted page of ten: the plant exists, a sprout', () => {
      const state = computeGardenState(gardenInput('W', 'read', { currentHizbProgress: 1 / 10 }));

      expect(state.nextElement?.growth).toBeCloseTo(0.1);
      expect(hasSprouted(state.nextElement)).toBe(true);
      expect(growthStageOf(1 / 10)).toBe('sprout');
    });

    it('part of the hizb read: the growth is pages read over pages of the hizb, not a step', () => {
      const growths = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(
        (pages) =>
          computeGardenState(gardenInput('W', 'read', { currentHizbProgress: pages / 10 }))
            .nextElement?.growth,
      );

      expect(growths).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
    });

    it('a completed hizb is a whole element: its growth is 1, and the next one starts', () => {
      expect(growthStageOf(1)).toBe('grown');
      const state = computeGardenState(
        gardenInput('W', 'read', { hizbCompleted: 25, currentHizbProgress: 1 / 11 }),
      );
      expect(state.lastUnlocked?.hizb).toBe(25);
      expect(state.nextElement?.element.hizb).toBe(26);
      expect(hasSprouted(state.nextElement)).toBe(true);
    });

    it('a complete garden has nothing left to grow', () => {
      const state = computeGardenState(
        gardenInput('W', 'read', { hizbCompleted: HIZB_COUNT, completedOn: null }),
      );
      expect(state.nextElement).toBeNull();
      expect(hasSprouted(state.nextElement)).toBe(false);
    });
  });

  describe('stages of a growing plant, from the growth', () => {
    it.each([
      [0.01, 'sprout'],
      [0.149, 'sprout'],
      [0.15, 'sapling'],
      [0.3, 'sapling'],
      [0.45, 'branches'],
      [0.6, 'branches'],
      [0.75, 'foliage'],
      [0.99, 'foliage'],
    ] as const)('growth %p is the %s stage', (growth, stage) => {
      expect(growthStageOf(growth)).toBe(stage);
    });

    it('the stages start where the owner placed them', () => {
      expect(GROWTH_STAGE_STARTS).toEqual({
        sprout: 0,
        sapling: 0.15,
        branches: 0.45,
        foliage: 0.75,
      });
    });

    it('says how far into its stage a plant is, continuously', () => {
      expect(stageProgressOf(0.3).stage).toBe('sapling');
      expect(stageProgressOf(0.3).progress).toBeCloseTo(0.5);
      expect(stageProgressOf(0.45)).toEqual({ stage: 'branches', progress: 0 });
      expect(stageProgressOf(0.875).progress).toBeCloseTo(0.5);
      expect(stageProgressOf(0)).toEqual({ stage: 'none', progress: 0 });
      expect(stageProgressOf(1)).toEqual({ stage: 'grown', progress: 1 });
    });

    it('refuses what is not a growth', () => {
      for (const wrong of [-0.1, 1.1, Number.NaN]) {
        expect(() => growthStageOf(wrong)).toThrow(RangeError);
      }
    });
  });
});
