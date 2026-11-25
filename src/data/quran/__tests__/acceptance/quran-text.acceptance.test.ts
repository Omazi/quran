/**
 * Acceptance tests — the text of the Quran, read through the repository.
 * Spec (docs/specs/quran.md): "Aucun mot affiché ne doit différer de la source", 114 surahs
 * and 6 236 verses, both scripts.
 *
 * The expected values are anchors the tester knows independently of the app (counts of
 * words of famous verses, refrains, where the signs of prostration are...). They are in
 * src/domain/quran/__tests__/acceptance/mushaf-anchors.ts or stated in each test.
 */
import { quranRepository } from '@/data/quran';
import {
  DEFAULT_QURAN_SCRIPT,
  splitVerseWords,
  type QuranScript,
  type Verse,
  type VerseKey,
} from '@/domain/quran';
import {
  allVerseKeys,
  HIZB_QUARTER_STARTS,
  HIZB_STARTS,
  itemAt,
  LONGEST_VERSE,
  REFRAIN_VERSES_OF_SURAH_26,
  REFRAIN_VERSES_OF_SURAH_54,
  REFRAIN_VERSES_OF_SURAH_55,
  REFRAIN_VERSES_OF_SURAH_77,
  SAJDA_VERSES,
  SURAHS_OPENING_WITH_ALIF_LAM_MIM,
  SURAHS_OPENING_WITH_HA_MIM,
  VERSE_COUNT_BY_SURAH,
  VERSE_OF_SECOND_BASMALA,
} from '@/domain/quran/__tests__/acceptance/mushaf-anchors';

import { formatCodePoint, readRawVerses } from './acceptance-kit';

const SCRIPTS: readonly QuranScript[] = ['uthmani', 'uthmani-minimal'];
const SURAH_NUMBERS = Array.from({ length: 114 }, (_, index) => index + 1);
const ALL_KEYS = allVerseKeys();

const SIGN_OF_PROSTRATION = '۩';
const SIGN_OF_HIZB_QUARTER = '۞';
const THIN_SPACE = ' ';

/** The three verses in which the Uthmani source writes two words without a space. */
const DECLARED_JOINED_WORDS: Readonly<Record<string, number>> = {
  '15:7': 1,
  '27:20': 4,
  '36:22': 1,
};

const surahsByScript = new Map<QuranScript, (readonly Verse[])[]>();
const textByScript = new Map<QuranScript, Map<string, string>>();

beforeAll(async () => {
  for (const script of SCRIPTS) {
    const surahs: (readonly Verse[])[] = [];
    const texts = new Map<string, string>();
    for (const surah of SURAH_NUMBERS) {
      const verses = await quranRepository.getSurahVerses(surah, script);
      surahs.push(verses);
      for (const verse of verses) {
        texts.set(verse.key, verse.text);
      }
    }
    surahsByScript.set(script, surahs);
    textByScript.set(script, texts);
  }
});

function surahsOf(script: QuranScript): (readonly Verse[])[] {
  const surahs = surahsByScript.get(script);
  if (surahs === undefined) {
    throw new Error(`The ${script} text was not loaded.`);
  }
  return surahs;
}

function textOf(script: QuranScript, key: string): string {
  const text = textByScript.get(script)?.get(key);
  if (text === undefined) {
    throw new RangeError(`No ${script} text for ${key}.`);
  }
  return text;
}

function wordsOf(script: QuranScript, key: string): string[] {
  return splitVerseWords(textOf(script, key));
}

function versesOfSurah(script: QuranScript, surah: number): readonly Verse[] {
  return itemAt(surahsOf(script), surah - 1);
}

/** Verse numbers of a surah whose text is exactly the text of the given verse. */
function versesEqualTo(script: QuranScript, surah: number, verse: number): number[] {
  const model = textOf(script, `${surah}:${verse}`);
  return versesOfSurah(script, surah)
    .filter((candidate) => candidate.text === model)
    .map((candidate) => candidate.verse);
}

function codePointsOf(text: string): number[] {
  return Array.from(text, (character) => character.codePointAt(0) ?? 0);
}

const ALEF = 'ا';
const WAW = 'و';
const YEH = 'ي';
const HAMZA_ON_THE_LINE = 0x0621;
const TATWEEL = 0x0640;

