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
  heldText,
  type SpeechEngine,
} from '@/domain/listening';
import type { VerseRef } from '@/domain/quran';
import type { SearchResult, VerseIndex } from '@/domain/recognition';

/** Imla'i verse texts (the spelling the model writes) and the length of each surah. */
export interface HeldTexts {
  text(ref: VerseRef): string | undefined;
  verseCount(surah: number): number;
}

/**
 * Checks `words` against the audio of the engine's latest reading. Resolves with a `found`
 * search result naming the passage, or null (unsure, nothing to check, or a build that cannot).
 */
export async function checkHeardWords(
  engine: SpeechEngine,
  index: VerseIndex,
  texts: HeldTexts,
  words: readonly string[],
): Promise<SearchResult | null> {
  if (engine.checkHeard === undefined || words.length < AUDIO_CHECK.minWords) return null;
  const candidates = audioCheckCandidates(index, words, (surah) => texts.verseCount(surah));
  if (candidates.length === 0) return null;
  const check = await engine.checkHeard(
    candidates.map((candidate) => heldText(candidate, (ref) => texts.text(ref))),
  );
  if (check === null) return null;
  const decision = decideByAudio(index, candidates, check.readings, check.freeText);
  return decision.status === 'found' ? decision.result : null;
}
