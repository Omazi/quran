/**
 * Checking the passages against the audio (docs/DECISIONS.md, D49).
 *
 * Whisper's free reading of an ordinary reciter is often misspelt ("الناح يختوا فون" for "الناس
 * يستوفون"): the passage search then finds nothing sure, though the right passage is often among
 * the few it ranks. So the audio is read again, once per ranked passage, the decoder being held to
 * that passage's text (native `quran-decoding`, through whisper.rn). Each reading has a cost: how
 * far the text had to move Whisper from what it heard. The passage really recited costs little;
 * the others cost much more, because their text had to be forced on the audio. A passage is
 * announced only when it is cheap enough itself, far cheaper than every other one, **and** when the
 * text of its reading, searched as any heard words are (`searchHeardWords`, never sure wrongly),
 * names that same passage and no other place (a stretch said in several places of the Quran stays
 * unsure, as it does without the audio check).
 *
 * Pure: the readings come from the speech side (`data/speech`), the verse texts from the caller.
 */
import type { VerseRef } from '../quran/types';
import type { PassageCandidate, SearchResult, VerseIndex } from '../recognition';

import { searchHeardWords } from './heard-search';
import { lettersOf, type LetterPlace, type QuranLetters } from './quran-letters';
import type { HeldReading } from './types';

export type { HeldReading } from './types';

export const AUDIO_CHECK = Object.freeze({
  /** The search that proposes passages to check: looser than the one that announces. */
  search: { minScore: 0.3, minWords: 2, maxAlternatives: 8 },
  /** The latest words are searched alone too (as `searchHeardWords` does). */
  recentWords: 8,
  /** At most this many passages are read again (each reading costs about a free reading). */
  maxCandidates: 4,
  /** Verses held on each side of a proposed passage (the reader may have gone on, or started
   * just before it). */
  versesAround: 1,
  /**
   * The reading may not end before it holds this share of the letters of Whisper's free reading
   * (a wrong passage would otherwise end at once, for little cost).
   */
  minLetterShare: 0.6,
  /**
   * The best passage is announced when its cost is at most `maxCostPerLetter` per letter of the
   * free reading (plus `maxCostBase`), and every other passage costs at least `minLead` more.
   * Measured on the voice benchmark (tools/voice-bench, D49).
   */
  maxCostBase: 10,
  maxCostPerLetter: 0.5,
  minLead: 15,
  /**
   * A reading that holds more of its passage than Whisper heard plainly may cost up to this per
   * letter of its own passage (counted up to the letters heard), when that allows more than
   * `maxCostPerLetter` (D50: an ordinary reader misspelt by Whisper, read back whole).
   */
  maxCostPerPassageLetter: 1,
  /**
   * With the letters of the Quran (`quran-letters.ts`): a reading whose passage letters, at
   * least this many, are said in one place only of the Quran names that place, even when its
   * words are too few for the word search (which wants three). D50.
   */
  uniqueMinLetters: 10,
  /** How the native side reads (quran-decoding.h, ReadOptions). A passage already `margin`
   * more expensive than the best one is not read to the end: more than `minLead`, so stopping
   * it never changes the decision. */
  read: { freeLetterCost: 2, firstChoices: 3, margin: 40 },
  /** At least this many words heard before checking (fewer say too little). */
  minWords: 2,
  /** A listening is checked again only once this many more words were heard. */
  recheckAfterWords: 3,
  /** Opening formulas: said before a passage, the passage follows. */
  formulas: ['أعوذ بالله من الشيطان الرجيم', 'بسم الله الرحمن الرحيم'] as readonly string[],
});

/** A passage to read the audio against: the search's candidate, and the verses held. */
export interface AudioCheckCandidate {
  readonly passage: PassageCandidate;
  readonly first: VerseRef;
  readonly last: VerseRef;
}

export type AudioCheckDecision =
  | {
      readonly status: 'found';
      readonly candidate: AudioCheckCandidate;
      readonly lead: number;
      /** The search of the reading's own words: `found`, naming the passage. */
      readonly result: SearchResult;
    }
  | { readonly status: 'unsure' };

function order(ref: VerseRef): number {
  return ref.surah * 1000 + ref.verse;
}

function overlaps(a: AudioCheckCandidate, b: AudioCheckCandidate): boolean {
  return order(a.first) <= order(b.last) && order(b.first) <= order(a.last);
}

