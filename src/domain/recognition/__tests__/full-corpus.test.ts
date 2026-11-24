/**
 * Tests and measures on the whole Quran.
 *
 * They need the generated Uthmani text (`assets/data/verses/uthmani.json`) and are skipped
 * when it is absent. The numbers of README.md come from the same measures, run with larger
 * samples: RECOGNITION_MEASURE_PASSAGES=2000 sets the sample size (default 120, to keep
 * `npm test` short) and RECOGNITION_PRINT_MEASURES=1 prints the measures.
 *
 * With RECOGNITION_IMLAEI_CORPUS set (see test-support/corpus.ts), an imla'i text plays the
 * speech engine; without it, the Uthmani text does, which tests the search but not the
 * bridge between the two scripts.
 */
import { VERSE_COUNT } from '../../quran/types';
import { UNRELATED_SENTENCES } from '../__fixtures__/unrelated-sentences';
import { UTHMANI_SAMPLE } from '../__fixtures__/uthmani-sample';
import {
  createVerseIndex,
  normalizeArabic,
  RECOGNITION_CONFIG,
  toAccentKey,
  type SearchResult,
  type VerseIndex,
  type VerseText,
  type WordRef,
} from '../index';
import {
  loadImlaeiCorpus,
  loadSecondTextCorpus,
  loadUthmaniCorpus,
  runsFromRepositoryRoot,
} from '../test-support/corpus';
import {
  measureFollow,
  measureNormalization,
  measureSearch,
  measureUnrelatedInput,
  type SearchOutcomeCounts,
} from '../test-support/measures';

const uthmani = loadUthmaniCorpus();
const imlaei = loadImlaeiCorpus();
const secondText = loadSecondTextCorpus();
const describeWithCorpus = uthmani === null ? describe.skip : describe;
const itWithImlaei = imlaei === null ? it.skip : it;
const itWithSecondText = secondText === null ? it.skip : it;

/** Number of passages drawn for the search measures; the other samples follow it. */
const PASSAGES = Number(process.env.RECOGNITION_MEASURE_PASSAGES ?? 120);

/** Budgets of the spec, for a development machine. */
const INDEX_BUILD_BUDGET_MS = 2000;
const SEARCH_BUDGET_MS = 150;
const UNRELATED_INPUT_BUDGET_MS = 1000;

/** The exhaustive tests run thousands of searches: far more than Jest's default 5 s. */
const EXHAUSTIVE_TEST_TIMEOUT_MS = 300_000;

/** Lengths, in words, of the repeated runs that are all checked. */
const REPEATED_RUN_LENGTHS = [3, 4, 5, 6] as const;

const now = (): number => performance.now();

function report(title: string, measure: unknown): void {
  if (process.env.RECOGNITION_PRINT_MEASURES !== undefined) {
    console.warn(`${title}\n${JSON.stringify(measure, null, 2)}`);
  }
}

/** The comparable words of a text in reading order, each with its place. */
interface FlatText {
  readonly words: readonly string[];
  readonly refs: readonly WordRef[];
}

function flatten(verses: readonly VerseText[]): FlatText {
  const words: string[] = [];
  const refs: WordRef[] = [];
  for (const verse of verses) {
    normalizeArabic(verse.text).forEach((word, index) => {
      words.push(word);
      refs.push({ surah: verse.surah, verse: verse.verse, word: index + 1 });
    });
  }
  return { words, refs };
}

function describeRef(ref: WordRef | undefined): string {
  return ref === undefined ? '?' : `${ref.surah}:${ref.verse}:${ref.word}`;
}

/**
 * Every run of `length` words that stands at two places or more, as the list of its
 * places. Runs may cross the limit of a verse or of a surah, as a recitation does.
 */
function repeatedRuns(words: readonly string[], length: number): number[][] {
  const placesByRun = new Map<string, number[]>();
  for (let start = 0; start + length <= words.length; start += 1) {
    const run = words.slice(start, start + length).join(' ');
    const places = placesByRun.get(run);
    if (places === undefined) placesByRun.set(run, [start]);
    else places.push(start);
  }
  return [...placesByRun.values()].filter((places) => places.length >= 2);
}

