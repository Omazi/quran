import { LEVEL_1_ART, packedGardenArt, type PackedGarden } from '../garden-art';
import { GARDEN_PICTURE_PIXELS } from '../garden-images.generated';

function packed(size: { width: number; height: number } = GARDEN_PICTURE_PIXELS): PackedGarden {
  return {
    level: 4,
    index: {
      size,
      base: ['h00-f0', 'h01-f0'],
      water: ['h01-f0-w2'],
      sprites: { '1': { name: 'e01', x: 10, y: 20, width: 30, height: 40, footX: 25, footY: 60 } },
    },
    uri: (path) => `file:///garden-art/level-4/${path}`,
    modelBytes: async () => new ArrayBuffer(8),
  };
}

describe('LEVEL_1_ART', () => {
  it('is the set that ships with the app', () => {
    expect(LEVEL_1_ART.key).toBe('level-1');
    expect(LEVEL_1_ART.images.base.has('h60-f0')).toBe(true);
    expect(LEVEL_1_ART.base('h00-f0')).toEqual(expect.anything());
    expect(LEVEL_1_ART.sprite(5)?.source).toEqual(expect.anything());
    expect(LEVEL_1_ART.base('h99-f0')).toBeUndefined();
  });
});

describe('packedGardenArt', () => {
  it('reads the pictures of a downloaded level garden from its files on the device', () => {
    const art = packedGardenArt(packed());
    expect(art?.key).toBe('level-4');
    expect(art?.images.base).toEqual(new Set(['h00-f0', 'h01-f0']));
    expect(art?.base('h01-f0')).toEqual({ uri: 'file:///garden-art/level-4/base/h01-f0.webp' });
    expect(art?.water('h01-f0-w2')).toEqual({
      uri: 'file:///garden-art/level-4/water/h01-f0-w2.webp',
    });
    expect(art?.sprite(1)).toEqual({
      source: { uri: 'file:///garden-art/level-4/grow/e01.webp' },
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      footX: 25,
      footY: 60,
    });
  });

  it('gives nothing for a picture the set does not have, never a broken address', () => {
    const art = packedGardenArt(packed());
    expect(art?.base('h02-f0')).toBeUndefined();
    expect(art?.water('h00-f0-w1')).toBeUndefined();
    expect(art?.sprite(2)).toBeUndefined();
  });

  it('keeps the same source for the same picture, so that a re-render does not reload it', () => {
    const art = packedGardenArt(packed());
    expect(art?.base('h00-f0')).toBe(art?.base('h00-f0'));
  });

  it('refuses pictures of another size: the scene and the 3D frame are laid out for one', () => {
    expect(packedGardenArt(packed({ width: 1200, height: 900 }))).toBeNull();
  });
});
