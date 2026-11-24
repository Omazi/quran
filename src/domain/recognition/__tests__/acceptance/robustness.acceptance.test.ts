/**
 * Acceptance tests of what must hold whatever the input: explicit errors on invalid input
 * (docs/CONTRIBUTING.md: "Entrées invalides : erreur explicite (RangeError, TypeError),
 * jamais de valeur silencieusement corrigée"), no other throw, no mutation, same input same
 * output, bounded work, and the speed budgets of docs/specs/recognition.md.
 */
import {
  createFollowSession,
  createVerseIndex,
  normalizeArabic,
  RECOGNITION_CONFIG,
  toAccentKey,
} from '@/domain/recognition';
import type { SearchResult, VerseIndex, VerseText } from '@/domain/recognition';

import {
  confuseEmphatics,
  describeResult,
  drawUniquePassages,
  dropShortParticle,
  median,
  randomInt,
  rawWords,
  report,
  requireCorpus,
  seededRandom,
  splitWords,
  timed,
  toPlene,
  transcriptOf,
  uthmaniCorpus,
  verseText,
  type FlatCorpus,
} from './acceptance-kit';

const describeWithCorpus = uthmaniCorpus() === null ? describe.skip : describe;

/** Messages of errors that the engine throws by accident, not the module on purpose. */
const ACCIDENTAL_ERROR =
  /Cannot read|Cannot convert|is not a function|is not iterable|undefined is not|null is not/;

