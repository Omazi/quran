/**
 * Checks and writes the garden pictures (docs/specs/garden-pictures.md, section 4).
 * Plain Node, no dependency. Every problem stops the tool with a `GardenPicturesError`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Elements of the garden: the pictures go from 0 to this many (`GARDEN_CATALOG.length`). */
export const ELEMENT_COUNT = 60;
export const FOLIAGE_STAGES = [0, 1, 2, 3];
export const WATER_LEVELS = [1, 2];
/** The first element is the channels: from it on, every picture has its water pictures. */
export const FIRST_COUNT_WITH_WATER = 1;
/**
 * Empty room kept around the pictures once cut, in pixels of the rendered size, the same on all
 * four sides: the set has to breathe a little, and a soft shadow must not be cut at its edge.
 */
export const CROP_MARGIN = 16;
/** Quality of the WebP written after the cut (the renders are quality 80): a little above, so that the second lossy encoding costs next to nothing, and the set stays near its former weight. */
export const CROP_QUALITY = 84;

export class GardenPicturesError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GardenPicturesError';
  }
}

export function fail(message) {
  throw new GardenPicturesError(message);
}

const two = (n) => String(n).padStart(2, '0');

export function baseFileName(count, foliage) {
  return `h${two(count)}-f${foliage}.webp`;
}
export function waterFileName(count, foliage, level) {
  return `h${two(count)}-f${foliage}-w${level}.webp`;
}

/** The names a complete set has, as `{ base: string[], water: string[] }`, sorted. */
export function expectedNames() {
  const base = [];
  const water = [];
  for (let count = 0; count <= ELEMENT_COUNT; count += 1) {
    for (const foliage of FOLIAGE_STAGES) {
      base.push(baseFileName(count, foliage));
      if (count >= FIRST_COUNT_WITH_WATER) {
        for (const level of WATER_LEVELS) water.push(waterFileName(count, foliage, level));
      }
    }
  }
  return { base: base.sort(), water: water.sort() };
}

function list(dir) {
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

/**
 * Reads the size and the alpha flag of a WebP file from its header. Supports the three layouts
 * of the format (VP8X, lossless VP8L, lossy VP8).
 */
export function readWebpHeader(bytes, name = 'file') {
  const isWebp =
    bytes.length >= 30 &&
    bytes.toString('latin1', 0, 4) === 'RIFF' &&
    bytes.toString('latin1', 8, 12) === 'WEBP';
  if (!isWebp) fail(`${name}: not a WebP file`);
  const chunk = bytes.toString('latin1', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3),
      hasAlpha: (bytes[20] & 0x10) !== 0,
    };
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff), hasAlpha: true };
  }
  if (chunk === 'VP8 ') {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
      hasAlpha: false,
    };
  }
  return fail(`${name}: unknown WebP layout "${chunk}"`);
}

/**
 * Checks a folder holding `base/` and `water/`: complete, nothing unexpected, every file a
 * WebP with an alpha channel, all of one size (the one given, when there is one: two pictures
 * overlay exactly only at the same size). Returns the sorted names of both folders and `size`.
 */
export function checkSet(root, expectedSize = null) {
  const expected = expectedNames();
  const problems = [];
  const found = { base: list(join(root, 'base')), water: list(join(root, 'water')) };
  for (const kind of ['base', 'water']) {
    const missing = expected[kind].filter((name) => !found[kind].includes(name));
    const extra = found[kind].filter((name) => !expected[kind].includes(name));
    if (missing.length > 0) {
      problems.push(
        `${kind}: ${missing.length} picture(s) missing, first: ${missing.slice(0, 5).join(', ')}`,
      );
    }
    if (extra.length > 0) {
      problems.push(
        `${kind}: ${extra.length} unexpected file(s), first: ${extra.slice(0, 5).join(', ')}`,
      );
    }
  }
  if (problems.length > 0) fail(`incomplete picture set in ${root}\n  ${problems.join('\n  ')}`);

  let size = expectedSize;
  for (const kind of ['base', 'water']) {
    for (const name of found[kind]) {
      const header = readWebpHeader(readFileSync(join(root, kind, name)), `${kind}/${name}`);
      size ??= { width: header.width, height: header.height };
      if (header.width !== size.width || header.height !== size.height) {
        fail(
          `${kind}/${name}: ${header.width}x${header.height}, expected ` +
            `${size.width}x${size.height}`,
        );
      }
      if (!header.hasAlpha)
        fail(`${kind}/${name}: no alpha channel (the picture must be transparent)`);
    }
  }
  return { ...found, size };
}

