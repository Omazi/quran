/**
 * The element of the hizb in progress, growing in the 3D garden (owner, 25 November 2026: "if I
 * read 2 or 3 pages of a hizb of 10 I must see a small sprout; the tree grows little by little,
 * young first, then its leaves appear"). Its pieces are those the stage with one more element
 * draws (`growingPieces`), drawn here apart from the stage, each with its own transform:
 *
 * - a tree: the seed mound and its sprout (the `sprout` prop) from the first page, then the tree
 *   scaled from its foot, its trunk thin at first; its branches grow from where they meet the
 *   trunk, its leaves swell cluster by cluster from their centres, its flowers or fruit last;
 * - a plant (flowers, bushes): each clump comes up from the ground, one after another;
 * - a built element (channels, walls, a pavilion): piece by piece, each from its foot.
 *
 * The per-vertex growth (branches, leaves) is a few lines in the vertex shader (`GROW_VERTEX`),
 * driven by two uniforms: nothing is rebuilt as the growth changes, so it animates in the render
 * loop without a React render (`GardenSurface`). At growth 1 every piece is exactly as the stage
 * draws it: the stage takes over without a seam.
 */

import * as THREE from 'three';

import type { GardenStage } from '../garden-picture';
import {
  growthPose,
  POP_SPRING,
  popScale,
  SPROUT_SHARE,
  staggered,
  type GrowthForm,
} from '../growth-pose';
import {
  growingPieces,
  plantFormOf,
  type GardenModel,
  type GrowingPiece,
  type ModelMaterial,
  type ModelMesh,
  type PieceRole,
} from './garden-model';
import { BRANCH_TIMING, LEAF_TIMING, partGrowth, positionsOf } from './plant-parts';

/** What `buildGardenThree` lends the growth: its geometry and materials, made once. */
export interface GrowthResources {
  readonly model: GardenModel;
  readonly scene: THREE.Scene;
  /** The geometry of a model mesh, as the stage draws it. */
  readonly geometryOf: (mesh: ModelMesh) => THREE.BufferGeometry;
  /** The material of a model mesh; with `grows`, its vertices move with `uGrow`. */
  readonly materialOf: (source: ModelMaterial, grows?: GrowUniforms) => THREE.MeshLambertMaterial;
}

export interface GrowUniforms {
  readonly uGrow: { value: number };
  readonly uGrowWindow: { value: number };
}

/** The highest point of a mesh, in its own (quantised) space. */
function topOf(mesh: ModelMesh): number {
  const positions = positionsOf(mesh);
  let top = 0;
  for (let k = 1; k < positions.length; k += 3) top = Math.max(top, positions[k] ?? 0);
  return top;
}

/** Plants: the last clump starts this far into the growth. Built pieces: the same, and each takes the window. */
const PLANT_STAGGER = 0.5;
const BUILT = { stagger: 0.75, window: 0.25 } as const;

/**
 * Scales each vertex about its pivot by the pop of its own progress (`popScale` of
 * `staggered(uGrow, delay, window)`, the same spring as growth-pose.ts).
 */
const GROW_COMMON = `#include <common>
attribute vec3 aGrowPivot;
attribute float aGrowDelay;
uniform float uGrow;
uniform float uGrowWindow;
float growPop(float t) {
  if (t <= 0.0) return 0.0;
  if (t >= 1.0) return 1.0;
  float zeta = ${POP_SPRING.damping.toFixed(3)};
  float decay = ${POP_SPRING.decay.toFixed(3)};
  float root = sqrt(1.0 - zeta * zeta);
  float damped = decay / zeta * root;
  return 1.0 - exp(-decay * t) * (cos(damped * t) + zeta / root * sin(damped * t));
}`;
const GROW_VERTEX = `#include <begin_vertex>
{
  float growT = clamp((uGrow - aGrowDelay) / uGrowWindow, 0.0, 1.0);
  transformed = aGrowPivot + (transformed - aGrowPivot) * growPop(growT);
}`;