/** What a call did, in one line, and whether it is the explicit error the rules ask for. */
function outcomeOf(action: () => unknown): {
  explicitError: boolean;
  threw: boolean;
  line: string;
} {
  try {
    const value = action();
    const text = JSON.stringify(value) ?? String(value);
    return { explicitError: false, threw: false, line: `returned ${text.slice(0, 80)}` };
  } catch (error) {
    const explicit =
      (error instanceof RangeError || error instanceof TypeError) &&
      error.message !== '' &&
      !ACCIDENTAL_ERROR.test(error.message);
    const name = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { explicitError: explicit, threw: true, line: `threw ${name.slice(0, 100)}` };
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** One letter (ba', U+0628) written `length` times: no word of any language. */
function overlongWord(length: number): string {
  return '\u0628'.repeat(length);
}

describeWithCorpus('Robustness of the recognition module', () => {
  let corpus: FlatCorpus;
  let index: VerseIndex;
  let threeWords: string[];
  let verseWords: string[];

  beforeAll(() => {
    corpus = requireCorpus();
    index = createVerseIndex(corpus.verses);
    threeWords = rawWords(corpus, '2:255', 1, 3);
    verseWords = rawWords(corpus, '2:255');
  });

  describe('règle : entrées invalides — erreur explicite (RangeError, TypeError)', () => {
    it('every invalid call throws an explicit RangeError or TypeError with a message of its own', () => {
      // The public functions, seen as a careless JavaScript caller sees them.
      const normalize = normalizeArabic as (text: unknown) => unknown;
      const accentKey = toAccentKey as (word: unknown) => unknown;
      const buildIndex = createVerseIndex as (verses: unknown) => unknown;
      const search = index.search.bind(index) as (words: unknown, options?: unknown) => unknown;
      const follow = createFollowSession as (words: unknown) => { feed(words: unknown): unknown };
      const word = threeWords[0] ?? '';
      const verse = (overrides: object): object[] => [
        { surah: 1, verse: 1, text: word, ...overrides },
      ];
      const calls: (readonly [string, () => unknown])[] = [
        ['normalizeArabic(undefined)', () => normalize(undefined)],
        ['normalizeArabic(null)', () => normalize(null)],
        ['normalizeArabic(42)', () => normalize(42)],
        ['normalizeArabic([word])', () => normalize([word])],
        ['toAccentKey(undefined)', () => accentKey(undefined)],
        ['toAccentKey(7)', () => accentKey(7)],
        ['createVerseIndex(undefined)', () => buildIndex(undefined)],
        ['createVerseIndex({})', () => buildIndex({})],
        ['createVerseIndex("text")', () => buildIndex(word)],
        ['createVerseIndex([])', () => buildIndex([])],
        ['createVerseIndex([null])', () => buildIndex([null])],
        ['createVerseIndex([text: 5])', () => buildIndex(verse({ text: 5 }))],
        ['createVerseIndex([text: ""])', () => buildIndex(verse({ text: '' }))],
        ['createVerseIndex([text: Latin only])', () => buildIndex(verse({ text: 'hello world' }))],
        ['createVerseIndex([surah: 0])', () => buildIndex(verse({ surah: 0 }))],
        ['createVerseIndex([surah: 115])', () => buildIndex(verse({ surah: 115 }))],
        ['createVerseIndex([surah: 1.5])', () => buildIndex(verse({ surah: 1.5 }))],
        ['createVerseIndex([surah: "1"])', () => buildIndex(verse({ surah: '1' }))],
        ['createVerseIndex([verse: 0])', () => buildIndex(verse({ verse: 0 }))],
        ['createVerseIndex([verse: -3])', () => buildIndex(verse({ verse: -3 }))],
        ['createVerseIndex([verse: NaN])', () => buildIndex(verse({ verse: Number.NaN }))],
        ['createVerseIndex([same verse twice])', () => buildIndex([...verse({}), ...verse({})])],
        [
          'createVerseIndex([2:1 before 1:1])',
          () => buildIndex([...verse({ surah: 2 }), ...verse({})]),
        ],
        ['search(undefined)', () => search(undefined)],
        ['search("three words in one string")', () => search(threeWords.join(' '))],
        ['search([1, 2, 3])', () => search([1, 2, 3])],
        ['search([word, null, word])', () => search([word, null, word])],
        ['search(words, null)', () => search(threeWords, null)],
        ['search(words, "fast")', () => search(threeWords, 'fast')],
        ['search(words, { minWords: 0 })', () => search(threeWords, { minWords: 0 })],
        ['search(words, { minWords: -1 })', () => search(threeWords, { minWords: -1 })],
        ['search(words, { minWords: 1.5 })', () => search(threeWords, { minWords: 1.5 })],
        ['search(words, { minWords: NaN })', () => search(threeWords, { minWords: Number.NaN })],
        ['search(words, { minWords: Infinity })', () => search(threeWords, { minWords: Infinity })],
        ['search(words, { minWords: "3" })', () => search(threeWords, { minWords: '3' })],
        ['search(words, { minScore: -0.1 })', () => search(threeWords, { minScore: -0.1 })],
        ['search(words, { minScore: 1.01 })', () => search(threeWords, { minScore: 1.01 })],
        ['search(words, { minScore: NaN })', () => search(threeWords, { minScore: Number.NaN })],
        ['search(words, { minScore: "0.5" })', () => search(threeWords, { minScore: '0.5' })],
        [
          'search(words, { maxAlternatives: -1 })',
          () => search(threeWords, { maxAlternatives: -1 }),
        ],
        [
          'search(words, { maxAlternatives: 2.5 })',
          () => search(threeWords, { maxAlternatives: 2.5 }),
        ],
        [
          'search(words, { maxAlternatives: NaN })',
          () => search(threeWords, { maxAlternatives: Number.NaN }),
        ],
        [
          'search(words, { maxAlternatives: Infinity })',
          () => search(threeWords, { maxAlternatives: Infinity }),
        ],
        ['createFollowSession(undefined)', () => follow(undefined)],
        ['createFollowSession("text")', () => follow(threeWords.join(' '))],
        ['createFollowSession([])', () => follow([])],
        ['createFollowSession([1])', () => follow([1])],
        ['createFollowSession([""])', () => follow([''])],
        ['createFollowSession(["hello"])', () => follow(['hello'])],
        [
          'createFollowSession([two words in one entry])',
          () => follow([threeWords.slice(0, 2).join(' ')]),
        ],
        ['feed(undefined)', () => follow(threeWords).feed(undefined)],
        ['feed("text")', () => follow(threeWords).feed(word)],
        ['feed([1])', () => follow(threeWords).feed([1])],
        ['feed([null])', () => follow(threeWords).feed([null])],
      ];
      const notExplicit = calls
        .map(([name, action]) => ({ name, outcome: outcomeOf(action) }))
        .filter(({ outcome }) => !outcome.explicitError)
        .map(({ name, outcome }) => `${name} ${outcome.line}`);
      expect(notExplicit).toEqual([]);
    });

    it('nothing else throws: odd but valid input gets an answer', () => {
      const session = createFollowSession(verseWords);
      const loneSurrogate = String.fromCharCode(0xd83d);
      const calls: (readonly [string, () => unknown])[] = [
        ['normalizeArabic of a lone surrogate', () => normalizeArabic(loneSurrogate)],
        [
          'normalizeArabic of a null character',
          () => normalizeArabic(`${threeWords[0]}\u0000${threeWords[1]}`),
        ],
        ['normalizeArabic of 100,000 spaces', () => normalizeArabic(' '.repeat(100_000))],
        ['search([])', () => index.search([])],
        ['search(["", " "])', () => index.search(['', ' '])],
        ['search(Latin words)', () => index.search(['in', 'the', 'name', 'of', 'God'])],
        ['search(emoji)', () => index.search(['\u{1F642}', '\u{1F642}', '\u{1F642}'])],
        [
          'search(lone surrogates)',
          () => index.search([loneSurrogate, loneSurrogate, loneSurrogate]),
        ],
        ['search(words, {})', () => index.search(threeWords, {})],
        ['search(words, undefined)', () => index.search(threeWords, undefined)],
        ['search(words, { minScore: 0 })', () => index.search(threeWords, { minScore: 0 })],
        ['search(words, { minScore: 1 })', () => index.search(threeWords, { minScore: 1 })],
        [
          'search(words, { maxAlternatives: 0 })',
          () => index.search(threeWords, { maxAlternatives: 0 }),
        ],
        ['search(words, { minWords: 1000 })', () => index.search(threeWords, { minWords: 1000 })],
        ['feed([])', () => session.feed([])],
        ['feed(["", "hello", emoji])', () => session.feed(['', 'hello', '\u{1F642}'])],
        ['feed([lone surrogate])', () => session.feed([loneSurrogate])],
        [
          'createVerseIndex of one verse',
          () =>
            createVerseIndex([{ surah: 1, verse: 1, text: verseText(corpus, '1:1') }]).search(
              threeWords,
            ),
        ],
      ];
      const thrown = calls
        .map(([name, action]) => ({ name, outcome: outcomeOf(action) }))
        .filter(({ outcome }) => outcome.threw)
        .map(({ name, outcome }) => `${name} ${outcome.line}`);
      expect(thrown).toEqual([]);
    });
  });

  describe('inputs are never mutated; same input, same output', () => {
    it('frozen verses, words and options are accepted and left as they were', () => {
      const verses: VerseText[] = corpus.verses
        .filter((verse) => verse.surah >= 110)
        .map((verse) => ({ surah: verse.surah, verse: verse.verse, text: verse.text }));
      const versesBefore = JSON.stringify(verses);
      const words = [...rawWords(corpus, '112:1'), ...rawWords(corpus, '112:2')];
      const wordsBefore = JSON.stringify(words);
      const options = { minWords: 3, minScore: 0.6, maxAlternatives: 2 };
      deepFreeze(verses);
      deepFreeze(words);
      deepFreeze(options);
      const small = createVerseIndex(verses);
      expect(small.search(words, options).status).toBe('found');
      const session = createFollowSession(words);
      session.feed(words);
      expect(JSON.stringify(verses)).toBe(versesBefore);
      expect(JSON.stringify(words)).toBe(wordsBefore);
      expect(options).toEqual({ minWords: 3, minScore: 0.6, maxAlternatives: 2 });
      expect(Object.isFrozen(RECOGNITION_CONFIG)).toBe(true);
    });

    it('the same search gives the same result: twice on one index, on a second index, and after other searches', () => {
      const random = seededRandom(5150);
      const second = createVerseIndex(corpus.verses);
      const inputs = drawUniquePassages(corpus, random, 40, 3, 12).flatMap((passage) => {
        const clean = transcriptOf(corpus, passage, toPlene);
        return [
          clean,
          confuseEmphatics(clean, random) ?? clean,
          dropShortParticle(clean, random) ?? clean,
        ];
      });
      inputs.push(rawWords(corpus, '55:13'), rawWords(corpus, '1:1'));
      const firstPass = inputs.map((words) => JSON.stringify(index.search(words)));
      const different: string[] = [];
      [...inputs].reverse().forEach((words, reversed) => {
        const position = inputs.length - 1 - reversed;
        if (JSON.stringify(index.search(words)) !== firstPass[position])
          different.push(`again: ${words.join(' ')}`);
        if (JSON.stringify(second.search(words)) !== firstPass[position])
          different.push(`second index: ${words.join(' ')}`);
      });
      expect(different).toEqual([]);
    });

    it('changing a returned result does not change the next answer', () => {
      const words = rawWords(corpus, '55:13');
      const first: SearchResult = index.search(words);
      const copy = JSON.stringify(first);
      try {
        // The types are read-only; a caller in plain JavaScript could still write.
        (first.candidates as unknown[]).length = 0;
        (first as { status: string }).status = 'found';
      } catch {
        // Frozen results refuse the write: just as good.
      }
      expect(JSON.stringify(index.search(words))).toBe(copy);
    });

    it('normalizeArabic and toAccentKey give the same answer every time, and a new list every time', () => {
      const text = verseText(corpus, '2:255');
      const once = normalizeArabic(text);
      const twice = normalizeArabic(text);
      expect(twice).toEqual(once);
      expect(twice).not.toBe(once);
      expect(toAccentKey(once[0] ?? '')).toBe(toAccentKey(once[0] ?? ''));
    });
  });

  describe('bounded work (no rule of the spec limits the input: see the report)', () => {
    it('follow-along: a "word" of 65,536 letters or more is not a reading of the expected word', () => {
      const wronglyRead: string[] = [];
      for (const length of [1_000, 65_535, 65_536, 65_537, 131_073]) {
        const session = createFollowSession(verseWords);
        const { value, milliseconds } = timed(() => session.feed([overlongWord(length)]));
        if (value.statuses[0] === 'read') {
          wronglyRead.push(
            `${length} letters: first word marked read (${milliseconds.toFixed(0)} ms)`,
          );
        }
      }
      expect(wronglyRead).toEqual([]);
    }, 60_000);

    it('follow-along: five over-long tokens in a row do not mark five words as read', () => {
      const session = createFollowSession(verseWords);
      const token = overlongWord(65_536);
      let snapshot = session.snapshot();
      for (let said = 0; said < 5; said += 1) snapshot = session.feed([token]);
      expect(snapshot.statuses.filter((status) => status === 'read')).toHaveLength(0);
      expect(snapshot.currentIndex).toBe(0);
    }, 60_000);

    it('search: an over-long "word" is never the reason for a found passage', () => {
      const token = overlongWord(65_537);
      const alone = index.search([token, token, token]);
      expect(alone.status).toBe('not-found');
      // Two real words of 2:255 and the token: two words cannot be found, the token adds nothing.
      const withTwoWords = index.search([...threeWords.slice(0, 2), token]);
      expect(describeResult(withTwoWords)).not.toMatch(/^found/);
    }, 60_000);

    it('search time grows in proportion to the number of words heard, not to its square (500, 1,000 and 2,000 words of one passage)', () => {
      const start = corpus.verseStart.get('2:1') ?? 0;
      const searchTime = (wordCount: number, runs: number): number => {
        const words = corpus.words.slice(start, start + wordCount);
        const times: number[] = [];
        for (let run = 0; run < runs; run += 1) {
          const { value, milliseconds } = timed(() => index.search(words));
          expect(value.status).toBe('found');
          times.push(milliseconds);
        }
        return Math.min(...times);
      };
      searchTime(100, 2);
      const fiveHundred = searchTime(500, 2);
      const thousand = searchTime(1_000, 2);
      const twoThousand = searchTime(2_000, 1);
      const random = seededRandom(64);
      const unrelated = (wordCount: number): number => {
        const words = Array.from(
          { length: wordCount },
          () => corpus.words[randomInt(random, 0, corpus.words.length - 1)] ?? '',
        );
        return timed(() => index.search(words)).milliseconds;
      };
      const unrelated250 = unrelated(250);
      const unrelated500 = unrelated(500);
      report('search time against input length (no limit on the input)', [
        `one clean passage from 2:1: 500 words ${fiveHundred.toFixed(0)} ms, 1,000 words ${thousand.toFixed(0)} ms, 2,000 words ${twoThousand.toFixed(0)} ms`,
        `growth when the input doubles: x${(thousand / fiveHundred).toFixed(1)} then x${(twoThousand / thousand).toFixed(1)} (2 would be proportional, 4 is quadratic)`,
        `words drawn anywhere in the text: 250 words ${unrelated250.toFixed(0)} ms, 500 words ${unrelated500.toFixed(0)} ms (x${(unrelated500 / unrelated250).toFixed(1)})`,
      ]);
      // Proportional work doubles; a margin of one half is left for noise.
      expect(thousand / fiveHundred).toBeLessThan(3);
      expect(twoThousand / thousand).toBeLessThan(3);
    }, 300_000);

    it('measure: one very long word and one very long feed', () => {
      const lines: string[] = [];
      for (const length of [100, 10_000, 65_535]) {
        const token = overlongWord(length);
        const session = createFollowSession(verseWords);
        const fed = timed(() => session.feed([token]));
        const searched = timed(() => index.search([token, token, token]));
        const normalized = timed(() => normalizeArabic(token));
        lines.push(
          `one word of ${length} letters: feed ${fed.milliseconds.toFixed(0)} ms, search of three ${searched.milliseconds.toFixed(0)} ms, normalizeArabic ${normalized.milliseconds.toFixed(0)} ms (kept as one word of ${normalized.value[0]?.length} letters)`,
        );
      }
      const random = seededRandom(65);
      for (const wordCount of [500, 2_000]) {
        const session = createFollowSession(verseWords);
        const words = Array.from(
          { length: wordCount },
          () => corpus.words[randomInt(random, 0, corpus.words.length - 1)] ?? '',
        );
        const fed = timed(() => session.feed(words));
        lines.push(
          `one feed of ${wordCount} unrelated words to a 50-word session: ${fed.milliseconds.toFixed(0)} ms`,
        );
      }
      const whole = corpus.verses.map((verse) => verse.text).join(' ');
      const all = timed(() => normalizeArabic(whole));
      lines.push(
        `normalizeArabic of the whole text in one string (${all.value.length} words): ${all.milliseconds.toFixed(0)} ms`,
      );
      report('very long words and very long feeds', lines);
      expect(all.value).toHaveLength(corpus.words.length);
    }, 120_000);
  });

  describe('règle : budget — index en moins de 2 s, recherche de 12 mots en moins de 150 ms', () => {
    it('builds the index of the 6236 verses in less than 2 s', () => {
      const times = [1, 2, 3, 4, 5].map(
        () => timed(() => createVerseIndex(corpus.verses)).milliseconds,
      );
      report('index build', [`five builds: ${times.map((time) => time.toFixed(0)).join(', ')} ms`]);
      expect(Math.max(...times)).toBeLessThan(2_000);
    });

    it('answers a search of 12 words in less than 150 ms: random passages, damaged passages, and the commonest words of the text', () => {
      const random = seededRandom(150);
      const inputs: string[][] = [];
      for (const passage of drawUniquePassages(corpus, random, 200, 12, 12)) {
        const clean = transcriptOf(corpus, passage, toPlene);
        inputs.push(clean, confuseEmphatics(clean, random) ?? clean);
      }
      const frequency = new Map<string, number>();
      for (const word of corpus.words) frequency.set(word, (frequency.get(word) ?? 0) + 1);
      const commonest = [...frequency.entries()]
        .sort((one, other) => other[1] - one[1])
        .slice(0, 12)
        .map(([word]) => word);
      const hard: string[][] = [commonest, [...commonest].reverse()];
      for (let draw = 0; draw < 100; draw += 1) {
        hard.push(Array.from({ length: 12 }, () => commonest[randomInt(random, 0, 5)] ?? ''));
      }
      // The refrain of surah 55 three times: twelve words, 31 places each.
      const refrain = splitWords(toPlene(verseText(corpus, '55:13')));
      hard.push([...refrain, ...refrain, ...refrain]);
      for (const words of inputs.slice(0, 20)) index.search(words);
      const ordinary = inputs.map((words) => timed(() => index.search(words)).milliseconds);
      const worstCase = hard.map((words) => timed(() => index.search(words)).milliseconds);
      report('search of 12 words', [
        `400 passages (clean and one confusion): median ${median(ordinary).toFixed(1)} ms, slowest ${Math.max(...ordinary).toFixed(1)} ms`,
        `103 inputs made of the 12 commonest words or of the refrain of surah 55: median ${median(worstCase).toFixed(1)} ms, slowest ${Math.max(...worstCase).toFixed(1)} ms`,
      ]);
      expect(Math.max(...ordinary, ...worstCase)).toBeLessThan(150);
    }, 120_000);
  });
});
