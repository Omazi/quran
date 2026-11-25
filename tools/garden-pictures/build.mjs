/**
 * npm run garden:build  : cuts the rendered garden pictures to what the whole set draws (one box
 *                         for all, so they still overlay exactly), copies them into the app,
 *                         checks them, writes the table the app loads and the NOTICE.
 *                         Needs python3 with Pillow (pixels.py).
 * npm run garden:verify : checks what is in the repository, without the source.
 *
 *   node tools/garden-pictures/build.mjs [--source <folder with base/ and water/>] [--verify]
 *
 * An incomplete set stops the tool before anything is written.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { checkSet, cropSet, fail, GardenPicturesError, tableSource } from './lib.mjs';
import { noticeText } from './notice.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_SOURCE = '/home/claude/gen/garden3d/app/level-1';
const ASSETS = join(ROOT, 'assets', 'images', 'garden', 'level-1');
const TABLE = join(ROOT, 'src', 'features', 'garden', 'garden-images.generated.ts');
const NOTICE = join(ROOT, 'assets', 'images', 'garden', 'NOTICE.txt');

function run() {
  const { values } = parseArgs({
    options: { source: { type: 'string', default: DEFAULT_SOURCE }, verify: { type: 'boolean' } },
  });
  const checked = checkSet(values.verify ? ASSETS : values.source);
  console.log(
    `checked: ${checked.base.length} base pictures, ${checked.water.length} water pictures`,
  );

  const writeTable = (size) =>
    tableSource(checked, relative(dirname(TABLE), ASSETS).split('\\').join('/'), size);
  const notice = noticeText();
  if (values.verify) {
    const table = writeTable(checked.size);
    if (!existsSync(TABLE) || readFileSync(TABLE, 'utf8') !== table) {
      fail(`${relative(ROOT, TABLE)} is not what the pictures give: run npm run garden:build`);
    }
    if (!existsSync(NOTICE) || readFileSync(NOTICE, 'utf8') !== notice) {
      fail(`${relative(ROOT, NOTICE)} is out of date: run npm run garden:build`);
    }
    console.log(
      `verified: pictures (${checked.size.width}x${checked.size.height}), table and notice agree`,
    );
    return;
  }

  // Cut into a temporary folder, check the result, and only then replace what the app holds.
  const work = mkdtempSync(join(tmpdir(), 'garden-cut-'));
  try {
    const { box, size } = cropSet(values.source, work);
    checkSet(work, size);
    console.log(`cut to [${box.join(', ')}]: ${size.width}x${size.height} for every picture`);
    for (const kind of ['base', 'water']) {
      rmSync(join(ASSETS, kind), { recursive: true, force: true });
      mkdirSync(ASSETS, { recursive: true });
      cpSync(join(work, kind), join(ASSETS, kind), { recursive: true });
    }
    writeFileSync(TABLE, writeTable(size));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  writeFileSync(NOTICE, notice);
  console.log(
    `wrote ${relative(ROOT, ASSETS)}, ${relative(ROOT, TABLE)}, ${relative(ROOT, NOTICE)}`,
  );
}

try {
  run();
} catch (error) {
  if (!(error instanceof GardenPicturesError)) throw error;
  console.error(`garden-pictures failed: ${error.message}`);
  process.exitCode = 1;
}
