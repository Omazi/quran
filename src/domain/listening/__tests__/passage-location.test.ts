import type { VerseRef } from '../../quran';
import type { PassageCandidate } from '../../recognition';
import { locatePassage } from '../index';

/** A structure that knows three verses: enough to tell which one was asked for. */
const PAGES: Readonly<Record<string, number>> = { '2:255': 42, '113:5': 604, '114:1': 604 };
const structure = {
  pageOfVerse: ({ surah, verse }: VerseRef): number => {
    const page = PAGES[`${surah}:${verse}`];
    if (page === undefined) throw new RangeError(`Invalid verse: ${surah}:${verse}`);
    return page;
  },
};

function candidate(
  start: [number, number, number],
  end: [number, number, number],
): PassageCandidate {
  const [surah, verse, word] = start;
  const [endSurah, endVerse, endWord] = end;
  return {
    start: { surah, verse, word },
    end: { surah: endSurah, verse: endVerse, word: endWord },
    score: 1,
    confidence: 1,
  };
}

describe('locatePassage', () => {
  it('gives the verse of the passage and the page where it starts', () => {
    expect(locatePassage(candidate([2, 255, 3], [2, 255, 9]), structure)).toEqual({
      firstVerse: { surah: 2, verse: 255 },
      lastVerse: { surah: 2, verse: 255 },
      page: 42,
    });
  });

  it('keeps both ends of a passage that runs over two surahs', () => {
    expect(locatePassage(candidate([113, 5, 1], [114, 1, 4]), structure)).toEqual({
      firstVerse: { surah: 113, verse: 5 },
      lastVerse: { surah: 114, verse: 1 },
      page: 604,
    });
  });

  it('lets the error of an unknown verse through: no page is made up', () => {
    expect(() => locatePassage(candidate([9, 130, 1], [9, 130, 2]), structure)).toThrow(RangeError);
  });
});
