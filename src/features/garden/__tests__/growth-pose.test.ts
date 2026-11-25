import {
  growthPose,
  pictureRect,
  pictureStep,
  popScale,
  SPROUT_SHARE,
  staggered,
  type GrowthPose,
} from '../growth-pose';

const at = (growth: number, form: 'tree' | 'plant' | 'structure' = 'tree'): GrowthPose =>
  growthPose(growth, form);

describe('the pose of a growing tree, from the growth of its hizb', () => {
  /** How tall it looks: the sprout, or the tree once it is taller, as a share of the tree. */
  const seenHeight = (pose: GrowthPose) => Math.max(pose.sprout * SPROUT_SHARE, pose.scale);
  /** How green it looks: the sprout's leaves, or the tree's. */
  const seenLeaves = (pose: GrowthPose) => Math.max(pose.sprout > 0.5 ? 0.15 : 0, pose.foliage);

  it('nothing before the first counted page', () => {
    expect(at(0)).toMatchObject({ sprout: 0, scale: 0, foliage: 0, bloom: 0 });
  });

  it('one page of a hizb of ten: a seed mound and its sprout, no tree yet', () => {
    const pose = at(0.1);
    expect(pose.sprout).toBeGreaterThan(0.8);
    expect(pose.scale).toBe(0);
    expect(pose.foliage).toBe(0);
  });

  it('the sapling rises out of the sprout and is taller than it at 30 %, with a few leaves', () => {
    const pose = at(0.3);
    expect(pose.sprout).toBeGreaterThan(0.8);
    expect(pose.scale).toBeGreaterThan(SPROUT_SHARE * pose.sprout * 1.4);
    expect(pose.branches).toBe(0);
    expect(pose.foliage).toBeGreaterThan(0.1);
    expect(pose.foliage).toBeLessThan(0.3);
  });

  it('the sprout gives way only once the young tree is clearly taller, between 35 % and 45 %', () => {
    expect(at(0.35).sprout).toBeGreaterThan(0.9);
    expect(at(0.45).sprout).toBe(0);
    expect(at(0.35).scale).toBeGreaterThan(1.5 * SPROUT_SHARE);
  });

  it('never looks smaller nor barer than a page before', () => {
    let previous = at(0.001);
    for (let growth = 0.002; growth <= 1; growth += 0.001) {
      const pose = at(Math.min(1, growth));
      expect(seenHeight(pose)).toBeGreaterThanOrEqual(seenHeight(previous) - 1e-9);
      expect(seenLeaves(pose)).toBeGreaterThanOrEqual(seenLeaves(previous) - 1e-9);
      previous = pose;
    }
  });

  it('the young tree has some leaves, never the look of a bare, drying tree', () => {
    expect(at(0.6).foliage).toBeGreaterThan(0.2);
    expect(at(0.6).foliage).toBeLessThan(0.4);
  });

  it('then the trunk thickens and rises, and the branches grow', () => {
    const pose = at(0.6);
    expect(pose.scale).toBeGreaterThan(at(0.3).scale);
    expect(pose.scale * pose.girth).toBeGreaterThan(at(0.3).scale * at(0.3).girth);
    expect(pose.branches).toBeCloseTo(0.5);
  });

  it('then most of the leaves come and fill out; the flowers and fruit come last', () => {
    const early = at(0.8);
    const late = at(0.95);
    expect(1 - at(0.75).foliage).toBeGreaterThan(0.5);
    expect(early.foliage).toBeLessThan(late.foliage);
    expect(early.bloom).toBe(0);
    expect(late.bloom).toBeGreaterThan(0);
    expect(at(0.9).girth).toBe(1);
  });

  it('a complete element is the whole tree, as the stage draws it', () => {
    expect(at(1)).toEqual({ sprout: 0, scale: 1, girth: 1, branches: 1, foliage: 1, bloom: 1 });
  });

  it('is continuous: a page more never makes the tree jump', () => {
    const keys = ['sprout', 'scale', 'girth', 'branches', 'foliage', 'bloom'] as const;
    let previous = at(0.0005);
    for (let growth = 0.001; growth <= 1; growth += 0.0005) {
      const pose = at(Math.min(1, growth));
      for (const key of keys) expect(Math.abs(pose[key] - previous[key])).toBeLessThan(0.02);
      previous = pose;
    }
  });

  it('only grows: height, drawn thickness, branches, leaves and flowers never shrink', () => {
    let previous = at(0.1);
    for (let growth = 0.11; growth <= 1; growth += 0.01) {
      const pose = at(Math.min(1, growth));
      for (const key of ['scale', 'branches', 'foliage', 'bloom'] as const) {
        expect(pose[key]).toBeGreaterThanOrEqual(previous[key]);
      }
      expect(pose.scale * pose.girth).toBeGreaterThanOrEqual(previous.scale * previous.girth);
      previous = pose;
    }
  });
});

