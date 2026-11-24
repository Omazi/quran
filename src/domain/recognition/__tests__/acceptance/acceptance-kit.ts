/**
 * Tools of the recognition acceptance tests, written by the independent tester from
 * docs/specs/recognition.md and the public API only (index.ts, types.ts, config names).
 *
 * No Quran text is copied here: every Arabic string of the tests is taken from the corpus
 * by verse key, or built from it by one of the transformations described below.
 *
 * Jest runs every file under `__tests__` as a suite and the tester may write nowhere else:
 * the self-check at the bottom is registered only when this file is the suite.
 */
import { normalizeArabic } from '@/domain/recognition';
import type { PassageCandidate, SearchResult, VerseText, WordRef } from '@/domain/recognition';

import { loadUthmaniCorpus, runsFromRepositoryRoot, toVerseTexts } from '../../test-support/corpus';

/** The one Node function needed besides the developer's reader (no Node typings here). */
interface NodeFileSystem {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: 'utf8'): string;
}

const nodeFileSystem = jest.requireActual<NodeFileSystem>('fs');

const MINIMAL_SPELLING_PATH = 'assets/data/verses/uthmani-minimal.json';
const OWN_FILE_NAME = 'acceptance-kit.ts';

export const VERSE_TOTAL = 6236;

// ---- Corpus ---------------------------------------------------------------------------

/** The whole text as one run of comparable words, each with its place. */
export interface FlatCorpus {
  readonly verses: readonly VerseText[];
  /** Comparable words (`normalizeArabic`) of the whole text, in mushaf order. */
  readonly words: readonly string[];
  /** Place of each comparable word: same length as `words`. */
  readonly refs: readonly WordRef[];
  /** Index in `words` of the first word of each verse, by "surah:verse". */
  readonly verseStart: ReadonlyMap<string, number>;
  /** Number of comparable words of each verse, by "surah:verse". */
  readonly verseLength: ReadonlyMap<string, number>;
  readonly textByKey: ReadonlyMap<string, string>;
}

export function flatten(verses: readonly VerseText[]): FlatCorpus {
  const words: string[] = [];
  const refs: WordRef[] = [];
  const verseStart = new Map<string, number>();
  const verseLength = new Map<string, number>();
  const textByKey = new Map<string, string>();
  for (const verse of verses) {
    const key = `${verse.surah}:${verse.verse}`;
    const verseWords = normalizeArabic(verse.text);
    verseStart.set(key, words.length);
    verseLength.set(key, verseWords.length);
    textByKey.set(key, verse.text);
    verseWords.forEach((word, position) => {
      words.push(word);
      refs.push({ surah: verse.surah, verse: verse.verse, word: position + 1 });
    });
  }
  return { verses, words, refs, verseStart, verseLength, textByKey };
}

let cachedUthmani: FlatCorpus | null | undefined;
let cachedMinimal: readonly VerseText[] | null | undefined;

/** The full Uthmani text, or null when the generated file is absent (tests then skip). */
export function uthmaniCorpus(): FlatCorpus | null {
  if (cachedUthmani === undefined) {
    const verses = runsFromRepositoryRoot() ? loadUthmaniCorpus() : null;
    cachedUthmani = verses === null ? null : flatten(verses);
  }
  return cachedUthmani;
}

/** The second spelling of the same 6236 verses, or null when the file is absent. */
export function minimalSpellingVerses(): readonly VerseText[] | null {
  if (cachedMinimal === undefined) {
    const present = runsFromRepositoryRoot() && nodeFileSystem.existsSync(MINIMAL_SPELLING_PATH);
    cachedMinimal = present
      ? toVerseTexts(
          JSON.parse(nodeFileSystem.readFileSync(MINIMAL_SPELLING_PATH, 'utf8')) as unknown,
          MINIMAL_SPELLING_PATH,
        )
      : null;
  }
  return cachedMinimal;
}

