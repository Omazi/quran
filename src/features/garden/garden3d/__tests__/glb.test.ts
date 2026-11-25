import { GardenModelError, parseGlb } from '../glb';
import { shippedGardenBytes } from '../test-support/shipped-model';

/** A GLB file made by hand: header, JSON chunk, optional BIN chunk. */
function glbOf(
  jsonText: string,
  bin?: number[],
  overrides: { magic?: number; version?: number } = {},
) {
  const jsonLength = Math.ceil(jsonText.length / 4) * 4;
  const binLength = bin ? Math.ceil(bin.length / 4) * 4 : 0;
  const total = 20 + jsonLength + (bin ? 8 + binLength : 0);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, overrides.magic ?? 0x46546c67, true);
  view.setUint32(4, overrides.version ?? 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  for (let i = 0; i < jsonLength; i += 1)
    bytes[20 + i] = i < jsonText.length ? jsonText.charCodeAt(i) : 0x20;
  if (bin) {
    view.setUint32(20 + jsonLength, binLength, true);
    view.setUint32(24 + jsonLength, 0x004e4942, true);
    bytes.set(bin, 28 + jsonLength);
  }
  return bytes.buffer;
}

describe('parseGlb', () => {
  it('reads the JSON chunk and the binary chunk', () => {
    const glb = parseGlb(glbOf('{"asset":{"version":"2.0"}}', [7, 8, 9]));
    expect(glb.json.asset.version).toBe('2.0');
    expect([...glb.bin]).toEqual([7, 8, 9, 0]);
  });

  it('reads escaped characters outside ASCII back as they were', () => {
    const glb = parseGlb(
      glbOf('{"asset":{"version":"2.0","generator":"\\u062c\\u0646\\u062a\\u0643"}}'),
    );
    expect((glb.json.asset as { generator?: string }).generator).toBe('جنتك');
  });

  it('gives an empty binary chunk when the file has none', () => {
    expect(parseGlb(glbOf('{"asset":{"version":"2.0"}}')).bin.length).toBe(0);
  });

  it('refuses a file that is not a GLB', () => {
    expect(() => parseGlb(glbOf('{}', undefined, { magic: 0x12345678 }))).toThrow(GardenModelError);
  });

  it('refuses another version of GLB', () => {
    expect(() => parseGlb(glbOf('{}', undefined, { version: 1 }))).toThrow(GardenModelError);
  });

  it('refuses a file shorter than a header', () => {
    expect(() => parseGlb(new ArrayBuffer(10))).toThrow(GardenModelError);
  });

  it('refuses a truncated file', () => {
    const whole = glbOf('{"asset":{"version":"2.0"}}', [1, 2, 3, 4]);
    expect(() => parseGlb(whole.slice(0, whole.byteLength - 4))).toThrow(GardenModelError);
  });

  it('refuses a JSON chunk that is not JSON', () => {
    expect(() => parseGlb(glbOf('{"asset":'))).toThrow(GardenModelError);
  });

  it('refuses a JSON chunk with a byte outside ASCII', () => {
    const bytes = new Uint8Array(glbOf('{"a":"xx"}'));
    bytes[26] = 0xc3;
    expect(() => parseGlb(bytes.buffer)).toThrow(GardenModelError);
  });

  it('reads the garden that ships with the app', () => {
    const glb = parseGlb(shippedGardenBytes());
    expect(glb.json.asset.version).toBe('2.0');
    expect(glb.bin.length).toBeGreaterThan(0);
  });
});
