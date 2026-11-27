/**
 * The packs of the level gardens (docs/specs/garden-levels.md, D46): levels 2 to 7 are not in
 * the app (about 25 MB each with their pictures); the app downloads the pack of a level when it
 * needs it, checks its SHA-256 and unpacks it.
 *
 *   node tools/garden-3d/pack.mjs           : packs dist/garden-art/level-N (garden.glb from
 *       bake.py, base/ and water/ from render.py, grow/ and sprites.json from
 *       tools/garden-pictures/growth-sprites.py --level N) into dist/garden-art/level-N.gardenpack
 *       and writes their sizes and SHA-256 into src/data/garden-art/garden-art.json.
 *   node tools/garden-3d/pack.mjs --verify  : checks the manifest, and the packs against it when
 *       they are in dist/garden-art (npm run garden:verify).
 *
 * The packs are published on the branch `garden-art` of the owner's repository, as the voice model
 * is on `voice-model` (D42): their address is in the manifest.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { decodeHeader, encodePack, webpSize } from './lib/pack.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(ROOT, 'dist', 'garden-art');
const MANIFEST = join(ROOT, 'src', 'data', 'garden-art', 'garden-art.json');
const LEVELS = [2, 3, 4, 5, 6, 7];
const SIZE = { width: 1170, height: 816 };
// raw.githubusercontent.com first: github.com/raw answered 504 through some proxies (same as the voice model).
const HOSTS = [
  'https://raw.githubusercontent.com/Omazi/quran/garden-art/',
  'https://github.com/Omazi/quran/raw/garden-art/',
];

const fail = (message) => {
  throw new Error(message);
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function pictures(folder, kind, pattern) {
  const dir = join(folder, kind);
  if (!existsSync(dir)) fail(`${relative(ROOT, dir)} is missing`);
  const names = readdirSync(dir)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => f.slice(0, -5))
    .sort();
  for (const name of names) {
    if (!pattern.test(name)) fail(`${kind}/${name}.webp is not a name of the set`);
  }
  return names;
}

/** The files of a level, checked: the model, every picture of the set, the sprites. */
function levelFiles(level) {
  const folder = join(DIST, `level-${level}`);
  const layout = JSON.parse(
    readFileSync(
      join(ROOT, 'tools', 'garden-3d', 'source', `level-${level}`, 'layout.json'),
      'utf8',
    ),
  );
  const model = readFileSync(join(folder, 'garden.glb'));
  if (model.toString('ascii', 0, 4) !== 'glTF') fail(`level ${level}: garden.glb is not a GLB`);
  const base = pictures(folder, 'base', /^h(\d\d)-f[0-3]$/);
  for (let n = 0; n <= 60; n += 1) {
    for (let f = 0; f < 4; f += 1) {
      const name = `h${String(n).padStart(2, '0')}-f${f}`;
      if (!base.includes(name)) fail(`level ${level}: base/${name}.webp is missing`);
    }
  }
  const water = pictures(folder, 'water', /^h(\d\d)-f[0-3]-w[12]$/);
  const grow = pictures(folder, 'grow', /^e(\d\d)$/);
  const sprites = JSON.parse(readFileSync(join(folder, 'sprites.json'), 'utf8'));
  for (const [hizb, sprite] of Object.entries(sprites)) {
    if (!grow.includes(sprite.name)) fail(`level ${level}: sprite of hizb ${hizb} has no picture`);
  }
  const files = [{ path: 'garden.glb', bytes: model }];
  for (const [kind, names] of [
    ['base', base],
    ['water', water],
    ['grow', grow],
  ]) {
    for (const name of names) {
      const bytes = readFileSync(join(folder, kind, `${name}.webp`));
      const size = webpSize(bytes);
      if (kind !== 'grow' && (size?.width !== SIZE.width || size?.height !== SIZE.height)) {
        fail(`level ${level}: ${kind}/${name}.webp is ${size?.width}x${size?.height}`);
      }
      files.push({ path: `${kind}/${name}.webp`, bytes });
    }
  }
  const index = { level, style: layout.style, size: SIZE, base, water, sprites };
  files.unshift({ path: 'index.json', bytes: Buffer.from(JSON.stringify(index), 'ascii') });
  // Where the models come from and under which licence (CC0), with the garden itself.
  files.push({
    path: 'notice.txt',
    bytes: readFileSync(join(ROOT, 'assets', 'models', 'garden', 'NOTICE.txt')),
  });
  return { files, style: layout.style };
}

function manifestOf(levels) {
  return {
    about:
      'The packs of the level gardens (tools/garden-3d/pack.mjs, docs/specs/garden-levels.md): ' +
      'downloaded when a level is needed, checked against sha256. Generated: do not edit by hand.',
    format: 1,
    levels,
  };
}

function build() {
  const levels = {};
  for (const level of LEVELS) {
    const { files, style } = levelFiles(level);
    const pack = encodePack(level, files);
    const file = `level-${level}.gardenpack`;
    writeFileSync(join(DIST, file), pack);
    levels[level] = {
      style,
      file,
      bytes: pack.length,
      sha256: sha256(pack),
      urls: HOSTS.map((host) => host + file),
    };
    console.log(`level ${level}: ${files.length} files, ${(pack.length / 1e6).toFixed(1)} MB`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifestOf(levels), null, 2) + '\n');
  console.log(`wrote ${relative(ROOT, MANIFEST)}`);
}

function verify() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  if (manifest.format !== 1) fail('garden-art.json: unknown format');
  for (const level of LEVELS) {
    const entry = manifest.levels[level];
    if (!entry) fail(`garden-art.json: level ${level} is missing`);
    if (!/^[0-9a-f]{64}$/.test(entry.sha256)) fail(`garden-art.json: level ${level} has no sha256`);
    if (!entry.urls.every((u) => u.startsWith('https://'))) fail(`level ${level}: not https`);
    const path = join(DIST, entry.file);
    if (!existsSync(path)) {
      console.log(`level ${level}: ${entry.file} not built here, manifest only`);
      continue;
    }
    const pack = readFileSync(path);
    if (pack.length !== entry.bytes || sha256(pack) !== entry.sha256) {
      fail(
        `level ${level}: ${entry.file} does not match garden-art.json: run node tools/garden-3d/pack.mjs`,
      );
    }
    const { header } = decodeHeader(pack);
    if (header.level !== level || !header.files.some((f) => f.path === 'garden.glb')) {
      fail(`level ${level}: the pack holds another garden`);
    }
    console.log(`level ${level}: ${entry.file} matches (${header.files.length} files)`);
  }
}

try {
  const { values } = parseArgs({ options: { verify: { type: 'boolean' } } });
  if (values.verify) verify();
  else build();
} catch (error) {
  console.error(`garden packs failed: ${error.message}`);
  process.exitCode = 1;
}
