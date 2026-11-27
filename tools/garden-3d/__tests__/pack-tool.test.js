/**
 * The garden packs (tools/garden-3d/lib/pack.mjs): ES modules run in a separate Node process, as
 * the tool runs, the result back as JSON (same method as garden-3d-tool.test.js).
 */
/* global __dirname -- Jest runs this file as CommonJS */
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const LIB = join(__dirname, '..', 'lib', 'pack.mjs');

function inTool(body) {
  const script = `import * as pack from ${JSON.stringify(LIB)};
    try { const value = await (async () => { ${body} })();
      console.log(JSON.stringify({ ok: value })); }
    catch (e) { console.log(JSON.stringify({ error: e.message })); }`;
  const run = spawnSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr);
  return JSON.parse(run.stdout);
}

describe('encodePack and decodeHeader', () => {
  it('writes the files after a header that says where each one is', () => {
    expect(
      inTool(`const bytes = pack.encodePack(4, [
          { path: 'index.json', bytes: Buffer.from('{}') },
          { path: 'base/h00-f0.webp', bytes: Buffer.from('abcd') },
        ]);
        const { header, dataStart } = pack.decodeHeader(bytes);
        const file = header.files[1];
        return { header, picture: bytes.subarray(dataStart + file.offset, dataStart + file.offset + file.length).toString() };`),
    ).toEqual({
      ok: {
        header: {
          format: 1,
          level: 4,
          files: [
            { path: 'index.json', offset: 0, length: 2 },
            { path: 'base/h00-f0.webp', offset: 2, length: 4 },
          ],
        },
        picture: 'abcd',
      },
    });
  });

  it('refuses a path that could leave the folder of its level', () => {
    expect(
      inTool(`return pack.encodePack(2, [{ path: '../x', bytes: Buffer.from('x') }]);`),
    ).toEqual({ error: 'pack: unsafe path "../x"' });
  });

  it('refuses a cut pack and a file that is not one', () => {
    expect(
      inTool(`const bytes = pack.encodePack(2, [{ path: 'a', bytes: Buffer.from('abc') }]);
        return pack.decodeHeader(bytes.subarray(0, bytes.length - 1));`),
    ).toEqual({ error: 'pack: a runs past the end' });
    expect(inTool(`return pack.decodeHeader(Buffer.from('PK not a pack'));`)).toEqual({
      error: 'pack: not a garden pack',
    });
  });
});

describe('webpSize', () => {
  it('reads the size of the three kinds of WebP', () => {
    expect(
      inTool(`const lossy = Buffer.alloc(30); lossy.write('RIFF', 0); lossy.write('WEBP', 8);
        lossy.write('VP8 ', 12); lossy.writeUInt16LE(1170, 26); lossy.writeUInt16LE(816, 28);
        const extended = Buffer.alloc(30); extended.write('RIFF', 0); extended.write('WEBP', 8);
        extended.write('VP8X', 12); extended.writeUIntLE(1169, 24, 3); extended.writeUIntLE(815, 27, 3);
        const lossless = Buffer.alloc(30); lossless.write('RIFF', 0); lossless.write('WEBP', 8);
        lossless.write('VP8L', 12); lossless.writeUInt32LE((1169) | (815 << 14), 21);
        return [pack.webpSize(lossy), pack.webpSize(extended), pack.webpSize(lossless), pack.webpSize(Buffer.from('no'))];`),
    ).toEqual({
      ok: [
        { width: 1170, height: 816 },
        { width: 1170, height: 816 },
        { width: 1170, height: 816 },
        null,
      ],
    });
  });
});