/** Adds the growth to a material's vertex shader (the main pass and the shadow's). */
export function injectGrowth(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: GrowUniforms,
): void {
  shader.uniforms.uGrow = uniforms.uGrow;
  shader.uniforms.uGrowWindow = uniforms.uGrowWindow;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', GROW_COMMON)
    .replace('#include <begin_vertex>', GROW_VERTEX);
}

function newUniforms(window: number): GrowUniforms {
  return { uGrow: { value: 0 }, uGrowWindow: { value: window } };
}

/** One piece on screen and how it moves with the growth. */
interface Shown {
  readonly object: THREE.Object3D;
  readonly update: (growth: number) => void;
}

export interface GrowthView {
  /** Shows the element growing at `growth` (0 to 1). */
  update(growth: number): void;
  dispose(): void;
}

function instanceMatrix(mesh: ModelMesh, instance: number): THREE.Matrix4 {
  const instances = mesh.instances;
  if (instances === null) return new THREE.Matrix4();
  return new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(instances.translation, instance * 3),
    new THREE.Quaternion().fromArray(instances.rotation, instance * 4),
    new THREE.Vector3().fromArray(instances.scale, instance * 3),
  );
}

/** The foot of a piece, in the garden's metres: the middle of the bottom of its box. */
function footOf(mesh: ModelMesh, piece: GrowingPiece): THREE.Vector3 {
  if (piece.instance !== null) {
    return new THREE.Vector3().fromArray(
      mesh.instances?.translation ?? [0, 0, 0],
      piece.instance * 3,
    );
  }
  const positions = positionsOf(mesh);
  const box = new THREE.Box3();
  const range = piece.range ?? { start: 0, count: 0 };
  const v = new THREE.Vector3();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    const vertex = mesh.index[i] as number;
    box.expandByPoint(v.fromArray(positions, vertex * 3));
  }
  const centre = box.getCenter(new THREE.Vector3());
  return new THREE.Vector3(centre.x, box.min.y, centre.z).multiplyScalar(mesh.positionScale);
}

/** Pieces at the same place are one plant (a tree's trunk and its leaves). */
function unitsOf(model: GardenModel, pieces: readonly GrowingPiece[]): GrowingPiece[][] {
  const units = new Map<string, GrowingPiece[]>();
  for (const piece of pieces) {
    const mesh = model.meshes[piece.mesh];
    if (mesh === undefined) continue;
    const foot = footOf(mesh, piece);
    const key =
      piece.instance === null
        ? `range:${piece.mesh}:${piece.range?.start}`
        : `${foot.x.toFixed(2)},${foot.z.toFixed(2)}`;
    const unit = units.get(key);
    if (unit === undefined) units.set(key, [piece]);
    else unit.push(piece);
  }
  return [...units.values()];
}

/** The colours of the channels' water (bake-scene.js COLORS: water, low water, dry bed). */
const WATER = /water|6cc3d0|7fb3b6|bfae98/i;

/**
 * Each unit's delay, the nearest to the garden's centre first, the last at `span`. Water comes
 * last: the channels are dug before they fill.
 */
function unitDelays(model: GardenModel, units: readonly GrowingPiece[][], span: number): number[] {
  const distances = units.map((unit) => {
    const first = unit[0];
    const mesh = first === undefined ? undefined : model.meshes[first.mesh];
    if (first === undefined || mesh === undefined) return 0;
    const foot = footOf(mesh, first);
    return Math.hypot(foot.x, foot.z) + (WATER.test(mesh.material.name) ? 1000 : 0);
  });
  const order = distances.map((_, k) => k).sort((a, b) => distances[a]! - distances[b]! || a - b);
  const delays = new Array<number>(units.length).fill(0);
  order.forEach((unit, rank) => {
    delays[unit] = units.length > 1 ? (span * rank) / (units.length - 1) : 0;
  });
  return delays;
}

/**
 * Builds the growing element for `stage` (whose count is the hizb before it). Null when the
 * stage has nothing more to grow.
 */
