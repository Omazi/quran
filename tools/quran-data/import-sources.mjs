/**
 * One-off helper: vendors the raw source files into tools/quran-data/sources.
 *
 *   node tools/quran-data/import-sources.mjs <folder with quran.json, tanzil_simple.json, qpages/>
 *
 * Each file is stored gzip-compressed and byte-for-byte unchanged once decompressed. The
 * SHA-256 of every original file is written to sources/SHA256SUMS; the build refuses any
 * source whose checksum differs. Origin and licence of each file: docs/DATA_SOURCES.md.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

import {
  CHECKSUM_FILE,
  COMPRESSED_SUFFIX,
  PAGE_LAYOUT_FOLDER,
  SOURCES_DIR,
  TANZIL_FILE,
  UTHMANI_FILE,
} from './lib/sources.mjs';

const [originDir] = process.argv.slice(2);
if (!originDir) {
  console.error('Usage: node tools/quran-data/import-sources.mjs <folder with the raw sources>');
  process.exit(1);
}

const pageFiles = readdirSync(join(originDir, PAGE_LAYOUT_FOLDER))
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => `${PAGE_LAYOUT_FOLDER}/${name}`);

const checksumLines = [];
for (const name of [...pageFiles, UTHMANI_FILE, TANZIL_FILE].sort()) {
  const original = readFileSync(join(originDir, name));
  const target = join(SOURCES_DIR, name + COMPRESSED_SUFFIX);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, gzipSync(original, { level: 9 }));
  checksumLines.push(`${createHash('sha256').update(original).digest('hex')}  ${name}`);
}
writeFileSync(join(SOURCES_DIR, CHECKSUM_FILE), checksumLines.join('\n') + '\n');

console.log(`Imported ${checksumLines.length} source files into ${SOURCES_DIR}`);
