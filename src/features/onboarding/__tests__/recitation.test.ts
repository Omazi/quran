import { quranRepository } from '@/data/quran';
import type { MushafPage } from '@/domain/quran';

import { STORY_MOTION } from '../config';
import { crackGroups, earthPoint } from '../cracks';
import {
  buildRecitation,
  currentWord,
  pageLines,
  readPillLook,
  recitedLines,
  rereadAmount,
  stillMoment,
  surahWords,
  wordLook,
} from '../recitation';
import { stageLayout } from '../stage-layout';

let page: MushafPage;

beforeAll(async () => {
  page = await quranRepository.getPage(1);
});

describe('Al-Fatiha, from page 1 of the data (never typed by hand)', () => {
  it('has the 29 words of the surah, exactly as the data writes them', async () => {
    const words = surahWords(page);
    expect(words).toHaveLength(29);
    const verses = await quranRepository.getSurahVerses(1);
    expect(words.map((word) => word.text).join(' ')).toBe(
      verses.map((verse) => verse.text).join(' '),
    );
  });

  it('recites one verse a line under the garden, the long seventh cut after its fourth word', () => {
    const lines = recitedLines(page);
    expect(
      lines.map((line) => [line.verse, line.words.length, line.start, line.endsVerse]),
    ).toEqual([
      [1, 4, 0, true],
      [2, 4, 4, true],
      [3, 2, 8, true],
      [4, 3, 10, true],
      [5, 4, 13, true],
      [6, 3, 17, true],
      [7, 4, 20, false],
      [7, 5, 24, true],
    ]);
  });

  it('sets the voice page as the mushaf prints page 1, words numbered in reading order', () => {
    const lines = pageLines(page);
    expect(lines).toHaveLength(7);
    expect(lines.flatMap((line) => line.words.map((word) => word.index))).toEqual(
      Array.from({ length: 29 }, (_, index) => index),
    );
    expect(lines.flatMap((line) => line.verseEnds.map((end) => end.verse))).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });
});

describe('the demonstration of the voice page', () => {
  it('lights a word every 300 ms plus 26 ms per pair of letters, from 0.5 s', () => {
    const recitation = buildRecitation(page);
    expect(recitation.wordStarts[0]).toBe(STORY_MOTION.recitationStartMs);
    const first = surahWords(page)[0]?.text ?? '';
    expect(recitation.wordEnds[0]).toBe(500 + 300 + (Array.from(first).length / 2) * 26);
  });

  it('reads نستعين wrong once: red for 1.5 s with "Relis ce mot", then read again', () => {
    const recitation = buildRecitation(page);
    expect(surahWords(page)[recitation.reread]?.verseKey).toBe('1:5');
    expect(recitation.fixedAt - recitation.rereadAt).toBe(STORY_MOTION.rereadHoldMs);
    const during = recitation.rereadAt + 600;
    expect(wordLook(recitation, recitation.reread, during).red).toBe(1);
    expect(rereadAmount(recitation, during)).toBe(1);
    expect(wordLook(recitation, recitation.reread, recitation.fixedEnd + 400)).toEqual({
      ink: 1,
      gold: 0,
      red: 0,
    });
    // The words before it are read, the words after it still faint.
    expect(wordLook(recitation, 0, during).ink).toBe(1);
    expect(wordLook(recitation, 28, during).ink).toBeCloseTo(0.3);
  });

  it('shows each word gold while the voice is on it, then in ink', () => {
    const recitation = buildRecitation(page);
    const start = recitation.wordStarts[3] ?? 0;
    expect(wordLook(recitation, 3, start + 300).gold).toBe(1);
    expect(currentWord(recitation, start + 10)).toBe(3);
    expect(wordLook(recitation, 3, (recitation.wordEnds[3] ?? 0) + 300).gold).toBe(0);
  });

  it('moves the gold pill from word to word and lets it go at a verse mark', () => {
    const recitation = buildRecitation(page);
    const boxes = Array.from({ length: 29 }, (_, index) => ({
      x: index * 10,
      y: 0,
      width: 8,
      height: 30,
    }));
    const atSecond = readPillLook(
      recitation,
      boxes,
      (recitation.wordStarts[1] ?? 0) + STORY_MOTION.pillSlideMs,
    );
    expect(atSecond).toMatchObject({ box: { x: 10 }, opacity: 1 });
    // The breath after the first verse: the pill fades where the verse ended.
    const breath = (recitation.wordEnds[3] ?? 0) + STORY_MOTION.verseBreathMs - 1;
    expect(readPillLook(recitation, boxes, breath).box.x).toBe(30);
  });

  it('stops on the word to read again with reduce motion, the words before it read', () => {
    const recitation = buildRecitation(page);
    const still = stillMoment(recitation);
    expect(wordLook(recitation, recitation.reread, still).red).toBe(1);
    expect(wordLook(recitation, recitation.reread - 1, still).ink).toBe(1);
  });

  it('loops after a rest', () => {
    const recitation = buildRecitation(page);
    expect(recitation.duration).toBe(
      (recitation.wordEnds[28] ?? 0) + STORY_MOTION.verseBreathMs + STORY_MOTION.recitationRestMs,
    );
  });
});

describe('the drought’s cracks and the stage’s layout', () => {
  it('cracks the earth the same way at every launch, inside its top', () => {
    const groups = crackGroups();
    expect(groups).toEqual(crackGroups());
    expect(groups.length).toBeGreaterThan(5);
    expect(groups.length).toBeLessThanOrEqual(STORY_MOTION.crackGroups + 1);
    expect(groups.map((group) => group.at)).toEqual(
      [...groups.map((group) => group.at)].sort((a, b) => a - b),
    );
    expect(earthPoint(0, 0)).toEqual([584, 85]);
  });

  it('places the stage as the prototype does on a 390 × 844 screen', () => {
    const layout = stageLayout({ width: 390, height: 844, top: 47, bottom: 34 });
    expect(layout.garden.height).toBeCloseTo(288.4, 0);
    expect(layout.garden.top).toBeCloseTo(47 + 844 * 0.13);
    // The words sit 40 points under the thread, or 246 points above the bottom, whichever is lower.
    expect(layout.copyTop).toBeCloseTo(Math.max(layout.waveY + 40, 844 - 246 - 34));
    expect(layout.waveY).toBeGreaterThan(layout.verseTop);
    expect(layout.pageTextSize).toBe(24);
    expect(() => stageLayout({ width: 0, height: 844, top: 0, bottom: 0 })).toThrow(RangeError);
  });
});
