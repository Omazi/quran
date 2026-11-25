/**
 * npm run garden:build  : copies the rendered garden pictures into the app, checks them, writes
 *                         the table the app loads and the NOTICE.
 * npm run garden:verify : checks what is in the repository, without the source.
 *
 *   node tools/garden-pictures/build.mjs [--source <folder with base/ and water/>] [--verify]
 *
 * An incomplete set stops the tool before anything is written.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { checkSet, fail, GardenPicturesError, tableSource } from './lib.mjs';
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
  const names = checkSet(values.verify ? ASSETS : values.source);
  console.log(`checked: ${names.base.length} base pictures, ${names.water.length} water pictures`);

  const table = tableSource(names, relative(dirname(TABLE), ASSETS).split('\\').join('/'));
  const notice = noticeText();
  if (values.verify) {
    if (!existsSync(TABLE) || readFileSync(TABLE, 'utf8') !== table) {
      fail(`${relative(ROOT, TABLE)} is not what the pictures give: run npm run garden:build`);
    }
    if (!existsSync(NOTICE) || readFileSync(NOTICE, 'utf8') !== notice) {
      fail(`${relative(ROOT, NOTICE)} is out of date: run npm run garden:build`);
    }
    console.log('verified: pictures, table and notice agree');
    return;
  }

  for (const kind of ['base', 'water']) {
    rmSync(join(ASSETS, kind), { recursive: true, force: true });
    mkdirSync(join(ASSETS, kind), { recursive: true });
    for (const file of names[kind]) {
      cpSync(join(values.source, kind, file), join(ASSETS, kind, file));
    }
  }
  writeFileSync(TABLE, table);
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
