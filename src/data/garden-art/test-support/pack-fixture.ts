/** A garden pack written as tools/garden-3d/lib/pack.mjs writes one, for the tests of the reader. */
export function encodePack(
  level: number,
  files: { path: string; bytes: Uint8Array }[],
): Uint8Array {
  let offset = 0;
  const entries = files.map(({ path, bytes }) => {
    const entry = { path, offset, length: bytes.length };
    offset += bytes.length;
    return entry;
  });
  const header = new TextEncoder().encode(JSON.stringify({ format: 1, level, files: entries }));
  const out = new Uint8Array(12 + header.length + offset);
  out.set(new TextEncoder().encode('JGARDEN1'), 0);
  new DataView(out.buffer).setUint32(8, header.length, true);
  out.set(header, 12);
  let at = 12 + header.length;
  for (const { bytes } of files) {
    out.set(bytes, at);
    at += bytes.length;
  }
  return out;
}

export const text = (value: string) => new TextEncoder().encode(value);

export const INDEX = {
  level: 2,
  style: 'oasis',
  size: { width: 1170, height: 816 },
  base: ['h00-f0', 'h01-f0'],
  water: ['h01-f0-w2'],
  sprites: { '1': { name: 'e01', x: 1, y: 2, width: 3, height: 4, footX: 5, footY: 6 } },
};

export function samplePack(level = 2): Uint8Array {
  return encodePack(level, [
    { path: 'index.json', bytes: text(JSON.stringify({ ...INDEX, level })) },
    { path: 'garden.glb', bytes: text('glTF-model') },
    { path: 'base/h00-f0.webp', bytes: text('picture-0') },
  ]);
}
