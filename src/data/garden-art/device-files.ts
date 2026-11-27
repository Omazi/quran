import { Directory, File, FileMode, Paths } from 'expo-file-system';

import type { PackDevice } from './install';

/**
 * The garden packs on a phone: a pack is downloaded into the cache, checked, then unpacked into
 * the documents folder (`garden-art/level-N/`), where it stays: a level garden is downloaded once.
 */
const levelDirectory = (level: number) =>
  new Directory(Paths.document, 'garden-art', `level-${level}`);
const packFile = (level: number) => new File(Paths.cache, `garden-level-${level}.gardenpack`);

export interface DeviceGardenFiles extends PackDevice {
  /** Where the image view and the 3D garden read an unpacked file. */
  uri(level: number, path: string): string;
}

export const deviceGardenFiles: DeviceGardenFiles = {
  async download(level, url) {
    const file = packFile(level);
    if (file.exists) file.delete();
    await File.downloadFileAsync(url, file);
  },
  packSize: (level) => packFile(level).size,
  packDigest: (level) => packFile(level).digest('SHA-256'),
  async readPack(level, offset, length) {
    const handle = packFile(level).open(FileMode.ReadOnly);
    try {
      handle.offset = offset;
      return await handle.readBytes(length);
    } finally {
      handle.close();
    }
  },
  removePack(level) {
    const file = packFile(level);
    if (file.exists) file.delete();
  },
  async readInstalled(level, path) {
    const file = new File(levelDirectory(level), path);
    return file.exists ? file.bytes() : null;
  },
  async writeInstalled(level, path, bytes) {
    const file = new File(levelDirectory(level), path);
    file.create({ intermediates: true, overwrite: true });
    await file.write(bytes);
  },
  clearInstalled(level) {
    const directory = levelDirectory(level);
    if (directory.exists) directory.delete();
  },
  uri: (level, path) => new File(levelDirectory(level), path).uri,
};
