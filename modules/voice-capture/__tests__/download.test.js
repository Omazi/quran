/**
 * The model download of the config plugin: it must stop at the size of the manifest, refuse a
 * redirect to anything but https, and not hang for ever.
 * @jest-environment node
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

jest.mock('expo/config-plugins', () => ({
  IOSConfig: {},
  withDangerousMod: (c) => c,
  withXcodeProject: (c) => c,
}));
jest.mock('../voice-model.json', () => ({
  file: 'm.bin',
  bytes: 100,
  sha256: 'x',
  urls: [],
}));

const { ReadableStream } = require('node:stream/web');
const plugin = require('../app.plugin.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-dl-'));
const target = path.join(dir, 'm.bin.part');
afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(target, { force: true });
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

function respond(chunks, { url = 'https://example.com/m.bin', hang = false } = {}) {
  const body = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (!hang) controller.close();
    },
  });
  const response = { ok: true, status: 200, body, url };
  jest.spyOn(globalThis, 'fetch').mockImplementation(async () => response);
}

describe('download', () => {
  it('keeps a file of the announced size', async () => {
    respond([new Uint8Array(60), new Uint8Array(40)]);
    await plugin.download('https://example.com/m.bin', target);
    expect(fs.statSync(target).size).toBe(100);
  });

  it('stops and deletes the file as soon as it is bigger than announced', async () => {
    respond([new Uint8Array(60), new Uint8Array(60), new Uint8Array(60)]);
    await expect(plugin.download('https://example.com/m.bin', target)).rejects.toThrow(/larger/);
    expect(fs.existsSync(target)).toBe(false);
  });

  it('refuses a redirect to a page that is not https', async () => {
    respond([new Uint8Array(100)], { url: 'http://evil.example/m.bin' });
    await expect(plugin.download('https://example.com/m.bin', target)).rejects.toThrow(/https/);
    expect(fs.existsSync(target)).toBe(false);
  });

  it('gives up on a transfer that stalls', async () => {
    respond([new Uint8Array(10)], { hang: true });
    await expect(
      plugin.download('https://example.com/m.bin', target, { stallMs: 50 }),
    ).rejects.toThrow(/stalled/);
    expect(fs.existsSync(target)).toBe(false);
  });
});
