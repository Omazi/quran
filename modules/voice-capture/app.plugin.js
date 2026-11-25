/**
 * Config plugin of the voice module (docs/DECISIONS.md, D42): puts the Whisper model in the iOS
 * app while `npx expo prebuild` generates the project.
 *
 * The model (43.5 MB) is not in the repository. It is downloaded once from the addresses of
 * `voice-model.json`, kept in a cache, and checked against its SHA-256 before it is used: a file
 * that does not match is refused and the build stops. Two environment variables help offline:
 * - `VOICE_MODEL_FILE`: a copy already on disk, used instead of downloading (still checked);
 * - `VOICE_MODEL_CACHE`: where the checked copy is kept (default `node_modules/.cache/voice-model`).
 * Behind a proxy, Node's `fetch` needs `NODE_USE_ENV_PROXY=1` (Node 22.21 or later).
 */
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const manifest = require('./voice-model.json');

function sha256Of(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    fs.createReadStream(file)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

async function isTheModel(file) {
  if (!fs.existsSync(file) || fs.statSync(file).size !== manifest.bytes) return false;
  return (await sha256Of(file)) === manifest.sha256;
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || response.body === null) {
    throw new Error(`HTTP ${response.status}`);
  }
  const { Readable } = require('node:stream');
  const { pipeline } = require('node:stream/promises');
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destination));
}

/** A checked copy of the model, from the cache, a local file, or one of the addresses. */
async function checkedModel(projectRoot) {
  const cacheDir =
    process.env.VOICE_MODEL_CACHE ??
    path.join(projectRoot, 'node_modules', '.cache', 'voice-model');
  const cached = path.join(cacheDir, `${manifest.sha256}-${manifest.file}`);
  if (await isTheModel(cached)) return cached;
  fs.mkdirSync(cacheDir, { recursive: true });

  const local = process.env.VOICE_MODEL_FILE;
  if (local !== undefined && local !== '') {
    if (!(await isTheModel(local))) {
      throw new Error(`VOICE_MODEL_FILE (${local}) is not ${manifest.file} (SHA-256 differs).`);
    }
    fs.copyFileSync(local, cached);
    return cached;
  }

  const failures = [];
  for (const url of manifest.urls) {
    const partial = `${cached}.part`;
    try {
      await download(url, partial);
      if (!(await isTheModel(partial))) throw new Error('size or SHA-256 differs');
      fs.renameSync(partial, cached);
      return cached;
    } catch (error) {
      fs.rmSync(partial, { force: true });
      failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(
    `The voice model ${manifest.file} could not be obtained:\n  ${failures.join('\n  ')}\n` +
      'See docs/BUILD.md, "Le modèle de la voix".',
  );
}

const withVoiceModelFile = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const { projectRoot, platformProjectRoot, projectName } = config.modRequest;
      const source = await checkedModel(projectRoot);
      const destination = path.join(platformProjectRoot, projectName, manifest.file);
      fs.copyFileSync(source, destination);
      return config;
    },
  ]);

const withVoiceModelResource = (config) =>
  withXcodeProject(config, (config) => {
    const { projectName } = config.modRequest;
    const filepath = path.join(projectName, manifest.file);
    if (!config.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath,
        groupName: projectName,
        project: config.modResults,
        isBuildFile: true,
        verbose: false,
      });
    }
    return config;
  });

module.exports = (config) => withVoiceModelResource(withVoiceModelFile(config));