/**
 * The passages worth reading the audio against, best ranked first, none overlapping another:
 * the search's candidates for all the words and for the latest ones, with a loose threshold.
 * `verseCount(surah)` gives the number of verses of a surah.
 */
export function audioCheckCandidates(
  index: VerseIndex,
  words: readonly string[],
  verseCount: (surah: number) => number,
): AudioCheckCandidate[] {
  if (words.length < AUDIO_CHECK.minWords) return [];
  const ranked: PassageCandidate[] = [];
  const add = (result: SearchResult) => ranked.push(...result.candidates);
  add(index.search(words, AUDIO_CHECK.search));
  if (words.length > AUDIO_CHECK.recentWords) {
    add(index.search(words.slice(-AUDIO_CHECK.recentWords), AUDIO_CHECK.search));
  }
  ranked.sort((a, b) => b.score - a.score);
  const chosen: AudioCheckCandidate[] = [];
  for (const passage of ranked) {
    const around = AUDIO_CHECK.versesAround;
    const first = { surah: passage.start.surah, verse: Math.max(1, passage.start.verse - around) };
    const last = {
      surah: passage.end.surah,
      verse: Math.min(verseCount(passage.end.surah), passage.end.verse + around),
    };
    const candidate = { passage, first, last };
    if (chosen.some((other) => overlaps(other, candidate))) continue;
    chosen.push(candidate);
    if (chosen.length === AUDIO_CHECK.maxCandidates) break;
  }
  return chosen;
}

/**
 * More passages to read, after a first check that stayed unsure: those the search ranks for the
 * words of a reading held to the whole Quran (`wholeQuranText`), which follows the audio where
 * Whisper's free reading was too misspelt to place. None overlapping those already read.
 */
export function followUpCandidates(
  index: VerseIndex,
  wholeQuranReading: HeldReading,
  already: readonly AudioCheckCandidate[],
  verseCount: (surah: number) => number,
): AudioCheckCandidate[] {
  return audioCheckCandidates(index, passageWords(wholeQuranReading), verseCount).filter(
    (candidate) => !already.some((other) => overlaps(other, candidate)),
  );
}

/** The text of a reading held to the whole Quran: the formulas, then every verse. */
export function wholeQuranText(
  verseText: (ref: VerseRef) => string | undefined,
  verseCount: (surah: number) => number,
): string {
  return heldText(
    {
      passage: WHOLE_PASSAGE,
      first: { surah: 1, verse: 1 },
      last: { surah: 114, verse: verseCount(114) },
    },
    verseText,
  );
}

const WHOLE_PASSAGE: PassageCandidate = Object.freeze({
  start: { surah: 1, verse: 1, word: 1 },
  end: { surah: 114, verse: 6, word: 1 },
  score: 0,
  confidence: 0,
});

const MAX_VERSES = 286;

/**
 * The text a reading is held to, in the format of `quran-decoding.h`: the opening formulas, then
 * one line per verse ("<surah> <verse> <text>"), in imla'i spelling (the model writes imla'i).
 * `verseText` gives a verse's text, or undefined past the end of a surah.
 */
export function heldText(
  candidate: AudioCheckCandidate,
  verseText: (ref: VerseRef) => string | undefined,
): string {
  const lines = AUDIO_CHECK.formulas.map((formula) => `formula ${formula}`);
  for (let surah = candidate.first.surah; surah <= candidate.last.surah; surah += 1) {
    const from = surah === candidate.first.surah ? candidate.first.verse : 1;
    // 286 verses at most in a surah (al-Baqara): a text source that never says "no more" stops.
    for (let verse = from; verse <= MAX_VERSES; verse += 1) {
      if (surah === candidate.last.surah && verse > candidate.last.verse) break;
      const text = verseText({ surah, verse });
      if (text === undefined) break;
      lines.push(`${surah} ${verse} ${text}`);
    }
  }
  return lines.join('\n');
}

/** Letters of a free reading, counted as `quran-decoding` counts them (Arabic letters only). */
export function letterCount(text: string): number {
  return (text.match(/[ء-غف-يٱ-ۓ]/gu) ?? []).length;
}

/** The fewest letters a held reading must reach before it may end. */
export function minLettersFor(freeText: string): number {
  return Math.floor(letterCount(freeText) * AUDIO_CHECK.minLetterShare);
}

