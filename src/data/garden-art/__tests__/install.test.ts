// The project compiles without Node's type definitions (see shipped-model.ts): typed here.
const { createHash } = jest.requireActual<{
  createHash: (algorithm: string) => {
    update: (bytes: Uint8Array) => { digest: (encoding: 'hex') => string };
  };
}>('node:crypto');

import { GardenArtUnavailableError, installGardenPack, type PackDevice } from '../install';
import { samplePack } from '../test-support/pack-fixture';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** A device in memory: what each address serves, the pack downloaded, the files unpacked. */
function fakeDevice(served: Record<string, Uint8Array | Error>) {
  const downloads: string[] = [];
  let pack: Uint8Array | null = null;
  const files = new Map<string, Uint8Array>();
  const device: PackDevice = {
    async download(_level, url) {
      downloads.push(url);
      const body = served[url];
      if (body === undefined || body instanceof Error) throw body ?? new Error('404');
      pack = body;
    },
    packSize: () => pack?.length ?? 0,
    packDigest: async () => sha(pack ?? new Uint8Array()),
    readPack: async (_level, offset, length) =>
      (pack ?? new Uint8Array()).slice(offset, offset + length),
    removePack: () => {
      pack = null;
    },
    readInstalled: async (_level, path) => files.get(path) ?? null,
    writeInstalled: async (_level, path, bytes) => {
      files.set(path, bytes);
    },
    clearInstalled: () => files.clear(),
  };
  return { device, downloads, files, hasPack: () => pack !== null };
}

const PACK = samplePack(2);
const entry = (urls: string[], bytes = PACK) => ({
  style: 'oasis',
  file: 'level-2.gardenpack',
  bytes: bytes.length,
  sha256: sha(bytes),
  urls,
});

describe('installGardenPack', () => {
  it('downloads, checks and unpacks a pack, then marks the level installed', async () => {
    const fake = fakeDevice({ 'https://a/level-2': PACK });
    const index = await installGardenPack(fake.device, 2, entry(['https://a/level-2']));
    expect(index.style).toBe('oasis');
    expect([...fake.files.keys()].sort()).toEqual([
      'base/h00-f0.webp',
      'garden.glb',
      'index.json',
      'installed.json',
    ]);
    expect(fake.hasPack()).toBe(false); // the download is not kept once unpacked
  });

  it('does not download again a level installed from the same pack', async () => {
    const fake = fakeDevice({ 'https://a/level-2': PACK });
    await installGardenPack(fake.device, 2, entry(['https://a/level-2']));
    await installGardenPack(fake.device, 2, entry(['https://a/level-2']));
    expect(fake.downloads).toHaveLength(1);
  });

  it('replaces a level installed from another pack (an older version of the garden)', async () => {
    const fake = fakeDevice({ 'https://a/level-2': PACK });
    await installGardenPack(fake.device, 2, entry(['https://a/level-2']));
    fake.files.set('installed.json', new TextEncoder().encode('{"sha256":"an-older-pack"}'));
    fake.files.set('base/stale.webp', new Uint8Array([1]));
    await installGardenPack(fake.device, 2, entry(['https://a/level-2']));
    expect(fake.downloads).toHaveLength(2);
    expect(fake.files.has('base/stale.webp')).toBe(false);
  });

  it('tries the next address when a copy is not the expected file', async () => {
    const tampered = PACK.slice();
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1;
    const fake = fakeDevice({ 'https://bad/x': tampered, 'https://good/x': PACK });
    await installGardenPack(fake.device, 2, entry(['https://bad/x', 'https://good/x']));
    expect(fake.downloads).toEqual(['https://bad/x', 'https://good/x']);
    expect(fake.files.has('installed.json')).toBe(true);
  });

  it('installs nothing when no address gives the expected file', async () => {
    const fake = fakeDevice({
      'https://bad/x': samplePack(3),
      'https://down/x': new Error('offline'),
    });
    await expect(
      installGardenPack(fake.device, 2, entry(['https://bad/x', 'https://down/x'])),
    ).rejects.toBeInstanceOf(GardenArtUnavailableError);
    expect(fake.files.size).toBe(0);
    expect(fake.hasPack()).toBe(false);
  });

  it('refuses a checked pack that holds another level', async () => {
    const other = samplePack(3);
    const fake = fakeDevice({ 'https://a/x': other });
    await expect(installGardenPack(fake.device, 2, entry(['https://a/x'], other))).rejects.toThrow(
      /another level/,
    );
    expect(fake.files.size).toBe(0);
  });
});
