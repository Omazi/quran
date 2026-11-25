import type { GardenStage } from '../../garden-picture';
import {
  comboOf,
  isItemShown,
  readGardenModel,
  stageDrawCalls,
  visibleInstances,
  visibleRanges,
  type GardenModel,
  type ModelItem,
} from '../garden-model';
import { parseGlb } from '../glb';
import { shippedGardenBytes } from '../test-support/shipped-model';

const ALL = 0xfff;

const MODEL: GardenModel = readGardenModel(parseGlb(shippedGardenBytes()));

const stage = (count: number, water: 0 | 1 | 2, foliage: 0 | 1 | 2 | 3): GardenStage => ({
  count,
  water,
  foliage,
});
const item = (
  start: number,
  count: number,
  from: number,
  until: number,
  comboMask = ALL,
): ModelItem => ({
  start,
  count,
  from,
  until,
  comboMask,
});

describe('combinations of water and foliage', () => {
  it('numbers them as the bake does: water times four plus foliage', () => {
    expect(comboOf(stage(5, 0, 0))).toBe(0);
    expect(comboOf(stage(5, 2, 3))).toBe(11);
    expect(comboOf(stage(5, 1, 2))).toBe(6);
  });
});

describe('isItemShown', () => {
  it('shows an item from its count on, up to and excluding its last count', () => {
    expect(isItemShown(item(0, 3, 5, 61), stage(4, 2, 0))).toBe(false);
    expect(isItemShown(item(0, 3, 5, 61), stage(5, 2, 0))).toBe(true);
    expect(isItemShown(item(0, 3, 0, 3), stage(3, 2, 0))).toBe(false);
  });

  it('shows an item only in its water and foliage states', () => {
    const flowingOnly = item(0, 3, 0, 61, 0b1111 << 8);
    expect(isItemShown(flowingOnly, stage(10, 2, 1))).toBe(true);
    expect(isItemShown(flowingOnly, stage(10, 1, 1))).toBe(false);
  });
});

describe('visibleRanges', () => {
  it('joins the ranges of pieces that follow each other into one draw', () => {
    const items = [item(0, 6, 0, 61), item(6, 3, 2, 61), item(9, 3, 9, 61)];
    expect(visibleRanges(items, stage(5, 2, 0))).toEqual([{ start: 0, count: 9 }]);
  });

  it('leaves a hole where a piece is not shown', () => {
    const items = [item(0, 6, 0, 61), item(6, 3, 0, 2), item(9, 3, 0, 61)];
    expect(visibleRanges(items, stage(5, 2, 0))).toEqual([
      { start: 0, count: 6 },
      { start: 9, count: 3 },
    ]);
  });

  it('counts a piece once when two of its items are shown', () => {
    const items = [item(0, 6, 0, 61, 1), item(0, 6, 0, 61, ALL)];
    expect(visibleRanges(items, stage(5, 0, 0))).toEqual([{ start: 0, count: 6 }]);
  });

  it('gives nothing when nothing is shown', () => {
    expect(visibleRanges([item(0, 6, 10, 61)], stage(5, 2, 0))).toEqual([]);
  });
});

describe('visibleInstances', () => {
  it('lists the instances shown, each once, in order', () => {
    const items = [
      { instance: 2, from: 0, until: 61, comboMask: ALL },
      { instance: 0, from: 3, until: 61, comboMask: ALL },
      { instance: 1, from: 9, until: 61, comboMask: ALL },
      { instance: 0, from: 0, until: 61, comboMask: ALL },
    ];
    expect(visibleInstances(items, stage(5, 2, 0))).toEqual([0, 2]);
  });
});

