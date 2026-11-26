/**
 * Al-Fatiha in the first launch: the line recited under the garden and the mushaf page of the
 * voice page, both from page 1 of the mushaf as the data layer gives it (never typed by hand,
 * docs/ARCHITECTURE.md), and the demonstration's timeline: each word lit in turn, one word read
 * wrong, caught, then read again (the prototype's `TL`, docs/design/premier-lancement-voix).
 */

import type { MushafLine, MushafPage, MushafWord } from '@/domain/quran';

import { STORY_MOTION } from './config';
import { clamp, easeOut, mix } from './story-math';

/** The surah of the demonstration and where its long last verse is cut under the garden. */
export const RECITED_SURAH = 1;
/** The seventh verse is too long for one line: it is cut after its fourth word (the prototype's `SEG`). */
export const LONG_VERSE = { verse: 7, cutAfter: 4 } as const;
/** The word the demonstration reads wrong once: نَسۡتَعِينُ, the fourth word of 1:5. */
export const REREAD_WORD = { verse: 5, position: 4 } as const;

/** One line of the recited verse under the garden. */
export interface RecitedLine {
  readonly verse: number;
  /** The words exactly as the data writes them. */
  readonly words: readonly string[];
  /** Index of the line's first word among all the words of the surah, in reading order. */
  readonly start: number;
  /** True when the verse ends on this line: its end-of-verse mark follows the last word. */
  readonly endsVerse: boolean;
}

type TextLine = Extract<MushafLine, { kind: 'text' }>;

function isTextLine(line: MushafLine): line is TextLine {
  return line.kind === 'text';
}

function verseOf(word: MushafWord): number {
  const verse = Number(word.verseKey.split(':')[1]);
  if (!Number.isInteger(verse)) throw new RangeError(`Invalid verse key: ${word.verseKey}`);
  return verse;
}

/** The words of the surah on the page, in reading order. */
export function surahWords(page: MushafPage, surah = RECITED_SURAH): readonly MushafWord[] {
  return page.lines
    .filter(isTextLine)
    .flatMap((line) => line.words)
    .filter((word) => word.verseKey.startsWith(`${surah}:`));
}

/** The lines under the garden: one per verse, the long seventh cut in two. */
export function recitedLines(page: MushafPage): readonly RecitedLine[] {
  const words = surahWords(page);
  const lines: RecitedLine[] = [];
  let index = 0;
  while (index < words.length) {
    const first = words[index] as MushafWord;
    const verse = verseOf(first);
    let count = 0;
    while (index + count < words.length && verseOf(words[index + count] as MushafWord) === verse) {
      count += 1;
    }
    const cut =
      verse === LONG_VERSE.verse && count > LONG_VERSE.cutAfter ? LONG_VERSE.cutAfter : count;
    const verseWords = words.slice(index, index + count).map((word) => word.text);
    lines.push({ verse, words: verseWords.slice(0, cut), start: index, endsVerse: cut === count });
    if (cut < count) {
      lines.push({ verse, words: verseWords.slice(cut), start: index + cut, endsVerse: true });
    }
    index += count;
  }
  return lines;
}

/** One line of the mushaf page: its words with their reading index, and the verses ending on it. */
export interface PageLine {
  readonly words: readonly { readonly index: number; readonly text: string }[];
  readonly verseEnds: readonly { readonly afterWordIndex: number; readonly verse: number }[];
}

/** The lines of the surah on its mushaf page, as printed. */
export function pageLines(page: MushafPage, surah = RECITED_SURAH): readonly PageLine[] {
  let index = 0;
  return page.lines.filter(isTextLine).flatMap((line) => {
    const words = line.words.filter((word) => word.verseKey.startsWith(`${surah}:`));
    if (words.length === 0) return [];
    const placed = words.map((word) => ({ index: index++, text: word.text }));
    return [{ words: placed, verseEnds: line.verseEnds }];
  });
}

// --- The demonstration's timeline -------------------------------------------------------------

/** What happens in a step of the demonstration. */
export const STEP = { word: 0, reread: 1, fixed: 2 } as const;

