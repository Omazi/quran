/**
 * npm run data:verify — checks the files of assets/data without regenerating them.
 *
 *   node tools/quran-data/verify.mjs [--sources <folder>] [--data <folder>]
 *
 * Three independent questions:
 *   1. Do the files on disk respect the invariants of docs/specs/quran.md? These checks
 *      read the generated files only and share no code with the build.
 *   2. Is the text on disk, character for character, the text of the sources?
 *   3. Are the files exactly what the build would write today (nothing edited by hand)?
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { fail, runCommand } from './lib/fail.mjs';
import { generateQuranData } from './lib/generate.mjs';
import { DATA_DIR } from './lib/output.mjs';
import { readSources, sha256, SOURCES_DIR } from './lib/sources.mjs';

const EXPECTED = Object.freeze({ surahs: 114, verses: 6236, pages: 604, juz: 30, hizb: 60 });
const LINES_PER_PAGE = 15;
const LINES_ON_OPENING_PAGES = 8;
const OPENING_PAGES = [1, 2];
const SURAHS_WITHOUT_BASMALA_LINE = [1, 9];
const HIZB_PER_JUZ = 2;

function check(condition, message) {
  if (!condition) fail(message);
}

function listFiles(dir, folder = '') {
  const names = [];
  for (const entry of readdirSync(join(dir, folder), { withFileTypes: true })) {
    const relative = folder === '' ? entry.name : `${folder}/${entry.name}`;
    if (entry.isDirectory()) names.push(...listFiles(dir, relative));
    else names.push(relative);
  }
  return names.sort();
}

function readJson(dataDir, name) {
  try {
    return JSON.parse(readFileSync(join(dataDir, name), 'utf8'));
  } catch (error) {
    return fail(`${name} cannot be read as JSON (${error.message})`);
  }
}

/** The files on disk must be the ones listed in integrity.json, each with its checksum. */
function checkFileChecksums(dataDir) {
  check(existsSync(join(dataDir, 'integrity.json')), `No integrity.json in ${dataDir}`);
  const integrity = readJson(dataDir, 'integrity.json');
  check(
    typeof integrity.files === 'object' && integrity.files !== null,
    'integrity.json does not list the generated files',
  );

  const expectedFiles = [...Object.keys(integrity.files), 'integrity.json'].sort();
  const actualFiles = listFiles(dataDir);
  check(
    actualFiles.join() === expectedFiles.join(),
    `Files in ${dataDir} are not the ones listed in integrity.json:\n` +
      `  on disk: ${actualFiles.filter((name) => !expectedFiles.includes(name))}\n` +
      `  missing: ${expectedFiles.filter((name) => !actualFiles.includes(name))}`,
  );
  for (const [name, expected] of Object.entries(integrity.files)) {
    check(
      sha256(readFileSync(join(dataDir, name))) === expected,
      `${name} does not match its checksum`,
    );
  }
  return integrity;
}

function readData(dataDir, integrity) {
  const pages = [];
  for (const name of Object.keys(integrity.files).filter((file) => file.startsWith('pages/'))) {
    const file = readJson(dataDir, name);
    check(file.pages.length <= integrity.pagesPerFile, `${name}: too many pages`);
    check(file.firstPage === file.pages[0].page, `${name}: firstPage does not match its pages`);
    check(file.lastPage === file.pages.at(-1).page, `${name}: lastPage does not match its pages`);
    pages.push(...file.pages);
  }
  return {
    integrity,
    pages,
    structure: readJson(dataDir, 'structure.json'),
    uthmani: readJson(dataDir, 'verses/uthmani.json'),
    uthmaniMinimal: readJson(dataDir, 'verses/uthmani-minimal.json'),
  };
}

function canonicalText(verses) {
  let text = '';
  for (let surah = 1; surah <= EXPECTED.surahs; surah += 1) {
    verses[surah].forEach((verseText, index) => {
      text += `${surah}|${index + 1}|${verseText}\n`;
    });
  }
  return text;
}

function checkCountsAndFingerprints({ integrity, pages, structure, uthmani, uthmaniMinimal }) {
  for (const [name, verses] of Object.entries({ uthmani, uthmaniMinimal })) {
    check(Object.keys(verses).length === EXPECTED.surahs, `${name}: not ${EXPECTED.surahs} surahs`);
    const verseCount = Object.values(verses).reduce((total, list) => total + list.length, 0);
    check(verseCount === EXPECTED.verses, `${name}: ${verseCount} verses`);
    structure.surahs.forEach((info) => {
      check(
        verses[info.surah].length === info.verseCount,
        `${name}: surah ${info.surah} does not have ${info.verseCount} verses`,
      );
    });
    check(
      sha256(canonicalText(verses)) === integrity.canonicalText[`${name}Sha256`],
      `The fingerprint of the ${name} text is not the one recorded in integrity.json`,
    );
  }
  check(structure.surahs.length === EXPECTED.surahs, 'structure: wrong number of surahs');
  check(pages.length === EXPECTED.pages, `${pages.length} pages`);
  check(structure.pageStarts.length === EXPECTED.pages, 'structure: wrong number of page starts');
  check(structure.juzStarts.length === EXPECTED.juz, 'structure: wrong number of juz');
  check(structure.hizbStarts.length === EXPECTED.hizb, 'structure: wrong number of hizb');
  for (const [name, expected] of Object.entries(EXPECTED)) {
    check(integrity.counts[name] === expected, `integrity.json: counts.${name} is not ${expected}`);
  }
}

