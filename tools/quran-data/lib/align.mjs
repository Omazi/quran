/**
 * Places every word of the Uthmani text on its line of the mushaf.
 *
 * The layout is read once, in reading order, next to the text. Each layout word must be
 * the next word of the text: same verse, next position, same consonants. The only accepted
 * differences are the ones declared in declared.mjs (sajda sign, joined words). Anything
 * else stops the build with the page, the line and the verse concerned. No fallback.
 *
 * Result:
 *   pages:        [{ page, lines: [{ header: surah } | { basmala: surah }
 *                                 | { surah, words: [[verse, firstWord, lastWord], ...] }] }]
 *   pageStarts:   key of the first verse of each page
 *   quarterVerses / sajdaVerses: keys of the verses that carry ۞ / ۩ in both sources
 */
import { consonantKey } from './comparison-key.mjs';
import { JOINED_WORDS, QUARTER_MARK, SAJDA_MARK } from './declared.mjs';
import { fail } from './fail.mjs';
import { forEachVerse, splitWords, verseKey } from './texts.mjs';

/** Al-Fatiha's basmala is its first verse; At-Tawba has none. */
const SURAHS_WITHOUT_BASMALA_LINE = Object.freeze([1, 9]);

/**
 * One entry per verse, in reading order. `places` lists, for each word place of the layout,
 * the position of the text word that fills it: [1, 2, 3...] for most verses, with a
 * repeated position where a declared joined word takes two places.
 */
function listVerses(uthmani) {
  const list = [];
  forEachVerse(uthmani.verses, (surah, verse, text) => {
    const key = verseKey(surah, verse);
    const words = splitWords(text);
    if (text.lastIndexOf(QUARTER_MARK) > 0) fail(`${key}: ۞ is not at the start of the verse`);
    if (text.includes(SAJDA_MARK) && text.indexOf(SAJDA_MARK) !== text.length - 1) {
      fail(`${key}: ۩ is not at the end of the verse`);
    }

    const joined = JOINED_WORDS[key] ?? [];
    for (const position of joined) {
      if (!Number.isInteger(position) || position < 1 || position > words.length) {
        fail(`declared.mjs: joined word ${position} of ${key} does not exist`);
      }
    }
    const places = words.flatMap((_, index) =>
      joined.includes(index + 1) ? [index + 1, index + 1] : [index + 1],
    );

    list.push({
      key,
      surah,
      verse,
      words,
      places,
      startsQuarter: text.startsWith(QUARTER_MARK),
      hasSajda: text.endsWith(SAJDA_MARK),
    });
  });

  for (const key of Object.keys(JOINED_WORDS)) {
    if (!list.some((entry) => entry.key === key)) fail(`declared.mjs: verse ${key} does not exist`);
  }
  return list;
}

/** [{ verse, position }] in reading order -> [[verse, firstWord, lastWord], ...]. */
function toSegments(placedWords) {
  const segments = [];
  for (const { verse, position } of placedWords) {
    const last = segments.at(-1);
    if (last && last[0] === verse.verse && last[2] === position - 1) last[2] = position;
    else segments.push([verse.verse, position, position]);
  }
  return segments;
}

/** Follows the text while the layout is read: it knows which word must come next. */
class TextReader {
  quarterVerses = [];
  sajdaVerses = [];

  #verses;
  #verseIndex = 0;
  // Progress inside the current verse.
  #filledPlaces = 0;
  #numberedItemsSeen = 0;
  #quarterSignSeen = false;
  #sajdaSignSeen = false;
  #layoutTextOfWord = '';
  // Surah header and basmala seen since the last verse.
  #headerSeenFor = null;
  #basmalaSeenFor = null;
  #previousLineWasHeader = false;

  constructor(verses) {
    this.#verses = verses;
  }

