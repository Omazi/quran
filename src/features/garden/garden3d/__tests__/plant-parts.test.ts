import { growingPieces, readGardenModel, type ModelMesh } from '../garden-model';
import { parseGlb } from '../glb';
import { BRANCH_TIMING, LEAF_TIMING, partGrowth, positionsOf } from '../plant-parts';
import { shippedGardenBytes } from '../test-support/shipped-model';

const MODEL = readGardenModel(parseGlb(shippedGardenBytes()));

function meshOfElement5(role: 'trunk' | 'foliage'): ModelMesh {
  const piece = growingPieces(MODEL, { count: 4, water: 2, foliage: 0 }).find(
    (p) => p.role === role,
  );
  const mesh = piece === undefined ? undefined : MODEL.meshes[piece.mesh];
  if (mesh === undefined) throw new Error('no such piece');
  return mesh;
}

describe('the parts of a tree that grow one after another', () => {
  it('reads the positions of a mesh as numbers, three per vertex', () => {
    const mesh = meshOfElement5('trunk');
    const positions = positionsOf(mesh);
    expect(positions.length).toBe(mesh.vertexCount * 3);
    expect(Math.max(...positions)).toBeLessThanOrEqual(1);
    expect(Math.min(...positions)).toBeGreaterThanOrEqual(-1);
  });

  it('the trunk is always there; its branches grow from where they meet it, the low ones first', () => {
    const mesh = meshOfElement5('trunk');
    const { pivot, delay } = partGrowth(mesh, 'trunk');
    const positions = positionsOf(mesh);
    const trunkVertices = [...delay].filter((d) => d < 0).length;
    const branchDelays = [...delay].filter((d) => d >= 0);

    // The main trunk is the part with the lowest point: it never waits.
    let lowest = 0;
    for (let v = 0; v < mesh.vertexCount; v += 1) {
      if ((positions[v * 3 + 1] ?? 0) < (positions[lowest * 3 + 1] ?? 0)) lowest = v;
    }
    expect(delay[lowest]).toBeLessThan(0);
    expect(trunkVertices).toBeGreaterThan(0);
    expect(branchDelays.length).toBeGreaterThan(0);
    expect(Math.max(...branchDelays)).toBeLessThanOrEqual(1 - BRANCH_TIMING.window + 1e-6);
    // A branch grows from a point of its own: its pivot is one of its vertices' height or above the ground.
    expect(pivot.length).toBe(mesh.vertexCount * 3);
  });

  it('the leaves come in clusters, each from its own centre, at its own time', () => {
    const mesh = meshOfElement5('foliage');
    const { pivot, delay } = partGrowth(mesh, 'foliage');
    const clusters = new Set<string>();
    for (let v = 0; v < mesh.vertexCount; v += 1) {
      clusters.add([pivot[v * 3], pivot[v * 3 + 1], pivot[v * 3 + 2]].join(','));
    }
    expect(clusters.size).toBeGreaterThanOrEqual(4);
    expect(clusters.size).toBeLessThanOrEqual(LEAF_TIMING.maxClusters);
    expect(Math.min(...delay)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...delay)).toBeLessThanOrEqual(1 - LEAF_TIMING.window + 1e-6);
    // Staggered: the clusters do not all start together.
    expect(new Set([...delay].map((d) => Math.round(d * 20))).size).toBeGreaterThan(3);
  });

  it('is the same every time: the same tree grows the same way', () => {
    const mesh = meshOfElement5('foliage');
    expect(partGrowth(mesh, 'foliage')).toEqual(partGrowth(mesh, 'foliage'));
  });
});