/**
 * Walks the pages in reading order next to the text. Every word of every verse must come
 * exactly once, in order; rebuilding each verse from the page words must give its text.
 * @returns {string[]} key of the first verse of each page
 */
function checkPagesCoverTheText({ integrity, pages, structure, uthmani }) {
  const pageStarts = [];
  let placedWords = 0;
  let lineCount = 0;
  let surah = 1;
  let verse = 1;
  let nextWord = 1;
  let wordsOfVerse = uthmani[1][0].split(' ');
  let rebuiltWords = [];
  let headerSeenFor = 0;
  let basmalaSeenFor = 0;

  const closeVerse = (where) => {
    check(
      rebuiltWords.join(' ') === uthmani[surah][verse - 1],
      `${where}: ${surah}:${verse} differs`,
    );
    if (verse < uthmani[surah].length) verse += 1;
    else {
      surah += 1;
      verse = 1;
    }
    nextWord = 1;
    rebuiltWords = [];
    wordsOfVerse = uthmani[surah]?.[verse - 1].split(' ');
  };

  pages.forEach((page, pageIndex) => {
    check(page.page === pageIndex + 1, `Page ${pageIndex + 1} is numbered ${page.page}`);
    const expectedLines = OPENING_PAGES.includes(page.page)
      ? LINES_ON_OPENING_PAGES
      : LINES_PER_PAGE;
    check(
      page.lines.length <= LINES_PER_PAGE,
      `Page ${page.page}: more than ${LINES_PER_PAGE} lines`,
    );
    check(page.lines.length === expectedLines, `Page ${page.page}: ${page.lines.length} lines`);
    check(page.lines.at(-1).words !== undefined, `Page ${page.page}: ends with a header`);

    let pageHasText = false;
    lineCount += page.lines.length;
    page.lines.forEach((line, lineIndex) => {
      const where = `Page ${page.page}, line ${lineIndex + 1}`;
      const atSurahStart = verse === 1 && nextWord === 1;
      if (line.header !== undefined) {
        check(atSurahStart && line.header === surah, `${where}: misplaced header`);
        headerSeenFor = line.header;
        return;
      }
      if (line.basmala !== undefined) {
        check(atSurahStart && line.basmala === surah, `${where}: misplaced basmala`);
        check(headerSeenFor === surah, `${where}: basmala before its header`);
        check(!SURAHS_WITHOUT_BASMALA_LINE.includes(surah), `${where}: unexpected basmala`);
        basmalaSeenFor = line.basmala;
        return;
      }

      check(Array.isArray(line.words) && line.words.length > 0, `${where}: empty text line`);
      if (!pageHasText) {
        check(nextWord === 1, `${where}: the page starts inside verse ${surah}:${verse}`);
        pageStarts.push(`${surah}:${verse}`);
        pageHasText = true;
      }
      for (const [segmentVerse, first, last] of line.words) {
        check(wordsOfVerse !== undefined, `${where}: words after the last verse`);
        check(
          line.surah === surah && segmentVerse === verse && first === nextWord,
          `${where}: expected ${surah}:${verse} word ${nextWord}, ` +
            `found ${line.surah}:${segmentVerse} word ${first} (a word is skipped or repeated)`,
        );
        check(
          last >= first && last <= wordsOfVerse.length,
          `${where}: no such word in ${surah}:${verse}`,
        );
        if (verse === 1 && first === 1) {
          check(headerSeenFor === surah, `${where}: surah ${surah} has no header`);
          const needsBasmala = !SURAHS_WITHOUT_BASMALA_LINE.includes(surah);
          check(
            !needsBasmala || basmalaSeenFor === surah,
            `${where}: surah ${surah} has no basmala`,
          );
        }
        rebuiltWords.push(...wordsOfVerse.slice(first - 1, last));
        placedWords += last - first + 1;
        nextWord = last + 1;
        if (nextWord > wordsOfVerse.length) closeVerse(where);
      }
    });
  });

  check(surah === EXPECTED.surahs + 1, `The pages stop at ${surah}:${verse}, before the end`);
  check(placedWords === integrity.counts.uthmaniWords, `${placedWords} words on the pages`);
  check(lineCount === integrity.counts.lines, `${lineCount} lines on the pages`);
  check(
    pageStarts.join() === structure.pageStarts.join(),
    'structure.pageStarts differ from the pages',
  );
  return pageStarts;
}

