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
 *
 * It is loud both ways: a missing or different model stops `expo prebuild` with an error that
 * says why, and a good one prints `voice model ok: <bytes> <sha256>` once it is in place in the
 * iOS project, so the build log shows the model went in. The Xcode project is checked to copy
 * the file into the app; the CI then checks the built app holds it (testflight-build.yml).
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

/** The whole transfer may last this long, and no longer than `STALL_MS` without a byte. */
const TOTAL_MS = 10 * 60 * 1000;
const STALL_MS = 60 * 1000;

/**
 * Downloads `url` to `destination`: https only (also after redirects), at most `manifest.bytes`
 * bytes (the file is deleted and the transfer stopped as soon as it is bigger, before any
 * hashing), within a total time and without stalling.
 */
async function download(url, destination, { totalMs = TOTAL_MS, stallMs = STALL_MS } = {}) {
  if (!url.startsWith('https://')) throw new Error('not an https address');
  const { Readable, Transform } = require('node:stream');
  const { pipeline } = require('node:stream/promises');

  const controller = new AbortController();
  const total = setTimeout(() => controller.abort(new Error('took too long')), totalMs);
  let stall;
  const watch = () => {
    clearTimeout(stall);
    stall = setTimeout(() => controller.abort(new Error('transfer stalled')), stallMs);
  };
  try {
    watch();
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!response.ok || response.body === null) throw new Error(`HTTP ${response.status}`);
    // A redirect may not take the download off https.
    if (
      typeof response.url === 'string' &&
      response.url !== '' &&
      !response.url.startsWith('https://')
    ) {
      throw new Error(`redirected to a page that is not https (${response.url})`);
    }
    let received = 0;
    const counter = new Transform({
      transform(chunk, _encoding, done) {
        watch();
        received += chunk.length;
        if (received > manifest.bytes) {
          done(new Error(`larger than the ${manifest.bytes} bytes announced`));
        } else {
          done(null, chunk);
        }
      },
    });
    await pipeline(Readable.fromWeb(response.body), counter, fs.createWriteStream(destination), {
      signal: controller.signal,
    });
  } catch (error) {
    fs.rmSync(destination, { force: true });
    const reason = controller.signal.aborted ? controller.signal.reason : null;
    throw reason instanceof Error ? reason : error;
  } finally {
    clearTimeout(total);
    clearTimeout(stall);
  }
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

/**
 * Puts the checked model in the iOS project folder and checks the copy itself (a full disk or a
 * cut copy would otherwise go into the app unnoticed). Throws when anything is wrong; says
 * `voice model ok` when the file in place is the model.
 */
async function placeModel(
  projectRoot,
  destination,
  log = (line) => process.stdout.write(`${line}\n`),
) {
  const source = await checkedModel(projectRoot);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  if (!(await isTheModel(destination))) {
    fs.rmSync(destination, { force: true });
    throw new Error(
      `The voice model copied to ${destination} is not ${manifest.file} (size or SHA-256 differs).`,
    );
  }
  log(`voice model ok: ${manifest.bytes} ${manifest.sha256} (${destination})`);
  return destination;
}

const withVoiceModelFile = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const { projectRoot, platformProjectRoot, projectName } = config.modRequest;
      await placeModel(projectRoot, path.join(platformProjectRoot, projectName, manifest.file));
      return config;
    },
  ]);

/**
 * Whether the Xcode project copies `filepath` into the app: a file reference and a build file in
 * the app's "Copy Bundle Resources" phase.
 */
function copiesIntoApp(project, filepath) {
  const name = path.basename(filepath);
  const buildFiles = project.pbxBuildFileSection();
  const phase = project.pbxResourcesBuildPhaseObj();
  if (!project.hasFile(filepath) || !phase || !Array.isArray(phase.files)) return false;
  return phase.files.some(({ value }) => {
    const buildFile = buildFiles[value];
    return buildFile !== undefined && String(buildFile.fileRef_comment ?? '').includes(name);
  });
}

function addModelResource(project, projectName) {
  const filepath = path.join(projectName, manifest.file);
  const refuse = (detail) =>
    new Error(
      `The Xcode project does not copy ${filepath} into the app ("Copy Bundle Resources"): ` +
        `the app would ship without its voice model.${detail ? ` (${detail})` : ''}`,
    );
  if (!copiesIntoApp(project, filepath)) {
    try {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath,
        groupName: projectName,
        project,
        isBuildFile: true,
        verbose: false,
      });
    } catch (error) {
      throw refuse(error instanceof Error ? error.message : String(error));
    }
  }
  if (!copiesIntoApp(project, filepath)) throw refuse('');
  return project;
}

const withVoiceModelResource = (config) =>
  withXcodeProject(config, (config) => {
    addModelResource(config.modResults, config.modRequest.projectName);
    return config;
  });

module.exports = (config) => withVoiceModelResource(withVoiceModelFile(config));
// For the tests.
module.exports.download = download;
module.exports.placeModel = placeModel;
module.exports.addModelResource = addModelResource;
module.exports.copiesIntoApp = copiesIntoApp;
