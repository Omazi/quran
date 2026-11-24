/**
 * Arabic normalisation: turns Quran text (Uthmani script) and speech-engine output (plain
 * imla'i spelling, with or without vowel marks) into words that can be compared.
 *
 * The two scripts write the same word differently. The rules below keep what both agree
 * on and drop what only one of them writes:
 *
 * 1. Vowel marks, Quranic annotation signs, pause marks and the tatweel are dropped.
 * 2. Every hamza, whatever carries it (ء أ إ آ ؤ ئ, or a hamza sign above a letter), is
 *    written ء. So is the alef that starts a word, because it is either a hamza seat or
 *    a linking alef, and transcripts often omit the hamza (ان for أن).
 * 3. An alef inside a word is a long "a". Uthmani often writes it as a small sign above
 *    the line (ٱلۡعَٰلَمِينَ) where imla'i writes a full letter (العالمين), with no rule to
 *    tell which. It is dropped in both. An alef that ends a word is kept (ما, فيها), except
 *    the silent one after a final waw (قالوا).
 * 4. In Uthmani a waw or a ya may only be the seat of a long "a" (ٱلصَّلَوٰةَ for الصلاة,
 *    هُدَىٰهُمۡ for هداهم): such a seat is treated as the long "a" it stands for.
 * 5. Final ى becomes ي, ة becomes ه, Persian and Urdu letter shapes become Arabic ones.
 *
 * Words are never merged nor cut: a word is a run of Arabic letters and signs; anything
 * else (space, punctuation, digit, Latin letter) separates words.
 *
 * The result is idempotent: normalising normalised words changes nothing.
 */

const HAMZA = 'ء';
const ALEF = 'ا';
const WAW = 'و';
const YA = 'ي';
const HA = 'ه';
const NOON = 'ن';

/** What a character is, for the rules above. */
type CharacterKind =
  | 'separator'
  | 'letter'
  /** ء أ إ ئ: a hamza, alone or on its seat. */
  | 'hamza'
  /** ؤ: a hamza on a waw (the alef after it, at the end of a word, is silent). */
  | 'hamza-on-waw'
  /** آ: a hamza followed by a long "a". */
  | 'hamza-then-long-a'
  /** ا and the linking alef ٱ. */
  | 'alef'
  /** The small alef written above the line. */
  | 'dagger-alef'
  /** Hamza sign above or below the previous letter. */
  | 'hamza-sign'
  | 'small-waw'
  | 'small-ya'
  /** Small ya above the line, a full ya in imla'i: إِبۡرَٰهِـۧمَ is إبراهيم. */
  | 'small-high-ya'
  /** Small noon above the line, a full noon in imla'i: نُـۨجِي is ننجي. */
  | 'small-high-noon'
  | 'tatweel'
  /** Vowel, shadda, annotation or pause mark: carried by a letter, dropped. */
  | 'sign'
  /** Sits inside a word without being part of it: dropped, and does not cut the word. */
  | 'invisible';

type CodePointRange = readonly [first: number, last: number];

/**
 * Letters of the Arabic script. Letters of other languages (پ, گ...) stay letters: they
 * never match a word of the Quran, but they must not cut a word in two either.
 */
const LETTER_RANGES: readonly CodePointRange[] = [
  [0x0620, 0x063f],
  [0x0641, 0x064a],
  [0x066e, 0x06d3],
  [0x06d5, 0x06d5],
  [0x06ee, 0x06ef],
  [0x06fa, 0x06ff],
  [0x0750, 0x077f],
  [0x08a0, 0x08c9],
];

/** Signs carried by a letter: vowels, shadda, Quranic annotations, pause marks. */
const SIGN_RANGES: readonly CodePointRange[] = [
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x06d6, 0x06dc],
  [0x06df, 0x06e4],
  [0x06ea, 0x06ed],
  [0x08ca, 0x08ff],
];

/** Letters with a rule of their own. */
const SPECIAL_LETTERS: Readonly<Record<string, CharacterKind>> = {
  ء: 'hamza',
  أ: 'hamza',
  إ: 'hamza',
  ئ: 'hamza',
  ؤ: 'hamza-on-waw',
  آ: 'hamza-then-long-a',
  ا: 'alef',
  ٱ: 'alef',
};

/**
 * Signs and invisible characters with a rule of their own. Written as code points because
 * they cannot be read in source code.
 */
