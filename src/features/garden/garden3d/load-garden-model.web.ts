import { Asset } from 'expo-asset';

/** The baked level-1 garden (tools/garden-3d), bundled with the app as an asset. */
// Metro needs a static require to bundle an asset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GARDEN_MODEL: number = require('../../../../assets/models/garden/level-1/garden.glb');

/** The bytes of the garden model, in a browser: the asset is a file served with the app. */
export async function loadGardenModelBytes(): Promise<ArrayBuffer> {
  const response = await fetch(Asset.fromModule(GARDEN_MODEL).uri);
  if (!response.ok) throw new Error(`The garden model could not be loaded (${response.status}).`);
  return response.arrayBuffer();
}
