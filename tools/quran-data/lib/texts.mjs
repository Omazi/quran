/**
 * Reads the two verse sources into one simple shape, without changing a single character:
 *
 *   { surahs: [{ surah, nameArabic, nameTransliterated, verseCount, revelationPlace }],
 *     verses: string[][] }            verses[surah - 1][verse - 1]
 */
import { THIN_SPACE, VERSES_WITH_THIN_SPACE_INSIDE_A_WORD, WORD_SEPARATOR } from './declared.mjs';
import { fail } from './fail.mjs';

export const SURAH_COUNT = 114;
export const VERSE_COUNT = 6236;

const REVELATION_PLACES = ['meccan', 'medinan'];

/**
 * The notice carried by the Tanzil file. tools/quran-data/NOTICE.txt repeats it next to the
 * generated data: if the file ever says something else, the build stops.
 */
const TANZIL_NOTICE = Object.freeze({
  source: 'Tanzil Project - https://tanzil.net',
  version: '1.1',
  copyright: 'Copyright (C) 2007-2025 Tanzil Project',
  license: 'Creative Commons Attribution 3.0',
});
const OTHER_WHITESPACE = /[^\S ]/gu;

export function verseKey(surah, verse) {
  return `${surah}:${verse}`;
}

export function splitWords(text) {
  return text.split(WORD_SEPARATOR);
}

/** Calls `visit(surah, verse, text)` for the 6236 verses in reading order. */
export function forEachVerse(verses, visit) {
  verses.forEach((surahVerses, surahIndex) => {
    surahVerses.forEach((text, verseIndex) => visit(surahIndex + 1, verseIndex + 1, text));
  });
}

/**
 * Words must be separated by exactly one U+0020, otherwise word positions are ambiguous.
 * Any other white space must be declared (the build never guesses how to split a word).
 */
function assertWordSeparation(sourceName, verses, versesWithThinSpace) {
  const found = [];
  forEachVerse(verses, (surah, verse, text) => {
    const key = verseKey(surah, verse);
    if (typeof text !== 'string' || text === '') fail(`${sourceName} ${key}: empty verse`);
    if (splitWords(text).includes('')) {
      fail(`${sourceName} ${key}: leading, trailing or double space in "${text}"`);
    }
    const others = text.match(OTHER_WHITESPACE) ?? [];
    if (others.some((character) => character !== THIN_SPACE)) {
      fail(`${sourceName} ${key}: unexpected white-space character in "${text}"`);
    }
    if (others.length > 0) found.push(key);
  });

  if (found.join() !== versesWithThinSpace.join()) {
    fail(
      `${sourceName}: verses with a thin space inside a word are [${found}], ` +
        `but [${versesWithThinSpace}] are declared in declared.mjs`,
    );
  }
}

function assertCounts(sourceName, surahs, verses) {
  if (surahs.length !== SURAH_COUNT) {
    fail(`${sourceName}: expected ${SURAH_COUNT} surahs, found ${surahs.length}`);
  }
  let total = 0;
  surahs.forEach((info, index) => {
    if (info.surah !== index + 1)
      fail(`${sourceName}: surah ${index + 1} is numbered ${info.surah}`);
    if (!REVELATION_PLACES.includes(info.revelationPlace)) {
      fail(`${sourceName}: surah ${info.surah} has revelation place "${info.revelationPlace}"`);
    }
    if (info.nameArabic === '' || info.nameTransliterated === '') {
      fail(`${sourceName}: surah ${info.surah} has an empty name`);
    }
    const count = verses[index].length;
    if (count !== info.verseCount) {
      fail(`${sourceName}: surah ${info.surah} announces ${info.verseCount} verses, has ${count}`);
    }
    total += count;
  });
  if (total !== VERSE_COUNT) fail(`${sourceName}: expected ${VERSE_COUNT} verses, found ${total}`);
}

function assertNumberedFromOne(sourceName, surah, items) {
  items.forEach((item, index) => {
    if (item.id !== index + 1) {
      fail(`${sourceName}: verse ${index + 1} of surah ${surah} is numbered ${item.id}`);
    }
  });
}

/** quran.json of the npm package quran-json: [{ id, name, transliteration, type, total_verses, verses: [{ id, text }] }]. */
export function readUthmaniSource(raw) {
  const sourceName = 'Uthmani source';
  if (!Array.isArray(raw)) fail(`${sourceName}: expected an array of surahs`);

  const surahs = raw.map((entry) => ({
    surah: entry.id,
    nameArabic: entry.name,
    nameTransliterated: entry.transliteration,
    verseCount: entry.total_verses,
    revelationPlace: entry.type,
  }));
  const verses = raw.map((entry) => {
    assertNumberedFromOne(sourceName, entry.id, entry.verses);
    return entry.verses.map((verse) => verse.text);
  });

  assertCounts(sourceName, surahs, verses);
  assertWordSeparation(sourceName, verses, VERSES_WITH_THIN_SPACE_INSIDE_A_WORD);
  return { surahs, verses };
}

/**
 * tanzil_simple.json, the Tanzil "Uthmani Minimal" text despite its name (see
 * docs/DATA_SOURCES.md): { source, version, copyright, license, surahs: [{ id, name, englishName,
 * revelationType, numberOfAyahs, ayat: [{ id, text, sajdah, juz, hizb }] }] }.
 *
 * The `hizb` field of this file is wrong (it only takes the values 1, 3, 5... 59) and is
 * never read. `juz` and `sajdah` are only used to cross-check the other sources.
 */
export function readTanzilSource(raw) {
  const sourceName = 'Tanzil source';
  if (!Array.isArray(raw?.surahs)) fail(`${sourceName}: expected a "surahs" array`);

  const surahs = raw.surahs.map((entry) => ({
    surah: entry.id,
    nameArabic: entry.name,
    nameTransliterated: entry.englishName,
    verseCount: entry.numberOfAyahs,
    revelationPlace: String(entry.revelationType).toLowerCase(),
  }));
  const verses = raw.surahs.map((entry) => {
    assertNumberedFromOne(sourceName, entry.id, entry.ayat);
    return entry.ayat.map((ayah) => ayah.text);
  });

  assertCounts(sourceName, surahs, verses);
  assertWordSeparation(sourceName, verses, []);

  const juzStarts = [];
  const sajdaVerses = [];
  for (const entry of raw.surahs) {
    for (const ayah of entry.ayat) {
      if (ayah.juz === juzStarts.length + 1) juzStarts.push(verseKey(entry.id, ayah.id));
      else if (ayah.juz !== juzStarts.length) {
        fail(`${sourceName}: juz jumps to ${ayah.juz} at ${verseKey(entry.id, ayah.id)}`);
      }
      if (ayah.sajdah === true) sajdaVerses.push(verseKey(entry.id, ayah.id));
    }
  }

  for (const [field, expected] of Object.entries(TANZIL_NOTICE)) {
    if (raw[field] !== expected) {
      fail(
        `${sourceName}: its "${field}" notice is "${raw[field]}", not "${expected}". ` +
          'Update tools/quran-data/NOTICE.txt and docs/DATA_SOURCES.md with the new notice.',
      );
    }
  }
  return { surahs, verses, juzStarts, sajdaVerses };
}
