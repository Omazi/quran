import { IMLAEI_SAMPLE } from '../__fixtures__/imlaei-sample';
import { UTHMANI_SAMPLE } from '../__fixtures__/uthmani-sample';
import {
  editDistance,
  isClearlyDifferent,
  isCloseEnough,
  isPartOfWord,
  isTooLongToBeAWord,
  joinedWordsSimilarity,
  similarityUnlessClearlyDifferent,
  toComparableWords,
  wordSimilarity,
  type ComparableWord,
} from '../comparable-word';
import { RECOGNITION_CONFIG } from '../config';
import { isSameWordHeard } from '../index';

function comparable(text: string): ComparableWord {
  const [word] = toComparableWords([text], 'text');
  if (word === undefined) throw new Error(`"${text}" is not one Arabic word`);
  return word;
}

function similarity(first: string, second: string): number {
  return wordSimilarity(comparable(first), comparable(second));
}

describe('editDistance', () => {
  it('counts the letters to insert, delete or replace', () => {
    expect(editDistance('', '')).toBe(0);
    expect(editDistance('قلب', 'قلب')).toBe(0);
    expect(editDistance('قلب', 'قلم')).toBe(1);
    expect(editDistance('قلب', 'قلوب')).toBe(1);
    expect(editDistance('قلوب', 'قلب')).toBe(1);
    expect(editDistance('', 'قلب')).toBe(3);
    expect(editDistance('كتاب', 'مكتوب')).toBe(2);
  });

  it('handles words longer than any word of the Quran', () => {
    const long = 'ب'.repeat(40);
    expect(editDistance(long, `${long}ت`)).toBe(1);
  });
});

describe('wordSimilarity', () => {
  it('is 1 for the same word in two scripts', () => {
    expect(similarity('ٱلۡعَٰلَمِينَ', 'العالمين')).toBe(1);
  });

  it('is just under 1 for words that only differ by letters a foreign accent confuses', () => {
    expect(similarity('الصراط', 'السراط')).toBe(RECOGNITION_CONFIG.accentMatchSimilarity);
  });

  it('is the share of agreeing letters otherwise', () => {
    expect(similarity('نعبد', 'نعبر')).toBeCloseTo(3 / 4);
    expect(similarity('من', 'في')).toBe(0);
  });

  it('accepts one wrong letter from 4 letters up, two from 7 letters up, none below', () => {
    expect(isCloseEnough(similarity('رب', 'رد'))).toBe(false); // 2 letters
    expect(isCloseEnough(similarity('خلق', 'خلف'))).toBe(false); // 3 letters
    expect(isCloseEnough(similarity('نعبد', 'نعبر'))).toBe(true); // 4 letters, 1 wrong
    expect(isCloseEnough(similarity('يعلمون', 'يعملون'))).toBe(false); // 6 letters, 2 wrong
    expect(isCloseEnough(similarity('ويقيمون', 'ويكيمين'))).toBe(true); // 7 letters, 2 wrong
  });

  it('calls clearly different only words with less than half of their letters in common', () => {
    expect(isClearlyDifferent(similarity('أحد', 'كتاب'))).toBe(true);
    expect(isClearlyDifferent(similarity('من', 'في'))).toBe(true);
    expect(isClearlyDifferent(similarity('من', 'مب'))).toBe(false); // exactly half
    expect(isClearlyDifferent(similarity('خلق', 'خلف'))).toBe(false);
  });
});

describe('Précisions — a "word" of more than 30 letters is not a word of the Quran', () => {
  const longest = comparable('ب'.repeat(RECOGNITION_CONFIG.maxWordLetters));
  const tooLong = comparable('ب'.repeat(RECOGNITION_CONFIG.maxWordLetters + 1));

  it('compares a word of exactly 30 letters like any other word', () => {
    expect(isTooLongToBeAWord(longest)).toBe(false);
    expect(wordSimilarity(longest, longest)).toBe(1);
  });

  it('matches nothing from 31 letters up, not even itself', () => {
    expect(isTooLongToBeAWord(tooLong)).toBe(true);
    expect(wordSimilarity(tooLong, tooLong)).toBe(0);
    expect(wordSimilarity(tooLong, longest)).toBe(0);
    expect(similarityUnlessClearlyDifferent(tooLong, tooLong)).toBe(0);
    expect(isClearlyDifferent(wordSimilarity(tooLong, tooLong))).toBe(true);
  });

  it('is never the joined spelling of two words, nor a word of which another is a part', () => {
    const half = comparable('ب'.repeat(16));

    expect(joinedWordsSimilarity(half, half, comparable('ب'.repeat(32)))).toBe(0);
    expect(isPartOfWord(half, tooLong)).toBe(false);
  });
});