/**
 * The demonstration as flat arrays, for the UI thread: for each step its kind, its word and its
 * start and end in milliseconds; and for each word when it becomes the current word and when it
 * is read, and its verse.
 */
export interface Recitation {
  readonly kinds: readonly number[];
  readonly words: readonly number[];
  readonly starts: readonly number[];
  readonly ends: readonly number[];
  /** When each word is reached (lit), and when the voice leaves it. */
  readonly wordStarts: readonly number[];
  readonly wordEnds: readonly number[];
  readonly verses: readonly number[];
  /** The word read wrong, its moment of error and the moment it is read again. */
  readonly reread: number;
  readonly rereadAt: number;
  readonly fixedAt: number;
  readonly fixedEnd: number;
  /** The whole loop, rest included. */
  readonly duration: number;
}

/**
 * The timeline: a word every 300 ms plus 26 ms per pair of letters, a breath of 260 ms at each
 * verse mark, the wrong word held 1.5 s then read again in 0.52 s, a rest of 1.9 s at the end.
 */
export function buildRecitation(page: MushafPage): Recitation {
  const m = STORY_MOTION;
  const words = surahWords(page);
  const verseEnds = new Set<number>();
  for (const line of pageLines(page)) {
    for (const end of line.verseEnds) {
      const word = line.words[end.afterWordIndex];
      if (word !== undefined) verseEnds.add(word.index);
    }
  }
  const reread = words.findIndex(
    (word) => verseOf(word) === REREAD_WORD.verse && word.position === REREAD_WORD.position,
  );
  if (reread < 0) throw new RangeError('The word to read again is not on the page.');
  const kinds: number[] = [];
  const steps: number[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  const wordStarts: number[] = [];
  const wordEnds: number[] = [];
  let t = m.recitationStartMs;
  let rereadAt = 0;
  let fixedAt = 0;
  let fixedEnd = 0;
  words.forEach((word, g) => {
    const step = (kind: number, length: number) => {
      kinds.push(kind);
      steps.push(g);
      starts.push(t);
      ends.push(t + length);
      t += length;
    };
    wordStarts.push(t);
    if (g === reread) {
      rereadAt = t;
      step(STEP.reread, m.rereadHoldMs);
      fixedAt = t;
      step(STEP.fixed, m.rereadFixMs);
      fixedEnd = t;
    } else {
      step(STEP.word, m.wordBaseMs + (Array.from(word.text).length / 2) * m.wordPerPairMs);
    }
    wordEnds.push(t);
    if (verseEnds.has(g)) t += m.verseBreathMs;
  });
  return {
    kinds,
    words: steps,
    starts,
    ends,
    wordStarts,
    wordEnds,
    verses: words.map(verseOf),
    reread,
    rereadAt,
    fixedAt,
    fixedEnd,
    duration: t + m.recitationRestMs,
  };
}

/** A change that takes `length` milliseconds from `from`: 0 before, 1 after. */
export function ramp(t: number, from: number, length: number): number {
  'worklet';
  return clamp((t - from) / length);
}

/** The step under way at `t`, or -1 between steps. */
export function stepAt(recitation: Recitation, t: number): number {
  'worklet';
  const { starts, ends } = recitation;
  for (let k = 0; k < starts.length; k += 1) {
    if (t >= (starts[k] ?? 0) && t < (ends[k] ?? 0)) return k;
  }
  return -1;
}

/** The word the voice is on at `t` (the last one reached), clamped to the surah. */
export function currentWord(recitation: Recitation, t: number): number {
  'worklet';
  const { wordStarts } = recitation;
  let word = 0;
  for (let g = 0; g < wordStarts.length; g += 1) if (t >= (wordStarts[g] ?? 0)) word = g;
  return word;
}

/**
 * How a word of the mushaf page looks at `t` (`.mw`): its opacity (faint until reached), how gold
 * it is (the word just recited), how red (the word read wrong, until it is read again).
 */
export function wordLook(
  recitation: Recitation,
  word: number,
  t: number,
): { ink: number; gold: number; red: number } {
  'worklet';
  const fade = STORY_MOTION.wordFadeMs;
  const start = recitation.wordStarts[word] ?? 0;
  const end = recitation.wordEnds[word] ?? 0;
  if (word === recitation.reread) {
    const red = ramp(t, recitation.rereadAt, fade) - ramp(t, recitation.fixedAt, fade);
    const fixed = ramp(t, recitation.fixedAt, fade);
    return { ink: (1 - red) * (0.3 + 0.7 * fixed), gold: 0, red };
  }
  const lit = ramp(t, start, fade);
  return { ink: 0.3 + 0.7 * lit, gold: lit - ramp(t, end, fade), red: 0 };
}

/** A box on the page: a word's place, for the pills that move under the words. */
export interface WordBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The gold pill under the word just recited (`#mpG`): which box it is on (moving from the word
 * before over 320 ms) and how visible it is (it fades in 250 ms after a pause, out at a pause).
 */
export function readPillLook(
  recitation: Recitation,
  boxes: readonly WordBox[],
  t: number,
): { box: WordBox; opacity: number } {
  'worklet';
  const empty = { x: 0, y: 0, width: 0, height: 0 };
  const fade = STORY_MOTION.wordFadeMs;
  const step = stepAt(recitation, t);
  const { kinds, words, starts, ends } = recitation;
  if (step >= 0 && kinds[step] === STEP.word) {
    const word = words[step] ?? 0;
    const here = boxes[word] ?? empty;
    const before = boxes[word - 1] ?? here;
    const slide = easeOut(ramp(t, starts[step] ?? 0, STORY_MOTION.pillSlideMs));
    const joined = step > 0 && kinds[step - 1] === STEP.word && ends[step - 1] === starts[step];
    return {
      box: {
        x: mix(before.x, here.x, slide),
        y: mix(before.y, here.y, slide),
        width: mix(before.width, here.width, slide),
        height: here.height,
      },
      opacity: joined ? 1 : ramp(t, starts[step] ?? 0, fade),
    };
  }
  // Between words: it fades out where the last word was.
  let last = -1;
  for (let k = 0; k < kinds.length; k += 1) {
    if (kinds[k] === STEP.word && (ends[k] ?? 0) <= t) last = k;
  }
  if (last < 0) return { box: empty, opacity: 0 };
  return {
    box: boxes[words[last] ?? 0] ?? empty,
    opacity: 1 - ramp(t, ends[last] ?? 0, fade),
  };
}

/** How visible the "read again" state is at `t` (the red pill, the bar's "Relis ce mot"). */
export function rereadAmount(recitation: Recitation, t: number): number {
  'worklet';
  const fade = STORY_MOTION.wordFadeMs;
  return ramp(t, recitation.rereadAt, fade) - ramp(t, recitation.fixedAt, fade);
}

/** How visible the "read again, now right" state is (the water pill). */
export function fixedAmount(recitation: Recitation, t: number): number {
  'worklet';
  const fade = STORY_MOTION.wordFadeMs;
  return ramp(t, recitation.fixedAt, fade) - ramp(t, recitation.fixedEnd, fade);
}

/**
 * The still picture shown with "reduce motion": the demonstration stopped on the word read wrong,
 * the words before it read (the prototype's `renderMushaf(null)`).
 */
export function stillMoment(recitation: Recitation): number {
  return (recitation.rereadAt + recitation.fixedAt) / 2;
}

/**
 * How far the word read wrong is shaken sideways at `t` (motion spec §8): 0, −3, 3, −2, 1, 0
 * points over the 360 ms after it turns red, each step on the strong ease-out. 0 otherwise.
 */
export function shakeOffset(recitation: Recitation, t: number): number {
  'worklet';
  const { shakeMs, shakeOffsets } = STORY_MOTION;
  const along = (t - recitation.rereadAt) / shakeMs;
  if (along <= 0 || along >= 1) return 0;
  const steps = shakeOffsets.length - 1;
  const at = along * steps;
  const step = Math.min(steps - 1, Math.floor(at));
  return mix(shakeOffsets[step] ?? 0, shakeOffsets[step + 1] ?? 0, easeOut(at - step));
}

/** True when the word turns red between two moments of the clock (for the warning haptic). */
export function turnsRed(recitation: Recitation, before: number, now: number): boolean {
  'worklet';
  return before < recitation.rereadAt && now >= recitation.rereadAt;
}
