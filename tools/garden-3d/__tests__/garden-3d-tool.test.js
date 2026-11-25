/**
 * The bake tool is made of ES modules and Jest runs CommonJS: its functions are called in a
 * separate Node process, as a developer runs the tool, and the result comes back as JSON (same
 * method as tools/garden-pictures).
 */
/* global __dirname -- Jest runs this file as CommonJS */
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const TOOL = join(__dirname, '..');

/** Runs `body` (which may use `visibility` and `glb`, the tool's modules) and returns its result. */
function inTool(body) {
  const script = `import * as visibility from ${JSON.stringify(join(TOOL, 'lib', 'visibility.mjs'))};
    import * as glb from ${JSON.stringify(join(TOOL, 'lib', 'glb.mjs'))};
    try { const value = await (async () => { ${body} })();
      console.log(JSON.stringify({ ok: value })); }
    catch (e) { console.log(JSON.stringify({ error: e.message })); }`;
  const run = spawnSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr);
  return JSON.parse(run.stdout);
}

describe('stage combinations', () => {
  it('numbers the twelve combinations of water (0 to 2) and foliage (0 to 3)', () => {
    expect(
      inTool('return [visibility.COMBO_COUNT, visibility.comboOf(2, 3), visibility.comboOf(0, 0)]'),
    ).toEqual({
      ok: [12, 11, 0],
    });
  });
});

describe('encodeVisibility', () => {
  it('gives one item for a piece shown from its hizb on, in every state', () => {
    expect(inTool('return visibility.encodeVisibility((n) => n >= 5)')).toEqual({
      ok: [{ from: 5, until: 61, comboMask: 4095 }],
    });
  });

  it('gives nothing for a piece never shown', () => {
    expect(inTool('return visibility.encodeVisibility(() => false)')).toEqual({ ok: [] });
  });

  it('gives a closed interval for a pebble that a bed covers later', () => {
    expect(inTool('return visibility.encodeVisibility((n) => n < 3)')).toEqual({
      ok: [{ from: 0, until: 3, comboMask: 4095 }],
    });
  });

  it('keeps only the water states where the water shows', () => {
    const body = 'return visibility.encodeVisibility((n, c) => n >= 1 && Math.floor(c / 4) === 2)';
    expect(inTool(body)).toEqual({ ok: [{ from: 1, until: 61, comboMask: 0b111100000000 }] });
  });

  it('splits a piece whose hizb range differs between foliage states', () => {
    // Leaves: from hizb 5, but gone on foliage 3.
    const body = 'return visibility.encodeVisibility((n, c) => n >= 5 && c % 4 !== 3)';
    expect(inTool(body)).toEqual({ ok: [{ from: 5, until: 61, comboMask: 0b011101110111 }] });
  });

  it('splits a range with a hole into two items', () => {
    const body = 'return visibility.encodeVisibility((n) => n < 3 || n >= 10)';
    expect(inTool(body)).toEqual({
      ok: [
        { from: 0, until: 3, comboMask: 4095 },
        { from: 10, until: 61, comboMask: 4095 },
      ],
    });
  });

  it('is visible exactly where the predicate is, for an irregular predicate', () => {
    const body = `
      const shown = (n, c) => (n * 7 + c * 3) % 5 < 2;
      const items = visibility.encodeVisibility(shown);
      for (let n = 0; n <= 60; n += 1) for (let c = 0; c < 12; c += 1) {
        const any = items.some((i) => n >= i.from && n < i.until && (i.comboMask >> c) & 1);
        if (any !== shown(n, c)) throw new Error('mismatch at ' + n + ',' + c);
      }
      return true;`;
    expect(inTool(body)).toEqual({ ok: true });
  });
});

describe('writeGlb', () => {
  it('writes the GLB header, a JSON chunk padded with spaces and a BIN chunk padded with zeros', () => {
    const body = `
      const bytes = glb.writeGlb({ asset: { version: '2.0' } }, new Uint8Array([1, 2, 3]));
      const view = new DataView(bytes.buffer);
      const jsonLength = view.getUint32(12, true);
      const binStart = 20 + jsonLength;
      return {
        magic: view.getUint32(0, true).toString(16),
        version: view.getUint32(4, true),
        length: view.getUint32(8, true) === bytes.length,
        jsonType: view.getUint32(16, true).toString(16),
        jsonAligned: jsonLength % 4,
        lastJsonByte: bytes[20 + jsonLength - 1],
        binLength: view.getUint32(binStart, true),
        binType: view.getUint32(binStart + 4, true).toString(16),
        bin: [...bytes.slice(binStart + 8, binStart + 12)],
      };`;
    expect(inTool(body)).toEqual({
      ok: {
        magic: '46546c67',
        version: 2,
        length: true,
        jsonType: '4e4f534a',
        jsonAligned: 0,
        lastJsonByte: 0x20,
        binLength: 4,
        binType: '4e4942',
        bin: [1, 2, 3, 0],
      },
    });
  });

  it('escapes every character outside ASCII, so the app can read the JSON without a text decoder', () => {
    const body = `
      const bytes = glb.writeGlb({ asset: { version: '2.0', generator: 'jardin جنتك' } }, new Uint8Array(0));
      const length = new DataView(bytes.buffer).getUint32(12, true);
      const text = String.fromCharCode(...bytes.slice(20, 20 + length));
      return { ascii: [...bytes.slice(20, 20 + length)].every((b) => b < 128), back: JSON.parse(text).asset.generator };`;
    expect(inTool(body)).toEqual({ ok: { ascii: true, back: 'jardin جنتك' } });
  });
});

describe('BinaryBuilder', () => {
  it('aligns every buffer view on 4 bytes', () => {
    const body = `
      const builder = new glb.BinaryBuilder();
      const a = builder.add(new Uint8Array([1, 2, 3]));
      const b = builder.add(new Int16Array([5]));
      return { views: builder.bufferViews, a, b, length: builder.bytes().length };`;
    expect(inTool(body)).toEqual({
      ok: {
        views: [
          { buffer: 0, byteOffset: 0, byteLength: 3 },
          { buffer: 0, byteOffset: 4, byteLength: 2 },
        ],
        a: 0,
        b: 1,
        length: 8,
      },
    });
  });
});
