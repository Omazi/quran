/**
 * Reading a garden pack (tools/garden-3d/lib/pack.mjs writes it): one file per level garden, the
 * baked 3D model and its pictures, downloaded and checked before it is unpacked
 * (docs/specs/garden-levels.md). Pure: bytes in, entries out.
 *
 *   "JGARDEN1" | header length (uint32, little endian) | header (ASCII JSON) | data
 */

export const PACK_MAGIC = 'JGARDEN1';
const FORMAT = 1;
const SAFE_PATH = /^[a-z0-9][a-z0-9_./-]*$/;

export class GardenPackError extends Error {
  constructor(message: string) {
    super(`Garden pack: ${message}`);
    this.name = 'GardenPackError';
  }
}

export interface PackEntry {
  readonly path: string;
  /** From the start of the pack file. */
  readonly offset: number;
  readonly length: number;
}

export interface PackHeader {
  readonly level: number;
  readonly entries: readonly PackEntry[];
}

/** What the pack says of its garden (`index.json`). */
export interface PackIndex {
  readonly level: number;
  readonly style: string;
  readonly size: { readonly width: number; readonly height: number };
  readonly base: readonly string[];
  readonly water: readonly string[];
  readonly sprites: Readonly<Record<string, PackSprite>>;
}

export interface PackSprite {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly footX: number;
  readonly footY: number;
}

function ascii(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x2000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x2000));
  }
  return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The number of bytes before the header ends, from the first 12 bytes of a pack. */
export function headerLength(start: Uint8Array): number {
  if (start.length < 12 || ascii(start.subarray(0, 8)) !== PACK_MAGIC) {
    throw new GardenPackError('this file is not a garden pack.');
  }
  const view = new DataView(start.buffer, start.byteOffset, start.byteLength);
  return 12 + view.getUint32(8, true);
}

/**
 * The header of a pack of `packBytes` bytes, from its first bytes (at least `headerLength`).
 * Rejects a header whose files run past the end or whose paths could leave the pack's folder.
 */
export function readPackHeader(start: Uint8Array, packBytes: number): PackHeader {
  const end = headerLength(start);
  if (start.length < end) throw new GardenPackError('the header is cut.');
  let json: unknown;
  try {
    json = JSON.parse(ascii(start.subarray(12, end)));
  } catch {
    throw new GardenPackError('the header is not JSON.');
  }
  if (!isRecord(json) || json.format !== FORMAT || !Array.isArray(json.files)) {
    throw new GardenPackError('unknown header.');
  }
  if (typeof json.level !== 'number') throw new GardenPackError('the header has no level.');
  const entries = json.files.map((file: unknown): PackEntry => {
    if (!isRecord(file)) throw new GardenPackError('a file is not described.');
    const { path, offset, length } = file;
    if (
      typeof path !== 'string' ||
      !SAFE_PATH.test(path) ||
      path.includes('..') ||
      typeof offset !== 'number' ||
      typeof length !== 'number' ||
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(length) ||
      offset < 0 ||
      length < 0 ||
      end + offset + length > packBytes
    ) {
      throw new GardenPackError(`the file "${String(path)}" is not where it says.`);
    }
    return { path, offset: end + offset, length };
  });
  return { level: json.level, entries };
}

function names(value: unknown, what: string): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
    throw new GardenPackError(`the index has no ${what}.`);
  }
  return value as string[];
}

/** The index of a pack (`index.json`), checked. */
export function readPackIndex(bytes: Uint8Array): PackIndex {
  let json: unknown;
  try {
    json = JSON.parse(ascii(bytes));
  } catch {
    throw new GardenPackError('the index is not JSON.');
  }
  if (!isRecord(json) || typeof json.level !== 'number' || typeof json.style !== 'string') {
    throw new GardenPackError('the index does not say its garden.');
  }
  const size = json.size;
  if (!isRecord(size) || typeof size.width !== 'number' || typeof size.height !== 'number') {
    throw new GardenPackError('the index has no picture size.');
  }
  if (!isRecord(json.sprites)) throw new GardenPackError('the index has no sprites.');
  const sprites: Record<string, PackSprite> = {};
  for (const [hizb, sprite] of Object.entries(json.sprites)) {
    if (
      !isRecord(sprite) ||
      typeof sprite.name !== 'string' ||
      !['x', 'y', 'width', 'height', 'footX', 'footY'].every((k) => typeof sprite[k] === 'number')
    ) {
      throw new GardenPackError(`the sprite of hizb ${hizb} is not described.`);
    }
    sprites[hizb] = sprite as unknown as PackSprite;
  }
  return {
    level: json.level,
    style: json.style,
    size: { width: size.width, height: size.height },
    base: names(json.base, 'dry pictures'),
    water: names(json.water, 'water pictures'),
    sprites,
  };
}
