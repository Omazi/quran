/**
 * CHECK BUILD ONLY (loaded through `door.ts`). The voice proof of the iOS check: real recitations
 * played to the app's real speech engine and passage search in the simulator, as if they came from
 * the microphone (the native module reads the file through its own converter, in real time), and
 * what came out written down: the passage found, how long after the start of the recitation, and
 * how long each reading by Whisper took. Pure: the engine, the search and the clock are given.
 *
 * A clip says what it holds in its name: `<id>__<surah>-<first verse>-<last verse>.wav`.
 */
import { searchHeardWords, type SpeechEngine } from '@/domain/listening';
import type { PassageCandidate, VerseIndex } from '@/domain/recognition';

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
  /** How the listening ended: `finished`, `failed: <failure>`, `timeout`... */
  readonly ending: string;
}

export interface VoiceProofDependencies {
  readonly clips: readonly ProofClip[];
  readonly loadIndex: () => Promise<VerseIndex>;
  /** The engine on one clip; it calls `onReading` after each reading by Whisper. */
  readonly createEngine: (clip: ProofClip, onReading: (ms: number) => void) => SpeechEngine | null;
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
  const verdict = found === null ? 'MISS' : covers(found, clip) ? 'OK' : 'WRONG';
  return `voice-proof: ${clip.name} expected ${expected} | ${what} | ${timing} | ${result.ending} | ${verdict}`;
}

/** Listens to one clip as the listening screen does: the first `found` is the answer. */
async function listenTo(
  clip: ProofClip,
  index: VerseIndex,
  deps: VoiceProofDependencies,
): Promise<ProofResult> {
  const readingsMs: number[] = [];
  const engine = deps.createEngine(clip, (ms) => readingsMs.push(ms));
  if (engine === null) {
    return { clip, found: null, foundAtMs: null, words: 0, readingsMs, ending: 'no engine' };
  }
  const heard: string[] = [];
  let found: PassageCandidate | null = null;
  let foundAtMs: number | null = null;
  let startedAt = deps.now();
  const ending = await new Promise<string>((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), deps.clipTimeoutMs ?? 90_000);
    const done = (why: string) => {
      clearTimeout(timer);
      resolve(why);
    };
    engine.onWords((words) => {
      if (found !== null) return;
      heard.push(...words);
      const result = searchHeardWords(index, heard);
      if (result.status === 'found') {
        found = result.candidates[0] ?? null;
        foundAtMs = deps.now() - startedAt;
        // As on the screen: the answer closes the microphone.
        void engine.stop().then(() => done('stopped at the answer'));
      }
    });
    engine.onEnd((reason, failure) =>
      done(failure === undefined ? reason : `${reason}: ${failure}`),
    );
    engine.start().then(
      () => {
        startedAt = deps.now();
      },
      (error: unknown) =>
        done(`failed to start: ${error instanceof Error ? error.message : String(error)}`),
    );
  });
  await engine.stop().catch(() => undefined);
  return { clip, found, foundAtMs, words: heard.length, readingsMs, ending };
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
