/**
 * Following a recitation in the vertical reader (owner's decision, 25 November 2026): the track of
 * Uthmani words from the verse at the reading line, how each verse looks as the voice goes, the
 * pages a voice has fully followed, and where the scroll goes to keep the current line at the
 * reading line.
 */

import { quranRepository, quranStructure } from '@/data/quran';
import { followRecitation, startFollowing } from '@/domain/listening';
import { splitVerseWords, type VerseRef } from '@/domain/quran';

import { READER_CONFIG } from '../config';
import {
  buildFollowTrack,
  followScrollOffset,
  pagesFollowedByVoice,
  verseLook,
} from '../follow-model';

let uthmani: (ref: VerseRef) => string;
let imlaei: (ref: VerseRef) => string;

async function textsOf(script: 'uthmani' | 'imlaei') {
  const bySurah = new Map<number, readonly string[]>();
  for (const { surah } of quranStructure.surahs) {
    bySurah.set(
      surah,
      (await quranRepository.getSurahVerses(surah, script)).map((verse) => verse.text),
    );
  }
  return ({ surah, verse }: VerseRef) => bySurah.get(surah)?.[verse - 1] ?? '';
}

beforeAll(async () => {
  uthmani = await textsOf('uthmani');
  imlaei = await textsOf('imlaei');
});

describe('the track of words followed', () => {
  it('starts at the verse asked and holds the Uthmani words, in order, page after page', () => {
    const track = buildFollowTrack({ surah: 18, verse: 10 }, uthmani, 2);
    expect(track[0]).toMatchObject({ surah: 18, verse: 10, word: 0, page: 294 });
    expect(track[0]?.text).toBe(splitVerseWords(uthmani({ surah: 18, verse: 10 }))[0]);
    const pages = new Set(track.map((word) => word.page));
    expect([...pages]).toEqual([294, 295]);
    // Every word of the verses on the track, exactly as the data writes them.
    const verse10 = track.filter((word) => word.surah === 18 && word.verse === 10);
    expect(verse10.map((word) => word.text).join(' ')).toBe(uthmani({ surah: 18, verse: 10 }));
  });

  it('stops at the end of the Quran', () => {
    const track = buildFollowTrack({ surah: 114, verse: 5 }, uthmani, 5);
    expect(track.at(-1)).toMatchObject({ surah: 114, verse: 6 });
  });
});

describe('how a verse looks while the voice follows', () => {
  const start = { surah: 18, verse: 10 };

  it('lights the word just recited, marks the one to read again, the others stay as they are', () => {
    const track = buildFollowTrack(start, uthmani, 1);
    const words = track.map((word) => word.text);
    // « إذ », then « الفتية »: the word between them, « أوى », was left out.
    const state = followRecitation(startFollowing(0), words, ['إذ', 'الفتية']);
    const look = verseLook(track, state, { surah: 18, verse: 10 }, 'uthmani', 0);
    expect(look?.kind === 'words' && look.looks.slice(0, 4)).toEqual([
      'read',
      'reread',
      'current',
      'upcoming',
    ]);
    expect(verseLook(track, state, { surah: 18, verse: 11 }, 'uthmani', 0)).toBeNull();
  });

  it('maps the words to the simple script when a verse has as many words in both', () => {
    const track = buildFollowTrack(start, uthmani, 1);
    const state = followRecitation(
      startFollowing(0),
      track.map((word) => word.text),
      ['إذ'],
    );
    const simpleWords = splitVerseWords(imlaei(start)).length;
    expect(simpleWords).toBe(splitVerseWords(uthmani(start)).length);
    const look = verseLook(track, state, start, 'imlaei', simpleWords);
    expect(look?.kind === 'words' && look.looks.slice(0, 2)).toEqual(['current', 'upcoming']);
  });

  it('lights the whole verse when the two scripts count its words differently', () => {
    const track = buildFollowTrack(start, uthmani, 1);
    const state = followRecitation(
      startFollowing(0),
      track.map((word) => word.text),
      ['إذ'],
    );
    const differentCount = splitVerseWords(uthmani(start)).length + 1;
    expect(verseLook(track, state, start, 'imlaei', differentCount)).toEqual({
      kind: 'verse',
      look: 'current',
    });
  });
});

describe('pages a voice has fully followed', () => {
  it('counts a page whose every word was recited from its first, and not the page started inside', () => {
    // From 18:10, in the middle of page 294: page 294 was not followed from its start.
    const fromMiddle = buildFollowTrack({ surah: 18, verse: 10 }, uthmani, 2);
    const allRead = { next: fromMiddle.length, current: fromMiddle.length - 1, reread: null };
    expect(pagesFollowedByVoice(fromMiddle, allRead)).toEqual([295]);

    const first = quranStructure.firstVerseOfPage(294);
    const fromStart = buildFollowTrack(first, uthmani, 1);
    const lastOf294 = fromStart.filter((word) => word.page === 294).length;
    expect(
      pagesFollowedByVoice(fromStart, { next: lastOf294 - 1, current: 0, reread: null }),
    ).toEqual([]);
    expect(pagesFollowedByVoice(fromStart, { next: lastOf294, current: 0, reread: null })).toEqual([
      294,
    ]);
  });
});

describe('the scroll keeps the current line at the reading line', () => {
  it('estimates the line of the word in its paragraph and puts it at the reading line', () => {
    const offset = followScrollOffset({
      paragraphTop: 1000,
      paragraphHeight: 560,
      lineHeight: 56,
      charsBefore: 50,
      totalChars: 100,
      viewportHeight: 600,
    });
    // Half the characters: the sixth of ten lines, whose top is 280 points into the paragraph.
    expect(offset).toBe(1000 + 280 - READER_CONFIG.readingLineRatio * 600);
  });

  it('never scrolls above the top of the content', () => {
    expect(
      followScrollOffset({
        paragraphTop: 0,
        paragraphHeight: 112,
        lineHeight: 56,
        charsBefore: 0,
        totalChars: 10,
        viewportHeight: 600,
      }),
    ).toBe(0);
  });
});
