/**
 * The baked garden as plain data, and which parts of it a stage draws (decision D40).
 *
 * The file is written by `tools/garden-3d`: every piece of the level-1 garden that the pictures
 * show (D35), merged per material or instanced, each tagged with the stages where it is drawn: a
 * range of element counts, and the water and foliage states (bits of `comboMask`, `water * 4 +
 * foliage`, as `GardenStage` names them). Showing a stage is choosing ranges of triangles and
 * instances: nothing is placed or computed on the phone.
 *
 * Pure: no three.js, no React. The arrays are views on the file's own bytes.
 */

import type { GardenStage } from '../garden-picture';
import { GardenModelError, type GltfAccessor, type Glb } from './glb';

const COMPONENT = {
  BYTE: 5120,
  UNSIGNED_BYTE: 5121,
  SHORT: 5122,
  UNSIGNED_SHORT: 5123,
  UNSIGNED_INT: 5125,
  FLOAT: 5126,
} as const;
const ITEM_SIZE: Readonly<Record<GltfAccessor['type'], number>> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
};
const FOLIAGE_STAGES = 4;
/** Numbers per item in the file: merged [start, count, from, until, combos], instanced [instance, from, until, combos]. */
const MERGED_ITEM_LENGTH = 5;
const INSTANCE_ITEM_LENGTH = 4;

type VertexArray = Int8Array | Uint8Array | Int16Array | Float32Array;

/** One vertex attribute: `itemSize` values every `stride` values of `array`. */
export interface ModelAttribute {
  readonly array: VertexArray;
  readonly itemSize: number;
  readonly stride: number;
  readonly normalized: boolean;
}

/** How a colour changes with the stage: the lawn dries with the foliage, the earth dies. */
export type MaterialTint = 'wilt' | 'dead' | null;

export interface ModelMaterial {
  readonly name: string;
  /** sRGB, as 0xRRGGBB. */
  readonly color: number;
  /** The colour at the far end of the tint (dry lawn, dead earth). */
  readonly colorAlt: number | null;
  readonly tint: MaterialTint;
  /** Index into `GardenModel.textures`. */
  readonly texture: number | null;
  readonly alphaTest: number;
  readonly doubleSided: boolean;
  readonly transparent: boolean;
  readonly opacity: number;
  readonly emissive: number;
  readonly emissiveIntensity: number;
  readonly vertexColors: boolean;
  /** A living plant: its colours fade with the foliage (the picture tool's wilt). */
  readonly wilts: boolean;
}

/** A merged piece: `count` indices from `start`, drawn in the stages it names. */
export interface ModelItem {
  readonly start: number;
  readonly count: number;
  readonly from: number;
  readonly until: number;
  readonly comboMask: number;
}

export interface InstanceItem {
  readonly instance: number;
  readonly from: number;
  readonly until: number;
  readonly comboMask: number;
}

export interface ModelInstances {
  readonly count: number;
  readonly translation: Float32Array;
  /** Quaternions, x y z w. */
  readonly rotation: Float32Array;
  /** Includes the scale of the quantised positions. */
  readonly scale: Float32Array;
  readonly items: readonly InstanceItem[];
}

export interface ModelMesh {
  readonly name: string;
  readonly material: ModelMaterial;
  readonly vertexCount: number;
  /** Quantised positions (signed 16-bit, normalised): multiply by `positionScale`. */
  readonly position: ModelAttribute;
  readonly normal: ModelAttribute;
  readonly uv: ModelAttribute | null;
  readonly color: ModelAttribute | null;
  readonly index: Uint16Array | Uint32Array;
  /** For a merged mesh; an instanced mesh has its scale in each instance. */
  readonly positionScale: number;
  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
  /** Merged mesh: its pieces. Empty for an instanced mesh. */
  readonly items: readonly ModelItem[];
  /** Instanced mesh: its instances. Null for a merged mesh. */
  readonly instances: ModelInstances | null;
}

export interface ModelTexture {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** RGBA, 8 bits per channel, sRGB, first row at v = 0. */
  readonly pixels: Uint8Array;
}

export interface GardenModel {
  readonly meshes: readonly ModelMesh[];
  readonly textures: readonly ModelTexture[];
}

// ---------------------------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------------------------

/** The bit of a stage's water and foliage in `comboMask`. */
export function comboOf(stage: GardenStage): number {
  return stage.water * FOLIAGE_STAGES + stage.foliage;
}

export function isItemShown(
  item: Pick<ModelItem, 'from' | 'until' | 'comboMask'>,
  stage: GardenStage,
): boolean {
  return (
    stage.count >= item.from &&
    stage.count < item.until &&
    ((item.comboMask >> comboOf(stage)) & 1) === 1
  );
}

/** The ranges of indices a merged mesh draws for a stage, joined where they touch. */
export function visibleRanges(
  items: readonly ModelItem[],
  stage: GardenStage,
): { start: number; count: number }[] {
  const shown = items.filter((item) => isItemShown(item, stage)).sort((a, b) => a.start - b.start);
  const ranges: { start: number; count: number }[] = [];
  for (const { start, count } of shown) {
    const last = ranges[ranges.length - 1];
    if (last !== undefined && start <= last.start + last.count) {
      last.count = Math.max(last.count, start + count - last.start);
    } else {
      ranges.push({ start, count });
    }
  }
  return ranges;
}

