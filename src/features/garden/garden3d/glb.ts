/**
 * Reads a binary glTF file (GLB 2.0): its JSON document and its binary chunk. Only what the baked
 * garden needs (`tools/garden-3d`): no image, no external buffer, no compression.
 *
 * Pure TypeScript, without `TextDecoder`, which the JavaScript engine of the phone may lack: the
 * bake writes the JSON chunk in ASCII only (every other character escaped), so each byte is one
 * character.
 */

const MAGIC = 0x46546c67; // "glTF"
const VERSION = 2;
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;
const ASCII_LIMIT = 0x80;
/** Characters decoded at a time: `String.fromCharCode` takes its bytes as arguments. */
const DECODE_SLICE = 0x2000;

export class GardenModelError extends Error {
  override name = 'GardenModelError';
}

/** The parts of a glTF document the garden reads. Unknown members are ignored. */
export interface GltfAccessor {
  readonly bufferView: number;
  readonly byteOffset?: number;
  readonly componentType: number;
  readonly count: number;
  readonly type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4';
  readonly normalized?: boolean;
}

export interface GltfBufferView {
  readonly byteOffset?: number;
  readonly byteLength: number;
  readonly byteStride?: number;
}

export interface GltfDocument {
  readonly asset: { readonly version: string };
  readonly accessors?: readonly GltfAccessor[];
  readonly bufferViews?: readonly GltfBufferView[];
  readonly meshes?: readonly {
    readonly name?: string;
    readonly primitives: readonly {
      readonly attributes: Readonly<Record<string, number>>;
      readonly indices?: number;
      readonly material?: number;
    }[];
  }[];
  readonly materials?: readonly { readonly name?: string; readonly extras?: unknown }[];
  readonly nodes?: readonly {
    readonly name?: string;
    readonly mesh?: number;
    readonly extras?: unknown;
    readonly extensions?: Readonly<Record<string, unknown>>;
  }[];
  readonly extras?: unknown;
}

export interface Glb {
  readonly json: GltfDocument;
  /** The binary chunk, as a view on the file's own bytes (nothing is copied). */
  readonly bin: Uint8Array;
}

function asciiText(bytes: Uint8Array): string {
  let text = '';
  for (let start = 0; start < bytes.length; start += DECODE_SLICE) {
    const slice = bytes.subarray(start, start + DECODE_SLICE);
    for (const byte of slice) {
      if (byte >= ASCII_LIMIT) throw new GardenModelError('The JSON chunk is not ASCII.');
    }
    text += String.fromCharCode(...slice);
  }
  return text;
}

/** The JSON and the binary chunk of a GLB file. Throws `GardenModelError` on anything else. */
export function parseGlb(buffer: ArrayBuffer): Glb {
  if (buffer.byteLength < HEADER_BYTES + CHUNK_HEADER_BYTES) {
    throw new GardenModelError('The file is too short to be a GLB.');
  }
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== MAGIC) throw new GardenModelError('This is not a GLB file.');
  if (view.getUint32(4, true) !== VERSION)
    throw new GardenModelError('Only GLB version 2 is read.');
  if (view.getUint32(8, true) > buffer.byteLength) {
    throw new GardenModelError('The file is shorter than its header says.');
  }

  let json: GltfDocument | null = null;
  let bin = new Uint8Array(0);
  let offset = HEADER_BYTES;
  while (offset + CHUNK_HEADER_BYTES <= buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + CHUNK_HEADER_BYTES;
    if (start + length > buffer.byteLength)
      throw new GardenModelError('A chunk runs past the end.');
    const bytes = new Uint8Array(buffer, start, length);
    if (type === CHUNK_JSON) {
      try {
        json = JSON.parse(asciiText(bytes)) as GltfDocument;
      } catch (error) {
        if (error instanceof GardenModelError) throw error;
        throw new GardenModelError('The JSON chunk cannot be read.');
      }
    } else if (type === CHUNK_BIN) {
      bin = bytes;
    }
    offset = start + length;
  }
  if (json === null) throw new GardenModelError('The file has no JSON chunk.');
  return { json, bin };
}
