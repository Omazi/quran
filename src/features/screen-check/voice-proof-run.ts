/**
 * CHECK BUILD ONLY (loaded through `door.ts`). The voice proof of the iOS check: real recitations
 * played to the app's real speech engine and passage search in the simulator, as if they came from
 * the microphone (the native module reads the file through its own converter, in real time), and
 * what came out written down: the passage found, how long after the start of the recitation, and
 * how long each reading by Whisper took. Pure: the engine, the search and the clock are given.
 *
 * A clip says what it holds in its name: `<id>__<surah>-<first verse>-<last verse>.wav`.
 */
import {
  AUDIO_CHECK,
  searchHeardWords,
  searchWithPartialWords,
  type SpeechEngine,
} from '@/domain/listening';
import type { PassageCandidate, SearchResult, VerseIndex } from '@/domain/recognition';
import { checkHeardWords, type HeldTexts } from '@/features/listening';

export interface ProofClip {
  readonly name: string;
  readonly path: string;
  readonly surah: number;
  readonly firstVerse: number;
  readonly lastVerse: number;
}

/** The clip a file name describes, or null when it does not follow the rule above. */
export function proofClipOf(name: string, path: string): ProofClip | null {
  const match = /^([A-Za-z0-9_-]{1,60})__([0-9]{1,3})-([0-9]{1,3})-([0-9]{1,3})\.wav$/.exec(name);
  if (match === null) return null;
  const [surah, firstVerse, lastVerse] = [match[2], match[3], match[4]].map(Number) as [
    number,
    number,
    number,
  ];
  if (surah < 1 || surah > 114 || firstVerse < 1 || lastVerse < firstVerse) return null;
  return { name, path, surah, firstVerse, lastVerse };
}

export interface ProofResult {
  readonly clip: ProofClip;
  /** The passage the screen would announce, or null. */
  readonly found: PassageCandidate | null;
  /** Milliseconds from the start of the recitation to the announcement. */
  readonly foundAtMs: number | null;
  readonly words: number;
  readonly readingsMs: readonly number[];
  /** How long each audio check took (D49), in milliseconds. */
  readonly checksMs?: readonly number[];
  /** The answer came from the audio check, not from the words alone. */
  readonly byCheck?: boolean;
  /** How the listening ended: `finished`, `failed: <failure>`, `timeout`... */
  readonly ending: string;
}

export interface VoiceProofDependencies {
  readonly clips: readonly ProofClip[];
  readonly loadIndex: () => Promise<VerseIndex>;
  /** The engine on one clip; it calls `onReading` after each reading by Whisper. */
  readonly createEngine: (
    clip: ProofClip,
    onReading: (ms: number) => void,
    onHeldReading: (ms: number) => void,
  ) => SpeechEngine | null;
  /** Imla'i verse texts for the audio check, as the listening screen loads them (D49). */
  readonly loadHeldTexts?: () => Promise<HeldTexts>;
  readonly now: () => number;
  readonly log: (line: string) => void;
  /** A listening that has not ended after this long is stopped. */
  readonly clipTimeoutMs?: number;
}