  #currentVerse(where) {
    const verse = this.#verses[this.#verseIndex];
    if (verse === undefined) fail(`${where}: the layout goes on after the last verse`);
    return verse;
  }

  #atVerseStart() {
    return this.#filledPlaces === 0 && !this.#quarterSignSeen;
  }

  takeHeader(surah, where) {
    const verse = this.#currentVerse(where);
    if (!this.#atVerseStart() || verse.verse !== 1 || verse.surah !== surah) {
      fail(`${where}: header of surah ${surah} found where ${verse.key} was expected`);
    }
    if (this.#headerSeenFor === surah) fail(`${where}: second header of surah ${surah}`);
    this.#headerSeenFor = surah;
    this.#previousLineWasHeader = true;
  }

  takeBasmala(surah, where) {
    if (!this.#previousLineWasHeader || this.#headerSeenFor !== surah) {
      fail(`${where}: basmala of surah ${surah} does not follow its header`);
    }
    if (SURAHS_WITHOUT_BASMALA_LINE.includes(surah)) {
      fail(`${where}: surah ${surah} must not have a basmala line`);
    }
    this.#basmalaSeenFor = surah;
    this.#previousLineWasHeader = false;
  }

  /** @returns the key of the verse that opens the page. A page never starts inside a verse. */
  startPage(where) {
    const verse = this.#currentVerse(where);
    if (!this.#atVerseStart()) fail(`${where}: the page starts in the middle of ${verse.key}`);
    return verse.key;
  }

  /** @returns {{ surah: number, words: number[][] }} the line as stored in the page files. */
  placeTextLine(items, where) {
    this.#previousLineWasHeader = false;
    const placedWords = [];
    for (const item of items) {
      const verse = this.#currentVerse(where);
      if (item.verseKey !== verse.key) {
        fail(
          `${where}: found an item of ${item.verseKey} where ${verse.key} word ` +
            `${this.#filledPlaces + 1} was expected`,
        );
      }
      if (this.#atVerseStart() && verse.verse === 1) this.#assertSurahIsOpened(verse.surah, where);

      if (item.kind === 'quarter-sign') this.#takeQuarterSign(verse, where);
      else {
        this.#assertLayoutNumbering(item, verse, where);
        if (item.kind === 'word') this.#placeWord(item, verse, placedWords, where);
        else if (item.kind === 'sajda-sign') this.#takeSajdaSign(verse, where);
        else this.#closeVerse(verse, placedWords, where);
      }
    }

    const surah = placedWords[0]?.verse.surah;
    if (surah === undefined) fail(`${where}: text line without a word`);
    if (placedWords.some((placed) => placed.verse.surah !== surah)) {
      fail(`${where}: words of two surahs on one line`);
    }
    return { surah, words: toSegments(placedWords) };
  }

  assertFinished() {
    if (this.#verseIndex !== this.#verses.length) {
      const missing = this.#verses[this.#verseIndex];
      fail(`The layout stops before the end of the text: ${missing.key} is not fully placed`);
    }
  }

  #assertSurahIsOpened(surah, where) {
    if (this.#headerSeenFor !== surah) fail(`${where}: surah ${surah} starts without its header`);
    const needsBasmala = !SURAHS_WITHOUT_BASMALA_LINE.includes(surah);
    if (needsBasmala && this.#basmalaSeenFor !== surah) {
      fail(`${where}: surah ${surah} starts without its basmala line`);
    }
  }

  /** The layout numbers words, sajda sign and end mark 1, 2, 3... inside each verse. */
  #assertLayoutNumbering(item, verse, where) {
    this.#numberedItemsSeen += 1;
    if (item.position !== this.#numberedItemsSeen) {
      fail(
        `${where}: the layout numbers this item ${item.position} in ${verse.key}, ` +
          `expected ${this.#numberedItemsSeen}`,
      );
    }
  }

  #takeQuarterSign(verse, where) {
    if (!this.#atVerseStart() || !verse.startsQuarter) {
      fail(`${where}: ۞ in the layout but not at the start of ${verse.key} in the text`);
    }
    this.#quarterSignSeen = true;
  }

  #placeWord(item, verse, placedWords, where) {
    const place = this.#filledPlaces;
    if (place >= verse.places.length) {
      fail(
        `${where}: verse ${verse.key} cannot be aligned. The layout has one more word ` +
          `("${item.text}") than the ${verse.words.length} words of the text. ` +
          'Find the cause and declare it in declared.mjs.',
      );
    }
    const position = verse.places[place];
    const isFirstPlaceOfWord = verse.places[place - 1] !== position;
    const isLastPlaceOfWord = verse.places[place + 1] !== position;

    if (isFirstPlaceOfWord) {
      placedWords.push({ verse, position });
      this.#layoutTextOfWord = '';
    } else {
      const lastPlaced = placedWords.at(-1);
      if (lastPlaced?.verse !== verse || lastPlaced.position !== position) {
        fail(`${where}: joined word ${position} of ${verse.key} is cut by a line break`);
      }
    }
    this.#layoutTextOfWord += item.text;
    this.#filledPlaces += 1;

    const word = verse.words[position - 1];
    if (isLastPlaceOfWord && consonantKey(word) !== consonantKey(this.#layoutTextOfWord)) {
      fail(
        `${where}: verse ${verse.key} cannot be aligned. Word ${position} of the text is ` +
          `"${word}" but the layout has "${this.#layoutTextOfWord}" at this place. ` +
          'Find the cause and declare it in declared.mjs.',
      );
    }
  }

  #assertEveryWordIsPlaced(verse, where) {
    if (this.#filledPlaces !== verse.places.length) {
      fail(
        `${where}: verse ${verse.key} cannot be aligned. The layout closes it after ` +
          `${this.#filledPlaces} words, the text has ${verse.words.length}. ` +
          'Find the cause and declare it in declared.mjs.',
      );
    }
  }

  #takeSajdaSign(verse, where) {
    this.#assertEveryWordIsPlaced(verse, where);
    if (!verse.hasSajda || this.#sajdaSignSeen) {
      fail(`${where}: sajda sign in the layout but no ۩ at the end of ${verse.key} in the text`);
    }
    this.#sajdaSignSeen = true;
  }

  #closeVerse(verse, placedWords, where) {
    this.#assertEveryWordIsPlaced(verse, where);
    const lastPlaced = placedWords.at(-1);
    if (lastPlaced?.verse !== verse || lastPlaced.position !== verse.words.length) {
      fail(`${where}: the end mark of ${verse.key} is not on the line of its last word`);
    }
    if (this.#quarterSignSeen !== verse.startsQuarter) {
      fail(`${where}: ${verse.key} starts with ۞ in the text but not in the layout`);
    }
    if (this.#sajdaSignSeen !== verse.hasSajda) {
      fail(`${where}: ${verse.key} ends with ۩ in the text but not in the layout`);
    }
    if (verse.startsQuarter) this.quarterVerses.push(verse.key);
    if (verse.hasSajda) this.sajdaVerses.push(verse.key);

    this.#verseIndex += 1;
    this.#filledPlaces = 0;
    this.#numberedItemsSeen = 0;
    this.#quarterSignSeen = false;
    this.#sajdaSignSeen = false;
  }
}

export function alignLayoutWithText(layoutPages, uthmani) {
  const reader = new TextReader(listVerses(uthmani));
  const pages = [];
  const pageStarts = [];

  for (const layoutPage of layoutPages) {
    const lines = [];
    let pageHasText = false;
    layoutPage.lines.forEach((line, index) => {
      const where = `Page ${layoutPage.page}, line ${index + 1}`;
      if (line.kind === 'surah-header') {
        reader.takeHeader(line.surah, where);
        lines.push({ header: line.surah });
      } else if (line.kind === 'basmala') {
        reader.takeBasmala(line.surah, where);
        lines.push({ basmala: line.surah });
      } else {
        if (!pageHasText) pageStarts.push(reader.startPage(where));
        pageHasText = true;
        lines.push(reader.placeTextLine(line.items, where));
      }
    });

    if (lines.at(-1)?.words === undefined) {
      fail(`Page ${layoutPage.page}: the page ends with a surah header or a basmala`);
    }
    pages.push({ page: layoutPage.page, lines });
  }

  reader.assertFinished();
  return {
    pages,
    pageStarts,
    quarterVerses: reader.quarterVerses,
    sajdaVerses: reader.sajdaVerses,
  };
}
