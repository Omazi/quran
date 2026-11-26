/**
 * The passage search on what the app's Whisper model really wrote on 306 clips of real
 * recitations (tools/voice-bench, D45), word after word as the listening screen receives them.
 * A regression net for the search: it must never name another passage, and must keep finding at
 * least as many as it did when measured. Needs the generated Uthmani text; skipped without it.
 */
import { createVerseIndex, type SearchResult, type VerseIndex } from '../../recognition';
import { loadUthmaniCorpus } from '../../recognition/test-support/corpus';
import { BENCH_RECITATIONS, type BenchRecitation } from '../__fixtures__/bench-recitations';
import { searchHeardWords } from '../heard-search';

const uthmani = loadUthmaniCorpus();
const describeWithCorpus = uthmani === null ? describe.skip : describe;

type Outcome = 'right' | 'wrong' | 'none';

/** The first `found` while the words arrive one by one, and whether it touches the verses heard. */
function firstFound(
  clip: BenchRecitation,
  search: (words: readonly string[]) => SearchResult,
): Outcome {
  const heard = clip.heard.split(/\s+/).filter((word) => word !== '');
  for (let count = 1; count <= heard.length; count += 1) {
    const result = search(heard.slice(0, count));
    if (result.status !== 'found') continue;
    const { start, end } = result.candidates[0]!;
    const order = (surah: number, verse: number) => surah * 1000 + verse;
    const touches =
      order(start.surah, start.verse) <= order(clip.surah, clip.verses[1]) &&
      order(end.surah, end.verse) >= order(clip.surah, clip.verses[0]);
    return touches ? 'right' : 'wrong';
  }
  return 'none';
}

describeWithCorpus('306 clips of real recitations, as the app’s Whisper wrote them', () => {
  let index: VerseIndex;

  beforeAll(() => {
    index = createVerseIndex(uthmani ?? []);
  });

  it('holds what the benchmark exported', () => {
    expect(BENCH_RECITATIONS).toHaveLength(306);
    expect(BENCH_RECITATIONS.filter((clip) => clip.reader === 'ordinary')).toHaveLength(90);
  });

  it('never names another passage', () => {
    const wrong = BENCH_RECITATIONS.filter(
      (clip) => firstFound(clip, (words) => searchHeardWords(index, words)) === 'wrong',
    );
    expect(wrong.map((clip) => clip.clip)).toEqual([]);
  });

  it('finds at least as many passages as when it was measured', () => {
    const found = (reader: BenchRecitation['reader']) =>
      BENCH_RECITATIONS.filter(
        (clip) =>
          clip.reader === reader &&
          firstFound(clip, (words) => searchHeardWords(index, words)) === 'right',
      ).length;
    // Measured on 26 November 2026 (D45): 184 of 216 professional clips, 38 of 90 ordinary.
    expect(found('professional')).toBeGreaterThanOrEqual(PROFESSIONAL_FOUND);
    expect(found('ordinary')).toBeGreaterThanOrEqual(ORDINARY_FOUND);
  });
});

const PROFESSIONAL_FOUND = 184;
const ORDINARY_FOUND = 38;