/** The instances a stage shows, each once, in increasing order. */
export function visibleInstances(items: readonly InstanceItem[], stage: GardenStage): number[] {
  const shown = new Set<number>();
  for (const item of items) if (isItemShown(item, stage)) shown.add(item.instance);
  return [...shown].sort((a, b) => a - b);
}

/** How many draws a stage takes, without shadows: one per range, one per instanced mesh shown. */
export function stageDrawCalls(model: GardenModel, stage: GardenStage): number {
  let draws = 0;
  for (const mesh of model.meshes) {
    if (mesh.instances === null) draws += visibleRanges(mesh.items, stage).length;
    else if (visibleInstances(mesh.instances.items, stage).length > 0) draws += 1;
  }
  return draws;
}

// ---------------------------------------------------------------------------------------------
// Reading the file
// ---------------------------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOf(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GardenModelError(`"${key}" is not a number.`);
  }
  return value;
}

function numbersOf(record: Record<string, unknown>, key: string): number[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((n) => typeof n === 'number')) {
    throw new GardenModelError(`"${key}" is not a list of numbers.`);
  }
  return value as number[];
}

class Reader {
  constructor(private readonly glb: Glb) {}

  private bytesOf(bufferViewIndex: number): { offset: number; length: number; stride?: number } {
    const view = this.glb.json.bufferViews?.[bufferViewIndex];
    if (view === undefined) throw new GardenModelError(`No buffer view ${bufferViewIndex}.`);
    const offset = this.glb.bin.byteOffset + (view.byteOffset ?? 0);
    if ((view.byteOffset ?? 0) + view.byteLength > this.glb.bin.byteLength) {
      throw new GardenModelError(`Buffer view ${bufferViewIndex} runs past the binary chunk.`);
    }
    return { offset, length: view.byteLength, stride: view.byteStride };
  }

  /** The raw bytes of a buffer view (texture pixels). */
  bufferView(index: number): Uint8Array {
    const { offset, length } = this.bytesOf(index);
    return new Uint8Array(this.glb.bin.buffer, offset, length);
  }

  attribute(accessorIndex: number): ModelAttribute & { count: number } {
    const accessor = this.glb.json.accessors?.[accessorIndex];
    if (accessor === undefined) throw new GardenModelError(`No accessor ${accessorIndex}.`);
    const { offset, length, stride } = this.bytesOf(accessor.bufferView);
    const start = offset + (accessor.byteOffset ?? 0);
    const buffer = this.glb.bin.buffer;
    const itemSize = ITEM_SIZE[accessor.type];
    let array: VertexArray;
    let bytesPerValue: number;
    switch (accessor.componentType) {
      case COMPONENT.BYTE:
        bytesPerValue = 1;
        array = new Int8Array(buffer, start, length / bytesPerValue);
        break;
      case COMPONENT.UNSIGNED_BYTE:
        bytesPerValue = 1;
        array = new Uint8Array(buffer, start, length / bytesPerValue);
        break;
      case COMPONENT.SHORT:
        bytesPerValue = 2;
        array = new Int16Array(buffer, start, length / bytesPerValue);
        break;
      case COMPONENT.FLOAT:
        bytesPerValue = 4;
        array = new Float32Array(buffer, start, length / bytesPerValue);
        break;
      default:
        throw new GardenModelError(`Accessor ${accessorIndex} has an unread component type.`);
    }
    return {
      array,
      itemSize,
      stride: stride === undefined ? itemSize : stride / bytesPerValue,
      normalized: accessor.normalized === true,
      count: accessor.count,
    };
  }

  indices(accessorIndex: number): Uint16Array | Uint32Array {
    const accessor = this.glb.json.accessors?.[accessorIndex];
    if (accessor === undefined) throw new GardenModelError(`No accessor ${accessorIndex}.`);
    const { offset } = this.bytesOf(accessor.bufferView);
    const start = offset + (accessor.byteOffset ?? 0);
    if (accessor.componentType === COMPONENT.UNSIGNED_SHORT) {
      return new Uint16Array(this.glb.bin.buffer, start, accessor.count);
    }
    if (accessor.componentType === COMPONENT.UNSIGNED_INT) {
      return new Uint32Array(this.glb.bin.buffer, start, accessor.count);
    }
    throw new GardenModelError(`Accessor ${accessorIndex} is not a list of indices.`);
  }

  floats(accessorIndex: number): Float32Array {
    const { array } = this.attribute(accessorIndex);
    if (!(array instanceof Float32Array))
      throw new GardenModelError(`Accessor ${accessorIndex} is not float.`);
    return array;
  }
}

