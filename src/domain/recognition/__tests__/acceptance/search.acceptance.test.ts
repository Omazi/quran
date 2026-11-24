/**
 * Acceptance tests of the passage search, written from docs/specs/recognition.md section 2
 * ("Recherche d'un passage") and the public API. Every Arabic string comes from the corpus
 * by verse key, or is built from it by a transformation of the acceptance kit.
 *
 * Hard requirements fail the test. Accuracy measures only report their numbers
 * (console.warn, prefix "[recognition acceptance]").
 */
import { createVerseIndex, RECOGNITION_CONFIG } from '@/domain/recognition';
import type { SearchResult, VerseIndex, VerseText } from '@/domain/recognition';

import {
  combine,
  confuseEmphatics,
  confuseGutturals,
  confuseOutsideSpecList,
  count,
  describePassage,
  describeResult,
  disturbLongVowel,
  doubleOneWord,
  drawUniquePassages,
  dropShortParticle,
  exactPlaces,
  globalIndex,
  judge,
  mergeTwoWords,
  minimalSpellingVerses,
  newTally,
  overlaps,
  percent,
  randomInt,
  rawWords,
  report,
  requireCorpus,
  seededRandom,
  splitOneWord,
  splitWords,
  tallyLine,
  tiedCandidates,
  toBare,
  toPlene,
  transcriptOf,
  uthmaniCorpus,
  verseText,
  type Damage,
  type FlatCorpus,
  type Passage,
  type Tally,
} from './acceptance-kit';

const describeWithCorpus = uthmaniCorpus() === null ? describe.skip : describe;

const DAMAGES: readonly (readonly [string, Damage])[] = [
  ['two words merged', mergeTwoWords],
  ['one word split', splitOneWord],
  ['short particle dropped', dropShortParticle],
  ['one word doubled', doubleOneWord],
  ['emphatic / plain confused', confuseEmphatics],
  ['h sounds, hamza / ayn confused', confuseGutturals],
  ['confusions outside spec list', confuseOutsideSpecList],
  ['long vowel lost', disturbLongVowel],
  ['merged + emphatic confused', combine(mergeTwoWords, confuseEmphatics)],
];

/** Words of a verse in the plene transcript style, 1-based inclusive range. */
function plene(corpus: FlatCorpus, key: string, from = 1, to?: number): string[] {
  return splitWords(toPlene(verseText(corpus, key))).slice(from - 1, to);
}

/** Replaces the first occurrence of a letter in one word of a transcript (0-based index). */
function replaceLetter(words: readonly string[], at: number, from: string, to: string): string[] {
  const word = words[at];
  if (word === undefined || !word.includes(from)) {
    throw new Error(`Word ${at} has no letter U+${from.charCodeAt(0).toString(16)}`);
  }
  const damaged = [...words];
  damaged[at] = word.replace(from, to);
  return damaged;
}

/**
 * Places that hold exactly the same comparable words as one of the tied candidates and are
 * not among the tied candidates. Two places with the same words explain any input equally
 * well, so the spec's ambiguity rule wants both listed. Returns one line per missing place.
 */
function missingTwinPlaces(corpus: FlatCorpus, result: SearchResult): string[] {
  const tied = tiedCandidates(result);
  const missing: string[] = [];
  for (const candidate of tied.slice(0, 3)) {
    const start = globalIndex(corpus, candidate.start);
    const end = globalIndex(corpus, candidate.end);
    const run = corpus.words.slice(start, end + 1);
    for (const place of exactPlaces(corpus, run)) {
      if (tied.some((other) => overlaps(corpus, other, place, run.length))) continue;
      missing.push(describePassage(corpus, { start: place, length: run.length }));
    }
  }
  return missing;
}

/** Every run of `length` comparable words that stands at two places or more. */
function repeatedRuns(corpus: FlatCorpus, length: number): number[][] {
  const byRun = new Map<string, number[]>();
  for (let start = 0; start + length <= corpus.words.length; start += 1) {
    const key = corpus.words.slice(start, start + length).join(' ');
    const places = byRun.get(key);
    if (places === undefined) byRun.set(key, [start]);
    else places.push(start);
  }
  return [...byRun.values()].filter((places) => places.length >= 2);
}

function sameVerse(corpus: FlatCorpus, first: number, second: number): boolean {
  const one = corpus.refs[first];
  const other = corpus.refs[second];
  return (
    one !== undefined &&
    other !== undefined &&
    one.surah === other.surah &&
    one.verse === other.verse
  );
}

interface RepeatFailure {
  readonly line: string;
  /** True when every place that is not listed stands in a verse that has a listed place. */
  readonly onlySameVerseMissing: boolean;
}

