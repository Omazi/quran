/**
 * The pack of a level garden (docs/specs/garden-levels.md): one file the app downloads, checks
 * against the SHA-256 of the manifest, and unpacks, holding the baked 3D garden and its pictures.
 *
 *   "JGARDEN1" (8 ASCII bytes) | header length (uint32, little endian) | header (ASCII JSON) | data
 *
 * The header lists the files: { format: 1, level, files: [{ path, offset, length }] }, offsets
 * from the start of the data. Pure: Node's Buffer only, tested under Jest; the app reads the same
 * layout with src/data/garden-art/garden-pack.ts.
 */
export const MAGIC = 'JGARDEN1';
export const FORMAT = 1;

/** The pack of `files` ([{ path, bytes }]), in the order given. */
export function encodePack(level, files) {
  let offset = 0;
  const entries = files.map(({ path, bytes }) => {
    if (!/^[a-z0-9][a-z0-9_./-]*$/.test(path) || path.includes('..')) {
      throw new Error(`pack: unsafe path "${path}"`);
    }
    const entry = { path, offset, length: bytes.length };
    offset += bytes.length;
    return entry;
  });
  const header = Buffer.from(JSON.stringify({ format: FORMAT, level, files: entries }), 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32LE(header.length);
  return Buffer.concat([Buffer.from(MAGIC, 'ascii'), length, header, ...files.map((f) => f.bytes)]);
}

/** The header of a pack and where its data starts. Throws on anything that is not a pack. */
export function decodeHeader(pack) {
  if (pack.length < 12 || pack.subarray(0, 8).toString('ascii') !== MAGIC) {
    throw new Error('pack: not a garden pack');
  }
  const length = pack.readUInt32LE(8);
  const header = JSON.parse(pack.subarray(12, 12 + length).toString('ascii'));
  if (header.format !== FORMAT) throw new Error(`pack: unknown format ${header.format}`);
  const dataStart = 12 + length;
  for (const file of header.files) {
    if (file.offset + file.length > pack.length - dataStart) {
      throw new Error(`pack: ${file.path} runs past the end`);
    }
  }
  return { header, dataStart };
}

/** Width and height of a WebP image (VP8, VP8L or VP8X), or null. */
export function webpSize(bytes) {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (bytes.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  if (chunk === 'VP8L') {
    const b = bytes.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  return null;
}