describe('similarityUnlessClearlyDifferent — the quick comparison used by the alignment', () => {
  it('agrees with wordSimilarity on every pair of words of the sample', () => {
    const texts = [...UTHMANI_SAMPLE, ...IMLAEI_SAMPLE].map((verse) => verse.text);
    const distinct = new Map(toComparableWords(texts, 'texts').map((word) => [word.key, word]));
    const words = [...distinct.values()];
    expect(words.length).toBeGreaterThan(150);

    let mismatches = 0;
    for (const word of words) {
      for (const other of words) {
        const exact = wordSimilarity(word, other);
        const expected = isClearlyDifferent(exact) ? 0 : exact;
        if (similarityUnlessClearlyDifferent(word, other) !== expected) mismatches += 1;
      }
    }
    expect(mismatches).toBe(0);
  });
});

describe('joinedWordsSimilarity — two words for one', () => {
  it("recognises the two imla'i words of a word that Uthmani writes joined", () => {
    expect(joinedWordsSimilarity(comparable('يا'), comparable('أيها'), comparable('يَـٰٓأَيُّهَا'))).toBe(
      1,
    );
    expect(joinedWordsSimilarity(comparable('يا'), comparable('قوم'), comparable('يَٰقَوۡمِ'))).toBe(1);
  });

  it('recognises a word cut in two, or two words glued, by a speech engine', () => {
    expect(joinedWordsSimilarity(comparable('في'), comparable('ها'), comparable('فيها'))).toBe(1);
    expect(joinedWordsSimilarity(comparable('قل'), comparable('هو'), comparable('قلهو'))).toBe(1);
  });

  it('recognises two glued words when the second starts with an alef, which the glued word drops', () => {
    // لغير الله glued as لغيرالله: the alef of the article is now inside a word.
    expect(
      joinedWordsSimilarity(comparable('لغير'), comparable('الله'), comparable('لغيرالله')),
    ).toBe(1);
    expect(
      joinedWordsSimilarity(comparable('رَبِّ'), comparable('ٱلۡعَٰلَمِينَ'), comparable('ربالعالمين')),
    ).toBe(1);
    // With its hamza written, the second word keeps it once glued.
    expect(
      joinedWordsSimilarity(comparable('من'), comparable('أنفسهم'), comparable('منأنفسهم')),
    ).toBe(1);
  });

  it('does not drop any other first letter of the second word', () => {
    expect(
      joinedWordsSimilarity(comparable('لغير'), comparable('بالله'), comparable('لغيرالله')),
    ).toBe(0);
  });

  it('tolerates confused letters but no other noise', () => {
    const accentOnly = joinedWordsSimilarity(
      comparable('يا'),
      comparable('كوم'),
      comparable('يَٰقَوۡمِ'),
    );
    expect(accentOnly).toBe(RECOGNITION_CONFIG.accentMatchSimilarity);
    expect(joinedWordsSimilarity(comparable('يا'), comparable('قول'), comparable('يَٰقَوۡمِ'))).toBe(0);
  });

  it('does not take a long word followed by a short one for the long word alone', () => {
    expect(joinedWordsSimilarity(comparable('الصمد'), comparable('لم'), comparable('الصمد'))).toBe(
      0,
    );
  });

  it('does not join a word that would bring no letter of its own', () => {
    // A lone hamza before أن is not "أن in two words".
    expect(joinedWordsSimilarity(comparable('ا'), comparable('أن'), comparable('أن'))).toBe(0);
  });
});

describe('isSameWordHeard (public)', () => {
  it('accepts the vowels, the script and a little transcription noise', () => {
    expect(isSameWordHeard('الْمُرْسِلِ', 'ٱلۡمُرۡسَلِينَ')).toBe(true);
    expect(isSameWordHeard('الحكيم', 'ٱلۡحَكِيمِ')).toBe(true);
  });

  it('refuses another word, and any difference in a short word', () => {
    expect(isSameWordHeard('قال', 'أَوَى')).toBe(false);
    expect(isSameWordHeard('من', 'عَن')).toBe(false);
    expect(isSameWordHeard('', 'عَن')).toBe(false);
  });
});