/** Checks one repeated run: the result must be ambiguous and list every place. */
function checkRepeatedRun(
  corpus: FlatCorpus,
  index: VerseIndex,
  places: readonly number[],
  length: number,
): RepeatFailure | null {
  const first = places[0] ?? 0;
  const result = index.search(corpus.words.slice(first, first + length));
  const tied = tiedCandidates(result);
  const listed = places.filter((place) =>
    tied.some((candidate) => overlaps(corpus, candidate, place, length)),
  );
  if (result.status === 'ambiguous' && listed.length === places.length) return null;
  const unlisted = places.filter((place) => !listed.includes(place));
  const onlySameVerseMissing =
    listed.length > 0 &&
    unlisted.every((place) => listed.some((other) => sameVerse(corpus, place, other)));
  const where = places
    .slice(0, 6)
    .map((place) => describePassage(corpus, { start: place, length }))
    .join(', ');
  return {
    onlySameVerseMissing,
    line: `${places.length} places (${where}${places.length > 6 ? ', ...' : ''}), ${listed.length} listed -> ${describeResult(result).slice(0, 170)}`,
  };
}

describeWithCorpus('Spec 2 — recherche d’un passage (full corpus)', () => {
  let corpus: FlatCorpus;
  let index: VerseIndex;

  beforeAll(() => {
    corpus = requireCorpus();
    index = createVerseIndex(corpus.verses);
  });

  describe('result contract', () => {
    it('index counts every verse and every comparable word', () => {
      expect(index.verseCount).toBe(corpus.verses.length);
      expect(index.wordCount).toBe(corpus.words.length);
    });

    it('each candidate has a start and an end that exist, in order, with score and confidence in 0..1, ranked best first', () => {
      const random = seededRandom(101);
      const problems: string[] = [];
      const inputs: string[][] = [];
      for (const passage of drawUniquePassages(corpus, random, 120, 3, 14)) {
        const clean = transcriptOf(corpus, passage, toPlene);
        inputs.push(clean);
        for (const [, damage] of DAMAGES) {
          const damaged = damage(clean, random);
          if (damaged !== null) inputs.push(damaged);
        }
      }
      for (const words of inputs) {
        const result = index.search(words);
        const label = `[${words.join(' ')}]`;
        if (result.status === 'not-found') {
          if (result.candidates.length !== 0 || result.tiedCount !== 0) {
            problems.push(`${label}: not-found with candidates`);
          }
          continue;
        }
        if (result.tiedCount < 1 || result.tiedCount > result.candidates.length) {
          problems.push(`${label}: tiedCount ${result.tiedCount} of ${result.candidates.length}`);
        }
        if (result.status === 'found' && result.tiedCount !== 1)
          problems.push(`${label}: found tied`);
        if (result.status === 'ambiguous' && result.tiedCount < 2) {
          problems.push(`${label}: ambiguous with one candidate`);
        }
        if (result.candidates.length - result.tiedCount > RECOGNITION_CONFIG.maxAlternatives) {
          problems.push(`${label}: more alternatives than maxAlternatives`);
        }
        let confidenceSum = 0;
        result.candidates.forEach((candidate, rank) => {
          const start = globalIndex(corpus, candidate.start);
          const end = globalIndex(corpus, candidate.end);
          if (start > end) problems.push(`${label}: candidate ${rank} ends before it starts`);
          for (const value of [candidate.score, candidate.confidence]) {
            if (!(value >= 0 && value <= 1)) problems.push(`${label}: value ${value} outside 0..1`);
          }
          const previous = result.candidates[rank - 1];
          if (
            previous !== undefined &&
            previous.score < candidate.score - 1e-9 &&
            rank >= result.tiedCount
          ) {
            problems.push(`${label}: candidate ${rank} outranks a better-scored one`);
          }
          confidenceSum += candidate.confidence;
        });
        if (confidenceSum > 1 + 1e-6)
          problems.push(`${label}: confidences add up to ${confidenceSum}`);
        const best = result.candidates[0];
        const runnerUp = result.candidates[1];
        if (result.status === 'found' && best !== undefined && runnerUp !== undefined) {
          if (runnerUp.score >= best.score)
            problems.push(`${label}: found, but a second candidate scores as much`);
        }
      }
      expect(problems).toEqual([]);
    });

    it('maxAlternatives limits the lower-ranked candidates and never hides a tied one', () => {
      const refrain = rawWords(corpus, '55:13');
      const none = index.search(refrain, { maxAlternatives: 0 });
      expect(none.status).toBe('ambiguous');
      expect(none.candidates).toHaveLength(none.tiedCount);
      const passage = [...plene(corpus, '55:12').slice(-2), ...plene(corpus, '55:13')];
      const withAlternatives = index.search(passage, { maxAlternatives: 2 });
      expect(withAlternatives.status).toBe('found');
      expect(withAlternatives.candidates.length).toBeLessThanOrEqual(3);
    });
  });

  describe('règle : l’entrée peut commencer et finir au milieu d’un verset et couvrir plusieurs versets', () => {
    it('a clean passage is always listed, in four writings of the same words (measure: single right answer rate)', () => {
      const random = seededRandom(20261124);
      const passages = drawUniquePassages(corpus, random, 300, 6, 12);
      const minimal = minimalSpellingVerses();
      const minimalByKey = new Map<string, string>();
      for (const verse of minimal ?? [])
        minimalByKey.set(`${verse.surah}:${verse.verse}`, verse.text);
      const writings: (readonly [string, (text: string) => string, ReadonlyMap<string, string>])[] =
        [
          ['Uthmani as in the corpus', (text) => text, corpus.textByKey],
          ['bare (marks stripped by the tester)', toBare, corpus.textByKey],
          ['plene (superscript alef written)', toPlene, corpus.textByKey],
        ];
      if (minimal !== null) {
        writings.push(['second spelling, marks stripped', toBare, minimalByKey]);
      }
      const lines: string[] = [];
      const lost: string[] = [];
      let exactBounds = 0;
      let crossVerse = 0;
      let midVerse = 0;
      for (const [name, style, source] of writings) {
        const tally = newTally();
        for (const passage of passages) {
          const words = transcriptOf(corpus, passage, style, source);
          const result = index.search(words);
          const verdict = judge(corpus, result, passage.start, passage.length);
          const describeCase = (): string =>
            `${name}: ${describePassage(corpus, passage)} -> ${describeResult(result).slice(0, 200)}`;
          count(tally, verdict, describeCase);
          if (verdict !== 'right' && verdict !== 'ambiguous-with-truth') lost.push(describeCase());
          if (name.startsWith('Uthmani')) {
            const first = corpus.refs[passage.start];
            const last = corpus.refs[passage.start + passage.length - 1];
            if (first !== undefined && last !== undefined) {
              if (first.verse !== last.verse) crossVerse += 1;
              if (first.word !== 1) midVerse += 1;
            }
            const best = result.candidates[0];
            if (
              best !== undefined &&
              globalIndex(corpus, best.start) === passage.start &&
              globalIndex(corpus, best.end) === passage.start + passage.length - 1
            ) {
              exactBounds += 1;
            }
          }
        }
        lines.push(tallyLine(name, tally));
      }
      lines.push(
        `300 unique passages of 6-12 words: ${midVerse} start mid-verse, ${crossVerse} cross a verse limit; ` +
          `first candidate has the exact first and last word in ${exactBounds} of 300 (Uthmani writing)`,
      );
      report('clean passages, four writings', lines);
      // Hard: exact text of the Quran is never lost nor answered with another place.
      expect(lost).toEqual([]);
    });

    it('exact Uthmani text of a unique passage: the first candidate starts and ends on the very words', () => {
      const random = seededRandom(7);
      const wrongBounds: string[] = [];
      for (const passage of drawUniquePassages(corpus, random, 150, 6, 12)) {
        const result = index.search(transcriptOf(corpus, passage, (text) => text));
        const best = result.candidates[0];
        const exact =
          best !== undefined &&
          globalIndex(corpus, best.start) === passage.start &&
          globalIndex(corpus, best.end) === passage.start + passage.length - 1 &&
          best.score === 1;
        if (!exact)
          wrongBounds.push(
            `${describePassage(corpus, passage)} -> ${describeResult(result).slice(0, 160)}`,
          );
      }
      expect(wrongBounds).toEqual([]);
    });

    it('a passage over two surahs read without basmala (end of 8:75 into 9:1) is one passage', () => {
      const words = [...plene(corpus, '8:75').slice(-6), ...plene(corpus, '9:1')];
      const result = index.search(words);
      expect(result.status).toBe('found');
      expect(result.candidates[0]?.start).toMatchObject({ surah: 8, verse: 75 });
      expect(result.candidates[0]?.end).toMatchObject({ surah: 9, verse: 1 });
    });

    it('a passage over two surahs with the basmala said in between (113:4-5, basmala, 114:1-2) is found', () => {
      const words = [
        ...plene(corpus, '113:4'),
        ...plene(corpus, '113:5'),
        ...plene(corpus, '1:1'),
        ...plene(corpus, '114:1'),
        ...plene(corpus, '114:2'),
      ];
      const result = index.search(words);
      expect(result.status).toBe('found');
      expect(result.candidates[0]?.start).toMatchObject({ surah: 113, verse: 4, word: 1 });
      expect(result.candidates[0]?.end).toMatchObject({ surah: 114, verse: 2 });
    });

    it('a passage preceded by the isti’adha and the basmala is found at its own place, not at 1:1', () => {
      // Isti'adha built from the corpus: word 2 of 113:1, then words 5 to 8 of 16:98.
      const istiadha = [...plene(corpus, '113:1', 2, 2), ...plene(corpus, '16:98', 5, 8)];
      const basmala = plene(corpus, '1:1');
      const passage = [...plene(corpus, '112:1'), ...plene(corpus, '112:2')];
      for (const prefix of [basmala, istiadha, [...istiadha, ...basmala]]) {
        const result = index.search([...prefix, ...passage]);
        expect(describeResult(result)).toMatch(/^found/);
        expect(result.candidates[0]?.start).toMatchObject({ surah: 112, verse: 1, word: 1 });
        expect(result.candidates[0]?.end).toMatchObject({ surah: 112, verse: 2 });
      }
    });

    it('the isti’adha alone is not a passage of the Quran: not found', () => {
      const istiadha = [...plene(corpus, '113:1', 2, 2), ...plene(corpus, '16:98', 5, 8)];
      expect(index.search(istiadha).status).toBe('not-found');
    });

    it('the opening of al-Fatiha (1:1 then 1:2, eight words that stand together only there) is found at 1:1', () => {
      const words = [...plene(corpus, '1:1'), ...plene(corpus, '1:2')];
      const comparable = [...corpus.words.slice(0, 8)];
      // The oracle confirms the premise: these eight words stand together once in the text.
      expect(exactPlaces(corpus, comparable)).toEqual([0]);
      const result = index.search(words);
      // Spec: "Ambiguïté : si plusieurs passages expliquent l'entrée aussi bien". A place that
      // holds only the last four of the eight heard words does not explain them as well.
      expect(describeResult(result)).toMatch(/^found/);
      expect(result.candidates[0]?.start).toMatchObject({ surah: 1, verse: 1, word: 1 });
    });
  });

  describe('règle : tolère des mots faux, manquants ou en trop (damage designed by the tester)', () => {
    interface Population {
      readonly name: string;
      readonly passages: readonly Passage[];
    }

    function drawRepeatedPassages(random: () => number, wanted: number): Passage[] {
      const passages: Passage[] = [];
      while (passages.length < wanted) {
        const length = randomInt(random, 4, 10);
        const start = randomInt(random, 0, corpus.words.length - length);
        if (exactPlaces(corpus, corpus.words.slice(start, start + length)).length >= 2) {
          passages.push({ start, length });
        }
      }
      return passages;
    }

    interface Measured {
      readonly lines: string[];
      readonly confidentlyWrong: string[];
      readonly confidentlyWrongOnLongUnique: string[];
      readonly twinFailures: string[];
    }

    let measured: Measured | undefined;

    /** One pass over every population and damage; the three tests below read it. */
    function measure(): Measured {
      if (measured !== undefined) return measured;
      const random = seededRandom(4242);
      const populations: Population[] = [
        { name: 'unique 6-12 words', passages: drawUniquePassages(corpus, random, 200, 6, 12) },
        { name: 'unique 3-5 words', passages: drawUniquePassages(corpus, random, 200, 3, 5) },
        { name: 'repeated 4-10 words', passages: drawRepeatedPassages(random, 200) },
      ];
      const lines: string[] = [];
      const confidentlyWrong: string[] = [];
      const confidentlyWrongOnLongUnique: string[] = [];
      const twinFailures: string[] = [];
      for (const population of populations) {
        for (const [damageName, damage] of [['no damage', null] as const, ...DAMAGES]) {
          const tally: Tally = newTally();
          for (const passage of population.passages) {
            const clean = transcriptOf(corpus, passage, toPlene);
            const words = damage === null ? clean : damage(clean, random);
            if (words === null) continue;
            const result = index.search(words);
            const where = `${population.name}, ${damageName}: ${describePassage(corpus, passage)} heard as [${words.join(' ')}]`;
            count(tally, judge(corpus, result, passage.start, passage.length), () => {
              return `${where} -> ${describeResult(result).slice(0, 150)}`;
            });
            const twins = missingTwinPlaces(corpus, result);
            if (twins.length > 0) {
              twinFailures.push(
                `${where} -> ${result.status}, confidence ${result.candidates[0]?.confidence.toFixed(2)}, ` +
                  `${twins.length} place(s) with the same words not listed (${twins.slice(0, 3).join(', ')})`,
              );
            }
          }
          lines.push(tallyLine(`${population.name} / ${damageName}`, tally));
          confidentlyWrong.push(...tally.worst);
          if (population.name === 'unique 6-12 words')
            confidentlyWrongOnLongUnique.push(...tally.worst);
        }
      }
      measured = { lines, confidentlyWrong, confidentlyWrongOnLongUnique, twinFailures };
      return measured;
    }

    it('measure: outcome for each kind of damage (plene transcript, one damage per passage)', () => {
      const { lines, confidentlyWrong } = measure();
      report('search under damage', [
        ...lines,
        `confidently wrong cases (${confidentlyWrong.length}):`,
        ...confidentlyWrong.map((line) => `  ${line}`),
      ]);
      expect(lines.length).toBe(3 * (DAMAGES.length + 1));
    }, 120_000);

    it('one damaged word in a unique passage of 6 to 12 words never produces a single wrong answer', () => {
      expect(measure().confidentlyWrongOnLongUnique).toEqual([]);
    });

    it('ambiguïté under damage: when the best candidate’s words also stand elsewhere, those places are listed too', () => {
      // Spec: "si plusieurs passages expliquent l'entrée aussi bien (passage répété dans
      // plusieurs sourates), le résultat le dit et les liste tous. Il ne choisit jamais au hasard."
      expect(measure().twinFailures).toEqual([]);
    });

    it('short repeated passages (3 to 6 words) with one particle dropped or one confusion outside the spec list: places with the same words are all listed', () => {
      const random = seededRandom(1717);
      const failures: string[] = [];
      let searched = 0;
      let drawn = 0;
      while (drawn < 600) {
        const length = randomInt(random, 3, 6);
        const start = randomInt(random, 0, corpus.words.length - length);
        if (exactPlaces(corpus, corpus.words.slice(start, start + length)).length < 2) continue;
        drawn += 1;
        const passage = { start, length };
        const clean = transcriptOf(corpus, passage, toPlene);
        for (const [damageName, damage] of [
          ['short particle dropped', dropShortParticle],
          ['confusions outside spec list', confuseOutsideSpecList],
        ] as const) {
          const words = damage(clean, random);
          if (words === null) continue;
          searched += 1;
          const result = index.search(words);
          const twins = missingTwinPlaces(corpus, result);
          if (twins.length === 0) continue;
          failures.push(
            `${damageName}: ${describePassage(corpus, passage)} heard as [${words.join(' ')}] -> ` +
              `${describeResult(result).slice(0, 90)}; ${twins.length} place(s) with the same words not listed (${twins.slice(0, 3).join(', ')})`,
          );
        }
      }
      report('twin places under damage (short repeated passages)', [
        `${searched} damaged inputs searched, ${failures.length} with unlisted twin places (${percent(failures.length, searched)})`,
        ...failures.map((line) => `  ${line}`),
      ]);
      expect(failures).toEqual([]);
    }, 120_000);

    it('pinned: 15:7 words 4-7 with the particle (word 6) not heard is not one sure place', () => {
      const all = plene(corpus, '15:7', 4, 7);
      const words = [...all.slice(0, 2), ...all.slice(3)];
      const result = index.search(words);
      expect(describeResult(result)).not.toMatch(/^found/);
      expect(missingTwinPlaces(corpus, result)).toEqual([]);
    });

    it('pinned: 6:116 words 11-14 (four places in the text) with two confusions outside the spec list is not one sure place', () => {
      // Word 12: ta' heard as tha'. Word 14: za' emphatic heard as dad.
      const clean = plene(corpus, '6:116', 11, 14);
      const words = replaceLetter(
        replaceLetter(clean, 1, '\u062A', '\u062B'),
        3,
        '\u0638',
        '\u0636',
      );
      expect(
        exactPlaces(
          corpus,
          corpus.words.slice(
            globalIndex(corpus, { surah: 6, verse: 116, word: 11 }),
            globalIndex(corpus, { surah: 6, verse: 116, word: 14 }) + 1,
          ),
        ).length,
      ).toBeGreaterThanOrEqual(2);
      const result = index.search(words);
      expect(describeResult(result)).not.toMatch(/^found/);
      expect(missingTwinPlaces(corpus, result)).toEqual([]);
    });
  });

  describe('règle : ambiguïté — un passage répété est signalé avec toutes ses places', () => {
    function identicalVerseGroups(): VerseText[][] {
      const byText = new Map<string, VerseText[]>();
      for (const verse of corpus.verses) {
        const group = byText.get(verse.text);
        if (group === undefined) byText.set(verse.text, [verse]);
        else group.push(verse);
      }
      return [...byText.values()].filter((group) => group.length >= 2);
    }

    function unlistedVerses(result: SearchResult, group: readonly VerseText[]): string[] {
      const tied = tiedCandidates(result);
      return group
        .filter((verse) => {
          const start = corpus.verseStart.get(`${verse.surah}:${verse.verse}`) ?? -1;
          const length = corpus.verseLength.get(`${verse.surah}:${verse.verse}`) ?? 0;
          return !tied.some((candidate) => overlaps(corpus, candidate, start, length));
        })
        .map((verse) => `${verse.surah}:${verse.verse}`);
    }

    it('verses written identically in several surahs (found by the tester in the corpus): ambiguous, every verse listed', () => {
      const groups = identicalVerseGroups().filter(
        (group) =>
          new Set(group.map((verse) => verse.surah)).size >= 2 &&
          splitWords(group[0]?.text ?? '').length >= RECOGNITION_CONFIG.minWords,
      );
      expect(groups.length).toBeGreaterThan(50);
      const failures: string[] = [];
      for (const group of groups) {
        const result = index.search(splitWords(group[0]?.text ?? ''));
        const unlisted = unlistedVerses(result, group);
        if (result.status !== 'ambiguous' || unlisted.length > 0) {
          failures.push(
            `${group.map((verse) => `${verse.surah}:${verse.verse}`).join(', ')}: ${result.status}, not listed: ${unlisted.join(', ')}`,
          );
        }
      }
      report('identical verses across surahs', [
        `${groups.length} groups checked, ${failures.length} failures`,
      ]);
      expect(failures).toEqual([]);
    });

    it('the verse repeated many times in one surah (55:13 thirty-one times, and the other refrains): every occurrence listed, equal confidence', () => {
      const refrains = identicalVerseGroups().filter((group) => {
        const surahs = new Set(group.map((verse) => verse.surah));
        return (
          surahs.size === 1 && group.length >= 3 && splitWords(group[0]?.text ?? '').length >= 3
        );
      });
      expect(refrains.some((group) => group.length === 31 && group[0]?.surah === 55)).toBe(true);
      const failures: string[] = [];
      for (const group of refrains) {
        const result = index.search(splitWords(toPlene(group[0]?.text ?? '')));
        const unlisted = unlistedVerses(result, group);
        const name = `${group[0]?.surah}:${group[0]?.verse} x${group.length}`;
        if (result.status !== 'ambiguous' || unlisted.length > 0) {
          failures.push(`${name}: ${result.status}, not listed: ${unlisted.join(', ')}`);
          continue;
        }
        const perfect = result.candidates.filter((candidate) => candidate.score === 1);
        const confidences = perfect.map((candidate) => candidate.confidence);
        const highest = Math.max(...confidences);
        const lowest = Math.min(...confidences);
        // "Three passages that fit perfectly get about a third each" (types.ts).
        if (highest - lowest > 1e-9 || highest > 1 / perfect.length + 1e-9) {
          failures.push(
            `${name}: confidences from ${lowest} to ${highest} for ${perfect.length} perfect places`,
          );
        }
      }
      report('refrains inside one surah', [
        `${refrains.length} refrains checked: ${refrains.map((group) => `${group[0]?.surah}:${group[0]?.verse} x${group.length}`).join(', ')}`,
      ]);
      expect(failures).toEqual([]);
    });

    describe('every run of three words that stands at several places (exact words of the corpus)', () => {
      let failures: RepeatFailure[] | undefined;
      let checked = 0;

      function scan(): RepeatFailure[] {
        if (failures !== undefined) return failures;
        const found: RepeatFailure[] = [];
        const runs = repeatedRuns(corpus, 3);
        checked = runs.length;
        for (const places of runs) {
          const failure = checkRepeatedRun(corpus, index, places, 3);
          if (failure !== null) found.push(failure);
        }
        failures = found;
        return found;
      }

      it('is ambiguous and lists every place that stands in another verse', () => {
        const elsewhere = scan().filter((failure) => !failure.onlySameVerseMissing);
        report('repeated runs of 3 words', [
          `${checked} repeated runs checked, ${scan().length} not fully listed, of which ${elsewhere.length} miss a place in another verse`,
          ...elsewhere.map((failure) => `  ${failure.line}`),
        ]);
        expect(elsewhere.map((failure) => failure.line)).toEqual([]);
      }, 120_000);

      it('lists both places when the run stands twice in the same verse', () => {
        const sameVerseOnly = scan().filter((failure) => failure.onlySameVerseMissing);
        expect(sameVerseOnly.map((failure) => failure.line)).toEqual([]);
      }, 120_000);
    });

    it('runs of 4 to 12 words that stand at several places: ambiguous with every place (seeded sample of 150 per length)', () => {
      const random = seededRandom(555);
      const failures: string[] = [];
      let checked = 0;
      for (const length of [4, 5, 6, 8, 10, 12]) {
        const runs = repeatedRuns(corpus, length).sort(
          (first, second) => second.length - first.length,
        );
        // The 50 most repeated runs of this length, then 100 drawn at random.
        const sample = runs.slice(0, 50);
        for (let draw = 0; draw < 100 && runs.length > 50; draw += 1) {
          const drawn = runs[randomInt(random, 50, runs.length - 1)];
          if (drawn !== undefined) sample.push(drawn);
        }
        for (const places of sample) {
          checked += 1;
          const failure = checkRepeatedRun(corpus, index, places, length);
          if (failure !== null) failures.push(`${length} words: ${failure.line}`);
        }
      }
      report('repeated runs of 4-12 words', [
        `${checked} runs checked, ${failures.length} failures`,
      ]);
      expect(failures).toEqual([]);
    }, 120_000);

    it('pinned: 3:55 words 10-12, three words that stand at four places, is not answered as one sure place', () => {
      const start = globalIndex(corpus, { surah: 3, verse: 55, word: 10 });
      const places = exactPlaces(corpus, corpus.words.slice(start, start + 3));
      expect(places.length).toBeGreaterThanOrEqual(2);
      const result = index.search(plene(corpus, '3:55', 10, 12));
      expect(describeResult(result)).toMatch(/^ambiguous/);
      expect(result.tiedCount).toBeGreaterThanOrEqual(places.length);
    });

    it('pinned: 46:20 words 3-5 stand exactly at two places (46:20 and 46:34); the answer is not a third place', () => {
      const start = globalIndex(corpus, { surah: 46, verse: 20, word: 3 });
      const places = exactPlaces(corpus, corpus.words.slice(start, start + 3));
      const result = index.search(rawWords(corpus, '46:20', 3, 5));
      const tied = tiedCandidates(result);
      const listed = places.filter((place) =>
        tied.some((candidate) => overlaps(corpus, candidate, place, 3)),
      );
      expect({ status: result.status, listed: listed.length }).toEqual({
        status: 'ambiguous',
        listed: places.length,
      });
    });

    it('with minWords lowered by the caller, a tie on one very common word still lists every place', () => {
      // Word 2 of 1:1, alone. The oracle counts its exact places in the text.
      const word = rawWords(corpus, '1:1', 2, 2);
      const places = exactPlaces(corpus, [corpus.words[1] ?? '']);
      const result = index.search(word, { minWords: 1 });
      expect(result.status).toBe('ambiguous');
      expect(result.tiedCount).toBe(places.length);
    });

    it('adding the following words converges to the right place (measure), and never to a wrong one (hard)', () => {
      const random = seededRandom(909);
      const tallyAtFirstUniqueWord = newTally();
      const tallyTwoWordsLater = newTally();
      const bad: string[] = [];
      let drawn = 0;
      let attempts = 0;
      while (drawn < 200 && attempts < 200_000) {
        attempts += 1;
        const length = randomInt(random, 4, 10);
        const start = randomInt(random, 0, corpus.words.length - length - 40);
        if (exactPlaces(corpus, corpus.words.slice(start, start + length)).length < 2) continue;
        let extended = length + 1;
        while (
          extended <= length + 30 &&
          exactPlaces(corpus, corpus.words.slice(start, start + extended)).length > 1
        ) {
          extended += 1;
        }
        if (extended > length + 30) continue;
        drawn += 1;
        for (const [extra, tally] of [
          [0, tallyAtFirstUniqueWord],
          [2, tallyTwoWordsLater],
        ] as const) {
          const passage = { start, length: extended + extra };
          const result = index.search(transcriptOf(corpus, passage, toPlene));
          const verdict = judge(corpus, result, passage.start, passage.length);
          const describeCase = (): string =>
            `${describePassage(corpus, passage)} -> ${describeResult(result).slice(0, 160)}`;
          count(tally, verdict, describeCase);
          if (verdict !== 'right' && verdict !== 'ambiguous-with-truth') bad.push(describeCase());
        }
      }
      report('convergence of repeated passages', [
        `${drawn} repeated runs of 4-10 words, extended word by word until the oracle finds one place`,
        tallyLine('at the first telling word', tallyAtFirstUniqueWord),
        tallyLine('two words later', tallyTwoWordsLater),
      ]);
      expect(drawn).toBe(200);
      expect(bad).toEqual([]);
    }, 120_000);
  });

  describe('règle : « pas trouvé » plutôt qu’une mauvaise réponse', () => {
    it('one or two words: not found, too few words', () => {
      for (const words of [
        rawWords(corpus, '55:64'),
        rawWords(corpus, '1:3'),
        plene(corpus, '2:255', 1, 2),
      ]) {
        const result = index.search(words);
        expect(result).toEqual({
          status: 'not-found',
          reason: 'too-few-words',
          candidates: [],
          tiedCount: 0,
        });
      }
    });

    it('entries that hold no Arabic word do not count as words; one entry may hold several words', () => {
      const twoWords = rawWords(corpus, '1:3');
      expect(index.search([...twoWords, 'hello', '123', '\u{1F642}', '']).status).toBe('not-found');
      const oneEntry = [verseText(corpus, '2:255')];
      const result = index.search(oneEntry);
      expect(result.status).toBe('found');
      expect(result.candidates[0]?.start).toMatchObject({ surah: 2, verse: 255, word: 1 });
    });

    it('the same word said three or six times is not a passage', () => {
      const word = rawWords(corpus, '1:1', 2, 2)[0] ?? '';
      expect(index.search([word, word, word]).status).toBe('not-found');
      expect(index.search([word, word, word, word, word, word]).status).toBe('not-found');
    });

    it('a well-known sentence that is not in the Quran but shares its words is never a single sure answer', () => {
      // Built from the corpus, word by word. Testimony of faith as said in the call to prayer:
      // 6:19 word 28, 6:19 word 21, 47:19 words 3-6, then 6:19 words 28 and 21, 48:29 words 1-3.
      const testimony = [
        ...plene(corpus, '6:19', 28, 28),
        ...plene(corpus, '6:19', 21, 21),
        ...plene(corpus, '47:19', 3, 6),
        ...plene(corpus, '6:19', 28, 28),
        ...plene(corpus, '6:19', 21, 21),
        ...plene(corpus, '48:29', 1, 3),
      ];
      // Praise formula: 37:159 words 1-2, 37:182 words 1-2, 2:255 word 11 with 47:19 words 4-6,
      // then the fourth and the fifth word from the end of 29:45, in that order.
      const andGod = plene(corpus, '29:45').slice(-4, -3);
      const greater = plene(corpus, '29:45').slice(-5, -4);
      const praise = [
        ...plene(corpus, '37:159', 1, 2),
        ...plene(corpus, '37:182', 1, 2),
        ...plene(corpus, '2:255', 11, 11),
        ...plene(corpus, '47:19', 4, 6),
        ...andGod,
        ...greater,
      ];
      const outcomes = [testimony, testimony.slice(0, 6), praise].map(
        (words) => `[${words.join(' ')}] -> ${describeResult(index.search(words)).slice(0, 200)}`,
      );
      report('non-Quranic sentences sharing vocabulary', outcomes);
      expect(outcomes.filter((line) => line.includes('-> found'))).toEqual([]);
    });

    it('measure: false positives on inputs without relation to any passage', () => {
      const random = seededRandom(31337);
      const randomWord = (): string =>
        corpus.words[randomInt(random, 0, corpus.words.length - 1)] ?? '';
      const unique = drawUniquePassages(corpus, random, 400, 6, 12);
      const kinds: (readonly [string, (draw: number) => string[]])[] = [
        [
          '6-12 words drawn anywhere in the text (common words come often)',
          () => Array.from({ length: randomInt(random, 6, 12) }, randomWord),
        ],
        [
          '3-5 words drawn anywhere in the text',
          () => Array.from({ length: randomInt(random, 3, 5) }, randomWord),
        ],
        [
          'two unrelated passages interleaved word by word (12 words)',
          (draw) => {
            const first = unique[2 * draw] ?? { start: 0, length: 6 };
            const second = unique[2 * draw + 1] ?? { start: 0, length: 6 };
            const out: string[] = [];
            for (let offset = 0; offset < 6; offset += 1) {
              out.push(
                corpus.words[first.start + offset] ?? '',
                corpus.words[second.start + offset] ?? '',
              );
            }
            return out;
          },
        ],
        [
          'letter soup: the letters of a passage dealt at random into words of the same lengths',
          (draw) => {
            const passage = unique[draw] ?? { start: 0, length: 6 };
            const source = corpus.words.slice(passage.start, passage.start + passage.length);
            const letters = [...source.join('')];
            return source.map((word) =>
              [...word].map(() => letters[randomInt(random, 0, letters.length - 1)] ?? '').join(''),
            );
          },
        ],
      ];
      const lines: string[] = [];
      for (const [name, make] of kinds) {
        let found = 0;
        let ambiguous = 0;
        const examples: string[] = [];
        const total = 200;
        for (let draw = 0; draw < total; draw += 1) {
          const words = make(draw);
          const result = index.search(words);
          if (result.status === 'found') found += 1;
          if (result.status === 'ambiguous') ambiguous += 1;
          if (result.status !== 'not-found' && examples.length < 5) {
            examples.push(`    [${words.join(' ')}] -> ${describeResult(result).slice(0, 140)}`);
          }
        }
        lines.push(
          `${name}: found ${percent(found, total)}, ambiguous ${percent(ambiguous, total)} of ${total}`,
          ...examples,
        );
      }
      report('inputs without relation to a passage', lines);
      expect(lines.length).toBeGreaterThanOrEqual(kinds.length);
    }, 120_000);
  });
});