const SPECIAL_CODE_POINTS: readonly (readonly [codePoint: number, kind: CharacterKind])[] = [
  [0x0670, 'dagger-alef'],
  [0x0654, 'hamza-sign'], // hamza above
  [0x0655, 'hamza-sign'], // hamza below
  [0x06e5, 'small-waw'],
  [0x06e6, 'small-ya'],
  [0x06e7, 'small-high-ya'],
  [0x06e8, 'small-high-noon'],
  [0x0640, 'tatweel'],
  [0x200c, 'invisible'], // zero-width non-joiner
  [0x200d, 'invisible'], // zero-width joiner
  [0x200e, 'invisible'], // left-to-right mark
  [0x200f, 'invisible'], // right-to-left mark
  [0x061c, 'invisible'], // Arabic letter mark
  [0xfeff, 'invisible'], // byte order mark
  // Thin spaces that some Quran editions use to place a sign inside a word (as in 2:72).
  [0x2009, 'invisible'],
  [0x200a, 'invisible'],
  [0x202f, 'invisible'],
];

/** Letters written differently for the same sound, mapped to one shape. */
const LETTER_VARIANTS: Readonly<Record<string, string>> = {
  ى: YA, // alef maqsura
  ة: HA, // ta marbuta
  ی: YA, // Farsi yeh
  ے: YA, // Urdu yeh barree
  ک: 'ك', // Persian keheh
  ہ: HA, // Urdu heh goal
  ھ: HA, // Urdu heh doachashmee
  ە: HA, // Kurdish ae
};

/** Kind of every character that can be part of a word; anything absent is a separator. */
const KIND_OF_CHARACTER: ReadonlyMap<number, CharacterKind> = buildKindTable();

function buildKindTable(): Map<number, CharacterKind> {
  const kinds = new Map<number, CharacterKind>();
  const fill = (ranges: readonly CodePointRange[], kind: CharacterKind): void => {
    for (const [first, last] of ranges) {
      for (let codePoint = first; codePoint <= last; codePoint += 1) kinds.set(codePoint, kind);
    }
  };
  fill(LETTER_RANGES, 'letter');
  fill(SIGN_RANGES, 'sign');
  // The special cases come last: they take precedence over the ranges.
  for (const [letter, kind] of Object.entries(SPECIAL_LETTERS))
    kinds.set(letter.charCodeAt(0), kind);
  for (const [codePoint, kind] of SPECIAL_CODE_POINTS) kinds.set(codePoint, kind);
  return kinds;
}

/** One sound-bearing piece of a word, before the rules that depend on its position. */
type Unit =
  | { readonly kind: 'letter'; readonly letter: string }
  | { readonly kind: 'hamza'; readonly onWaw: boolean }
  /** A long "a": plain alef, linking alef or the small alef above the line. */
  | { readonly kind: 'long-a' }
  /** A ya carrying a small alef: a long "a" inside a word, a plain ya at its end. */
  | { readonly kind: 'ya-seat' }
  /** Small waw or small ya of the Uthmani script. */
  | { readonly kind: 'small-vowel'; readonly letter: string };

const HAMZA_UNIT: Unit = { kind: 'hamza', onWaw: false };
const HAMZA_ON_WAW_UNIT: Unit = { kind: 'hamza', onWaw: true };
const LONG_A_UNIT: Unit = { kind: 'long-a' };
const YA_SEAT_UNIT: Unit = { kind: 'ya-seat' };
const SMALL_WAW_UNIT: Unit = { kind: 'small-vowel', letter: WAW };
const SMALL_YA_UNIT: Unit = { kind: 'small-vowel', letter: YA };
const YA_UNIT: Unit = { kind: 'letter', letter: YA };
const NOON_UNIT: Unit = { kind: 'letter', letter: NOON };

function isLetterUnit(unit: Unit | undefined, letter: string): boolean {
  return unit !== undefined && unit.kind === 'letter' && unit.letter === letter;
}

