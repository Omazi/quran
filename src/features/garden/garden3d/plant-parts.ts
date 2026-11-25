/**
 * The parts of a growing tree that come one after another (owner, 25 November 2026: "it starts
 * young, then grows, then its leaves appear"): for each vertex of a trunk or of its leaves, the
 * point it grows from and when it starts. Read once from the baked geometry: the bark of a tree is
 * its trunk and its branches, apart; its leaves are many small cards, gathered here in clusters.
 *
 * Pure: plain arrays, no three.js. The renderer hands `pivot` and `delay` to its shader, which
 * scales each vertex about its pivot by `popScale(staggered(progress, delay, window))`.
 */

import type { ModelMesh } from './garden-model';

/** A branch takes this much of the branches' progress; the last one starts at `1 - window`. */
export const BRANCH_TIMING = { window: 0.35, heightShare: 0.8 } as const;

/**
 * Leaves: about `leavesPerCluster` cards per cluster, between `minClusters` and `maxClusters`;
 * each cluster takes `window` of the foliage's progress, a card up to `jitter` after its cluster.
 */
export const LEAF_TIMING = {
  window: 0.3,
  jitter: 0.06,
  leavesPerCluster: 40,
  minClusters: 4,
  maxClusters: 14,
  heightShare: 0.5,
} as const;

/** Per vertex: the point it grows from (3 numbers), and its delay (negative: never waits). */
export interface PartGrowth {
  readonly pivot: Float32Array;
  readonly delay: Float32Array;
}

/** The positions of a mesh as numbers, three per vertex, in the mesh's own (quantised) space. */
export function positionsOf(mesh: ModelMesh): Float32Array {
  const { array, stride, normalized } = mesh.position;
  const unit = !normalized
    ? 1
    : array instanceof Int16Array
      ? 32767
      : array instanceof Int8Array
        ? 127
        : array instanceof Uint8Array
          ? 255
          : 1;
  const out = new Float32Array(mesh.vertexCount * 3);
  for (let v = 0; v < mesh.vertexCount; v += 1) {
    for (let a = 0; a < 3; a += 1) {
      const value = (array[v * stride + a] ?? 0) / unit;
      out[v * 3 + a] = unit === 1 ? value : Math.max(-1, value);
    }
  }
  return out;
}

