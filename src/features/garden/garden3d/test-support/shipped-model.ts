// The project compiles without Node's type definitions: the two functions needed are typed here
// (same as src/ui/__tests__/tokens.test.ts).
const { readFileSync } = jest.requireActual<{
  readFileSync: (path: string) => { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
}>('node:fs');
const { resolve } = jest.requireActual<{ resolve: (...segments: string[]) => string }>('node:path');

/** The bytes of the baked garden that ships with the app (assets/models/garden/level-1). */
export function shippedGardenBytes(): ArrayBuffer {
  const file = readFileSync(
    resolve(
      expect.getState().testPath ?? '',
      '../../../../../../assets/models/garden/level-1/garden.glb',
    ),
  );
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}