/** The corpus, for tests that already checked that it is present. */
export function requireCorpus(): FlatCorpus {
  const corpus = uthmaniCorpus();
  if (corpus === null) throw new Error('The Uthmani corpus is absent: this test must be skipped');
  return corpus;
}

export function verseText(corpus: FlatCorpus, key: string): string {
  const text = corpus.textByKey.get(key);
  if (text === undefined) throw new Error(`Unknown verse ${key}`);
  return text;
}

/** Raw words of a verse, split on spaces, 1-based inclusive range. */
export function rawWords(corpus: FlatCorpus, key: string, from = 1, to?: number): string[] {
  const all = verseText(corpus, key)
    .split(' ')
    .filter((token) => token !== '');
  return all.slice(from - 1, to ?? all.length);
}

/** Index in `corpus.words` of a word given by place. */
export function globalIndex(corpus: FlatCorpus, ref: WordRef): number {
  const start = corpus.verseStart.get(`${ref.surah}:${ref.verse}`);
  const length = corpus.verseLength.get(`${ref.surah}:${ref.verse}`);
  if (start === undefined || length === undefined) {
    throw new Error(`Candidate names an unknown verse ${ref.surah}:${ref.verse}`);
  }
  if (!Number.isInteger(ref.word) || ref.word < 1 || ref.word > length) {
    throw new Error(`Candidate names word ${ref.word} of ${ref.surah}:${ref.verse} (${length})`);
  }
  return start + ref.word - 1;
}

export function describeRef(ref: WordRef): string {
  return `${ref.surah}:${ref.verse}#${ref.word}`;
}

export function describeCandidate(candidate: PassageCandidate): string {
  return `${describeRef(candidate.start)}..${describeRef(candidate.end)} score=${candidate.score.toFixed(2)} conf=${candidate.confidence.toFixed(2)}`;
}

export function describeResult(result: SearchResult): string {
  const head = result.status === 'not-found' ? `not-found(${result.reason})` : `${result.status}`;
  return `${head} tied=${result.tiedCount} [${result.candidates.map(describeCandidate).join(' | ')}]`;
}

// ---- Oracle: every place of an exact run of comparable words ------------------------------

/**
 * Brute force, independent of the index: every position of the corpus where the run of
 * comparable words occurs exactly (runs may cross verse and surah limits).
 */
export function exactPlaces(corpus: FlatCorpus, run: readonly string[]): number[] {
  const places: number[] = [];
  const first = run[0];
  if (first === undefined) return places;
  const last = corpus.words.length - run.length;
  for (let start = 0; start <= last; start += 1) {
    if (corpus.words[start] !== first) continue;
    let same = true;
    for (let offset = 1; offset < run.length && same; offset += 1) {
      same = corpus.words[start + offset] === run[offset];
    }
    if (same) places.push(start);
  }
  return places;
}

/** True when the candidate covers at least one word of [start, start + length). */
export function overlaps(
  corpus: FlatCorpus,
  candidate: PassageCandidate,
  start: number,
  length: number,
): boolean {
  const candidateStart = globalIndex(corpus, candidate.start);
  const candidateEnd = globalIndex(corpus, candidate.end);
  return candidateStart < start + length && candidateEnd >= start;
}

/** The first `tiedCount` candidates: the ones the module presents as equally good. */
export function tiedCandidates(result: SearchResult): readonly PassageCandidate[] {
  return result.candidates.slice(0, result.tiedCount);
}

/**
 * How a result relates to the true place of a passage.
 * - `right`: found, and the single best candidate is the true place;
 * - `ambiguous-with-truth`: ambiguous, the true place is among the tied candidates;
 * - `ambiguous-without-truth`: ambiguous, the true place is not among the tied candidates;
 * - `not-found`;
 * - `confidently-wrong`: found, and the single best candidate is another place.
 */
export type Verdict =
  'right' | 'ambiguous-with-truth' | 'ambiguous-without-truth' | 'not-found' | 'confidently-wrong';

