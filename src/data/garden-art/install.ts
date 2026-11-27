/**
 * Installing the pack of a level garden on the device (docs/specs/garden-levels.md): download it
 * from the first address that answers, check its size and SHA-256 against the manifest, unpack its
 * files into the level's folder, and only then mark the level installed. A level installed from
 * another pack (an older version) is replaced. Nothing is shown from a pack that did not pass.
 *
 * The device is injected (`PackDevice`), so that the rules are tested without a file system.
 */
import { headerLength, readPackHeader, readPackIndex, type PackIndex } from './garden-pack';

/** One level of the manifest (`garden-art.json`). */
export interface GardenArtEntry {
  readonly style: string;
  readonly file: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly urls: readonly string[];
}

/** What installing needs of the device. Paths are those of the pack (`base/h00-f0.webp`). */
export interface PackDevice {
  /** Downloads `url` as the pack of `level`, replacing any earlier download. */
  download(level: number, url: string): Promise<void>;
  /** The size of the downloaded pack, and its SHA-256 (lowercase hexadecimal). */
  packSize(level: number): number;
  packDigest(level: number): Promise<string>;
  readPack(level: number, offset: number, length: number): Promise<Uint8Array>;
  removePack(level: number): void;
  readInstalled(level: number, path: string): Promise<Uint8Array | null>;
  writeInstalled(level: number, path: string, bytes: Uint8Array): Promise<void>;
  clearInstalled(level: number): void;
}

const STAMP = 'installed.json';
const INDEX = 'index.json';

export class GardenArtUnavailableError extends Error {
  constructor(level: number, reason: string) {
    super(`The garden of level ${level} could not be installed: ${reason}`);
    this.name = 'GardenArtUnavailableError';
  }
}

function text(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

function bytesOf(value: string): Uint8Array {
  return Uint8Array.from(value, (c) => c.charCodeAt(0));
}

async function installedSha(device: PackDevice, level: number): Promise<string | null> {
  const stamp = await device.readInstalled(level, STAMP);
  if (stamp === null) return null;
  try {
    const json: unknown = JSON.parse(text(stamp));
    return typeof json === 'object' && json !== null && 'sha256' in json
      ? String((json as { sha256: unknown }).sha256)
      : null;
  } catch {
    return null;
  }
}

/** Downloads a checked copy of the pack, trying each address in turn. */
async function downloadChecked(device: PackDevice, level: number, entry: GardenArtEntry) {
  const reasons: string[] = [];
  for (const url of entry.urls) {
    try {
      await device.download(level, url);
      if (device.packSize(level) !== entry.bytes) {
        reasons.push(`${url}: ${device.packSize(level)} bytes, not ${entry.bytes}`);
      } else if ((await device.packDigest(level)) !== entry.sha256) {
        reasons.push(`${url}: not the expected file (SHA-256)`);
      } else {
        return;
      }
    } catch (error) {
      reasons.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
    device.removePack(level);
  }
  throw new GardenArtUnavailableError(level, reasons.join('; ') || 'no address');
}

/**
 * Makes sure the pack of `entry` is installed for `level`, and returns its index. Throws
 * `GardenArtUnavailableError` when no address gives the expected file.
 */
export async function installGardenPack(
  device: PackDevice,
  level: number,
  entry: GardenArtEntry,
): Promise<PackIndex> {
  if ((await installedSha(device, level)) !== entry.sha256) {
    device.clearInstalled(level);
    await downloadChecked(device, level, entry);
    try {
      const start = await device.readPack(level, 0, 12);
      const header = readPackHeader(
        await device.readPack(level, 0, headerLength(start)),
        entry.bytes,
      );
      if (header.level !== level) throw new GardenArtUnavailableError(level, 'another level');
      for (const file of header.entries) {
        await device.writeInstalled(
          level,
          file.path,
          await device.readPack(level, file.offset, file.length),
        );
      }
      await device.writeInstalled(level, STAMP, bytesOf(JSON.stringify({ sha256: entry.sha256 })));
    } catch (error) {
      device.clearInstalled(level);
      throw error;
    } finally {
      device.removePack(level);
    }
  }
  const index = await device.readInstalled(level, INDEX);
  if (index === null) throw new GardenArtUnavailableError(level, 'the pack has no index');
  return readPackIndex(index);
}
