/**
 * The passage search on what the real speech engine wrote for real ordinary readers (D42), word
 * after word as the listening screen receives them. Needs the generated Uthmani text; skipped
 * without it, like the other tests on the whole Quran.
 */
import { createVerseIndex, type SearchResult, type VerseIndex } from '../../recognition';
import { loadUthmaniCorpus } from '../../recognition/test-support/corpus';
import { ORDINARY_READERS_83_1_3 } from '../__fixtures__/ordinary-readers';
import { searchHeardWords } from '../heard-search';

const uthmani = loadUthmaniCorpus();
const describeWithCorpus = uthmani === null ? describe.skip : describe;

type Outcome = 'right' | 'wrong' | 'none';

/** The first `found` while the words arrive one by one, and whether it is 83:1–3. */
function firstFound(
  heard: readonly string[],
  search: (words: readonly string[]) => SearchResult,
): Outcome {
  for (let count = 1; count <= heard.length; count += 1) {
    const result = search(heard.slice(0, count));
    if (result.status !== 'found') continue;
    const { start } = result.candidates[0]!;
    return start.surah === 83 && start.verse <= 3 ? 'right' : 'wrong';
  }
  return 'none';
}

describeWithCorpus('28 ordinary readers reciting 83:1–3, as Whisper tiny heard them', () => {
  let index: VerseIndex;
  const recordings = ORDINARY_READERS_83_1_3.map(({ heard }) => heard.split(' '));

  beforeAll(() => {
    index = createVerseIndex(uthmani ?? []);
  });

  it('never names another passage', () => {
    for (const heard of recordings) {
      expect(firstFound(heard, (words) => searchHeardWords(index, words))).not.toBe('wrong');
      expect(firstFound(heard, (words) => index.search(words))).not.toBe('wrong');
    }
  });

  it('finds more of them with the latest words searched alone than with all the words', () => {
    const count = (search: (words: readonly string[]) => SearchResult) =>
      recordings.filter((heard) => firstFound(heard, search) === 'right').length;
    const withAllWords = count((words) => index.search(words));
    const withLatestWords = count((words) => searchHeardWords(index, words));
    // Measured on 25 November 2026: 16 and 19 of 28 (D42).
    expect(withAllWords).toBeGreaterThanOrEqual(16);
    expect(withLatestWords).toBeGreaterThanOrEqual(19);
    expect(withLatestWords).toBeGreaterThan(withAllWords);
  });
});
