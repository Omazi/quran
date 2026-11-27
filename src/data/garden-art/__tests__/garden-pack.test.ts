import { headerLength, readPackHeader, readPackIndex } from '../garden-pack';
import { encodePack, INDEX, samplePack, text } from '../test-support/pack-fixture';

describe('readPackHeader', () => {
  it('lists the files of a pack, each where its bytes are in the file', () => {
    const pack = samplePack();
    const header = readPackHeader(pack, pack.length);
    expect(header.level).toBe(2);
    expect(header.entries.map((e) => e.path)).toEqual([
      'index.json',
      'garden.glb',
      'base/h00-f0.webp',
    ]);
    const model = header.entries[1];
    expect(model).toBeDefined();
    if (model === undefined) return;
    expect(new TextDecoder().decode(pack.subarray(model.offset, model.offset + model.length))).toBe(
      'glTF-model',
    );
  });

  it('needs only the first bytes of the pack: the header ends at headerLength', () => {
    const pack = samplePack();
    const end = headerLength(pack.subarray(0, 12));
    expect(readPackHeader(pack.subarray(0, end), pack.length).entries).toHaveLength(3);
    expect(() => readPackHeader(pack.subarray(0, end - 1), pack.length)).toThrow(/cut/);
  });

  it('refuses a file that is not a pack', () => {
    expect(() => readPackHeader(text('PK\u0003\u0004 not a pack'), 20)).toThrow(
      /not a garden pack/,
    );
  });

  it('refuses a file that runs past the end of the pack (a cut download)', () => {
    const pack = samplePack();
    expect(() => readPackHeader(pack, pack.length - 1)).toThrow(/not where it says/);
  });

  it('refuses a path that could leave the folder of its level', () => {
    for (const path of ['../evil.webp', '/etc/passwd', 'base/../../x', 'Base/X.webp']) {
      const pack = encodePack(2, [{ path, bytes: text('x') }]);
      expect(() => readPackHeader(pack, pack.length)).toThrow(/not where it says/);
    }
  });
});

describe('readPackIndex', () => {
  it('reads what the pack says of its garden', () => {
    expect(readPackIndex(text(JSON.stringify(INDEX)))).toEqual(INDEX);
  });

  it('refuses an index without its sprites or picture size', () => {
    const { sprites: _sprites, ...noSprites } = INDEX;
    expect(() => readPackIndex(text(JSON.stringify(noSprites)))).toThrow(/sprites/);
    const { size: _size, ...noSize } = INDEX;
    expect(() => readPackIndex(text(JSON.stringify(noSize)))).toThrow(/size/);
  });
});