export function judge(
  corpus: FlatCorpus,
  result: SearchResult,
  trueStart: number,
  trueLength: number,
): Verdict {
  if (result.status === 'not-found') return 'not-found';
  const tied = tiedCandidates(result);
  const truthListed = tied.some((candidate) => overlaps(corpus, candidate, trueStart, trueLength));
  if (result.status === 'found') return truthListed ? 'right' : 'confidently-wrong';
  return truthListed ? 'ambiguous-with-truth' : 'ambiguous-without-truth';
}

// ---- Transcript styles (what a speech engine could write) ---------------------------------

const DAGGER_ALEF = '\u0670';
const ALEF = '\u0627';
const WAW = '\u0648';
const ALEF_MAKSURA = '\u0649';
const TATWEEL = '\u0640';
const HAMZA = '\u0621';

/**
 * "Bare" transcript: the tester's own stripping, not the module's. Removes every combining
 * mark, the tatweel and the Quranic annotation signs that are not letters, writes the alef
 * wasla as a plain alef and a hamza that the source writes as a combining mark as a hamza
 * on the line. The consonant skeleton stays as the source spells it. An earlier build of
 * the corpus wrote a thin space (U+2009) inside one word of 2:72: a thin space is removed,
 * so that such a word stays whole.
 */
export function toBare(text: string): string {
  return text
    .replace(/\u0671/g, ALEF)
    .replace(/\u0640?\u0654/g, HAMZA)
    .replace(/\u0655/g, HAMZA)
    .replace(/[\p{M}\u0640\u06DD\u06DE\u06E5\u06E6\u06E9\u2009]/gu, '')
    .split(' ')
    .filter((token) => token !== '')
    .join(' ');
}

/**
 * "Plene" transcript: closer to everyday spelling. Before stripping, the superscript alef
 * is written as a full alef (waw + superscript alef becomes alef, as in the everyday
 * spelling of "salat"; after alef maksura it is dropped). A few very common words are not
 * spelled that way in everyday writing; no exception list is kept, so those words carry an
 * extra alef: a plausible engine output, and a harder input than the bare one.
 */
export function toPlene(text: string): string {
  const withFullAlef = text
    .replace(new RegExp(`${WAW}${DAGGER_ALEF}`, 'gu'), ALEF)
    .replace(new RegExp(`${ALEF_MAKSURA}${DAGGER_ALEF}`, 'gu'), ALEF_MAKSURA)
    .replace(new RegExp(`${TATWEEL}?${DAGGER_ALEF}`, 'gu'), ALEF);
  return toBare(withFullAlef);
}

export function splitWords(text: string): string[] {
  return text.split(' ').filter((token) => token !== '');
}

// ---- Reproducible randomness ----------------------------------------------------------------

export type Random = () => number;

/** mulberry32: small, fast, reproducible. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(random: Random, minimum: number, maximum: number): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

export function pick<T>(random: Random, items: readonly T[]): T {
  const item = items[randomInt(random, 0, items.length - 1)];
  if (item === undefined) throw new Error('pick() needs a non-empty list');
  return item;
}

// ---- Passages -------------------------------------------------------------------------------

/** A run of the corpus: `length` comparable words from position `start`. */
export interface Passage {
  readonly start: number;
  readonly length: number;
}

export function describePassage(corpus: FlatCorpus, passage: Passage): string {
  const first = corpus.refs[passage.start];
  const last = corpus.refs[passage.start + passage.length - 1];
  if (first === undefined || last === undefined) return 'passage outside the corpus';
  return `${describeRef(first)}..${describeRef(last)}`;
}

/**
 * The transcript of a passage, word for word, in the given style. The raw words of the
 * verses are transformed one by one, so the transcript has exactly `passage.length` words
 * whenever the style keeps one word per word.
 */