function checkJuzAndHizb({ structure }, pageStarts) {
  const surahOffsets = [];
  let offset = 0;
  for (const info of structure.surahs) {
    surahOffsets[info.surah] = offset;
    offset += info.verseCount;
  }
  const verseNumber = (key) => {
    const [surah, verse] = key.split(':').map(Number);
    const info = structure.surahs[surah - 1];
    check(info !== undefined && verse >= 1 && verse <= info.verseCount, `No such verse: ${key}`);
    return surahOffsets[surah] + verse;
  };
  const pageOfVerseNumber = (number) =>
    pageStarts.findLastIndex((key) => verseNumber(key) <= number) + 1;

  const hizbStarts = structure.hizbStarts.map(verseNumber);
  check(hizbStarts[0] === 1, 'Hizb 1 does not start at 1:1');
  hizbStarts.forEach((start, index) => {
    check(
      index === 0 || start > hizbStarts[index - 1],
      `Hizb ${index + 1} does not follow hizb ${index}`,
    );
  });
  structure.juzStarts.forEach((key, index) => {
    check(
      key === structure.hizbStarts[index * HIZB_PER_JUZ],
      `Juz ${index + 1} does not start a hizb`,
    );
  });

  // Page ranges of the hizb: no gap from page 1 to 604, neighbours share at most one page.
  let previousLastPage = 0;
  hizbStarts.forEach((start, index) => {
    const firstPage = pageOfVerseNumber(start);
    const endOfHizb = index + 1 < hizbStarts.length ? hizbStarts[index + 1] - 1 : EXPECTED.verses;
    const lastPage = pageOfVerseNumber(endOfHizb);
    check(
      firstPage === previousLastPage || firstPage === previousLastPage + 1,
      `Hizb ${index + 1} starts on page ${firstPage}, the previous one ends on page ${previousLastPage}`,
    );
    check(lastPage >= firstPage, `Hizb ${index + 1} ends before it starts`);
    previousLastPage = lastPage;
  });
  check(
    previousLastPage === EXPECTED.pages,
    `Hizb ${EXPECTED.hizb} ends on page ${previousLastPage}`,
  );
}

/**
 * The verse as stored must be the verse as the publisher prints it in `aya_text`, minus the
 * two documented removals: the no-break space and verse number at the end, and the no-break
 * space after the hizb sign. Written here a second time, on purpose, without the build's code.
 */
function publishedVerseText(printed) {
  return printed.replace(/\u00A0[\u0660-\u0669]+$/u, '').replace(/^\u06DE\u00A0/u, '\u06DE');
}

/** The text on disk must be the text of the sources, character for character. */
function checkTextIsTheSourceText({ integrity, uthmani, uthmaniMinimal }, sources) {
  check(sources.uthmani.length === EXPECTED.verses, 'The Uthmani source does not have 6236 rows');
  sources.uthmani.forEach((row) => {
    const key = `${row.sora}:${row.aya_no}`;
    check(
      uthmani[row.sora]?.[row.aya_no - 1] === publishedVerseText(row.aya_text),
      `Uthmani ${key} differs from its source`,
    );
  });
  sources.tanzil.surahs.forEach((surah) => {
    surah.ayat.forEach((ayah) => {
      const key = `${surah.id}:${ayah.id}`;
      check(
        uthmaniMinimal[surah.id]?.[ayah.id - 1] === ayah.text,
        `Uthmani-minimal ${key} differs from its source`,
      );
    });
  });
  for (const name of ['hafsData_v18.json', 'tanzil_simple.json']) {
    check(
      integrity.sources[name] === sources.checksums[name],
      `integrity.json was not generated from the current ${name}`,
    );
  }
}

function checkFilesAreWhatTheBuildWrites(sourcesDir, dataDir) {
  const { files } = generateQuranData(sourcesDir);
  for (const [name, content] of files) {
    check(
      readFileSync(join(dataDir, name), 'utf8') === content,
      `${name} is not what data:build generates from the sources. ` +
        'Generated files are never edited: run "npm run data:build".',
    );
  }
}

runCommand('data:verify', () => {
  const { values } = parseArgs({
    options: { sources: { type: 'string' }, data: { type: 'string' } },
  });
  const dataDir = values.data ?? DATA_DIR;
  const sourcesDir = values.sources ?? SOURCES_DIR;

  const integrity = checkFileChecksums(dataDir);
  const data = readData(dataDir, integrity);
  checkCountsAndFingerprints(data);
  const pageStarts = checkPagesCoverTheText(data);
  checkJuzAndHizb(data, pageStarts);
  checkTextIsTheSourceText(data, readSources(sourcesDir));
  checkFilesAreWhatTheBuildWrites(sourcesDir, dataDir);

  const { counts, canonicalText: fingerprints } = data.integrity;
  console.log(
    [
      `data:verify passed for ${dataDir}`,
      `  ${counts.surahs} surahs, ${counts.verses} verses, ${counts.pages} pages, ` +
        `${counts.juz} juz, ${counts.hizb} hizb`,
      `  ${counts.uthmaniWords} Uthmani words placed exactly once on ${counts.lines} lines; ` +
        'every verse rebuilt from its page words equals its text',
      '  both texts identical to their sources; every file matches its checksum and the build',
      `  Uthmani text SHA-256 ${fingerprints.uthmaniSha256}`,
      `  Uthmani-minimal text SHA-256 ${fingerprints.uthmaniMinimalSha256}`,
    ].join('\n'),
  );
});
