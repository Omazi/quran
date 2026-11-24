/**
 * Builds the structure of the mushaf (surahs, first verse of each page, juz and hizb
 * starts) and cross-checks every piece against the other sources.
 *
 * Where each piece comes from:
 *   - surahs:      Uthmani source, checked against the Tanzil file and quran-meta;
 *   - page starts: the page layout (the pages the app displays);
 *   - hizb starts: quran-meta (every 4th quarter of hizb), checked against the ۞ signs
 *                  of the layout and of the Uthmani text;
 *   - juz starts:  every 2nd hizb, checked against quran-meta and the Tanzil file.
 */
import {
  PAGES_STARTING_ELSEWHERE_IN_QURAN_META,
  QUARTER_START_DISAGREEMENTS,
} from './declared.mjs';
import { fail } from './fail.mjs';
import { VERSE_COUNT, verseKey } from './texts.mjs';

export const PAGE_COUNT = 604;
export const JUZ_COUNT = 30;
export const HIZB_COUNT = 60;
const QUARTERS_PER_HIZB = 4;
const HIZB_PER_JUZ = 2;
const SAJDA_COUNT = 15;

function sameList(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function assertSameList(what, sources) {
  const [[firstName, firstList], ...others] = Object.entries(sources);
  for (const [name, list] of others) {
    if (!sameList(firstList, list)) {
      const index = firstList.findIndex((value, i) => value !== list[i]);
      fail(
        `${what}: ${firstName} and ${name} disagree ` +
          `(entry ${index + 1}: ${firstList[index]} against ${list[index]}; ` +
          `${firstList.length} against ${list.length} entries)`,
      );
    }
  }
}

/**
 * quran-meta numbers the verses 1..6236 and gives each list as [0, start, start, ..., 6237].
 * Returns the starts as verse keys.
 */
function readBoundaryList(name, list, expectedCount, keyOfVerseId) {
  if (list.length !== expectedCount + 2 || list[0] !== 0 || list.at(-1) !== VERSE_COUNT + 1) {
    fail(`quran-meta ${name}: unexpected shape (${list.length} entries)`);
  }
  return list.slice(1, -1).map(keyOfVerseId);
}

function readQuranMeta(quranMeta, surahs) {
  const firstVerseIds = [];
  let nextId = 1;
  for (const info of surahs) {
    firstVerseIds.push(nextId);
    nextId += info.verseCount;
  }
  const keyOfVerseId = (id) => {
    if (!Number.isInteger(id) || id < 1 || id > VERSE_COUNT) fail(`quran-meta: verse id ${id}`);
    const surahIndex = firstVerseIds.findLastIndex((firstId) => firstId <= id);
    return verseKey(surahIndex + 1, id - firstVerseIds[surahIndex] + 1);
  };

  // SurahList: [placeholder, [firstVerseId, verseCount, order, rukus, name, isMeccan] x 114, end].
  const metaSurahs = quranMeta.SurahList.slice(1, -1);
  if (metaSurahs.length !== surahs.length) fail('quran-meta SurahList: unexpected length');

  return {
    quarterStarts: readBoundaryList(
      'HizbQuarterList',
      quranMeta.HizbQuarterList,
      HIZB_COUNT * QUARTERS_PER_HIZB,
      keyOfVerseId,
    ),
    juzStarts: readBoundaryList('JuzList', quranMeta.JuzList, JUZ_COUNT, keyOfVerseId),
    pageStarts: readBoundaryList('PageList', quranMeta.PageList, PAGE_COUNT, keyOfVerseId),
    sajdaVerses: quranMeta.SajdaList.map(keyOfVerseId),
    verseCounts: metaSurahs.map((entry) => entry[1]),
    revelationPlaces: metaSurahs.map((entry) => (entry[5] ? 'meccan' : 'medinan')),
  };
}

/** The quarter starts of quran-meta, with the declared disagreements settled for the mushaf. */
function settleQuarterStarts(metaQuarterStarts, markedVerses) {
  const quarterStarts = [...metaQuarterStarts];
  for (const { quranMeta, mushaf } of QUARTER_START_DISAGREEMENTS) {
    const index = quarterStarts.indexOf(quranMeta);
    if (index === -1 || markedVerses.includes(quranMeta) || !markedVerses.includes(mushaf)) {
      fail(`declared.mjs: quarter disagreement ${quranMeta} / ${mushaf} is not observed`);
    }
    quarterStarts[index] = mushaf;
  }

  // A quarter that starts inside a surah is printed ۞; one that starts a surah is not.
  const insideSurah = quarterStarts.filter((key) => !key.endsWith(':1'));
  assertSameList('Quarter-of-hizb starts inside a surah', {
    'quran-meta': insideSurah,
    'the ۞ signs of the layout and of the Uthmani text': markedVerses,
  });
  return quarterStarts;
}

function assertPageStartDifferencesAreTheDeclaredOnes(layoutPageStarts, metaPageStarts) {
  const differing = [];
  layoutPageStarts.forEach((key, index) => {
    if (key !== metaPageStarts[index]) differing.push(index + 1);
  });
  if (!sameList(differing, PAGES_STARTING_ELSEWHERE_IN_QURAN_META)) {
    fail(
      `Pages whose first verse differs from quran-meta are [${differing}], ` +
        `but [${PAGES_STARTING_ELSEWHERE_IN_QURAN_META}] are declared in declared.mjs`,
    );
  }
}

export function buildStructure({ uthmani, tanzil, alignment, quranMeta }) {
  const surahs = uthmani.surahs;
  const meta = readQuranMeta(quranMeta, surahs);

  assertSameList('Verses per surah', {
    'the Uthmani source': surahs.map((info) => info.verseCount),
    'the Tanzil file': tanzil.surahs.map((info) => info.verseCount),
    'quran-meta': meta.verseCounts,
  });
  assertSameList('Arabic surah names', {
    'the Uthmani source': surahs.map((info) => info.nameArabic),
    'the Tanzil file': tanzil.surahs.map((info) => info.nameArabic),
  });
  assertSameList('Revelation place per surah', {
    'the Uthmani source': surahs.map((info) => info.revelationPlace),
    'the Tanzil file': tanzil.surahs.map((info) => info.revelationPlace),
    'quran-meta': meta.revelationPlaces,
  });

  if (alignment.sajdaVerses.length !== SAJDA_COUNT) {
    fail(`Expected ${SAJDA_COUNT} sajda verses, found ${alignment.sajdaVerses.length}`);
  }
  assertSameList('Sajda verses', {
    'the layout and the Uthmani text': alignment.sajdaVerses,
    'the Tanzil file': tanzil.sajdaVerses,
    'quran-meta': meta.sajdaVerses,
  });

  if (alignment.pageStarts.length !== PAGE_COUNT) {
    fail(`Expected ${PAGE_COUNT} pages, found ${alignment.pageStarts.length}`);
  }
  assertPageStartDifferencesAreTheDeclaredOnes(alignment.pageStarts, meta.pageStarts);

  const quarterStarts = settleQuarterStarts(meta.quarterStarts, alignment.quarterVerses);
  const hizbStarts = quarterStarts.filter((_, index) => index % QUARTERS_PER_HIZB === 0);
  const juzStarts = hizbStarts.filter((_, index) => index % HIZB_PER_JUZ === 0);
  assertSameList('Juz starts', {
    'every second hizb': juzStarts,
    'quran-meta': meta.juzStarts,
    'the Tanzil file': tanzil.juzStarts,
  });

  return { surahs, pageStarts: alignment.pageStarts, juzStarts, hizbStarts };
}
