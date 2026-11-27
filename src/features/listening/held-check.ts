/**
 * The audio check of a listening (docs/DECISIONS.md, D47): when the words heard do not name a
 * passage for sure, the passages the search ranks are read again from the audio, each held to
 * its own text (`SpeechEngine.checkHeard`), and the domain decides (`decideByAudio`). Used by the
 * listening screen and by the voice proof of the check build.
 */
import {
  AUDIO_CHECK,
  audioCheckCandidates,
  decideByAudio,
  followUpCandidates,
  heldText,
  wholeQuranText,
  type AudioCheckCandidate,
  type HeldCheck,
  type HeldReading,
  type SpeechEngine,
} from '@/domain/listening';
import type { VerseRef } from '@/domain/quran';
import type { SearchResult, VerseIndex } from '@/domain/recognition';

/** Imla'i verse texts (the spelling the model writes) and the length of each surah. */
export interface HeldTexts {
  text(ref: VerseRef): string | undefined;
  verseCount(surah: number): number;
}

const wholeTexts = new WeakMap<HeldTexts, string>();
function wholeQuranOf(texts: HeldTexts): string {
  let whole = wholeTexts.get(texts);
  if (whole === undefined) {
    whole = wholeQuranText(
      (ref) => texts.text(ref),
      (surah) => texts.verseCount(surah),
    );
    wholeTexts.set(texts, whole);
  }
  return whole;
}

/**
 * Checks `words` against the audio of the engine's latest reading. Resolves with a `found`
 * search result naming the passage, or null (unsure, nothing to check, or a build that cannot).
 * With `secondChance` (the last check of a listening, before "nothing found"), when the passages
 * the words propose leave it unsure, the audio is read once more held to the whole Quran, and the
 * passages that reading proposes are read too (two more native calls; +1 clip in 208 on the
 * bench, D47: not worth slowing the readings during the listening).
 */
export async function checkHeardWords(
  engine: SpeechEngine,
  index: VerseIndex,
  texts: HeldTexts,
  words: readonly string[],
  { secondChance = false }: { readonly secondChance?: boolean } = {},
): Promise<SearchResult | null> {
  if (engine.checkHeard === undefined || words.length < AUDIO_CHECK.minWords) return null;
  const verseCount = (surah: number) => texts.verseCount(surah);
  const textOf = (candidate: AudioCheckCandidate) => heldText(candidate, (ref) => texts.text(ref));
  const candidates = audioCheckCandidates(index, words, verseCount);
  let readings: readonly HeldReading[] = [];
  let first: HeldCheck | null = null;
  if (candidates.length > 0) {
    first = await engine.checkHeard(candidates.map(textOf));
    if (first === null) return null;
    readings = first.readings;
    const decision = decideByAudio(index, candidates, readings, first.freeText);
    if (decision.status === 'found') return decision.result;
  }
  if (!secondChance) return null;
  // Second chance: the same audio held to the whole Quran proposes its own passages.
  const whole = await engine.checkHeard([wholeQuranOf(texts)], first ?? undefined);
  if (whole === null || whole.readings.length !== 1) return null;
  const more = followUpCandidates(index, whole.readings[0]!, candidates, verseCount);
  if (more.length === 0) return null;
  const extra = await engine.checkHeard(more.map(textOf), whole);
  if (extra === null) return null;
  const decision = decideByAudio(
    index,
    [...candidates, ...more],
    [...readings, ...extra.readings],
    extra.freeText,
  );
  return decision.status === 'found' ? decision.result : null;
}