export function transcriptOf(
  corpus: FlatCorpus,
  passage: Passage,
  style: (text: string) => string,
  source: ReadonlyMap<string, string> = corpus.textByKey,
): string[] {
  const words: string[] = [];
  let position = passage.start;
  const end = passage.start + passage.length;
  while (position < end) {
    const ref = corpus.refs[position];
    if (ref === undefined) throw new Error('Passage outside the corpus');
    const key = `${ref.surah}:${ref.verse}`;
    const text = source.get(key);
    const length = corpus.verseLength.get(key);
    if (text === undefined || length === undefined) throw new Error(`Unknown verse ${key}`);
    const styled = splitWords(style(text));
    const take = Math.min(length - ref.word + 1, end - position);
    words.push(...styled.slice(ref.word - 1, ref.word - 1 + take));
    position += take;
  }
  return words;
}

/**
 * Draws passages of `minimumWords`..`maximumWords` words whose exact run of comparable
 * words occurs once in the whole text (the oracle says so), so that a single right answer
 * exists. They start anywhere: mostly mid-verse, often across a verse limit.
 */
export function drawUniquePassages(
  corpus: FlatCorpus,
  random: Random,
  count: number,
  minimumWords: number,
  maximumWords: number,
): Passage[] {
  const passages: Passage[] = [];
  let attempts = 0;
  while (passages.length < count) {
    attempts += 1;
    if (attempts > count * 200) throw new Error('Could not draw enough unique passages');
    const length = randomInt(random, minimumWords, maximumWords);
    const start = randomInt(random, 0, corpus.words.length - length);
    const first = corpus.refs[start];
    const last = corpus.refs[start + length - 1];
    // One surah per passage here; passages over a surah limit have their own tests.
    if (first === undefined || last === undefined || first.surah !== last.surah) continue;
    const run = corpus.words.slice(start, start + length);
    if (exactPlaces(corpus, run).length !== 1) continue;
    passages.push({ start, length });
  }
  return passages;
}

// ---- Transcript damage designed by the tester -------------------------------------------------

/** One kind of damage: returns the damaged words, or null when it cannot apply here. */
export type Damage = (words: readonly string[], random: Random) => string[] | null;

function indicesWhere(
  words: readonly string[],
  accepts: (word: string, index: number) => boolean,
): number[] {
  const indices: number[] = [];
  words.forEach((word, index) => {
    if (accepts(word, index)) indices.push(index);
  });
  return indices;
}

/** Two neighbouring words written as one (the engine missed the word limit). */
export const mergeTwoWords: Damage = (words, random) => {
  if (words.length < 2) return null;
  const at = randomInt(random, 0, words.length - 2);
  return [...words.slice(0, at), `${words[at]}${words[at + 1]}`, ...words.slice(at + 2)];
};

/** One word of four letters or more written as two (cut after its second letter or later). */
export const splitOneWord: Damage = (words, random) => {
  const long = indicesWhere(words, (word) => [...word].length >= 4);
  if (long.length === 0) return null;
  const at = pick(random, long);
  const letters = [...(words[at] ?? '')];
  const cut = randomInt(random, 2, letters.length - 2);
  return [
    ...words.slice(0, at),
    letters.slice(0, cut).join(''),
    letters.slice(cut).join(''),
    ...words.slice(at + 1),
  ];
};

/** One short particle (one or two letters once bare) not written at all. */
export const dropShortParticle: Damage = (words, random) => {
  const short = indicesWhere(words, (word) => [...word].length <= 2);
  if (short.length === 0) return null;
  const at = pick(random, short);
  return [...words.slice(0, at), ...words.slice(at + 1)];
};

/** One word written twice in a row (the reader stumbled, or the engine stuttered). */
export const doubleOneWord: Damage = (words, random) => {
  if (words.length === 0) return null;
  const at = randomInt(random, 0, words.length - 1);
  return [...words.slice(0, at + 1), ...words.slice(at)];
};

