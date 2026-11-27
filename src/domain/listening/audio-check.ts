/**
 * Checking the passages against the audio (docs/DECISIONS.md, D47).
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
   * Measured on the voice benchmark (tools/voice-bench, D47).
   */
  maxCostBase: 10,
  maxCostPerLetter: 1.0,
  minLead: 25,
  /** At least this many words heard before checking (fewer say too little). */
  minWords: 2,
  /** Opening formulas: said before a passage, the passage follows. */
  formulas: ['أعوذ بالله من الشيطان الرجيم', 'بسم الله الرحمن الرحيم'] as readonly string[],
});

/** A passage to read the audio against: the search's candidate, and the verses held. */
export interface AudioCheckCandidate {
  readonly passage: PassageCandidate;
  readonly first: VerseRef;
  readonly last: VerseRef;
}

/** One reading of the audio held to a candidate's text (see `quran-decoding.h`). */
export interface HeldReading {
  readonly cost: number;
  readonly letters: number;
  /** Letters of the free words at its start (not the passage). */
  readonly freeLetters: number;
  /** Stopped early because it already cost far more than a better one. */
  readonly abandoned: boolean;
  readonly text: string;
}

export type AudioCheckDecision =
  | { readonly status: 'found'; readonly candidate: AudioCheckCandidate; readonly lead: number }
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
    for (let verse = from; ; verse += 1) {
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
export function decideByAudio(
  index: VerseIndex,
  candidates: readonly AudioCheckCandidate[],
  readings: readonly HeldReading[],
  freeText: string,
): AudioCheckDecision {
  if (candidates.length === 0 || readings.length !== candidates.length) return { status: 'unsure' };
  let best = -1;
  readings.forEach((reading, i) => {
    if (reading.abandoned) return;
    if (best < 0 || reading.cost < readings[best]!.cost) best = i;
  });
  if (best < 0) return { status: 'unsure' };
  const cost = readings[best]!.cost;
  const allowed = AUDIO_CHECK.maxCostBase + AUDIO_CHECK.maxCostPerLetter * letterCount(freeText);
  if (cost > allowed) return { status: 'unsure' };
  let lead = Number.POSITIVE_INFINITY;
  readings.forEach((reading, i) => {
    if (i === best || reading.abandoned) return;
    lead = Math.min(lead, reading.cost - cost);
  });
  if (lead < AUDIO_CHECK.minLead) return { status: 'unsure' };
  const candidate = candidates[best]!;
  const named = searchHeardWords(index, passageWords(readings[best]!));
  if (named.status !== 'found') return { status: 'unsure' };
  const place = named.candidates[0]!;
  const from = order(place.start);
  const to = order(place.end);
  if (to < order(candidate.first) || from > order(candidate.last)) return { status: 'unsure' };
  return { status: 'found', candidate, lead };
}
