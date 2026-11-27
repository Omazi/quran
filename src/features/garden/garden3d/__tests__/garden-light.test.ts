import { readGardenModel } from '../garden-model';
import { GardenModelError, type Glb } from '../glb';
import { parseGlb } from '../glb';
import { shippedGardenBytes } from '../test-support/shipped-model';

const NIGHT = {
  sky: { color: 0x9db0dc, ground: 0x2c3048, intensity: 1.05 },
  sun: { color: 0xc9d8ff, intensity: 1.05, position: [18, 30, -8] },
  shadowIntensity: 0.62,
};

/** A baked garden with no mesh, only its settings. */
function gardenWith(garden: Record<string, unknown>): Glb {
  return {
    json: { asset: { version: '2.0' }, extras: { garden: { textures: [], ...garden } }, nodes: [] },
    bin: new Uint8Array(0),
  } as unknown as Glb;
}

describe('the light of a garden (D46)', () => {
  it('is the daylight of the pictures for the level-1 garden', () => {
    expect(readGardenModel(parseGlb(shippedGardenBytes())).light).toBeNull();
  });

  it('is read from the file for a garden that has its own (the night garden)', () => {
    expect(readGardenModel(gardenWith({ light: NIGHT })).light).toEqual(NIGHT);
  });

  it('refuses a light that is not described', () => {
    expect(() => readGardenModel(gardenWith({ light: { sky: NIGHT.sky } }))).toThrow(
      GardenModelError,
    );
    expect(() =>
      readGardenModel(gardenWith({ light: { ...NIGHT, sky: { ...NIGHT.sky, color: -1 } } })),
    ).toThrow(GardenModelError);
  });
});
