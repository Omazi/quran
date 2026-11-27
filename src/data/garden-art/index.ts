/**
 * The gardens of levels 2 to 7 (D46, docs/specs/garden-levels.md): not in the app, downloaded
 * when a level needs one, from the addresses of the manifest (`garden-art.json`, written by
 * tools/garden-3d/pack.mjs), checked against its SHA-256, then kept on the device.
 */
import { deviceGardenFiles } from './device-files';
import manifest from './garden-art.json';
import { type PackIndex } from './garden-pack';
import { installGardenPack, type GardenArtEntry } from './install';

export { GardenPackError, readPackHeader, readPackIndex } from './garden-pack';
export type { PackIndex, PackSprite } from './garden-pack';
export { GardenArtUnavailableError, installGardenPack } from './install';
export type { GardenArtEntry, PackDevice } from './install';

const LEVELS: Readonly<Record<string, GardenArtEntry>> = manifest.levels;

/** The pack of a level in the manifest, or null (level 1 ships with the app). */
export function gardenArtEntry(level: number): GardenArtEntry | null {
  return LEVELS[String(level)] ?? null;
}

/** An installed level garden: what its pack holds, and where its files are. */
export interface GardenArtFiles {
  readonly level: number;
  readonly index: PackIndex;
  /** The address of a file of the pack (`base/h00-f0.webp`), for an image view. */
  uri(path: string): string;
  /** The bytes of its baked 3D garden. */
  modelBytes(): Promise<ArrayBuffer>;
}

const loading = new Map<number, Promise<GardenArtFiles>>();

/**
 * The garden of `level`, installed if it was not: one download per level, shared by every screen.
 * A failure is not kept, so that a later screen can try again (no network, a server down).
 */
export function loadGardenArtFiles(
  level: number,
  device = deviceGardenFiles,
): Promise<GardenArtFiles> {
  const entry = gardenArtEntry(level);
  if (entry === null) return Promise.reject(new Error(`No garden pack for level ${level}`));
  let promise = loading.get(level);
  if (promise === undefined) {
    promise = installGardenPack(device, level, entry).then((index): GardenArtFiles => ({
      level,
      index,
      uri: (path) => device.uri(level, path),
      modelBytes: async () => {
        const bytes = await device.readInstalled(level, 'garden.glb');
        if (bytes === null) throw new Error(`The garden of level ${level} has no model`);
        return bytes.slice().buffer;
      },
    }));
    promise.catch(() => loading.delete(level));
    loading.set(level, promise);
  }
  return promise;
}

/** For tests: forget the gardens loaded. */
export function forgetGardenArtFiles(): void {
  loading.clear();
}