/**
 * The consonants of a text: letters only, without any sign. The seats of hamza are folded
 * to their letter and the hamza itself is dropped, because the two sources do not encode
 * hamza the same way. Written by the tester; it does not use the app's own comparison.
 */
function consonantSkeleton(text: string): string {
  let skeleton = '';
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (character === ' ') {
      skeleton += ' ';
    } else if ([0x0622, 0x0623, 0x0625, 0x0671].includes(codePoint)) {
      skeleton += ALEF;
    } else if (codePoint === 0x0624) {
      skeleton += WAW;
    } else if (codePoint === 0x0626 || codePoint === 0x0649) {
      skeleton += YEH;
    } else if (codePoint === HAMZA_ON_THE_LINE || codePoint === TATWEEL) {
      continue;
    } else if (
      (codePoint >= 0x0627 && codePoint <= 0x063a) ||
      (codePoint >= 0x0641 && codePoint <= 0x064a)
    ) {
      skeleton += character;
    }
  }
  return skeleton;
}

/** Number of hamzas written in a text, whatever their seat. */
function hamzaCount(text: string): number {
  const hamzas = [0x0621, 0x0622, 0x0623, 0x0624, 0x0625, 0x0626, 0x0654, 0x0655];
  return codePointsOf(text).filter((codePoint) => hamzas.includes(codePoint)).length;
}

describe('Invariant — 114 sourates, 6 236 versets (les deux écritures)', () => {
  it.each(SCRIPTS)('%s: each surah has its verse count, 6236 verses in total', (script) => {
    expect(surahsOf(script).map((verses) => verses.length)).toEqual(VERSE_COUNT_BY_SURAH);
    expect(surahsOf(script).reduce((sum, verses) => sum + verses.length, 0)).toBe(6236);
  });

  it.each(SCRIPTS)('%s: every verse is reachable exactly once, in reading order', (script) => {
    const keys = surahsOf(script).flatMap((verses) => verses.map((verse) => verse.key));
    expect(keys).toEqual(ALL_KEYS);
    expect(new Set(keys).size).toBe(6236);
  });

  it.each(SCRIPTS)('%s: each verse carries its surah, its number and its key', (script) => {
    surahsOf(script).forEach((verses, surahIndex) => {
      verses.forEach((verse, verseIndex) => {
        expect(verse.surah).toBe(surahIndex + 1);
        expect(verse.verse).toBe(verseIndex + 1);
        expect(verse.key).toBe(`${surahIndex + 1}:${verseIndex + 1}`);
        expect(typeof verse.text).toBe('string');
      });
    });
  });

  it.each(SCRIPTS)(
    '%s: the text given by the repository is the text of the file, character for character',
    (script) => {
      const raw = readRawVerses(script);
      expect(Object.keys(raw)).toEqual(SURAH_NUMBERS.map(String));
      const differences: string[] = [];
      for (const surah of SURAH_NUMBERS) {
        const fileTexts = raw[String(surah)] ?? [];
        const repositoryTexts = versesOfSurah(script, surah).map((verse) => verse.text);
        if (JSON.stringify(fileTexts) !== JSON.stringify(repositoryTexts)) {
          differences.push(`surah ${surah}`);
        }
      }
      expect(differences).toEqual([]);
    },
  );

  it('getVerse gives, for each of the 6236 keys, the verse of getSurahVerses (both scripts)', async () => {
    for (const script of SCRIPTS) {
      for (const verses of surahsOf(script)) {
        for (const expected of verses) {
          expect(await quranRepository.getVerse(expected.key, script)).toEqual(expected);
        }
      }
    }
  });

  it('without a script, getVerse and getSurahVerses read the Uthmani text', async () => {
    expect(DEFAULT_QURAN_SCRIPT).toBe('uthmani');
    expect(await quranRepository.getVerse('2:255')).toEqual(
      await quranRepository.getVerse('2:255', 'uthmani'),
    );
    expect(await quranRepository.getSurahVerses(112)).toEqual(versesOfSurah('uthmani', 112));
    expect((await quranRepository.getVerse('1:1')).text).not.toBe(
      (await quranRepository.getVerse('1:1', 'uthmani-minimal')).text,
    );
  });
});