export function buildGrowthView(resources: GrowthResources, stage: GardenStage): GrowthView | null {
  const { model, scene } = resources;
  const pieces = growingPieces(model, stage);
  if (pieces.length === 0) return null;
  const form: GrowthForm = plantFormOf(pieces);
  const hasFoliage = pieces.some((piece) => piece.role === 'foliage');
  const group = new THREE.Group();
  group.name = 'growing-element';
  const disposables: { dispose(): void }[] = [];
  const shown: Shown[] = [];

  const growthAttributes = new Map<
    string,
    { pivot: THREE.BufferAttribute; delay: THREE.BufferAttribute }
  >();
  const growGeometry = (
    mesh: ModelMesh,
    role: 'trunk' | 'foliage' | 'bloom',
  ): THREE.BufferGeometry => {
    const base = resources.geometryOf(mesh);
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(base.attributes))
      geometry.setAttribute(name, attribute);
    geometry.setIndex(base.index);
    const key = `${mesh.name}|${model.meshes.indexOf(mesh)}|${role}`;
    let attributes = growthAttributes.get(key);
    if (attributes === undefined) {
      const parts = partGrowth(mesh, role);
      attributes = {
        pivot: new THREE.BufferAttribute(parts.pivot, 3),
        delay: new THREE.BufferAttribute(parts.delay, 1),
      };
      growthAttributes.set(key, attributes);
    }
    geometry.setAttribute('aGrowPivot', attributes.pivot);
    geometry.setAttribute('aGrowDelay', attributes.delay);
    disposables.push(geometry);
    return geometry;
  };

  /** A mesh for one piece, its geometry shared with the stage's, drawn on its own. */
  const pieceMesh = (
    source: ModelMesh,
    piece: GrowingPiece,
    role: PieceRole,
  ): { mesh: THREE.Mesh; uniforms: GrowUniforms | null } => {
    let geometry: THREE.BufferGeometry;
    let uniforms: GrowUniforms | null = null;
    let material: THREE.MeshLambertMaterial;
    if (role === 'built') {
      const base = resources.geometryOf(source);
      geometry = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(base.attributes))
        geometry.setAttribute(name, attribute);
      geometry.setIndex(base.index);
      disposables.push(geometry);
      material = resources.materialOf(source.material);
    } else {
      geometry = growGeometry(source, role);
      uniforms = newUniforms(role === 'trunk' ? BRANCH_TIMING.window : LEAF_TIMING.window);
      material = resources.materialOf(source.material, uniforms);
      disposables.push(material);
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      depth.map = material.map;
      depth.alphaTest = material.alphaTest;
      const shared = uniforms;
      depth.onBeforeCompile = (shader) => injectGrowth(shader, shared);
      depth.customProgramCacheKey = () => 'garden-grow-depth';
      disposables.push(depth);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.customDepthMaterial = depth;
      return finish(mesh, uniforms);
    }
    return finish(new THREE.Mesh(geometry, material), uniforms);

    function finish(mesh: THREE.Mesh, grow: GrowUniforms | null) {
      if (piece.range !== null) geometry.setDrawRange(piece.range.start, piece.range.count);
      mesh.matrixAutoUpdate = false;
      mesh.castShadow = source.castShadow;
      mesh.receiveShadow = source.receiveShadow;
      mesh.frustumCulled = false;
      mesh.visible = false;
      group.add(mesh);
      return { mesh, uniforms: grow };
    }
  };

  const baseMatrixOf = (source: ModelMesh, piece: GrowingPiece): THREE.Matrix4 =>
    piece.instance !== null
      ? instanceMatrix(source, piece.instance)
      : new THREE.Matrix4().makeScale(
          source.positionScale,
          source.positionScale,
          source.positionScale,
        );

  const units = unitsOf(model, pieces);
  const scratch = new THREE.Matrix4();

  if (form === 'structure') {
    const delays = unitDelays(model, units, BUILT.stagger);
    units.forEach((unit, k) => {
      for (const piece of unit) {
        const source = model.meshes[piece.mesh];
        if (source === undefined) continue;
        const { mesh } = pieceMesh(source, piece, 'built');
        const base = baseMatrixOf(source, piece);
        const foot = footOf(source, piece);
        const delay = delays[k] ?? 0;
        shown.push({
          object: mesh,
          update: (growth) => {
            const s = popScale(staggered(growthPose(growth, form).scale, delay, BUILT.window));
            mesh.visible = s > 0.001;
            mesh.matrix
              .makeTranslation(foot.x, foot.y, foot.z)
              .multiply(scratch.makeScale(s, s, s))
              .multiply(scratch.makeTranslation(-foot.x, -foot.y, -foot.z))
              .multiply(base);
          },
        });
      }
    });
  } else {
    const delays = form === 'plant' ? unitDelays(model, units, PLANT_STAGGER) : units.map(() => 0);
    units.forEach((unit, k) => {
      const delay = delays[k] ?? 0;
      const poseAt = (growth: number) =>
        growthPose(form === 'plant' ? staggered(growth, delay, 1 - delay) : growth, form);
      for (const piece of unit) {
        const source = model.meshes[piece.mesh];
        if (source === undefined) continue;
        // A plant without leaves (a clump of flowers) grows its flowers as its leaves.
        const role: PieceRole =
          piece.role === 'bloom' && !hasFoliage && form === 'plant' ? 'foliage' : piece.role;
        const { mesh, uniforms } = pieceMesh(source, piece, role === 'built' ? 'built' : role);
        const base = baseMatrixOf(source, piece);
        shown.push({
          object: mesh,
          update: (growth) => {
            const pose = poseAt(growth);
            const girth = role === 'trunk' ? pose.girth : 1;
            const progress =
              role === 'trunk'
                ? pose.branches
                : role === 'bloom'
                  ? pose.bloom
                  : role === 'foliage'
                    ? pose.foliage
                    : 1;
            if (uniforms !== null) uniforms.uGrow.value = progress;
            const isOut = role === 'trunk' || role === 'built' ? pose.scale > 0.001 : progress > 0;
            mesh.visible = isOut && pose.scale > 0.001;
            mesh.matrix
              .copy(base)
              .multiply(scratch.makeScale(pose.scale * girth, pose.scale, pose.scale * girth));
          },
        });
      }
      // The seed mound and its sprout, at the foot of a tree.
      const trunk = unit.find((piece) => piece.role === 'trunk' && piece.instance !== null);
      const trunkMesh = trunk === undefined ? undefined : model.meshes[trunk.mesh];
      const sprout = model.props.sprout ?? [];
      if (form !== 'tree' || trunk === undefined || !trunkMesh?.instances) return;
      const instances = trunkMesh.instances;
      const at = new THREE.Vector3().fromArray(instances.translation, (trunk.instance ?? 0) * 3);
      const turn = new THREE.Quaternion().fromArray(instances.rotation, (trunk.instance ?? 0) * 4);
      // The sprout is a share of the tree it becomes (`SPROUT_SHARE`), whatever the tree.
      let treeHeight = 0;
      for (const piece of unit) {
        const mesh = model.meshes[piece.mesh];
        const scaleY = mesh?.instances?.scale[(piece.instance ?? 0) * 3 + 1] ?? 0;
        if (mesh !== undefined) treeHeight = Math.max(treeHeight, topOf(mesh) * scaleY);
      }
      const propHeight = Math.max(...sprout.map((mesh) => topOf(mesh) * mesh.positionScale), 1e-6);
      const sproutSize = (SPROUT_SHARE * treeHeight) / propHeight;
      for (const source of sprout) {
        const geometry = resources.geometryOf(source);
        const mesh = new THREE.Mesh(geometry, resources.materialOf(source.material));
        mesh.matrixAutoUpdate = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.visible = false;
        group.add(mesh);
        const size = new THREE.Vector3();
        shown.push({
          object: mesh,
          update: (growth) => {
            const s = growthPose(growth, form).sprout * sproutSize * source.positionScale;
            mesh.visible = s > 0.0001;
            mesh.matrix.compose(at, turn, size.set(s, s, s));
          },
        });
      }
    });
  }

  scene.add(group);
  return {
    update(growth) {
      for (const piece of shown) piece.update(growth);
    },
    dispose() {
      scene.remove(group);
      for (const item of disposables) item.dispose();
    },
  };
}