function covers(passage: PassageCandidate, clip: ProofClip): boolean {
  const order = (surah: number, verse: number) => surah * 1000 + verse;
  const from = order(passage.start.surah, passage.start.verse);
  const to = order(passage.end.surah, passage.end.verse);
  return from <= order(clip.surah, clip.lastVerse) && to >= order(clip.surah, clip.firstVerse);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

/** One line of the report for one clip. */
export function describeResult(result: ProofResult): string {
  const { clip, found } = result;
  const expected = `${clip.surah}:${clip.firstVerse}-${clip.lastVerse}`;
  const readings = result.readingsMs;
  const med = median(readings);
  const timing =
    readings.length === 0
      ? 'no reading'
      : `${readings.length} readings, median ${Math.round(med!)} ms, max ${Math.round(Math.max(...readings))} ms`;
  const what =
    found === null
      ? `nothing found (${result.words} words heard)`
      : `found ${found.start.surah}:${found.start.verse}-${found.end.surah}:${found.end.verse} ` +
        `at ${((result.foundAtMs ?? 0) / 1000).toFixed(1)} s after ${result.words} words`;
  const checks = result.checksMs ?? [];
  const checking =
    checks.length === 0
      ? ''
      : ` | ${checks.length} audio checks, max ${Math.round(Math.max(...checks))} ms` +
        (result.byCheck === true ? ', answer by the check' : '');
  const verdict = found === null ? 'MISS' : covers(found, clip) ? 'OK' : 'WRONG';
  return `voice-proof: ${clip.name} expected ${expected} | ${what} | ${timing}${checking} | ${result.ending} | ${verdict}`;
}

/** Listens to one clip as the listening screen does: the first `found` is the answer. */
async function listenTo(
  clip: ProofClip,
  index: VerseIndex,
  deps: VoiceProofDependencies,
): Promise<ProofResult> {
  const readingsMs: number[] = [];
  const checksMs: number[] = [];
  const engine = deps.createEngine(
    clip,
    (ms) => readingsMs.push(ms),
    (ms) => checksMs.push(ms),
  );
  if (engine === null) {
    return { clip, found: null, foundAtMs: null, words: 0, readingsMs, ending: 'no engine' };
  }
  const heard: string[] = [];
  let found: PassageCandidate | null = null;
  let foundAtMs: number | null = null;
  let wordsAtAnswer: number | null = null;
  let startedAt = deps.now();
  let byCheck = false;
  const texts = deps.loadHeldTexts === undefined ? null : await deps.loadHeldTexts();
  const ending = await new Promise<string>((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), deps.clipTimeoutMs ?? 90_000);
    const done = (why: string) => {
      clearTimeout(timer);
      resolve(why);
    };
    const answer = (result: SearchResult | null, words: number) => {
      if (found !== null || result === null || result.status !== 'found') return;
      found = result.candidates[0] ?? null;
      foundAtMs = deps.now() - startedAt;
      wordsAtAnswer = words;
      // As on the screen: the answer closes the microphone.
      void engine.stop().then(() => done('stopped at the answer'));
    };
    // The audio check, as the listening screen runs it (use-listening.ts): one at a time,
    // again once more words came, and once more before "nothing found".
    let checking: Promise<void> | null = null;
    let checkedAt = 0;
    const check = (words: readonly string[], last = false): Promise<void> => {
      checkedAt = words.length;
      const run = (async () => {
        if (texts === null) return;
        try {
          const result = await checkHeardWords(engine, index, texts, words, { secondChance: last });
          if (result !== null && found === null) byCheck = true;
          answer(result, heard.length);
        } catch {
          // As on the screen: a failed check leaves the answer to the words.
        }
      })();
      checking = run;
      void run.then(() => {
        if (checking === run) checking = null;
      });
      return run;
    };
    // The same searches as the listening screen (use-listening.ts): the final words, and the
    // words of the latest reading not final yet.
    engine.onWords((words) => {
      if (found !== null) return;
      heard.push(...words);
      const result = searchHeardWords(index, heard);
      answer(result, heard.length);
      if (
        found === null &&
        texts !== null &&
        checking === null &&
        heard.length >= AUDIO_CHECK.minWords &&
        heard.length >= checkedAt + AUDIO_CHECK.recheckAfterWords
      ) {
        void check([...heard]);
      }
    });
    engine.onActivity?.((activity) => {
      if (found !== null) return;
      answer(
        searchWithPartialWords(index, heard, activity.partial),
        heard.length + activity.partial.length,
      );
    });
    engine.onEnd((reason, failure) => {
      void (async () => {
        if (reason === 'finished' && found === null && texts !== null) {
          if (checking !== null) await checking;
          if (found === null && heard.length >= AUDIO_CHECK.minWords) {
            await check([...heard], true);
          }
          if (found !== null) return;
        }
        done(failure === undefined ? reason : `${reason}: ${failure}`);
      })();
    });
    engine.start().then(
      () => {
        startedAt = deps.now();
      },
      (error: unknown) =>
        done(`failed to start: ${error instanceof Error ? error.message : String(error)}`),
    );
  });
  await engine.stop().catch(() => undefined);
  return {
    clip,
    found,
    foundAtMs,
    words: wordsAtAnswer ?? heard.length,
    readingsMs,
    checksMs,
    byCheck,
    ending,
  };
}

/** Every clip, one after the other; the last line says DONE and how many were right. */
export async function runVoiceProof(deps: VoiceProofDependencies): Promise<ProofResult[]> {
  deps.log(`voice-proof: start, ${deps.clips.length} clips`);
  const index = await deps.loadIndex();
  const results: ProofResult[] = [];
  for (const clip of deps.clips) {
    const result = await listenTo(clip, index, deps);
    results.push(result);
    deps.log(describeResult(result));
  }
  const right = results.filter((r) => r.found !== null && covers(r.found, r.clip)).length;
  const wrong = results.filter((r) => r.found !== null && !covers(r.found, r.clip)).length;
  deps.log(`voice-proof: DONE right ${right}/${results.length}, wrong ${wrong}`);
  return results;
}