/** Reads the characters `text[from .. to)` of one word into units (rules 1, 2, 4 and 5). */
function readUnits(text: string, from: number, to: number): Unit[] {
  const units: Unit[] = [];
  // What came after the last unit. A tatweel means that a following sign sits on the
  // tatweel, not on the letter before it. A vowel sign means that a following small alef
  // is a real long "a" after a consonant (ٱلسَّمَٰوَٰتِ), not the mark of a seat (ٱلصَّلَوٰةَ).
  let tatweelSinceUnit = false;
  let signSinceUnit = false;

  for (let index = from; index < to; index += 1) {
    const character = text.charAt(index);
    const kind = KIND_OF_CHARACTER.get(text.charCodeAt(index));
    if (kind === 'invisible') continue;
    if (kind === 'tatweel') {
      tatweelSinceUnit = true;
      continue;
    }
    if (kind === 'sign') {
      signSinceUnit = true;
      continue;
    }

    const last = units[units.length - 1];
    const lastIsBare = !tatweelSinceUnit && !signSinceUnit;
    if (kind === 'dagger-alef') {
      if (lastIsBare && isLetterUnit(last, WAW)) units[units.length - 1] = LONG_A_UNIT;
      else if (lastIsBare && isLetterUnit(last, YA)) units[units.length - 1] = YA_SEAT_UNIT;
      else units.push(LONG_A_UNIT);
    } else if (kind === 'hamza-sign') {
      // A hamza sign turns the alef, waw or ya under it into a hamza (decomposed أ ؤ ئ);
      // on a tatweel or on any other letter it is a hamza of its own (شَيۡـٔٗا).
      const onWaw = isLetterUnit(last, WAW);
      const onSeat = last?.kind === 'long-a' || onWaw || isLetterUnit(last, YA);
      if (onSeat && !tatweelSinceUnit) {
        units[units.length - 1] = onWaw ? HAMZA_ON_WAW_UNIT : HAMZA_UNIT;
      } else {
        units.push(HAMZA_UNIT);
      }
    } else if (kind === 'hamza') {
      units.push(HAMZA_UNIT);
    } else if (kind === 'hamza-on-waw') {
      units.push(HAMZA_ON_WAW_UNIT);
    } else if (kind === 'hamza-then-long-a') {
      units.push(HAMZA_UNIT, LONG_A_UNIT);
    } else if (kind === 'alef') {
      units.push(LONG_A_UNIT);
    } else if (kind === 'small-waw') {
      units.push(SMALL_WAW_UNIT);
    } else if (kind === 'small-ya') {
      units.push(SMALL_YA_UNIT);
    } else if (kind === 'small-high-ya') {
      units.push(YA_UNIT);
    } else if (kind === 'small-high-noon') {
      units.push(NOON_UNIT);
    } else {
      units.push({ kind: 'letter', letter: LETTER_VARIANTS[character] ?? character });
    }
    tatweelSinceUnit = false;
    signSinceUnit = false;
  }
  return units;
}

/**
 * Spells the units of one word, applying the rules that depend on the position (2 and 3)
 * and the rule of the small vowels.
 */
function spellUnits(units: readonly Unit[]): string {
  const lastIndex = units.length - 1;
  let spelled = '';
  let previous: Unit | undefined;

  for (let index = 0; index <= lastIndex; index += 1) {
    const unit = units[index];
    if (unit === undefined) continue;

    if (unit.kind === 'letter') {
      spelled += unit.letter;
    } else if (unit.kind === 'hamza' || (unit.kind === 'long-a' && index === 0)) {
      // ءَأَنذَرۡتَهُمۡ and أَأَنذَرْتَهُمْ: two hamzas in a row are written once.
      if (!spelled.endsWith(HAMZA)) spelled += HAMZA;
    } else if (unit.kind === 'long-a') {
      // Silent after a waw, whether full (قالوا), small (تَلۡوُۥٓاْ) or carrying a hamza (يَبۡدَؤُاْ).
      const silentAfterWaw =
        spelled.endsWith(WAW) || (previous?.kind === 'hamza' && previous.onWaw);
      if (index === lastIndex && !silentAfterWaw) spelled += ALEF;
    } else if (unit.kind === 'ya-seat') {
      if (index === lastIndex) spelled += YA;
    } else {
      // Small waw and small ya lengthen the pronoun "his" (لَهُۥ, بِهِۦ), which imla'i does
      // not write: dropped. Anywhere else they stand for a letter that imla'i writes in
      // full (دَاوُۥدَ is داوود, يُحۡيِۦ is يحيي): kept.
      const lengthensPronoun = index === lastIndex && isLetterUnit(previous, HA);
      if (!lengthensPronoun) spelled += unit.letter;
    }
    previous = unit;
  }
  return spelled;
}

