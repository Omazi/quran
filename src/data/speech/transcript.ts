/**
 * From what Whisper writes to the words a `SpeechEngine` gives: words cleaned of what is not
 * Arabic, and only words that will not change any more (the interface's promise: "a word given
 * once is final").
 *
 * Whisper is not a streaming recogniser: the engine transcribes the phrase heard so far again and
 * again while it grows, and each pass may revise its last words. A word is given once two passes
 * in a row agree on it ("local agreement", as in Macháček et al., "Turning Whisper into Real-Time
 * Transcription System", 2023), and every word left is given when the phrase closes.
 */
import { normalizeArabic } from '@/domain/recognition';

import { SPEECH_ENGINE_CONFIG } from './config';

/** Sound labels Whisper may write between brackets: « [Music] », « (applause) ». */
const LABELS = /\[[^\]]*\]|\([^)]*\)/g;
/** Anything that is not in an Arabic block of Unicode. */
const NOT_ARABIC = /[^؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
/** Arabic punctuation: comma, semicolon, question mark, full stop. */
const ARABIC_PUNCTUATION = /[،؛؟۔]/g;

function keyOf(word: string): string {
  return normalizeArabic(word).join(' ');
}

/** The Arabic words of a transcription, in order, with their vowels as Whisper wrote them. */
export function whisperWords(text: string): string[] {
  const words: string[] = [];
  let repeated = 0;
  for (const token of text.replace(LABELS, ' ').split(/\s+/)) {
    const word = token.replace(NOT_ARABIC, '').replace(ARABIC_PUNCTUATION, '');
    if (word === '' || keyOf(word) === '') continue;
    const previous = words[words.length - 1];
    repeated = previous !== undefined && keyOf(previous) === keyOf(word) ? repeated + 1 : 1;
    if (repeated <= SPEECH_ENGINE_CONFIG.maxRepeatedWord) words.push(word);
  }
  return words;
}

export interface TranscriptStabilizer {
  /** A new pass over the phrase; returns the words that became final, in order. */
  update(words: readonly string[]): string[];
  /** The phrase is over: returns every word of this last pass not given yet, then starts afresh. */
  close(words: readonly string[]): string[];
  /** How many words of the current phrase were given already. */
  given(): number;
}

export function createTranscriptStabilizer(): TranscriptStabilizer {
  /** Words of the current phrase already given. */
  let given = 0;
  /** The previous pass over the current phrase, as comparison keys. */
  let previous: string[] = [];

  return {
    update(words) {
      const keys = words.map(keyOf);
      let agreed = 0;
      while (
        agreed < keys.length &&
        agreed < previous.length &&
        keys[agreed] === previous[agreed]
      ) {
        agreed += 1;
      }
      previous = keys;
      if (agreed <= given) return [];
      const final = words.slice(given, agreed);
      given = agreed;
      return final;
    },
    close(words) {
      const final = words.slice(given);
      given = 0;
      previous = [];
      return final;
    },
    given: () => given,
  };
}