describe('Ancres indépendantes — texte', () => {
  it.each(SCRIPTS)('%s: al-Fatiha has 29 words: 4, 4, 2, 3, 4, 3 and 9', (script) => {
    const counts = [1, 2, 3, 4, 5, 6, 7].map((verse) => wordsOf(script, `1:${verse}`).length);
    expect(counts).toEqual([4, 4, 2, 3, 4, 3, 9]);
  });

  it.each(SCRIPTS)(
    '%s: word counts of surahs 112 (4, 2, 4, 5), 108 (3, 3, 4), 103 (1, 4, 9)',
    (script) => {
      const counts = (surah: number): number[] =>
        versesOfSurah(script, surah).map((verse) => splitVerseWords(verse.text).length);
      expect(counts(112)).toEqual([4, 2, 4, 5]);
      expect(counts(108)).toEqual([3, 3, 4]);
      expect(counts(103)).toEqual([1, 4, 9]);
    },
  );

  it.each(SCRIPTS)('%s: the verse of the Throne (2:255) has 50 words', (script) => {
    expect(wordsOf(script, '2:255')).toHaveLength(50);
  });

  it.each(SCRIPTS)('%s: the longest verse is the verse of debt, 2:282', (script) => {
    let longestByWords = '';
    let longestByCharacters = '';
    let mostWords = 0;
    let mostCharacters = 0;
    for (const key of ALL_KEYS) {
      const text = textOf(script, key);
      const wordCount = splitVerseWords(text).length;
      if (wordCount > mostWords) {
        mostWords = wordCount;
        longestByWords = key;
      }
      if (text.length > mostCharacters) {
        mostCharacters = text.length;
        longestByCharacters = key;
      }
    }
    expect(longestByWords).toBe(LONGEST_VERSE);
    expect(longestByCharacters).toBe(LONGEST_VERSE);
  });

  it.each(SCRIPTS)('%s: verses made of a single word', (script) => {
    const singleWordVerses = [
      '2:1',
      '19:1',
      '20:1',
      '36:1',
      '42:1',
      '42:2',
      '55:1',
      '55:64',
      '69:1',
      '89:1',
      '93:1',
      '101:1',
      '103:1',
    ];
    for (const key of singleWordVerses) {
      expect(wordsOf(script, key)).toHaveLength(1);
    }
  });

  it.each(SCRIPTS)('%s: the refrain of surah 55 is 31 verses, word for word', (script) => {
    expect(versesEqualTo(script, 55, 13)).toEqual(REFRAIN_VERSES_OF_SURAH_55);
    expect(wordsOf(script, '55:13')).toHaveLength(4);
  });

  it.each(SCRIPTS)(
    '%s: the refrain of surah 77 is 10 verses, and 83:10 has the same words',
    (script) => {
      expect(versesEqualTo(script, 77, 15)).toEqual(REFRAIN_VERSES_OF_SURAH_77);
      expect(textOf(script, '83:10')).toBe(textOf(script, '77:15'));
      expect(wordsOf(script, '77:15')).toHaveLength(3);
    },
  );

  it.each(SCRIPTS)('%s: the refrains of surah 54 (4 verses) and surah 26 (8 verses)', (script) => {
    expect(versesEqualTo(script, 54, 17)).toEqual(REFRAIN_VERSES_OF_SURAH_54);
    expect(versesEqualTo(script, 26, 9)).toEqual(REFRAIN_VERSES_OF_SURAH_26);
  });

  it.each(SCRIPTS)('%s: 109:3 and 109:5 are the same verse', (script) => {
    expect(textOf(script, '109:5')).toBe(textOf(script, '109:3'));
    expect(textOf(script, '109:2')).not.toBe(textOf(script, '109:4'));
  });

  it.each(SCRIPTS)(
    '%s: six surahs open with alif-lam-mim alone, seven with ha-mim alone',
    (script) => {
      const openings = (surahs: readonly number[]): Set<string> =>
        new Set(surahs.map((surah) => textOf(script, `${surah}:1`)));
      expect(openings(SURAHS_OPENING_WITH_ALIF_LAM_MIM).size).toBe(1);
      expect(openings(SURAHS_OPENING_WITH_HA_MIM).size).toBe(1);
      const alifLamMim = textOf(script, '2:1');
      const haMim = textOf(script, '40:1');
      expect(consonantSkeleton(alifLamMim)).toBe('الم');
      expect(consonantSkeleton(haMim)).toBe('حم');
      const surahsOpeningWith = (opening: string): number[] =>
        SURAH_NUMBERS.filter((surah) => textOf(script, `${surah}:1`) === opening);
      expect(surahsOpeningWith(alifLamMim)).toEqual(SURAHS_OPENING_WITH_ALIF_LAM_MIM);
      expect(surahsOpeningWith(haMim)).toEqual(SURAHS_OPENING_WITH_HA_MIM);
    },
  );

  it.each(SCRIPTS)(
    '%s: the basmala is verse 1:1 and the end of 27:30, and is in no other verse',
    (script) => {
      const basmala = textOf(script, '1:1');
      expect(splitVerseWords(basmala)).toHaveLength(4);
      expect(textOf(script, VERSE_OF_SECOND_BASMALA).endsWith(` ${basmala}`)).toBe(true);
      const holders = ALL_KEYS.filter((key) => textOf(script, key).includes(basmala));
      expect(holders).toEqual(['1:1', VERSE_OF_SECOND_BASMALA]);
    },
  );

  it.each(SCRIPTS)(
    '%s: no surah other than al-Fatiha has the basmala as a numbered verse',
    (script) => {
      const basmalaSkeleton = consonantSkeleton(textOf(script, '1:1'));
      const surahsStartingWithIt = SURAH_NUMBERS.filter((surah) =>
        consonantSkeleton(textOf(script, `${surah}:1`)).startsWith(basmalaSkeleton),
      );
      expect(surahsStartingWithIt).toEqual([1]);
    },
  );

  it.each(SCRIPTS)('%s: consonants of well-known verses', (script) => {
    // Each expected text is written in the spelling of the mushaf (no alif where the
    // mushaf writes a small alif above), then folded like the text under test.
    const wholeVerses: Readonly<Record<string, string>> = {
      '1:1': 'بسم الله الرحمن الرحيم',
      '1:2': 'الحمد لله رب العلمين',
      '1:3': 'الرحمن الرحيم',
      '1:4': 'ملك يوم الدين',
      '1:5': 'اياك نعبد واياك نستعين',
      '1:6': 'اهدنا الصرط المستقيم',
      '1:7': 'صرط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين',
      '2:2': 'ذلك الكتب لا ريب فيه هدى للمتقين',
      '19:1': 'كهيعص',
      '20:1': 'طه',
      '36:1': 'يس',
      '55:1': 'الرحمن',
      '55:2': 'علم القرءان',
      '96:1': 'اقرا باسم ربك الذي خلق',
      '97:1': 'انا انزلنه في ليلة القدر',
      '103:1': 'والعصر',
      '103:2': 'ان الانسن لفي خسر',
      '108:1': 'انا اعطينك الكوثر',
      '108:2': 'فصل لربك وانحر',
      '108:3': 'ان شانئك هو الابتر',
      '109:1': 'قل يايها الكفرون',
      '110:1': 'اذا جاء نصر الله والفتح',
      '111:1': 'تبت يدا ابي لهب وتب',
      '112:1': 'قل هو الله احد',
      '112:2': 'الله الصمد',
      '112:3': 'لم يلد ولم يولد',
      '112:4': 'ولم يكن له كفوا احد',
      '113:1': 'قل اعوذ برب الفلق',
      '114:1': 'قل اعوذ برب الناس',
      '114:2': 'ملك الناس',
      '114:3': 'اله الناس',
      '114:6': 'من الجنة والناس',
    };
    const differences: string[] = [];
    for (const [key, expected] of Object.entries(wholeVerses)) {
      const actual = consonantSkeleton(textOf(script, key));
      if (actual !== consonantSkeleton(expected)) {
        differences.push(`${key}: ${actual}`);
      }
    }
    expect(differences).toEqual([]);
  });

  it.each(SCRIPTS)('%s: first words of well-known verses', (script) => {
    const openings: Readonly<Record<string, string>> = {
      '2:255': 'الله لا اله الا هو الحي القيوم',
      '9:1': 'براءة من الله ورسوله',
      '18:1': 'الحمد لله الذي انزل على عبده الكتب',
      '24:35': 'الله نور السموت والارض',
      '33:56': 'ان الله وملئكته يصلون على النبي',
      '48:29': 'محمد رسول الله',
      '67:1': 'تبرك الذي بيده الملك وهو على كل شيء قدير',
    };
    const differences: string[] = [];
    for (const [key, expected] of Object.entries(openings)) {
      const actual = consonantSkeleton(textOf(script, key));
      if (!actual.startsWith(consonantSkeleton(expected))) {
        differences.push(`${key}: ${actual.slice(0, 60)}`);
      }
    }
    expect(differences).toEqual([]);
  });

  it('the sign of prostration is at the end of the 15 verses of prostration, and nowhere else', () => {
    const marked = ALL_KEYS.filter((key) => textOf('uthmani', key).includes(SIGN_OF_PROSTRATION));
    expect(marked).toEqual(SAJDA_VERSES);
    for (const key of marked) {
      const text = textOf('uthmani', key);
      expect(text.indexOf(SIGN_OF_PROSTRATION)).toBe(text.length - 1);
    }
  });

  it('the sign of hizb quarter opens 199 verses: every quarter that does not open a surah', () => {
    const marked = ALL_KEYS.filter((key) => textOf('uthmani', key).includes(SIGN_OF_HIZB_QUARTER));
    for (const key of marked) {
      expect(textOf('uthmani', key).lastIndexOf(SIGN_OF_HIZB_QUARTER)).toBe(0);
    }
    // The mushaf prints the sign before 15:49; the Tanzil list of quarters says 15:50.
    const expected = HIZB_QUARTER_STARTS.filter((key) => !key.endsWith(':1')).map((key) =>
      key === '15:50' ? '15:49' : key,
    );
    expect(marked).toEqual(expected);
    expect(marked).toHaveLength(199);
  });

  it('every hizb that does not open a surah starts at a verse bearing the sign of hizb quarter', () => {
    const insideSurah = HIZB_STARTS.filter((key) => !key.endsWith(':1'));
    expect(insideSurah).toHaveLength(44);
    for (const key of insideSurah) {
      expect(textOf('uthmani', key).startsWith(SIGN_OF_HIZB_QUARTER)).toBe(true);
    }
  });
});

