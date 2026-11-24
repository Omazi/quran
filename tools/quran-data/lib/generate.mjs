/**
 * The whole generation, in memory: sources in, files of assets/data out. `build.mjs` writes
 * the result; `verify.mjs` compares it with what is on disk. Nothing is written here.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HizbQuarterList, JuzList, PageList, SajdaList, SurahList } from 'quran-meta/hafs';

import { alignLayoutWithText } from './align.mjs';
import { crossCheckTexts } from './cross-check.mjs';
import { readPageLayout } from './layout.mjs';
import { writeDataFiles } from './output.mjs';
import { readSources } from './sources.mjs';
import { buildStructure } from './structure.mjs';
import { readTanzilSource, readUthmaniSource } from './texts.mjs';

/** The licence notices shipped next to the data; the Tanzil part is checked in texts.mjs. */
const NOTICE_PATH = fileURLToPath(new URL('../NOTICE.txt', import.meta.url));

/** @returns {{ files: Map<string, string>, comparedWords: number }} */
export function generateQuranData(sourcesDir) {
  const sources = readSources(sourcesDir);
  const uthmani = readUthmaniSource(sources.uthmani);
  const tanzil = readTanzilSource(sources.tanzil);
  const layoutPages = sources.pages.map((raw, index) => readPageLayout(raw, index + 1));

  const alignment = alignLayoutWithText(layoutPages, uthmani);
  const comparedWords = crossCheckTexts(uthmani, tanzil);
  const quranMeta = { HizbQuarterList, JuzList, PageList, SajdaList, SurahList };
  const structure = buildStructure({ uthmani, tanzil, alignment, quranMeta });

  const files = writeDataFiles({
    uthmani,
    tanzil,
    alignment,
    structure,
    sourceChecksums: sources.checksums,
    notice: readFileSync(NOTICE_PATH, 'utf8'),
  });
  return { files, comparedWords };
}