/** The words of a held reading after its free words (they are not the passage). */
export function passageWords(reading: HeldReading): string[] {
  const words = reading.text.split(/\s+/u).filter((word) => letterCount(word) > 0);
  let skipped = 0;
  let letters = 0;
  while (skipped < words.length && letters + letterCount(words[skipped]!) <= reading.freeLetters) {
    letters += letterCount(words[skipped]!);
    skipped += 1;
  }
  return words.slice(skipped);
}

/**
 * The passage the audio says, or `unsure`: the cheapest reading must be cheap enough for the
 * letters heard, every other passage at least `minLead` more expensive (an abandoned reading was
 * stopped once it was, so it counts as far enough), and the reading's own words must name that
 * passage alone when searched as heard words.
 */
export interface AudioCheckThresholds {
  readonly maxCostBase: number;
  readonly maxCostPerLetter: number;
  readonly minLead: number;
  /** 0 or absent: no allowance per letter of the reading's own passage. */
  readonly maxCostPerPassageLetter?: number;
  /** 0 or absent: the word search alone names the passage. */
  readonly uniqueMinLetters?: number;
}

const FORMULA_LETTERS = AUDIO_CHECK.formulas.map(lettersOf);

/** The one place where the letters of `words` are said (opening formulas skipped), or null. */
function uniquePlace(
  letters: QuranLetters,
  words: readonly string[],
  min: number,
): LetterPlace | null {
  let passage = lettersOf(words.join(' '));
  for (const formula of FORMULA_LETTERS) {
    if (passage.startsWith(formula) && passage.length > formula.length) {
      passage = passage.slice(formula.length);
    }
  }
  if (passage.length < min) return null;
  const places = letters.placesOf(passage, 2);
  return places.length === 1 ? places[0]! : null;
}

/** A search result naming `place` alone, as the word search names a passage. */
function foundAt(place: LetterPlace): SearchResult {
  return {
    status: 'found',
    candidates: [
      {
        start: { ...place.first, word: 1 },
        end: { ...place.last, word: 1 },
        score: 1,
        confidence: 1,
      },
    ],
    tiedCount: 1,
  };
}

export function decideByAudio(
  index: VerseIndex,
  candidates: readonly AudioCheckCandidate[],
  readings: readonly HeldReading[],
  freeText: string,
  thresholds: AudioCheckThresholds = AUDIO_CHECK,
  letters?: QuranLetters,
): AudioCheckDecision {
  if (candidates.length === 0 || readings.length !== candidates.length) return { status: 'unsure' };
  let best = -1;
  readings.forEach((reading, i) => {
    if (reading.abandoned) return;
    if (best < 0 || reading.cost < readings[best]!.cost) best = i;
  });
  if (best < 0) return { status: 'unsure' };
  const cost = readings[best]!.cost;
  const words = passageWords(readings[best]!);
  const heard = letterCount(freeText);
  const own = Math.min(heard, letterCount(words.join(' ')));
  const allowed =
    thresholds.maxCostBase +
    Math.max(thresholds.maxCostPerLetter * heard, (thresholds.maxCostPerPassageLetter ?? 0) * own);
  if (cost > allowed) return { status: 'unsure' };
  let lead = Number.POSITIVE_INFINITY;
  readings.forEach((reading, i) => {
    if (i === best || reading.abandoned) return;
    lead = Math.min(lead, reading.cost - cost);
  });
  if (lead < thresholds.minLead) return { status: 'unsure' };
  const candidate = candidates[best]!;
  const within = (from: VerseRef, to: VerseRef) =>
    order(to) >= order(candidate.first) && order(from) <= order(candidate.last);
  const named = searchHeardWords(index, words);
  if (named.status === 'found') {
    const place = named.candidates[0]!;
    if (!within(place.start, place.end)) return { status: 'unsure' };
    return { status: 'found', candidate, lead, result: named };
  }
  const minLetters = thresholds.uniqueMinLetters ?? 0;
  if (letters === undefined || minLetters <= 0) return { status: 'unsure' };
  const place = uniquePlace(letters, words, minLetters);
  if (place === null || !within(place.first, place.last)) return { status: 'unsure' };
  return { status: 'found', candidate, lead, result: foundAt(place) };
}
