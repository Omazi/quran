import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

/** The baked level-1 garden (tools/garden-3d), bundled with the app as an asset. */
// Metro needs a static require to bundle an asset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GARDEN_MODEL: number = require('../../../../assets/models/garden/level-1/garden.glb');

/**
 * The bytes of the garden model, on a phone: the asset is copied out of the app bundle by
 * expo-asset where needed, then read whole by expo-file-system. No network: the file ships with
 * the app.
 */
export async function loadGardenModelBytes(): Promise<ArrayBuffer> {
  const asset = await Asset.fromModule(GARDEN_MODEL).downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  return new File(uri).arrayBuffer();
}
