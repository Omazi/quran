import type { DeviceGardenFiles } from './device-files';

/**
 * The garden packs in a browser (the web export, used to look at the app): downloaded with fetch,
 * checked with the browser's SHA-256, unpacked in memory for the page's life.
 */
const packs = new Map<number, Uint8Array>();
const installed = new Map<number, Map<string, { bytes: Uint8Array; url: string | null }>>();

function filesOf(level: number) {
  let files = installed.get(level);
  if (files === undefined) {
    files = new Map();
    installed.set(level, files);
  }
  return files;
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const deviceGardenFiles: DeviceGardenFiles = {
  async download(level, url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    packs.set(level, new Uint8Array(await response.arrayBuffer()));
  },
  packSize: (level) => packs.get(level)?.length ?? 0,
  async packDigest(level) {
    const pack = packs.get(level) ?? new Uint8Array();
    return hex(await crypto.subtle.digest('SHA-256', pack.slice().buffer));
  },
  async readPack(level, offset, length) {
    return (packs.get(level) ?? new Uint8Array()).slice(offset, offset + length);
  },
  removePack(level) {
    packs.delete(level);
  },
  async readInstalled(level, path) {
    return installed.get(level)?.get(path)?.bytes ?? null;
  },
  async writeInstalled(level, path, bytes) {
    filesOf(level).set(path, { bytes, url: null });
  },
  clearInstalled(level) {
    for (const file of installed.get(level)?.values() ?? []) {
      if (file.url !== null) URL.revokeObjectURL(file.url);
    }
    installed.delete(level);
  },
  uri(level, path) {
    const file = installed.get(level)?.get(path);
    if (file === undefined) return '';
    if (file.url === null) {
      const type = path.endsWith('.webp') ? 'image/webp' : 'application/octet-stream';
      file.url = URL.createObjectURL(new Blob([file.bytes.slice().buffer], { type }));
    }
    return file.url;
  },
};