describe('a plant and a built element', () => {
  it('a plant comes up from the ground from its first page, its flowers last', () => {
    expect(at(0.1, 'plant').scale).toBeGreaterThan(0);
    expect(at(0.1, 'plant').sprout).toBe(0);
    expect(at(0.5, 'plant').bloom).toBe(0);
    expect(at(1, 'plant')).toMatchObject({ scale: 1, foliage: 1, bloom: 1 });
  });

  it('a built element goes up piece by piece', () => {
    expect(at(0, 'structure').scale).toBe(0);
    expect(at(0.5, 'structure').scale).toBeCloseTo(0.5);
    expect(at(1, 'structure').scale).toBe(1);
  });
});

describe('the stagger of the pieces, and their pop', () => {
  it('each piece starts at its own delay and takes its window', () => {
    expect(staggered(0.2, 0.3, 0.25)).toBe(0);
    expect(staggered(0.425, 0.3, 0.25)).toBeCloseTo(0.5);
    expect(staggered(0.9, 0.3, 0.25)).toBe(1);
  });

  it('a leaf pops with a slight overshoot and settles at its size', () => {
    expect(popScale(0)).toBe(0);
    expect(popScale(1)).toBe(1);
    const peak = Math.max(...Array.from({ length: 101 }, (_, k) => popScale(k / 100)));
    expect(peak).toBeGreaterThan(1.02);
    expect(peak).toBeLessThan(1.08);
  });
});

describe('the picture fallback: the element drawn in steps', () => {
  it('nothing before the first page, then larger at each stage, whole at the end', () => {
    expect(pictureStep(0)).toBeNull();
    const steps = [0.1, 0.3, 0.6, 0.9].map((growth) => pictureStep(growth)?.scale ?? 0);
    expect(steps[0]).toBeGreaterThan(0);
    for (let k = 1; k < steps.length; k += 1) expect(steps[k]).toBeGreaterThan(steps[k - 1]!);
    expect(pictureStep(1)).toEqual({ scale: 1 });
    // One step per stage: two growths of the same stage are drawn the same.
    expect(pictureStep(0.5)).toEqual(pictureStep(0.7));
  });
});

describe('where the picture sits in its box', () => {
  it('a box of its proportions: the whole box', () => {
    expect(pictureRect({ width: 390, height: 272 }, 390 / 272, 'bottom')).toEqual({
      x: 0,
      y: 0,
      width: 390,
      height: 272,
    });
  });

  it('a taller box: as wide as the box, on its bottom edge or in its middle', () => {
    expect(pictureRect({ width: 300, height: 400 }, 1.5, 'bottom')).toEqual({
      x: 0,
      y: 200,
      width: 300,
      height: 200,
    });
    expect(pictureRect({ width: 300, height: 400 }, 1.5, 'center').y).toBe(100);
  });

  it('a wider box: as tall as the box, centred across', () => {
    expect(pictureRect({ width: 600, height: 200 }, 1.5, 'bottom')).toEqual({
      x: 150,
      y: 0,
      width: 300,
      height: 200,
    });
  });
});