/**
 * What is wrong with the result of searching a run that stands at `places`; null when the
 * result is ambiguous and lists every place, from its first word to its last.
 */
function faultOfRepeatedRun(
  text: FlatText,
  places: readonly number[],
  length: number,
  result: SearchResult,
): string | null {
  const where = `${places.length} places, first at ${describeRef(text.refs[places[0] ?? 0])}`;
  if (result.status !== 'ambiguous') return `${where}: ${result.status}`;
  if (result.tiedCount < places.length) return `${where}: only ${result.tiedCount} tied`;
  if (result.candidates.length < result.tiedCount && result.truncated !== true) {
    return `${where}: list cut without saying so`;
  }
  // More places than a result lists: it says so and gives their number (checked above).
  if (places.length > RECOGNITION_CONFIG.maxListedPlaces) {
    return result.truncated === true ? null : `${where}: not said to be truncated`;
  }
  const tied = new Set(
    result.candidates
      .slice(0, result.tiedCount)
      .map((candidate) => `${describeRef(candidate.start)}-${describeRef(candidate.end)}`),
  );
  const missing = places.filter(
    (place) =>
      !tied.has(`${describeRef(text.refs[place])}-${describeRef(text.refs[place + length - 1])}`),
  );
  if (missing.length === 0) return null;
  return `${where}: ${missing.length} not listed, first ${describeRef(text.refs[missing[0] ?? 0])}`;
}

/** Share of the passages for which the right place is the answer or among the tied answers. */
function rightRate(counts: SearchOutcomeCounts): number {
  return (counts.foundRight + counts.ambiguousWithRight) / counts.passages;
}

it('looks for the generated data from the repository root', () => {
  // Otherwise the tests below would be skipped for the wrong reason.
  expect(runsFromRepositoryRoot()).toBe(true);
});