function swapLetters(pairs: readonly (readonly [string, string])[], maximumWords: number): Damage {
  const swap = new Map<string, string>();
  for (const [first, second] of pairs) {
    swap.set(first, second);
    if (!swap.has(second)) swap.set(second, first);
  }
  return (words, random) => {
    const candidates = indicesWhere(words, (word) => [...word].some((letter) => swap.has(letter)));
    if (candidates.length === 0) return null;
    const damaged = [...words];
    const wanted = Math.min(maximumWords, candidates.length);
    const remaining = [...candidates];
    for (let done = 0; done < wanted; done += 1) {
      const chosen = remaining.splice(randomInt(random, 0, remaining.length - 1), 1)[0];
      if (chosen === undefined) break;
      const letters = [...(damaged[chosen] ?? '')];
      const positions = indicesWhere(letters, (letter) => swap.has(letter));
      const position = pick(random, positions);
      letters[position] = swap.get(letters[position] ?? '') ?? '';
      damaged[chosen] = letters.join('');
    }
    return damaged;
  };
}

/** Emphatic consonant heard as its plain twin, or the reverse, in one or two words. */
export const confuseEmphatics: Damage = swapLetters(
  [
    ['\u0635', '\u0633'], // sad / sin
    ['\u0637', '\u062A'], // ta' emphatic / ta'
    ['\u0636', '\u062F'], // dad / dal
    ['\u0638', '\u0630'], // za' emphatic / dhal
    ['\u0642', '\u0643'], // qaf / kaf
  ],
  2,
);

/** The two h sounds, and hamza / ayn, confused in one or two words. */
export const confuseGutturals: Damage = swapLetters(
  [
    ['\u062D', '\u0647'], // ha' / ha
    ['\u0639', '\u0621'], // ayn / hamza
    ['\u0639', '\u0623'], // ayn / hamza on alef
  ],
  2,
);

/**
 * Confusions of an ordinary reader that the spec's list of merged letters does NOT contain:
 * tha' as ta', dhal as dal, za' emphatic as dad, ghayn as kha', jim as shin.
 */
export const confuseOutsideSpecList: Damage = swapLetters(
  [
    ['\u062B', '\u062A'], // tha' / ta'
    ['\u0630', '\u062F'], // dhal / dal
    ['\u0638', '\u0636'], // za' emphatic / dad
    ['\u063A', '\u062E'], // ghayn / kha'
    ['\u062C', '\u0634'], // jim / shin
  ],
  2,
);

/** A long vowel not written, or written where there is none (length misheard), in one word. */
export const disturbLongVowel: Damage = (words, random) => {
  const longVowels = [ALEF, WAW, '\u064A'];
  const candidates = indicesWhere(words, (word) => {
    const letters = [...word];
    return (
      letters.length >= 4 && letters.slice(1, -1).some((letter) => longVowels.includes(letter))
    );
  });
  if (candidates.length === 0) return null;
  const at = pick(random, candidates);
  const letters = [...(words[at] ?? '')];
  const inner = indicesWhere(
    letters,
    (letter, index) => index > 0 && index < letters.length - 1 && longVowels.includes(letter),
  );
  letters.splice(pick(random, inner), 1);
  const damaged = [...words];
  damaged[at] = letters.join('');
  return damaged;
};

/** Applies two different kinds of damage one after the other. */
export function combine(first: Damage, second: Damage): Damage {
  return (words, random) => {
    const once = first(words, random);
    return once === null ? null : second(once, random);
  };
}

// ---- Measures ---------------------------------------------------------------------------------

export interface Tally {
  total: number;
  right: number;
  ambiguousWithTruth: number;
  ambiguousWithoutTruth: number;
  notFound: number;
  confidentlyWrong: number;
  /** Description of every confidently wrong case, for the report. */
  readonly worst: string[];
}