/**
 * The box that holds the pixels of every picture of the set: the union of the boxes of the
 * non-transparent pixels, `[left, top, right, bottom]` with the right and bottom edges excluded.
 * A picture with nothing in it (null) adds nothing; a set with nothing at all is an error.
 */
export function unionBounds(boxes) {
  const drawn = boxes.filter((box) => box !== null);
  if (drawn.length === 0) fail('every picture is empty: there is nothing to cut around');
  return [
    Math.min(...drawn.map((box) => box[0])),
    Math.min(...drawn.map((box) => box[1])),
    Math.max(...drawn.map((box) => box[2])),
    Math.max(...drawn.map((box) => box[3])),
  ];
}

/**
 * The box to cut every picture to: the union of what they draw, plus `margin` on each side. The
 * margin is the same on the four sides: when the pictures come closer than `margin` to an edge,
 * the margin shrinks to the smallest room there is, rather than cutting one side tighter.
 */
export function cropBox(union, size, margin = CROP_MARGIN) {
  const [left, top, right, bottom] = union;
  const room = Math.min(left, top, size.width - right, size.height - bottom);
  const even = Math.max(0, Math.min(margin, room));
  return [left - even, top - even, right + even, bottom + even];
}

const PIXELS = join(dirname(fileURLToPath(import.meta.url)), 'pixels.py');

function python(args) {
  const run = spawnSync('python3', ['-I', PIXELS, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  if (run.error || run.status !== 0) {
    fail(
      `cutting needs python3 with Pillow (pixels.py): ${run.error?.message ?? run.stderr.trim()}`,
    );
  }
  return run.stdout;
}

/** The box that holds what the set draws, and the size of the pictures it came from. */
export function setBounds(root) {
  const { size, files } = JSON.parse(python(['bounds', root]));
  return {
    size: { width: size[0], height: size[1] },
    union: unionBounds(Object.values(files)),
  };
}

/**
 * Cuts every picture of `source` to the one box (same size for all, so they still overlay
 * exactly) and writes them to `destination`. Returns the box and the new size.
 */
export function cropSet(source, destination, margin = CROP_MARGIN) {
  const { size, union } = setBounds(source);
  const box = cropBox(union, size, margin);
  python(['crop', source, destination, ...box.map(String), String(CROP_QUALITY)]);
  return { box, size: { width: box[2] - box[0], height: box[3] - box[1] } };
}

/** The TypeScript file the app loads: one static `require` per picture (Metro needs literals). */
export function tableSource(names, relativeAssetFolder, size) {
  const entries = (kind) =>
    names[kind]
      .map((file) => {
        const key = file.replace(/\.webp$/, '');
        return `  '${key}': require('${relativeAssetFolder}/${kind}/${file}'),`;
      })
      .join('\n');
  return `/* generated by tools/garden-pictures/build.mjs: do not edit by hand. */
/**
 * Every picture of the level-1 garden, as a static require. Metro needs the paths written out;
 * the tool writes them from the set it has checked (docs/specs/garden-pictures.md, section 4).
 */

/**
 * Size of every picture, in pixels. All the pictures have this size, cut to what the set draws
 * (a margin of ${CROP_MARGIN} pixels around it), so that two pictures overlay exactly.
 */
export const GARDEN_PICTURE_PIXELS = { width: ${size.width}, height: ${size.height} } as const;

/** What \`require\` gives for an image: an asset number. */
type PictureAsset = number;

/** The dry garden: \`hNN-fF\`, NN elements (00 to ${two(ELEMENT_COUNT)}), F foliage (0 to 3). */
export const GARDEN_BASE_ASSETS: Readonly<Record<string, PictureAsset>> = {
${entries('base')}
};

/** What the water changes, to lay over the dry garden: \`hNN-fF-wW\`, W 1 low, 2 flowing. */
export const GARDEN_WATER_ASSETS: Readonly<Record<string, PictureAsset>> = {
${entries('water')}
};
`;
}