describeWithCorpus('Full Quran (generated data; skipped when the data is absent)', () => {
  const verses: readonly VerseText[] = uthmani ?? [];
  const spoken: readonly VerseText[] = imlaei ?? verses;
  let index: VerseIndex;
  let text: FlatText;
  let buildMs = 0;

  beforeAll(() => {
    const before = now();
    index = createVerseIndex(verses);
    buildMs = now() - before;
    text = flatten(verses);
  });

  it('holds every verse of the Quran', () => {
    expect(index.verseCount).toBe(VERSE_COUNT);
    expect(spoken).toHaveLength(VERSE_COUNT);
  });

  it('Rule 2 budget — builds the index in less than 2 s', () => {
    report('Index build (ms)', buildMs);
    expect(buildMs).toBeLessThan(INDEX_BUILD_BUDGET_MS);
  });

  it('Rule 1 — normalisation is idempotent on every verse', () => {
    for (const verse of verses) {
      const once = normalizeArabic(verse.text);
      expect(normalizeArabic(once.join(' '))).toEqual(once);
    }
  });

  it('holds, character for character, the sample verses used by the other tests', () => {
    const byKey = new Map(verses.map((verse) => [`${verse.surah}:${verse.verse}`, verse.text]));
    for (const sample of UTHMANI_SAMPLE) {
      expect(byKey.get(`${sample.surah}:${sample.verse}`)).toBe(sample.text);
    }
  });

  itWithImlaei(
    "Rule 1 measure — share of verses whose Uthmani and imla'i words are identical",
    () => {
      const measure = measureNormalization(verses, spoken);
      report("Normalisation, Uthmani against imla'i", measure);

      // Measured: 92.0 % identical (5,737 verses), 1.8 word edits on average for the others.
      expect(measure.identicalVerses / measure.verses).toBeGreaterThan(0.9);
      expect(measure.meanWordEditsWhenDifferent).toBeLessThan(2.5);
      expect(measure.differingWordRate).toBeLessThan(0.02);
    },
  );

  describe('Rule 2 measures — passages of 6 to 12 words with 0 to 3 simulated errors', () => {
    it('finds the right passage, reports the repeated ones as ambiguous, within the time budget', () => {
      const measures = measureSearch(index, verses, spoken, {
        seed: 2026,
        passages: PASSAGES,
        minWords: 6,
        maxWords: 12,
        errorCounts: [0, 1, 2, 3],
        now,
      });
      report('Search, 6 to 12 words', measures);

      for (const measure of measures) {
        const all: SearchOutcomeCounts = {
          passages: measure.unique.passages + measure.repeated.passages,
          foundRight: measure.unique.foundRight + measure.repeated.foundRight,
          ambiguousWithRight:
            measure.unique.ambiguousWithRight + measure.repeated.ambiguousWithRight,
          wrong: measure.unique.wrong + measure.repeated.wrong,
          notFound: measure.unique.notFound + measure.repeated.notFound,
        };
        // Measured on 2,000 passages, imla'i text as input: 100 %, 99.9 %, 97.95 %, 92.25 %.
        const minRightRate = [0.99, 0.97, 0.95, 0.85][measure.errorCount] ?? 0;
        expect(rightRate(all)).toBeGreaterThanOrEqual(minRightRate);
        // A wrong answer is worse than no answer.
        expect(all.wrong / all.passages).toBeLessThanOrEqual(0.02);
        expect(measure.meanSearchMs).toBeLessThan(SEARCH_BUDGET_MS);
      }

      // A passage repeated word for word is never presented as certain.
      const [exact] = measures;
      expect(exact?.repeated.foundRight).toBe(0);
      expect(exact?.repeated.wrong).toBe(0);
    });

    it('Rule 2 ambiguity — lists every place of the most repeated passages', () => {
      // Two counts that readers know: the refrain of surah 55 comes 31 times, and
      // "يا أيها الذين آمنوا" opens 89 verses.
      const refrain = index.search(['فبأي', 'آلاء', 'ربكما', 'تكذبان']);
      const believers = index.search(['يا', 'أيها', 'الذين', 'آمنوا']);

      expect(refrain.status).toBe('ambiguous');
      expect(refrain.tiedCount).toBe(31);
      expect(
        refrain.candidates.slice(0, 31).every((candidate) => candidate.start.surah === 55),
      ).toBe(true);
      expect(believers.status).toBe('ambiguous');
      expect(believers.tiedCount).toBe(89);
      expect(believers.candidates.length).toBeGreaterThanOrEqual(89);
    });

    it('answers "not found" to words of the Quran drawn at random', () => {
      const measure = measureUnrelatedInput(index, verses, {
        seed: 7,
        inputs: Math.ceil(PASSAGES / 2),
        minWords: 6,
        maxWords: 12,
      });
      report('Unrelated input, 6 to 12 words', measure);

      // Measured on 2,000 inputs: no false positive, best score 0.56.
      expect(measure.falsePositives).toBe(0);
      expect(measure.highestScore).toBeLessThan(0.6);
    });

    it('Rule 2 budget — finds a 12-word passage in less than 150 ms', () => {
      const twelveWords = verses
        .flatMap((verse) => normalizeArabic(verse.text))
        .slice(40_000, 40_012);
      const searches = 20;
      const before = now();
      for (let search = 0; search < searches; search += 1) index.search(twelveWords);
      const meanMs = (now() - before) / searches;
      report('Search of 12 words (ms)', meanMs);

      expect(index.search(twelveWords).status).not.toBe('not-found');
      expect(meanMs).toBeLessThan(SEARCH_BUDGET_MS);
    });
  });

  describe('Précisions — never sure by mistake, on every repeated passage', () => {
    it.each(REPEATED_RUN_LENGTHS)(
      'every run of %i words that stands at several places is ambiguous and lists all its places',
      (length) => {
        const runs = repeatedRuns(text.words, length);
        const faults: string[] = [];
        for (const places of runs) {
          const first = places[0] ?? 0;
          const result = index.search(text.words.slice(first, first + length));
          const fault = faultOfRepeatedRun(text, places, length, result);
          if (fault !== null) faults.push(fault);
        }
        report(`Repeated runs of ${length} words`, { runs: runs.length, faults: faults.length });

        // Measured: 6,434 runs of 3 words, 4,131 of 4, 2,669 of 5 and 1,757 of 6; no fault.
        expect(runs.length).toBeGreaterThan(1000);
        expect(faults).toEqual([]);
      },
      EXHAUSTIVE_TEST_TIMEOUT_MS,
    );
  });

  describe('Précisions — places that noise cannot tell apart are tied', () => {
    it('ties the places that differ by one letter of one rare word (19:69 and من كل شيء)', () => {
      // 19:69 says من كل شيعة; five other places say من كل شيء, one letter away. The rare
      // word carries most of the weight: these places were once left unexamined.
      const result = index.search(['من', 'كل', 'شيعة']);
      const tied = result.candidates
        .slice(0, result.tiedCount)
        .map((candidate) => describeRef(candidate.start));

      expect(result.status).toBe('ambiguous');
      expect(tied[0]).toBe('19:69:3');
      expect(tied).toEqual(expect.arrayContaining(['7:145:5', '15:19:8', '18:84:7']));
      // The place spelled exactly as heard still comes first, with the highest confidence.
      expect(result.candidates[0]?.score).toBe(1);
      expect(result.candidates[0]?.confidence).toBeGreaterThan(
        result.candidates[1]?.confidence ?? 1,
      );
    });
  });

  describe('Précisions — no list is cut silently', () => {
    it('counts every place of one common word and says that the list is cut', () => {
      const heard = 'الله';
      const accentKey = toAccentKey(heard);
      const places = text.words.filter((word) => toAccentKey(word) === accentKey).length;

      const result = index.search([heard], { minWords: 1 });

      // Measured: 2,155 places.
      expect(places).toBeGreaterThan(RECOGNITION_CONFIG.maxListedPlaces);
      expect(result.status).toBe('ambiguous');
      expect(result.tiedCount).toBe(places);
      expect(result.candidates).toHaveLength(RECOGNITION_CONFIG.maxListedPlaces);
      expect(result.truncated).toBe(true);
    });

    it('says nothing when every tied place is listed (the refrain of surah 55)', () => {
      const result = index.search(['فبأي', 'آلاء', 'ربكما', 'تكذبان']);

      expect(result.candidates.length).toBeGreaterThanOrEqual(result.tiedCount);
      expect(result.truncated).toBeUndefined();
    });
  });

  describe('Précisions — opening formulas', () => {
    const BASMALA = ['بسم', 'الله', 'الرحمن', 'الرحيم'];
    const spanOf = (result: SearchResult): string =>
      `${describeRef(result.candidates[0]?.start)}-${describeRef(result.candidates[0]?.end)}`;

    it('a basmala alone stands at two places: 1:1 and inside 27:30', () => {
      const result = index.search(BASMALA);

      expect(result.status).toBe('ambiguous');
      expect(result.tiedCount).toBe(2);
      expect(result.candidates.map((candidate) => describeRef(candidate.start))).toEqual([
        '1:1:1',
        '27:30:5',
      ]);
    });

    it('a basmala followed by 1:2 is found from 1:1, which explains every heard word', () => {
      const result = index.search([...BASMALA, 'الحمد', 'لله', 'رب', 'العالمين']);

      expect(result.status).toBe('found');
      expect(spanOf(result)).toBe('1:1:1-1:2:4');
      expect(result.candidates[0]?.score).toBe(1);
    });

    it('a basmala followed by 27:31 is found inside 27:30, which explains every heard word', () => {
      const result = index.search([...BASMALA, 'ألا', 'تعلوا', 'علي', 'وأتوني', 'مسلمين']);

      expect(result.status).toBe('found');
      expect(spanOf(result)).toBe('27:30:5-27:31:5');
      expect(result.candidates[0]?.score).toBe(1);
    });

    it('a basmala followed by the start of a surah is that start (96:1)', () => {
      const result = index.search([...BASMALA, 'اقرأ', 'باسم', 'ربك', 'الذي', 'خلق']);

      expect(result.status).toBe('found');
      expect(spanOf(result)).toBe('96:1:1-96:1:5');
      expect(result.candidates[0]?.score).toBe(1);
    });

    it("an isti'adha and a basmala before the start of a surah are both left out (112:1)", () => {
      const istiadha = ['أعوذ', 'بالله', 'من', 'الشيطان', 'الرجيم'];
      const result = index.search([...istiadha, ...BASMALA, 'قل', 'هو', 'الله', 'أحد']);

      expect(result.status).toBe('found');
      expect(spanOf(result)).toBe('112:1:1-112:1:4');
    });
  });

  describe('Précisions — bounded input: long passages', () => {
    it('answers "not found" to 300 words unrelated to the Quran in less than one second', () => {
      const everydayWords = UNRELATED_SENTENCES.flatMap((sentence) => normalizeArabic(sentence));
      const heard = Array.from(
        { length: RECOGNITION_CONFIG.maxHeardWords },
        (_unused, position) => everydayWords[position % everydayWords.length] ?? '',
      );

      const before = now();
      const result = index.search(heard);
      const elapsedMs = now() - before;
      report('Search of 300 unrelated words (ms)', elapsedMs);

      expect(result.status).toBe('not-found');
      expect(elapsedMs).toBeLessThan(UNRELATED_INPUT_BUDGET_MS);
    });

    /** Words of the corpus from `start`, without those at the offsets `dropped`. */
    function wordsWithout(start: number, dropped: readonly number[], count: number): string[] {
      const heard: string[] = [];
      for (let offset = 0; heard.length < count; offset += 1) {
        const word = text.words[start + offset];
        if (word === undefined) break;
        if (!dropped.includes(offset)) heard.push(word);
      }
      return heard;
    }

    function startOf(ref: WordRef): number {
      return text.refs.findIndex(
        (other) =>
          other.surah === ref.surah && other.verse === ref.verse && other.word === ref.word,
      );
    }

    it('finds a passage of 300 words from which six words are missing (20:76 onwards)', () => {
      // Each missing word shifts the words after it by one. This very input was once
      // answered "not found": none of the shifted pieces had enough support alone.
      const start: WordRef = { surah: 20, verse: 76, word: 7 };
      const heard = wordsWithout(startOf(start), [88, 103, 118, 138, 154, 220], 300);

      const result = index.search(heard);

      expect(heard).toHaveLength(300);
      expect(result.status).toBe('found');
      expect(result.candidates[0]?.start).toEqual(start);
      expect(result.inputTruncated).toBeUndefined();
    });

    it(
      'finds every long passage of a seeded sample with words missing at random',
      () => {
        // A small generator with a fixed seed: the same passages at every run.
        let state = 4242;
        const random = (): number => {
          state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
          return state / 4_294_967_296;
        };
        const faults: string[] = [];
        for (const [wordCount, droppedCount] of [
          [40, 6],
          [100, 10],
          [200, 6],
          [300, 10],
        ] as const) {
          for (let passage = 0; passage < Math.ceil(PASSAGES / 4); passage += 1) {
            const start = Math.floor(random() * (text.words.length - 2 * wordCount));
            const dropped = new Set<number>();
            // Never the first words, so that the passage still starts where it starts.
            while (dropped.size < droppedCount) {
              dropped.add(5 + Math.floor(random() * (wordCount - 10)));
            }
            const result = index.search(wordsWithout(start, [...dropped], wordCount));
            const foundAt = result.candidates[0]?.start;
            if (
              result.status !== 'found' ||
              describeRef(foundAt) !== describeRef(text.refs[start])
            ) {
              faults.push(
                `${wordCount} words from ${describeRef(text.refs[start])}: ${result.status} ${describeRef(foundAt)}`,
              );
            }
          }
        }
        // Measured on 300 passages for each of the four cases: every one found at its place.
        expect(faults).toEqual([]);
      },
      EXHAUSTIVE_TEST_TIMEOUT_MS,
    );

    it('searches only the last 300 words of a longer input, and says so', () => {
      const start = startOf({ surah: 2, verse: 255, word: 1 });
      const longInput = text.words.slice(start - 150, start + 300);
      const lastWords = longInput.slice(-RECOGNITION_CONFIG.maxHeardWords);

      const result = index.search(longInput);

      expect(result.inputTruncated).toBe(true);
      expect(result.candidates[0]?.start).toEqual(text.refs[start]);
      expect({ ...result, inputTruncated: undefined }).toEqual({
        ...index.search(lastWords),
        inputTruncated: undefined,
      });
    });
  });

  describe('Rule 1 — the two texts shipped with the app', () => {
    itWithSecondText('give the same words, verse by verse, but for six known words', () => {
      const differences: string[] = [];
      (secondText ?? []).forEach((verse, position) => {
        const first = normalizeArabic(verses[position]?.text ?? '');
        const second = normalizeArabic(verse.text);
        // Three verses are cut into words differently by the two texts: not compared.
        if (first.length !== second.length) return;
        first.forEach((word, index) => {
          if (word !== second[index]) {
            differences.push(`${verse.surah}:${verse.verse} ${word} / ${second[index] ?? ''}`);
          }
        });
      });
      report('Words that differ between the two shipped texts', differences);

      // The plural صلوٰت, which the second text writes like the singular of صلوٰتك (five
      // times), and one word of 17:7 that the two texts spell differently.
      expect(differences).toEqual([
        '2:157 صلوت / صلت',
        '2:238 ءلصلوت / ءلصلت',
        '9:99 وصلوت / وصلت',
        '17:7 ليسءو / ليسوءو',
        '22:40 وصلوت / وصلت',
        '23:9 صلوتهم / صلتهم',
      ]);
    });
  });

  describe('Rule 3 measures — following simulated readers', () => {
    const sessions = { seed: 5, sessions: Math.ceil(PASSAGES / 5), wordsPerSession: 60 };

    it('shows no mistake to a reader who reads correctly', () => {
      const measure = measureFollow(verses, spoken, 'clean', sessions);
      report('Follow, clean reading', measure);

      expect(measure.mistake).toBe(0);
      // Measured: 2 words in 26,872 skipped, both written very differently by the two scripts.
      expect(measure.read / measure.expectedWords).toBeGreaterThan(0.995);
    });

    it('shows no mistake when the reader repeats phrases or when words are missing', () => {
      const repeats = measureFollow(verses, spoken, 'repeats', sessions);
      const dropped = measureFollow(verses, spoken, 'dropped-words', sessions);
      report('Follow, repeats', repeats);
      report('Follow, dropped words', dropped);

      expect(repeats.mistake).toBe(0);
      expect(dropped.mistake).toBe(0);
      expect(dropped.skipped).toBeGreaterThan(0);
    });

    it('marks most replaced words as mistakes, and almost nothing else', () => {
      const replaced = measureFollow(verses, spoken, 'replaced-words', sessions);
      const noisy = measureFollow(verses, spoken, 'noisy-letters', sessions);
      report('Follow, replaced words', replaced);
      report('Follow, noisy letters', noisy);

      // Measured: 91 % of the replaced words are marked; a replaced word can be a close one.
      expect(replaced.mistake).toBeGreaterThan(replaced.damagedOnPurpose * 0.75);
      expect(replaced.mistake).toBeLessThanOrEqual(replaced.damagedOnPurpose);
      // Measured: 0.4 wrongly red words per 1,000 words under letter noise.
      expect(noisy.mistake / noisy.expectedWords).toBeLessThan(0.005);
    });
  });
});