describe('the garden that ships with the app', () => {
  it('has meshes, each with triangles, positions and normals for every vertex', () => {
    expect(MODEL.meshes.length).toBeGreaterThan(10);
    for (const mesh of MODEL.meshes) {
      expect(mesh.index.length % 3).toBe(0);
      expect(mesh.index.length).toBeGreaterThan(0);
      expect(mesh.position.array.length).toBe(mesh.vertexCount * 4);
      expect(mesh.normal.array.length).toBe(mesh.vertexCount * 4);
      expect(Math.max(...mesh.index)).toBeLessThan(mesh.vertexCount);
    }
  });

  it('has a translation, a rotation and a scale for every instance', () => {
    const instanced = MODEL.meshes.filter((mesh) => mesh.instances !== null);
    expect(instanced.length).toBeGreaterThan(0);
    for (const { instances } of instanced) {
      if (instances === null) continue;
      expect(instances.translation.length).toBe(instances.count * 3);
      expect(instances.rotation.length).toBe(instances.count * 4);
      expect(instances.scale.length).toBe(instances.count * 3);
    }
  });

  it('has the pixels of every texture a material names', () => {
    for (const texture of MODEL.textures) {
      expect(texture.pixels.length).toBe(texture.width * texture.height * 4);
    }
    for (const mesh of MODEL.meshes) {
      if (mesh.material.texture !== null)
        expect(MODEL.textures[mesh.material.texture]).toBeDefined();
    }
  });

  const drawn = (s: GardenStage) =>
    MODEL.meshes.filter((mesh) =>
      mesh.instances === null
        ? visibleRanges(mesh.items, s).length > 0
        : visibleInstances(mesh.instances.items, s).length > 0,
    );
  const names = (s: GardenStage) => new Set(drawn(s).map((mesh) => mesh.name));

  it('shows the bare earth with no tree at no element', () => {
    const bare = names(stage(0, 0, 0));
    expect(bare.has('earth')).toBe(true);
    expect([...bare].some((name) => /Tree|Leaves/.test(name))).toBe(false);
  });

  it('shows the trees with their leaves in the full garden', () => {
    const full = names(stage(60, 2, 0));
    expect(full.has('NormalTree_Leaves')).toBe(true);
    expect(full.has('NormalTree_Bark')).toBe(true);
  });

  it('shows no tree leaves once every tree is bare, and keeps the branches', () => {
    // As in the pictures: every tree loses its leaves; the plain bushes keep theirs.
    const bare = names(stage(60, 0, 3));
    expect([...bare].some((name) => /Tree_Leaves/.test(name))).toBe(false);
    expect(bare.has('NormalTree_Bark')).toBe(true);
  });

  it('shows fewer leaf instances when half of the trees are bare', () => {
    const leaves = (s: GardenStage) =>
      MODEL.meshes
        .filter((mesh) => /Tree_Leaves/.test(mesh.name) && mesh.instances !== null)
        .reduce((n, mesh) => n + visibleInstances(mesh.instances?.items ?? [], s).length, 0);
    expect(leaves(stage(60, 0, 2))).toBeLessThan(leaves(stage(60, 0, 1)));
    expect(leaves(stage(60, 0, 2))).toBeGreaterThan(0);
  });

  it('shows the water colour only when the water flows or is low', () => {
    const water = 'ground-6cc3d0';
    expect(names(stage(60, 2, 0)).has(water)).toBe(true);
    expect(names(stage(60, 0, 0)).has(water)).toBe(false);
  });

  it('fills the channels with the colour of each water level, and only that one', () => {
    // The picture tool's colours: flowing water, low water, dry bed.
    const flowing = 'ground-6cc3d0';
    const low = 'ground-7fb3b6';
    const dryBed = 'ground-bfae98';
    const at = (water: 0 | 1 | 2) => names(stage(30, water, 0));
    expect([at(2).has(flowing), at(2).has(low), at(2).has(dryBed)]).toEqual([true, false, false]);
    expect([at(1).has(low), at(1).has(dryBed)]).toEqual([true, false]);
    expect([at(0).has(flowing), at(0).has(low), at(0).has(dryBed)]).toEqual([false, false, true]);
  });

  it('keeps the drawing of the full garden under 80 draws', () => {
    expect(stageDrawCalls(MODEL, stage(60, 2, 0))).toBeLessThanOrEqual(80);
  });
});