/**
 * Splits a text into comparable words. Returns an empty list when the text holds no
 * Arabic word. Throws a TypeError when `text` is not a string.
 */
export function normalizeArabic(text: string): string[] {
  if (typeof text !== 'string') {
    throw new TypeError(`normalizeArabic expects a string, got ${typeof text}`);
  }
  const words: string[] = [];
  let wordStart = -1; // -1: not inside a word

  for (let index = 0; index <= text.length; index += 1) {
    const insideWord = index < text.length && KIND_OF_CHARACTER.has(text.charCodeAt(index));
    if (insideWord && wordStart === -1) {
      wordStart = index;
    } else if (!insideWord && wordStart !== -1) {
      const spelled = spellUnits(readUnits(text, wordStart, index));
      // A lone pause mark or a tatweel leaves nothing: it is not a word.
      if (spelled !== '') words.push(spelled);
      wordStart = -1;
    }
  }
  return words;
}

/**
 * Letters that non-Arabic speakers confuse, mapped to one letter per group:
 * ح/ه, ع/ء, ق/ك, ص/س/ث, ض/د, ط/ت, ذ/ز/ظ.
 */
const ACCENT_GROUPS: Readonly<Record<string, string>> = {
  ح: HA,
  ع: HAMZA,
  ق: 'ك',
  ص: 'س',
  ث: 'س',
  ض: 'د',
  ط: 'ت',
  ذ: 'ز',
  ظ: 'ز',
};

/** Accent-tolerant key of a word that is already normalised. */
export function accentKeyOfNormalized(normalizedWord: string): string {
  let key = '';
  for (let index = 0; index < normalizedWord.length; index += 1) {
    const letter = normalizedWord.charAt(index);
    const grouped = ACCENT_GROUPS[letter] ?? letter;
    // ع becomes ء: a hamza next to it must not be written twice (rule 2).
    if (grouped === HAMZA && key.endsWith(HAMZA)) continue;
    key += grouped;
  }
  return key;
}

/**
 * Second key of a word, tolerant to a foreign accent: two words that only differ by letters
 * of the same group get the same key. Accepts one word, raw or already normalised.
 * Throws a TypeError when `word` does not hold exactly one Arabic word.
 */
export function toAccentKey(word: string): string {
  const normalized = normalizeArabic(word);
  const [only] = normalized;
  if (only === undefined || normalized.length !== 1) {
    throw new TypeError(`toAccentKey expects exactly one Arabic word, got ${normalized.length}`);
  }
  return accentKeyOfNormalized(only);
}

/**
 * True when two normalised words, read as one, spell `whole`. Used to compare words that
 * the two scripts cut differently: يَـٰٓأَيُّهَا is one word in Uthmani and two (يا أيها) in
 * imla'i. Once joined, the alef that ended the first word is inside the word, where rule 3
 * drops it, and a hamza met twice at the junction is written once (rule 2).
 */
export function isJoinedSpelling(first: string, second: string, whole: string): boolean {
  // Cheap way out for the usual case: the joined word starts like the first one.
  if (first.charCodeAt(0) !== whole.charCodeAt(0)) return false;
  const head = spellingInsideWord(first);
  const tail = head.endsWith(HAMZA) && second.startsWith(HAMZA) ? second.slice(1) : second;
  // Each half must bring letters of its own: a lone ء followed by أن is not "أن in two words".
  const bothHalvesCount = tail.length > 0 && head.length + tail.length > second.length;
  return (
    bothHalvesCount &&
    head.length + tail.length === whole.length &&
    whole.startsWith(head) &&
    whole.endsWith(tail)
  );
}

/** True when `part` spells only the beginning or the end of `whole`. */
export function isPartOfSpelling(part: string, whole: string): boolean {
  const head = spellingInsideWord(part);
  const isShorter = head.length > 0 && head.length < whole.length;
  return isShorter && (whole.startsWith(head) || whole.endsWith(part));
}

/** A word as spelled when another word follows it without a space: its final alef is dropped (rule 3). */
function spellingInsideWord(normalizedWord: string): string {
  return normalizedWord.endsWith(ALEF) ? normalizedWord.slice(0, -1) : normalizedWord;
}
