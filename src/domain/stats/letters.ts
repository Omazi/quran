/**
 * THE LETTER RULE. To be validated by a qualified person: scholars count the letters of the
 * Quran in several ways, and this is one reading of "the letters as they are written".
 *
 * A letter is a written letter of the Arabic alphabet, in the Uthmani text of the app:
 *
 * - COUNTED, one each: the 28 letters in every written form (U+0621..U+063A, U+0641..U+064A:
 *   hamza alone, alif with madda, with hamza above or below, waw or ya carrying a hamza, ta
 *   marbuta, alif maqsura...) and the alif wasla (U+0671).
 * - COUNTED, a hamza written on a tatweel (U+0640 followed by U+0654 or U+0655): the tatweel
 *   is only the seat, the letter is the hamza. The Uthmani text writes it so in a few hundred
 *   places (2:255 "يَـُٔودُهُۥ").
 * - NOT counted: the vowels (fatha, damma, kasra), the sukun, the shadda (the doubled letter
 *   is written once, so it counts once), the tanwin, the madda sign, the hamza SIGN on a
 *   letter (it belongs to that letter), the dagger alif (alif suscrit), the small waw and ya
 *   and all the other small letters written above or below, the pause and annotation signs,
 *   the hizb and sajda signs, and the tatweel itself.
 *
 * A character that is none of these (a Latin letter, a digit, a space...) is an error: nothing
 * is guessed about text the rule was not written for.
 */

const TATWEEL = 0x0640;
const HAMZA_ABOVE_SIGN = 0x0654;
const HAMZA_BELOW_SIGN = 0x0655;

/** Inclusive ranges of code points. */
type CodePointRange = readonly [first: number, last: number];

/** Hamza to ghayn (U+0621..U+063A), fa to ya (U+0641..U+064A), and the alif wasla. */
const LETTER_RANGES: readonly CodePointRange[] = [
  [0x0621, 0x063a],
  [0x0641, 0x064a],
  [0x0671, 0x0671],
];

/**
 * Signs that are not letters: tatweel, the harakat and Quranic marks (U+064B..U+065F), the
 * dagger alif (U+0670), and the annotation block of the Quran (U+06D6..U+06ED).
 */
const NON_LETTER_RANGES: readonly CodePointRange[] = [
  [TATWEEL, TATWEEL],
  [0x064b, 0x065f],
  [0x0670, 0x0670],
  [0x06d6, 0x06ed],
];

function isInRanges(codePoint: number, ranges: readonly CodePointRange[]): boolean {
  return ranges.some(([first, last]) => codePoint >= first && codePoint <= last);
}

function isHamzaSign(codePoint: number): boolean {
  return codePoint === HAMZA_ABOVE_SIGN || codePoint === HAMZA_BELOW_SIGN;
}

function describeCharacter(character: string): string {
  const codePoint = character.codePointAt(0) ?? 0;
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * The number of letters of one word, by the rule written at the top of this file.
 * Throws a TypeError for something that is not a string and a RangeError for an empty word or
 * for a character the rule does not know.
 */
export function countLetters(word: string): number {
  if (typeof word !== 'string') {
    throw new TypeError(`Invalid word: expected a string, got ${typeof word}`);
  }
  if (word === '') throw new RangeError('Invalid word: it is empty');

  let letters = 0;
  // True from a tatweel until the next letter: a hamza sign met meanwhile is the hamza letter.
  let isOnTatweel = false;
  for (const character of word) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (isInRanges(codePoint, LETTER_RANGES)) {
      letters += 1;
      isOnTatweel = false;
    } else if (codePoint === TATWEEL) {
      isOnTatweel = true;
    } else if (isOnTatweel && isHamzaSign(codePoint)) {
      letters += 1;
      // One seat holds one hamza.
      isOnTatweel = false;
    } else if (!isInRanges(codePoint, NON_LETTER_RANGES)) {
      throw new RangeError(
        `Invalid character ${describeCharacter(character)} in word ${JSON.stringify(word)}: ` +
          'the letter rule only knows Arabic letters and Quranic signs',
      );
    }
  }
  return letters;
}