function materialOf(extras: unknown, name: string): ModelMaterial {
  if (!isRecord(extras)) throw new GardenModelError(`Material "${name}" has no garden settings.`);
  const tint = extras.tint;
  if (tint !== null && tint !== 'wilt' && tint !== 'dead') {
    throw new GardenModelError(`Material "${name}" has an unknown tint.`);
  }
  const texture = extras.texture;
  const colorAlt = extras.colorAlt;
  return {
    name,
    color: numberOf(extras, 'color'),
    colorAlt: typeof colorAlt === 'number' ? colorAlt : null,
    tint,
    texture: typeof texture === 'number' ? texture : null,
    alphaTest: numberOf(extras, 'alphaTest'),
    doubleSided: extras.doubleSided === true,
    transparent: extras.transparent === true,
    opacity: numberOf(extras, 'opacity'),
    emissive: numberOf(extras, 'emissive'),
    emissiveIntensity: numberOf(extras, 'emissiveIntensity'),
    vertexColors: extras.vertexColors === true,
    wilts: extras.wilts === true,
  };
}

function mergedItems(values: number[]): ModelItem[] {
  const items: ModelItem[] = [];
  for (let i = 0; i + MERGED_ITEM_LENGTH <= values.length; i += MERGED_ITEM_LENGTH) {
    const [start, count, from, until, comboMask] = values.slice(i, i + MERGED_ITEM_LENGTH) as [
      number,
      number,
      number,
      number,
      number,
    ];
    items.push({ start, count, from, until, comboMask });
  }
  return items;
}

function instanceItems(values: number[]): InstanceItem[] {
  const items: InstanceItem[] = [];
  for (let i = 0; i + INSTANCE_ITEM_LENGTH <= values.length; i += INSTANCE_ITEM_LENGTH) {
    const [instance, from, until, comboMask] = values.slice(i, i + INSTANCE_ITEM_LENGTH) as [
      number,
      number,
      number,
      number,
    ];
    items.push({ instance, from, until, comboMask });
  }
  return items;
}

/** The garden of a parsed GLB written by `tools/garden-3d`. Throws `GardenModelError` otherwise. */
export function readGardenModel(glb: Glb): GardenModel {
  const reader = new Reader(glb);
  const { json } = glb;
  const garden = isRecord(json.extras) ? json.extras.garden : undefined;
  if (!isRecord(garden) || !Array.isArray(garden.textures)) {
    throw new GardenModelError('This GLB is not a baked garden.');
  }
  const textures: ModelTexture[] = garden.textures.map((entry: unknown) => {
    if (!isRecord(entry)) throw new GardenModelError('A texture is not described.');
    const width = numberOf(entry, 'width');
    const height = numberOf(entry, 'height');
    const pixels = reader.bufferView(numberOf(entry, 'bufferView'));
    if (pixels.length !== width * height * 4)
      throw new GardenModelError('A texture has the wrong size.');
    return { name: typeof entry.name === 'string' ? entry.name : 'texture', width, height, pixels };
  });

  const meshes: ModelMesh[] = [];
  for (const node of json.nodes ?? []) {
    if (node.mesh === undefined) continue;
    const mesh = json.meshes?.[node.mesh];
    const primitive = mesh?.primitives[0];
    if (
      primitive === undefined ||
      primitive.indices === undefined ||
      primitive.material === undefined
    ) {
      throw new GardenModelError(`Node "${node.name ?? ''}" has no drawable mesh.`);
    }
    const extras = isRecord(node.extras) ? node.extras : {};
    const name = node.name ?? mesh?.name ?? 'mesh';
    const material = materialOf(json.materials?.[primitive.material]?.extras, name);
    const attributes = primitive.attributes;
    if (attributes.POSITION === undefined || attributes.NORMAL === undefined) {
      throw new GardenModelError(`Mesh "${name}" has no positions or normals.`);
    }
    const position = reader.attribute(attributes.POSITION);
    let instances: ModelInstances | null = null;
    const gpu = node.extensions?.EXT_mesh_gpu_instancing;
    if (isRecord(gpu) && isRecord(gpu.attributes)) {
      const a = gpu.attributes;
      const translation = reader.floats(numberOf(a, 'TRANSLATION'));
      instances = {
        count: translation.length / 3,
        translation,
        rotation: reader.floats(numberOf(a, 'ROTATION')),
        scale: reader.floats(numberOf(a, 'SCALE')),
        items: instanceItems(numbersOf(extras, 'instanceItems')),
      };
    }
    meshes.push({
      name,
      material,
      vertexCount: position.count,
      position,
      normal: reader.attribute(attributes.NORMAL),
      uv: attributes.TEXCOORD_0 === undefined ? null : reader.attribute(attributes.TEXCOORD_0),
      color: attributes.COLOR_0 === undefined ? null : reader.attribute(attributes.COLOR_0),
      index: reader.indices(primitive.indices),
      positionScale: numberOf(extras, 'positionScale'),
      castShadow: extras.castShadow === true,
      receiveShadow: extras.receiveShadow === true,
      items: instances === null ? mergedItems(numbersOf(extras, 'items')) : [],
      instances,
    });
  }
  return { meshes, textures };
}