describe('Hygiène du texte (corpus entier, les deux écritures)', () => {
  /** Every code point outside this list is "surprising" and must be declared below. */
  const EXPECTED_RANGES: readonly (readonly [number, number])[] = [
    [0x0020, 0x0020], // space between words
    [0x0621, 0x063a], // letters hamza .. ghain
    [0x0640, 0x064a], // tatweel, letters feh .. yeh
    [0x064b, 0x0657], // vowel signs, shadda, sukun, madda, hamza above and below
    [0x065e, 0x065e], // used by the Uthmani source for a form of tanwin
    [0x0670, 0x0671], // small alif above, alif wasla
    [0x06d6, 0x06dc], // signs of pause, small high seen
    [0x06de, 0x06ed], // hizb quarter, small signs, prostration
  ];

  /** Surprising code points found by the tester, with where and how often. */
  const DECLARED_SURPRISES: Readonly<Record<QuranScript, readonly string[]>> = {
    uthmani: [],
    'uthmani-minimal': [],
    imlaei: [],
  };

  function isExpected(codePoint: number): boolean {
    return EXPECTED_RANGES.some(([first, last]) => codePoint >= first && codePoint <= last);
  }

  function countOf(script: QuranScript, codePoint: number): number {
    let count = 0;
    for (const key of ALL_KEYS) {
      count += codePointsOf(textOf(script, key)).filter((value) => value === codePoint).length;
    }
    return count;
  }

  function versesMatching(script: QuranScript, pattern: RegExp): string[] {
    return ALL_KEYS.filter((key) => pattern.test(textOf(script, key)));
  }

  it.each(SCRIPTS)(
    '%s: no empty verse, no white space at either end, no double space',
    (script) => {
      expect(ALL_KEYS.filter((key) => textOf(script, key).length === 0)).toEqual([]);
      expect(ALL_KEYS.filter((key) => textOf(script, key) !== textOf(script, key).trim())).toEqual(
        [],
      );
      expect(versesMatching(script, / {2}/)).toEqual([]);
      expect(ALL_KEYS.filter((key) => splitVerseWords(textOf(script, key)).includes(''))).toEqual(
        [],
      );
    },
  );

  it.each(SCRIPTS)(
    '%s: no Latin letter, no digit of any script, no ASCII punctuation',
    (script) => {
      expect(versesMatching(script, /[A-Za-z]/)).toEqual([]);
      expect(versesMatching(script, /[0-9٠-٩۰-۹]/)).toEqual([]);
      expect(versesMatching(script, /[!-~]/)).toEqual([]);
      expect(versesMatching(script, /&|#|;/)).toEqual([]);
    },
  );

  it.each(SCRIPTS)(
    '%s: no replacement character, control character, byte order mark or invisible mark',
    (script) => {
      expect(versesMatching(script, /�/)).toEqual([]);
      expect(versesMatching(script, /[\u0000-\u001F\u007F-\u009F]/)).toEqual([]);
      expect(versesMatching(script, /[﻿​-‏‪-‮⁠-⁩­]/)).toEqual([]);
      expect(versesMatching(script, /[\uD800-\uDFFF]/)).toEqual([]);
    },
  );

  it.each(SCRIPTS)('%s: the only white space is U+0020', (script) => {
    const otherWhiteSpace = versesMatching(script, /[^\S ]/);
    expect(otherWhiteSpace).toEqual([]);
  });

  it.each(SCRIPTS)('%s: only expected code points, apart from the declared surprises', (script) => {
    const found = new Map<number, { count: number; first: string }>();
    for (const key of ALL_KEYS) {
      for (const codePoint of codePointsOf(textOf(script, key))) {
        if (!isExpected(codePoint)) {
          const entry = found.get(codePoint) ?? { count: 0, first: key };
          entry.count += 1;
          found.set(codePoint, entry);
        }
      }
    }
    const surprises = [...found.entries()]
      .sort(([a], [b]) => a - b)
      .map(
        ([codePoint, entry]) =>
          `${formatCodePoint(codePoint)} x${entry.count} first in ${entry.first}`,
      );
    expect(surprises).toEqual(DECLARED_SURPRISES[script]);
  });

  it('2:72 has ten words; its fourth word no longer holds a thin space', () => {
    const words = wordsOf('uthmani', '2:72');
    expect(words).toHaveLength(10);
    expect(itemAt(words, 3)).not.toContain(THIN_SPACE);
    expect(wordsOf('uthmani-minimal', '2:72')).toHaveLength(10);
  });

  it.each(SCRIPTS)(
    '%s: every word begins with a letter (or with the sign of hizb quarter)',
    (script) => {
      const startsWell = /^۞?[ء-غف-يٱ]/;
      const badWords: string[] = [];
      for (const key of ALL_KEYS) {
        wordsOf(script, key).forEach((word, index) => {
          if (!startsWell.test(word)) {
            badWords.push(`${key}#${index + 1}`);
          }
        });
      }
      expect(badWords).toEqual([]);
    },
  );

  it.each(SCRIPTS)(
    '%s: one consistent order of signs: shadda always before the vowel',
    (script) => {
      // The text is in the order of the mushaf sources, which is not Unicode's canonical
      // order. What matters is that a single convention is used everywhere.
      expect(versesMatching(script, /[ً-ِٖٗٞ]ّ/)).toEqual([]);
      expect(versesMatching(script, /ّ[ً-ِٖٗٞ]/).length).toBeGreaterThan(3000);
    },
  );

  it.each(SCRIPTS)('%s: one consistent encoding of hamza and madda on alif', (script) => {
    // Never the precomposed alif-madda, never a combining hamza on a plain alif: each
    // would be a second spelling of something the text already writes another way.
    expect(countOf(script, 0x0622)).toBe(0);
    expect(versesMatching(script, /ا[ٕٔ]/)).toEqual([]);
  });

  it.each(SCRIPTS)(
    '%s: the text is NOT in Unicode NFC, and normalising it would change it',
    (script) => {
      // Stated so that nobody "cleans" the text: NFC reorders shadda and vowel and would
      // change most verses, hence their fingerprint.
      const changedByNfc = ALL_KEYS.filter(
        (key) => textOf(script, key).normalize('NFC') !== textOf(script, key),
      );
      expect(changedByNfc.length).toBeGreaterThan(5000);
    },
  );

  it('the Uthmani text encodes three forms of tanwin with code points whose Unicode meaning is different', () => {
    // U+0656 SUBSCRIPT ALEF, U+0657 INVERTED DAMMA and U+065E FATHA WITH TWO DOTS are used,
    // as in the King Fahd Complex fonts, for the "successive" tanwin. Unicode has
    // U+08F0..U+08F2 for these; a font that follows Unicode draws other signs.
    // Declared here as a fact of the source, to be handled when rendering (decision D6).
    expect(countOf('uthmani', 0x0656)).toBeGreaterThan(0);
    expect(countOf('uthmani', 0x0657)).toBeGreaterThan(0);
    expect(countOf('uthmani', 0x065e)).toBeGreaterThan(0);
    expect(versesMatching('uthmani', /[ࣰ-ࣲ]/)).toEqual([]);
    expect(versesMatching('uthmani-minimal', /[ࣰٖٗٞ-ࣲ]/)).toEqual([]);
  });
});

describe('Cohérence entre les deux écritures', () => {
  it('same number of words in every verse, except the three declared verses (one word fewer in Uthmani)', () => {
    const differences: Record<string, number> = {};
    for (const key of ALL_KEYS) {
      const difference = wordsOf('uthmani-minimal', key).length - wordsOf('uthmani', key).length;
      if (difference !== 0) {
        differences[key] = difference;
      }
    }
    expect(differences).toEqual({ '15:7': 1, '27:20': 1, '36:22': 1 });
  });

  it('in the three declared verses, one Uthmani word is two words of the other text written together', () => {
    for (const [key, position] of Object.entries(DECLARED_JOINED_WORDS)) {
      const uthmani = wordsOf('uthmani', key);
      const minimal = wordsOf('uthmani-minimal', key);
      const joined = itemAt(minimal, position - 1) + itemAt(minimal, position);
      expect(consonantSkeleton(itemAt(uthmani, position - 1))).toBe(consonantSkeleton(joined));
    }
  });

  it('same consonants, word for word, in the 6236 verses', () => {
    const differences: string[] = [];
    for (const key of ALL_KEYS) {
      const uthmani = wordsOf('uthmani', key).map(consonantSkeleton);
      const minimal = wordsOf('uthmani-minimal', key).map(consonantSkeleton);
      const joinedAt = DECLARED_JOINED_WORDS[key];
      if (joinedAt !== undefined) {
        minimal.splice(joinedAt - 1, 2, itemAt(minimal, joinedAt - 1) + itemAt(minimal, joinedAt));
      }
      uthmani.forEach((word, index) => {
        if (word !== minimal[index]) {
          differences.push(`${key}#${index + 1}`);
        }
      });
      if (uthmani.length !== minimal.length) {
        differences.push(`${key}: word count`);
      }
    }
    expect(differences).toEqual([]);
  });

  it('same number of hamzas in every verse, except the eased hamza of 41:44', () => {
    // Hafs reads the second hamza of 41:44 eased: the Uthmani text writes it as an alif
    // with a dot, the other text as a hamza.
    const differences = ALL_KEYS.filter(
      (key) => hamzaCount(textOf('uthmani', key)) !== hamzaCount(textOf('uthmani-minimal', key)),
    );
    expect(differences).toEqual(['41:44']);
  });

  it('the two texts are really two scripts: they differ in every verse but agree on the keys', () => {
    const identical = ALL_KEYS.filter(
      (key) => textOf('uthmani', key) === textOf('uthmani-minimal', key),
    );
    // Verses made only of unvowelled letters can be the same in both (e.g. 20:1).
    expect(identical.length).toBeLessThan(20);
    expect(identical).toContain('20:1');
  });

  it('getVerse refuses a key that getSurahVerses does not have, in both scripts', async () => {
    for (const script of SCRIPTS) {
      // as: the key is deliberately wrong.
      await expect(quranRepository.getVerse('114:7' as VerseKey, script)).rejects.toThrow(
        RangeError,
      );
    }
  });
});
