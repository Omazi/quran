/**
 * Turns the checked data into the files of assets/data. The same input always gives the
 * same bytes: no date, no machine-dependent order, one fixed way of writing each file.
 */
import { fileURLToPath } from 'node:url';

import { PAGE_LAYOUT_FOLDER, sha256, TANZIL_FILE, UTHMANI_FILE } from './sources.mjs';
import { HIZB_COUNT, JUZ_COUNT, PAGE_COUNT } from './structure.mjs';
import { forEachVerse, splitWords, SURAH_COUNT, VERSE_COUNT } from './texts.mjs';

export const DATA_DIR = fileURLToPath(new URL('../../../assets/data', import.meta.url));
export const FORMAT_VERSION = 1;
export const PAGES_PER_FILE = 20;
export const INTEGRITY_FILE = 'integrity.json';
export const STRUCTURE_FILE = 'structure.json';
export const UTHMANI_VERSES_FILE = 'verses/uthmani.json';
export const UTHMANI_MINIMAL_VERSES_FILE = 'verses/uthmani-minimal.json';
export const NOTICE_FILE = 'NOTICE.txt';
export const CANONICAL_TEXT_FORMAT =
  'UTF-8, one line "<surah>|<verse>|<text>\\n" per verse, the 6236 verses in reading order';

const PAGE_NUMBER_DIGITS = 3;

export function pagesFileName(firstPage, lastPage) {
  const pad = (page) => String(page).padStart(PAGE_NUMBER_DIGITS, '0');
  return `pages/pages-${pad(firstPage)}-${pad(lastPage)}.json`;
}

/** The text that integrity.json fingerprints. src/domain/quran/integrity.ts builds the same. */
export function canonicalText(verses) {
  let text = '';
  forEachVerse(verses, (surah, verse, verseText) => {
    text += `${surah}|${verse}|${verseText}\n`;
  });
  return text;
}

function countWords(verses) {
  let count = 0;
  forEachVerse(verses, (_surah, _verse, text) => {
    count += splitWords(text).length;
  });
  return count;
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

/** { "1": [verses], ..., "114": [verses] } with one verse per line, to keep diffs readable. */
function versesJson(verses) {
  const surahBlocks = verses.map((surahVerses, index) => {
    const lines = surahVerses.map((text) => JSON.stringify(text)).join(',\n');
    return `"${index + 1}": [\n${lines}\n]`;
  });
  return `{\n${surahBlocks.join(',\n')}\n}\n`;
}

/** { firstPage, lastPage, pages: [...] } with one page per line. */
function pagesJson(pages) {
  const lines = pages.map((page) => JSON.stringify(page)).join(',\n');
  return `{\n"firstPage": ${pages[0].page},\n"lastPage": ${pages.at(-1).page},\n"pages": [\n${lines}\n]\n}\n`;
}

/** SHA-256 of the "<sha256>  <name>" lines of the page layout files, as in SHA256SUMS. */
function pageLayoutChecksum(sourceChecksums) {
  const lines = Object.entries(sourceChecksums)
    .filter(([name]) => name.startsWith(`${PAGE_LAYOUT_FOLDER}/`))
    .map(([name, checksum]) => `${checksum}  ${name}\n`);
  return sha256(lines.join(''));
}

/** @returns {Map<string, string>} file path inside assets/data -> content. */
export function writeDataFiles({ uthmani, tanzil, alignment, structure, sourceChecksums, notice }) {
  const files = new Map();
  files.set(UTHMANI_VERSES_FILE, versesJson(uthmani.verses));
  files.set(UTHMANI_MINIMAL_VERSES_FILE, versesJson(tanzil.verses));
  files.set(NOTICE_FILE, notice);
  files.set(STRUCTURE_FILE, prettyJson(structure));
  for (let first = 0; first < alignment.pages.length; first += PAGES_PER_FILE) {
    const pages = alignment.pages.slice(first, first + PAGES_PER_FILE);
    files.set(pagesFileName(pages[0].page, pages.at(-1).page), pagesJson(pages));
  }

  const integrity = {
    formatVersion: FORMAT_VERSION,
    counts: {
      surahs: SURAH_COUNT,
      verses: VERSE_COUNT,
      pages: PAGE_COUNT,
      juz: JUZ_COUNT,
      hizb: HIZB_COUNT,
      lines: alignment.pages.reduce((total, page) => total + page.lines.length, 0),
      uthmaniWords: countWords(uthmani.verses),
      uthmaniMinimalWords: countWords(tanzil.verses),
    },
    pagesPerFile: PAGES_PER_FILE,
    canonicalText: {
      format: CANONICAL_TEXT_FORMAT,
      uthmaniSha256: sha256(canonicalText(uthmani.verses)),
      uthmaniMinimalSha256: sha256(canonicalText(tanzil.verses)),
    },
    files: Object.fromEntries(
      [...files.keys()].sort().map((name) => [name, sha256(files.get(name))]),
    ),
    sources: {
      [UTHMANI_FILE]: sourceChecksums[UTHMANI_FILE],
      [TANZIL_FILE]: sourceChecksums[TANZIL_FILE],
      [PAGE_LAYOUT_FOLDER]: pageLayoutChecksum(sourceChecksums),
    },
  };
  files.set(INTEGRITY_FILE, prettyJson(integrity));
  return files;
}
