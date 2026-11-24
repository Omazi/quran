/**
 * npm run data:build — regenerates every file of assets/data from the vendored sources.
 *
 *   node tools/quran-data/build.mjs [--sources <folder>] [--out <folder>]
 *
 * Deterministic: two runs give identical files. If anything in the sources cannot be
 * explained, the build stops with a message and writes nothing. See docs/DATA_SOURCES.md.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import { fail, runCommand } from './lib/fail.mjs';
import { generateQuranData } from './lib/generate.mjs';
import { DATA_DIR, INTEGRITY_FILE } from './lib/output.mjs';
import { SOURCES_DIR } from './lib/sources.mjs';

/** Empties the output folder, but only if it is recognisably a previous output. */
function resetOutputFolder(outDir) {
  if (existsSync(outDir)) {
    const isEmpty = readdirSync(outDir).length === 0;
    if (!isEmpty && !existsSync(join(outDir, INTEGRITY_FILE))) {
      fail(`${outDir} is not empty and has no ${INTEGRITY_FILE}: refusing to replace it`);
    }
    rmSync(outDir, { recursive: true });
  }
  mkdirSync(outDir, { recursive: true });
}

runCommand('data:build', () => {
  const { values } = parseArgs({
    options: { sources: { type: 'string' }, out: { type: 'string' } },
  });
  const outDir = values.out ?? DATA_DIR;

  const { files, comparedWords } = generateQuranData(values.sources ?? SOURCES_DIR);

  resetOutputFolder(outDir);
  for (const [name, content] of files) {
    mkdirSync(dirname(join(outDir, name)), { recursive: true });
    writeFileSync(join(outDir, name), content);
  }
  console.log(
    `data:build wrote ${files.size} files to ${outDir} ` +
      `(${comparedWords} words placed and cross-checked between the two texts).`,
  );
});
