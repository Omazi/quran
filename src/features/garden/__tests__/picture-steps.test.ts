import { DEFAULT_GARDEN_CONFIG } from '@/domain/garden';

import { GARDEN_STEP_COUNT, MAX_ELEMENT_STEPS } from '../config';
import {
  baseName,
  gardenPicture,
  pictureSteps,
  type GardenImageNames,
  type GardenStage,
} from '../garden-picture';
import { previewGardenState } from '../garden-preview';

function completeSet(): GardenImageNames {
  const base = new Set<string>();
  const water = new Set<string>();
  for (let count = 0; count <= GARDEN_STEP_COUNT; count += 1) {
    for (let foliage = 0; foliage < 4; foliage += 1) {
      const name = baseName({ count, foliage: foliage as 0 });
      base.add(name);
      if (count >= 1) for (const level of [1, 2]) water.add(`${name}-w${level}`);
    }
  }
  return { base, water };
}
const IMAGES = completeSet();

const stageOf = (hizbCompleted: number, daysWithoutReading: number, readsToday = false) => {
  const picture = gardenPicture(
    previewGardenState({ hizbCompleted, daysWithoutReading, readsToday }),
    { images: IMAGES },
  );
  if (picture === null) throw new Error('The test needs a picture.');
  return picture.stage;
};

const alive = stageOf(24, 0);
const labels = (from: GardenStage, to: GardenStage) =>
  pictureSteps(from, to, IMAGES).map(({ stage }) => ({
    count: stage.count,
    foliage: stage.foliage,
    water: stage.water,
  }));

describe('pictureSteps', () => {
  it('is empty between a stage and itself', () => {
    expect(pictureSteps(alive, alive, IMAGES)).toEqual([]);
  });

  it('lets the water leave first, then the leaves fall, then the elements go (D26)', () => {
    const dead = stageOf(24, DEFAULT_GARDEN_CONFIG.droughtDaysToDeath);
    const steps = pictureSteps(alive, dead, IMAGES);
    expect(steps.every(({ direction }) => direction === 'decay')).toBe(true);
    const stages = steps.map(({ stage }) => stage);
    // Water: 2 -> 1 -> 0 while everything else stays.
    expect(stages[0]).toEqual({ ...alive, water: 1 });
    expect(stages[1]).toEqual({ ...alive, water: 0 });
    // Then foliage 1, 2, 3 with the count unchanged.
    expect(stages.slice(2, 5).map(({ foliage, count }) => [foliage, count])).toEqual([
      [1, 24],
      [2, 24],
      [3, 24],
    ]);
    // Then fewer elements, each step lower than the one before, ending on the dead earth.
    const counts = stages.slice(5).map(({ count }) => count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(stages.at(-1)).toEqual(dead);
  });

  it('never passes more than a few pictures between two numbers of elements', () => {
    const steps = labels({ count: 60, foliage: 3, water: 0 }, { count: 0, foliage: 3, water: 0 });
    expect(steps).toHaveLength(MAX_ELEMENT_STEPS);
    expect(steps.at(-1)?.count).toBe(0);
  });

  it('brings a dead garden back the other way round: elements, leaves, then water', () => {
    const dead = stageOf(40, DEFAULT_GARDEN_CONFIG.droughtDaysToDeath);
    const revived = stageOf(40, DEFAULT_GARDEN_CONFIG.droughtDaysToDeath, true);
    const steps = pictureSteps(dead, revived, IMAGES);
    expect(steps.every(({ direction }) => direction === 'recovery')).toBe(true);
    expect(steps.at(-1)?.stage).toEqual(revived);
    // The water comes last, after the elements.
    expect(steps.slice(-2).map(({ stage }) => stage.water)).toEqual([1, 2]);
    expect(steps[0]?.stage.water).toBe(0);
    expect(steps[0]?.stage.count).toBeGreaterThan(0);
  });

  it('puts the worse steps before the better ones when both happen at once', () => {
    // Water leaves while one more element appears.
    const from = alive;
    const to = { ...alive, count: 25, water: 0 as const };
    const steps = pictureSteps(from, to, IMAGES);
    expect(steps.map(({ direction }) => direction)).toEqual(['decay', 'decay', 'recovery']);
  });

  it('goes through consecutive pictures only: one thing changes at each step', () => {
    const dead = stageOf(24, DEFAULT_GARDEN_CONFIG.droughtDaysToDeath);
    let previous: GardenStage = alive;
    for (const { stage } of pictureSteps(alive, dead, IMAGES)) {
      const changes = [
        stage.water !== previous.water,
        stage.foliage !== previous.foliage,
        stage.count !== previous.count,
      ].filter(Boolean);
      expect(changes).toHaveLength(1);
      previous = stage;
    }
  });

  it('skips a picture the set lacks', () => {
    const base = new Set(IMAGES.base);
    base.delete('h24-f1');
    const steps = pictureSteps(alive, { ...alive, foliage: 2, water: 2 }, { ...IMAGES, base });
    expect(steps.map(({ stage }) => stage.foliage)).toEqual([2]);
  });
});
