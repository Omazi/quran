/**
 * Reads the two verse sources into one simple shape. The Tanzil text is taken unchanged;
 * the Uthmani text is extracted by the two documented removals of `verseTextOf`:
 *
 *   { surahs: [{ surah, nameArabic, nameTransliterated, verseCount, revelationPlace }],
 *     verses: string[][] }            verses[surah - 1][verse - 1]
 */
import { QUARTER_MARK, WORD_SEPARATOR } from './declared.mjs';
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
const OTHER_WHITESPACE = /[^\S ]/u;

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
 * Any other white space is refused (the build never guesses how to split a word).
 */
function assertWordSeparation(sourceName, verses) {
  forEachVerse(verses, (surah, verse, text) => {
    const key = verseKey(surah, verse);
    if (typeof text !== 'string' || text === '') fail(`${sourceName} ${key}: empty verse`);
    if (splitWords(text).includes('')) {
      fail(`${sourceName} ${key}: leading, trailing or double space in "${text}"`);
    }
    if (OTHER_WHITESPACE.test(text)) {
      fail(`${sourceName} ${key}: unexpected white-space character in "${text}"`);
    }
  });
}

function assertCounts(sourceName, surahs, verses) {
  if (surahs.length !== SURAH_COUNT) {
    fail(`${sourceName}: expected ${SURAH_COUNT} surahs, found ${surahs.length}`);
  }
  let total = 0;
  surahs.forEach((info, index) => {
    if (info.surah !== index + 1)
      fail(`${sourceName}: surah ${index + 1} is numbered ${info.surah}`);
    if (!info.nameArabic || !info.nameTransliterated) {
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

const NO_BREAK_SPACE = '\u00A0';
const ARABIC_INDIC_ZERO = 0x0660;
const VERSE_NUMBER_AT_THE_END = /\u00A0([\u0660-\u0669]+)$/u;
const ANY_ARABIC_INDIC_DIGIT = /[\u0660-\u0669]/u;

/**
 * The text of a verse, taken from the `aya_text` column of the publisher's file.
 *
 * `aya_text` is the verse as the publisher prints it: the verse, a no-break space and the
 * verse number in Arabic-Indic digits; and, where a quarter of hizb starts, the sign followed
 * by a no-break space. Exactly two things are removed, and nothing else is touched:
 *   1. at the end: the no-break space and the verse number (checked to be this verse's number);
 *   2. at the start: the no-break space that follows the hizb sign (the sign itself is kept).
 * The build stops if a no-break space or a digit is left anywhere else.
 */
function verseTextOf(row, key) {
  const printed = row.aya_text;
  const number = VERSE_NUMBER_AT_THE_END.exec(printed ?? '');
  if (!number) fail(`Uthmani source ${key}: no verse number at the end of "${printed}"`);
  const digits = [...number[1]].map((digit) => digit.codePointAt(0) - ARABIC_INDIC_ZERO).join('');
  if (Number(digits) !== row.aya_no) {
    fail(`Uthmani source ${key}: the text ends with verse number ${digits}`);
  }

  let text = printed.slice(0, number.index);
  if (text.startsWith(QUARTER_MARK + NO_BREAK_SPACE)) {
    text = QUARTER_MARK + text.slice((QUARTER_MARK + NO_BREAK_SPACE).length);
  }
  if (text.includes(NO_BREAK_SPACE) || ANY_ARABIC_INDIC_DIGIT.test(text)) {
    fail(`Uthmani source ${key}: unexpected no-break space or digit left in "${text}"`);
  }
  return text;
}

/**
 * hafsData_v18.json of the King Fahd Complex: one row per verse, in reading order,
 * { id, jozz, sora, sora_name_en, sora_name_ar, page, line_start, line_end, aya_no, aya_text,
 * aya_text_emlaey }.
 *
 * Only `sora`, `aya_no`, `aya_text`, `page` and the two surah names are read. Its `jozz`
 * column puts 3:92 and 9:93 in the wrong juz and is not used. The surah names and the first
 * verse of each `page` come back as the publisher gives them: structure.mjs only uses them
 * to cross-check the names kept in the app and the pages of the layout.
 */
export function readUthmaniSource(raw) {
  const sourceName = 'Uthmani source';
  if (!Array.isArray(raw)) fail(`${sourceName}: expected an array of verses`);

  const surahs = [];
  const verses = [];
  const pageStarts = [];
  for (const row of raw) {
    const key = verseKey(row.sora, row.aya_no);
    if (row.page === pageStarts.length + 1) pageStarts.push(key);
    else if (row.page !== pageStarts.length)
      fail(`${sourceName}: page jumps to ${row.page} at ${key}`);
    if (row.aya_no === 1) {
      surahs.push({
        surah: row.sora,
        nameArabic: row.sora_name_ar,
        nameTransliterated: row.sora_name_en,
        verseCount: 0,
      });
      verses.push([]);
    }
    const info = surahs.at(-1);
    if (info === undefined || row.sora !== info.surah || row.aya_no !== info.verseCount + 1) {
      fail(`${sourceName}: verse ${key} is out of order`);
    }
    verses.at(-1).push(verseTextOf(row, key));
    info.verseCount += 1;
  }

  assertCounts(sourceName, surahs, verses);
  assertWordSeparation(sourceName, verses);
  return { surahs, verses, pageStarts };
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

  for (const info of surahs) {
    if (!REVELATION_PLACES.includes(info.revelationPlace)) {
      fail(`${sourceName}: surah ${info.surah} has revelation place "${info.revelationPlace}"`);
    }
  }
  assertCounts(sourceName, surahs, verses);
  assertWordSeparation(sourceName, verses);

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
