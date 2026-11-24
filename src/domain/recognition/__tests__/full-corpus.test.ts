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
import { UTHMANI_SAMPLE } from '../__fixtures__/uthmani-sample';
import { createVerseIndex, normalizeArabic, type VerseIndex, type VerseText } from '../index';
import {
  loadImlaeiCorpus,
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
const describeWithCorpus = uthmani === null ? describe.skip : describe;
const itWithImlaei = imlaei === null ? it.skip : it;

/** Number of passages drawn for the search measures; the other samples follow it. */
const PASSAGES = Number(process.env.RECOGNITION_MEASURE_PASSAGES ?? 120);

/** Budgets of the spec, for a development machine. */
const INDEX_BUILD_BUDGET_MS = 2000;
const SEARCH_BUDGET_MS = 150;

const now = (): number => performance.now();

function report(title: string, measure: unknown): void {
  if (process.env.RECOGNITION_PRINT_MEASURES !== undefined) {
    console.warn(`${title}\n${JSON.stringify(measure, null, 2)}`);
  }
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
  let buildMs = 0;

  beforeAll(() => {
    const before = now();
    index = createVerseIndex(verses);
    buildMs = now() - before;
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

  it('agrees with the sample verses used by the other tests', () => {
    const byKey = new Map(verses.map((verse) => [`${verse.surah}:${verse.verse}`, verse.text]));
    for (const sample of UTHMANI_SAMPLE) {
      const generated = byKey.get(`${sample.surah}:${sample.verse}`) ?? '';
      expect(normalizeArabic(generated)).toEqual(normalizeArabic(sample.text));
    }
  });

  itWithImlaei(
    "Rule 1 measure — share of verses whose Uthmani and imla'i words are identical",
    () => {
      const measure = measureNormalization(verses, spoken);
      report("Normalisation, Uthmani against imla'i", measure);

      // Measured: 92.0 % identical, 1.8 word edits on average for the others (Tanzil Simple).
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
        // Measured on 2,000 passages, imla'i text as input: 100 %, 99.9 %, 98.0 %, 92.3 %.
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

      // Measured on 2,000 inputs: no false positive, best score 0.53.
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

  describe('Rule 3 measures — following simulated readers', () => {
    const sessions = { seed: 5, sessions: Math.ceil(PASSAGES / 5), wordsPerSession: 60 };

    it('shows no mistake to a reader who reads correctly', () => {
      const measure = measureFollow(verses, spoken, 'clean', sessions);
      report('Follow, clean reading', measure);

      expect(measure.mistake).toBe(0);
      // Measured: 2 words in 26,871 skipped, both written very differently by the two scripts.
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

      // Measured: 90 % of the replaced words are marked; a replaced word can be a close one.
      expect(replaced.mistake).toBeGreaterThan(replaced.damagedOnPurpose * 0.75);
      expect(replaced.mistake).toBeLessThanOrEqual(replaced.damagedOnPurpose);
      // Measured: 0.4 wrongly red words per 1,000 words under letter noise.
      expect(noisy.mistake / noisy.expectedWords).toBeLessThan(0.005);
    });
  });
});
