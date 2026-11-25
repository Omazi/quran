/**
 * Writes a binary glTF (GLB 2.0, https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html,
 * section "GLB File Format Specification"). Pure: no three.js, no browser.
 *
 * The JSON chunk is pure ASCII (every other character is escaped), so that the app can read it
 * without a text decoder, which the JavaScript engine of the phone may lack.
 */

const MAGIC = 0x46546c67; // "glTF"
const VERSION = 2;
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"
const ALIGNMENT = 4;
const SPACE = 0x20;

function padded(length) {
  return Math.ceil(length / ALIGNMENT) * ALIGNMENT;
}

/** JSON with every non-ASCII character written as \uXXXX: same value, one byte per character. */
export function asciiJson(value) {
  return JSON.stringify(value).replace(
    /[\u0080-￿]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

/** The GLB file of a glTF document and its binary buffer. */
export function writeGlb(json, bin) {
  const text = asciiJson(json);
  const jsonLength = padded(text.length);
  const binLength = padded(bin.length);
  const total = 12 + 8 + jsonLength + (bin.length > 0 ? 8 + binLength : 0);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, VERSION, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, CHUNK_JSON, true);
  for (let i = 0; i < jsonLength; i += 1)
    bytes[20 + i] = i < text.length ? text.charCodeAt(i) : SPACE;
  if (bin.length > 0) {
    const start = 20 + jsonLength;
    view.setUint32(start, binLength, true);
    view.setUint32(start + 4, CHUNK_BIN, true);
    bytes.set(bin, start + 8);
  }
  return bytes;
}

/** Collects typed arrays into one binary buffer, one buffer view each, aligned on 4 bytes. */
export class BinaryBuilder {
  constructor() {
    this.parts = [];
    this.length = 0;
    this.bufferViews = [];
  }

  /** Appends the bytes of a typed array; returns the index of its buffer view. */
  add(array, extra = {}) {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    const byteOffset = padded(this.length);
    this.parts.push({ byteOffset, bytes });
    this.length = byteOffset + bytes.length;
    this.bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, ...extra });
    return this.bufferViews.length - 1;
  }

  /** The whole buffer, its length a multiple of 4. */
  bytes() {
    const out = new Uint8Array(padded(this.length));
    for (const { byteOffset, bytes } of this.parts) out.set(bytes, byteOffset);
    return out;
  }
}