/** A number from 0 to 1 that depends only on `n`: the same tree always grows the same way. */
function hash01(n: number): number {
  let x = (n + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** The connected pieces of a mesh: vertices at the same place are one (the bake splits them). */
function componentsOf(mesh: ModelMesh, positions: Float32Array): Int32Array {
  const count = mesh.vertexCount;
  const weld = new Int32Array(count);
  const seen = new Map<string, number>();
  for (let v = 0; v < count; v += 1) {
    const key = `${positions[v * 3]},${positions[v * 3 + 1]},${positions[v * 3 + 2]}`;
    const found = seen.get(key);
    if (found === undefined) seen.set(key, v);
    weld[v] = found ?? v;
  }
  const parent = Int32Array.from({ length: count }, (_, v) => v);
  const find = (v: number): number => {
    let root = v;
    while (parent[root] !== root) root = parent[root] as number;
    let node = v;
    while (parent[node] !== root) {
      const next = parent[node] as number;
      parent[node] = root;
      node = next;
    }
    return root;
  };
  const index = mesh.index;
  for (let i = 0; i + 2 < index.length; i += 3) {
    const a = find(weld[index[i] as number] as number);
    const b = find(weld[index[i + 1] as number] as number);
    const c = find(weld[index[i + 2] as number] as number);
    parent[b] = a;
    parent[find(c)] = a;
  }
  // Numbered 0..n-1 in order of first vertex, so that the result never depends on the roots.
  const numbers = new Map<number, number>();
  const component = new Int32Array(count);
  for (let v = 0; v < count; v += 1) {
    const root = find(weld[v] as number);
    let n = numbers.get(root);
    if (n === undefined) {
      n = numbers.size;
      numbers.set(root, n);
    }
    component[v] = n;
  }
  return component;
}

function groupVertices(component: Int32Array): number[][] {
  const groups: number[][] = [];
  component.forEach((n, v) => (groups[n] ??= []).push(v));
  return groups;
}

/** The trunk never waits; each branch grows from the point where it is closest to the trunk. */
function trunkGrowth(mesh: ModelMesh, positions: Float32Array): PartGrowth {
  const pivot = positions.slice();
  const delay = new Float32Array(mesh.vertexCount);
  const groups = groupVertices(componentsOf(mesh, positions));
  const y = (v: number): number => positions[v * 3 + 1] ?? 0;
  let lowest = 0;
  for (let v = 1; v < mesh.vertexCount; v += 1) if (y(v) < y(lowest)) lowest = v;
  const main = groups.find((group) => group.includes(lowest)) ?? [];
  const branches = groups.filter((group) => group !== main);
  for (const v of main) delay[v] = -1;
  if (branches.length === 0) return { pivot, delay };

  const distance2 = (a: number, b: number): number => {
    const dx = (positions[a * 3] ?? 0) - (positions[b * 3] ?? 0);
    const dy = y(a) - y(b);
    const dz = (positions[a * 3 + 2] ?? 0) - (positions[b * 3 + 2] ?? 0);
    return dx * dx + dy * dy + dz * dz;
  };
  // Every few vertices of the trunk are enough to find where a branch meets it.
  const step = Math.max(1, Math.floor(main.length / 400));
  const trunkSample = main.filter((_, k) => k % step === 0);
  const bases = branches.map((branch) => {
    let best = branch[0] as number;
    let bestDistance = Infinity;
    for (const v of branch) {
      for (const t of trunkSample) {
        const d = distance2(v, t);
        if (d < bestDistance) {
          bestDistance = d;
          best = v;
        }
      }
    }
    return best;
  });
  const heights = bases.map(y);
  const low = Math.min(...heights);
  const high = Math.max(...heights);
  const span = 1 - BRANCH_TIMING.window;
  branches.forEach((branch, k) => {
    const base = bases[k] as number;
    const height = high > low ? ((heights[k] as number) - low) / (high - low) : 0;
    const share = BRANCH_TIMING.heightShare;
    const start = span * (share * height + (1 - share) * hash01(k));
    for (const v of branch) {
      pivot.set([positions[base * 3] ?? 0, y(base), positions[base * 3 + 2] ?? 0], v * 3);
      delay[v] = start;
    }
  });
  return { pivot, delay };
}

/** Leaves and flowers: cards gathered in clusters, each cluster swelling from its centre. */
function clusterGrowth(mesh: ModelMesh, positions: Float32Array): PartGrowth {
  const groups = groupVertices(componentsOf(mesh, positions));
  const centres = groups.map((group) => {
    let x = 0;
    let y = 0;
    let z = 0;
    for (const v of group) {
      x += positions[v * 3] ?? 0;
      y += positions[v * 3 + 1] ?? 0;
      z += positions[v * 3 + 2] ?? 0;
    }
    return [x / group.length, y / group.length, z / group.length] as [number, number, number];
  });
  const wanted = Math.round(groups.length / LEAF_TIMING.leavesPerCluster);
  const clusterCount = Math.min(
    groups.length,
    Math.max(LEAF_TIMING.minClusters, Math.min(LEAF_TIMING.maxClusters, wanted)),
  );
  // A few rounds of k-means, seeded the same way every time (evenly through the heights).
  const byHeight = centres.map((_, k) => k).sort((a, b) => centres[a]![1] - centres[b]![1]);
  let means = Array.from({ length: clusterCount }, (_, k) => [
    ...centres[byHeight[Math.floor(((k + 0.5) * byHeight.length) / clusterCount)] as number]!,
  ]);
  const member = new Int32Array(groups.length);
  for (let round = 0; round < 8; round += 1) {
    centres.forEach((c, k) => {
      let best = 0;
      let bestDistance = Infinity;
      means.forEach((m, j) => {
        const d = (c[0] - m[0]!) ** 2 + (c[1] - m[1]!) ** 2 + (c[2] - m[2]!) ** 2;
        if (d < bestDistance) {
          bestDistance = d;
          best = j;
        }
      });
      member[k] = best;
    });
    means = means.map((m, j) => {
      let x = 0;
      let y = 0;
      let z = 0;
      let n = 0;
      centres.forEach((c, k) => {
        if (member[k] !== j) return;
        x += c[0];
        y += c[1];
        z += c[2];
        n += 1;
      });
      return n === 0 ? m : [x / n, y / n, z / n];
    });
  }
  // The order the clusters come in: from the top down, with a share of chance, so that a young
  // tree has its first leaves at its tip.
  const heights = means.map((m) => m[1]!);
  const low = Math.min(...heights);
  const high = Math.max(...heights);
  const share = LEAF_TIMING.heightShare;
  const rank = means
    .map((_, j) => j)
    .sort((a, b) => {
      const key = (j: number): number =>
        share * (high > low ? (high - heights[j]!) / (high - low) : 0) + (1 - share) * hash01(j);
      return key(a) - key(b);
    });
  const order = new Int32Array(clusterCount);
  rank.forEach((j, position) => (order[j] = position));
  const span = 1 - LEAF_TIMING.window - LEAF_TIMING.jitter;
  const pivot = new Float32Array(mesh.vertexCount * 3);
  const delay = new Float32Array(mesh.vertexCount);
  groups.forEach((group, k) => {
    const j = member[k] as number;
    const start =
      (clusterCount > 1 ? (span * (order[j] as number)) / (clusterCount - 1) : 0) +
      LEAF_TIMING.jitter * hash01(k + 7919);
    const m = means[j] as number[];
    for (const v of group) {
      pivot.set([m[0]!, m[1]!, m[2]!], v * 3);
      delay[v] = start;
    }
  });
  return { pivot, delay };
}

/** Where each vertex of a trunk, or of leaves and flowers, grows from, and when it starts. */
export function partGrowth(mesh: ModelMesh, role: 'trunk' | 'foliage' | 'bloom'): PartGrowth {
  const positions = positionsOf(mesh);
  return role === 'trunk' ? trunkGrowth(mesh, positions) : clusterGrowth(mesh, positions);
}
