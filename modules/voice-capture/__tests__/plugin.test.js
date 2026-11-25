/**
 * The config plugin must be loud: a missing model, or one whose hash differs, stops the build with
 * an error; a good one is placed, checked again and announced; the Xcode project must copy it into
 * the app.
 * @jest-environment node
 */
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MODEL = Buffer.from('a small stand-in for the Whisper model');

jest.mock('../voice-model.json', () => {
  const { createHash: hash } = jest.requireActual('node:crypto');
  const content = Buffer.from('a small stand-in for the Whisper model');
  return {
    file: 'model.bin',
    bytes: content.length,
    sha256: hash('sha256').update(content).digest('hex'),
    urls: [],
  };
});

const plugin = require('../app.plugin.js');

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-plugin-'));
  process.env.VOICE_MODEL_CACHE = path.join(dir, 'cache');
  delete process.env.VOICE_MODEL_FILE;
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.VOICE_MODEL_CACHE;
  delete process.env.VOICE_MODEL_FILE;
});

function write(name, content) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}

describe('placing the model', () => {
  it('copies a checked model and says so with its size and hash', async () => {
    process.env.VOICE_MODEL_FILE = write('given.bin', MODEL);
    const destination = path.join(dir, 'ios', 'App', 'model.bin');
    const log = jest.fn();
    await plugin.placeModel(dir, destination, log);
    expect(fs.readFileSync(destination)).toEqual(MODEL);
    const sha = createHash('sha256').update(MODEL).digest('hex');
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(`voice model ok: ${MODEL.length} ${sha}`),
    );
  });

  it('stops the build when the given model has another hash', async () => {
    const other = Buffer.from(MODEL);
    other[0] ^= 1;
    process.env.VOICE_MODEL_FILE = write('given.bin', other);
    const destination = path.join(dir, 'ios', 'App', 'model.bin');
    await expect(plugin.placeModel(dir, destination, jest.fn())).rejects.toThrow(/SHA-256/);
    expect(fs.existsSync(destination)).toBe(false);
  });

  it('stops the build when the given model file does not exist', async () => {
    process.env.VOICE_MODEL_FILE = path.join(dir, 'nowhere.bin');
    await expect(
      plugin.placeModel(dir, path.join(dir, 'ios', 'App', 'model.bin'), jest.fn()),
    ).rejects.toThrow(/VOICE_MODEL_FILE/);
  });

  it('stops the build when no address gives the model', async () => {
    await expect(
      plugin.placeModel(dir, path.join(dir, 'ios', 'App', 'model.bin'), jest.fn()),
    ).rejects.toThrow(/could not be obtained/);
  });
});

describe('the Xcode project', () => {
  const xcode = require('xcode');

  /** The project `expo prebuild` generates for this app (SDK 58), without the model. */
  function project() {
    const pbxproj = write(
      'project.pbxproj',
      fs.readFileSync(path.join(__dirname, 'fixtures', 'project.pbxproj'), 'utf8'),
    );
    const parsed = xcode.project(pbxproj);
    parsed.parseSync();
    return parsed;
  }

  it('copies the model into the app', () => {
    const parsed = project();
    expect(plugin.copiesIntoApp(parsed, 'Jannatuk/model.bin')).toBe(false);
    plugin.addModelResource(parsed, 'Jannatuk');
    expect(plugin.copiesIntoApp(parsed, 'Jannatuk/model.bin')).toBe(true);
    // Twice is the same as once.
    plugin.addModelResource(parsed, 'Jannatuk');
    const phase = parsed.pbxResourcesBuildPhaseObj();
    expect(phase.files.filter(({ comment }) => comment.includes('model.bin'))).toHaveLength(1);
  });

  it('stops the build when the project would not copy it', () => {
    const parsed = project();
    // A project whose app has no "Copy Bundle Resources" phase at all.
    delete parsed.hash.project.objects.PBXResourcesBuildPhase;
    expect(() => plugin.addModelResource(parsed, 'Jannatuk')).toThrow(/Copy Bundle Resources/);
  });
});