export function newTally(): Tally {
  return {
    total: 0,
    right: 0,
    ambiguousWithTruth: 0,
    ambiguousWithoutTruth: 0,
    notFound: 0,
    confidentlyWrong: 0,
    worst: [],
  };
}

export function count(tally: Tally, verdict: Verdict, describeCase: () => string): void {
  tally.total += 1;
  if (verdict === 'right') tally.right += 1;
  else if (verdict === 'ambiguous-with-truth') tally.ambiguousWithTruth += 1;
  else if (verdict === 'ambiguous-without-truth') tally.ambiguousWithoutTruth += 1;
  else if (verdict === 'not-found') tally.notFound += 1;
  else {
    tally.confidentlyWrong += 1;
    tally.worst.push(describeCase());
  }
}

export function percent(part: number, total: number): string {
  return total === 0 ? 'n/a' : `${((100 * part) / total).toFixed(1)}%`;
}

export function tallyLine(label: string, tally: Tally): string {
  return [
    label.padEnd(34),
    `n=${String(tally.total).padStart(3)}`,
    `right ${percent(tally.right, tally.total).padStart(6)}`,
    `ambiguous+truth ${percent(tally.ambiguousWithTruth, tally.total).padStart(6)}`,
    `ambiguous-truth ${percent(tally.ambiguousWithoutTruth, tally.total).padStart(6)}`,
    `not-found ${percent(tally.notFound, tally.total).padStart(6)}`,
    `CONFIDENTLY WRONG ${tally.confidentlyWrong}`,
  ].join('  ');
}

/** Measures are reported through console.warn (the only console output the lint allows). */
export function report(title: string, lines: readonly string[]): void {
  console.warn(`[recognition acceptance] ${title}\n${lines.join('\n')}`);
}

/** Wall-clock duration of a call, in milliseconds. */
export function timed<T>(action: () => T): { value: T; milliseconds: number } {
  const before = performance.now();
  const value = action();
  return { value, milliseconds: performance.now() - before };
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

if (expect.getState().testPath?.endsWith(OWN_FILE_NAME)) {
  describe('acceptance kit', () => {
    it('seededRandom is reproducible and stays in [0, 1)', () => {
      const first = seededRandom(11);
      const second = seededRandom(11);
      for (let draw = 0; draw < 100; draw += 1) {
        const value = first();
        expect(value).toBe(second());
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('damage functions never change the words they are given', () => {
      const words = Object.freeze(['abcd', 'ef', 'ghij', 'kl']);
      const random = seededRandom(3);
      expect(mergeTwoWords(words, random)).toHaveLength(3);
      expect(splitOneWord(words, random)).toHaveLength(5);
      expect(dropShortParticle(words, random)).toHaveLength(3);
      expect(doubleOneWord(words, random)).toHaveLength(5);
      expect(words).toEqual(['abcd', 'ef', 'ghij', 'kl']);
    });

    const corpus = uthmaniCorpus();
    const itWithCorpus = corpus === null ? it.skip : it;

    itWithCorpus('the corpus has 6236 verses and the oracle finds a verse at its own place', () => {
      const flat = requireCorpus();
      expect(flat.verses).toHaveLength(VERSE_TOTAL);
      expect(flat.words).toHaveLength(flat.refs.length);
      const start = flat.verseStart.get('2:255') ?? -1;
      const length = flat.verseLength.get('2:255') ?? 0;
      expect(exactPlaces(flat, flat.words.slice(start, start + length))).toEqual([start]);
    });

    itWithCorpus('the bare and plene styles keep one word per word and leave no mark', () => {
      const flat = requireCorpus();
      for (const verse of flat.verses) {
        const raw = splitWords(verse.text).filter((token) => /\p{L}/u.test(token));
        const bare = splitWords(toBare(verse.text));
        expect(bare).toHaveLength(raw.length);
        expect(splitWords(toPlene(verse.text))).toHaveLength(raw.length);
        expect(/\p{M}/u.test(bare.join(''))).toBe(false);
      }
    });
  });
}
