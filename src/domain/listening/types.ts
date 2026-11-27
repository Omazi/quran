/**
 * Public types of the listening module: what the app needs from a speech engine, whatever the
 * engine is (docs/specs/listening.md, section 2; docs/DECISIONS.md, D5).
 */

/** What the person decided about the microphone. `undetermined`: nobody asked yet. */
export type MicrophonePermission = 'undetermined' | 'granted' | 'denied';

/**
 * Why an engine stopped listening by itself.
 *
 * - `finished`: it judged the recitation over (a silence after speech, its own time limit, the
 *   end of a simulated script).
 * - `interrupted`: the system took the microphone away (a call, another app).
 * - `failed`: it could not go on.
 */
export type SpeechEndReason = 'finished' | 'interrupted' | 'failed';

/**
 * What broke, when an engine fails, so the screen can name the fix instead of a vague "try again".
 *
 * - `microphone-unavailable`: the microphone could not be opened (a call, another app, no input).
 * - `no-audio`: the microphone opened but gave no sound at all.
 * - `model-missing`: the speech model is not in the app (a broken install).
 * - `model-failed`: the speech model is there but could not be loaded.
 * - `transcription-failed`: the recogniser broke down or stopped answering.
 * - `unknown`: anything else.
 */
export type SpeechFailure =
  | 'microphone-unavailable'
  | 'no-audio'
  | 'model-missing'
  | 'model-failed'
  | 'transcription-failed'
  | 'unknown';

const FAILURES: ReadonlySet<string> = new Set<SpeechFailure>([
  'microphone-unavailable',
  'no-audio',
  'model-missing',
  'model-failed',
  'transcription-failed',
  'unknown',
]);

/** An engine's refusal or breakdown, with what broke. */
export class SpeechEngineError extends Error {
  readonly failure: SpeechFailure;

  constructor(failure: SpeechFailure, message: string) {
    super(message);
    this.name = 'SpeechEngineError';
    this.failure = failure;
  }
}

/** What broke, from anything an engine threw: `unknown` when it does not say. */
export function failureOf(error: unknown): SpeechFailure {
  if (typeof error === 'object' && error !== null && 'failure' in error) {
    const failure = (error as { failure: unknown }).failure;
    if (typeof failure === 'string' && FAILURES.has(failure)) return failure as SpeechFailure;
  }
  return 'unknown';
}

/**
 * What the engine is doing right now, beyond the level: the screen shows it so the person always
 * knows the voice reaches the phone.
 */
export interface SpeechActivity {
  /** A voice is being heard right now. */
  readonly voice: boolean;
  /** The engine is reading what it heard (the recogniser is working). */
  readonly transcribing: boolean;
  /**
   * The words the latest reading gave for the phrase in progress, not final yet (they may still
   * change); empty between phrases. Only shown, never searched.
   */
  readonly partial: readonly string[];
}

/** Ends a subscription. Calling it twice is harmless. */
export type Unsubscribe = () => void;

/**
 * A speech engine: it opens the microphone and turns a voice into a level and into words. The
 * app only knows this interface; the engine behind it can be replaced without touching a screen.
 *
 * An engine listens for one caller at a time. Listeners can be added before `start`, and stay
 * until their `Unsubscribe` is called.
 */
export interface SpeechEngine {
  /** The current decision, without asking anything. */
  getMicrophonePermission(): Promise<MicrophonePermission>;
  /**
   * Asks the person, with the system's own alert, when nobody asked yet; otherwise gives the
   * decision already made. Never resolves to `undetermined` after the person answered.
   */
  requestMicrophonePermission(): Promise<MicrophonePermission>;
  /**
   * Opens the microphone and starts listening. Resolves once the engine listens; rejects when it
   * cannot (microphone not granted, engine not ready), with a `SpeechEngineError` when it knows
   * what broke.
   */
  start(): Promise<void>;
  /**
   * Stops listening and closes the microphone. Harmless when the engine is not listening. No
   * level and no word is given once it has resolved, and `onEnd` is not called for it.
   */
  stop(): Promise<void>;
  /**
   * The loudness of the voice right now, from 0 (silence) to 1 (as loud as the engine measures),
   * several times a second while it listens.
   */
  onLevel(listener: (level: number) => void): Unsubscribe;
  /**
   * The words recognised since the previous call, in the order they were said. A word given
   * once is final: an engine that revises what it heard only gives a word when it will no longer
   * change. Words are Arabic text, raw or normalised; the passage search normalises them.
   */
  onWords(listener: (words: readonly string[]) => void): Unsubscribe;
  /** The engine stopped by itself, with what broke when it failed. Not called after `stop`. */
  onEnd(listener: (reason: SpeechEndReason, failure?: SpeechFailure) => void): Unsubscribe;
  /**
   * What the engine is doing (voice heard, reading, words not final yet), each time it changes.
   * Optional: an engine without it shows the level only.
   */
  onActivity?(listener: (activity: SpeechActivity) => void): Unsubscribe;
  /**
   * Reads the audio of the latest reading again, once per text, held to that text (the audio
   * check, D49, `audio-check.ts`). Gives the readings and the text of that latest reading; null
   * when nothing was read yet or when this build cannot (the screen then goes by the words alone).
   * With `sameAudioAs`, reads the audio of that earlier check instead (its readings and these
   * can then be compared). Optional: an engine without it is never checked.
   */
  checkHeard?(texts: readonly string[], sameAudioAs?: HeldCheck): Promise<HeldCheck | null>;
}

/** What `checkHeard` gives: one reading per text, and Whisper's free reading of the same audio. */
export interface HeldCheck {
  readonly readings: readonly HeldReading[];
  readonly freeText: string;
  /** The audio read, kept by the engine for a check of the same audio (`sameAudioAs`). */
  readonly audio: unknown;
}

/** One reading of the audio held to a text (native `quran-decoding`, `Reading`). */
export interface HeldReading {
  readonly text: string;
  readonly cost: number;
  readonly letters: number;
  /** Letters of the free words at its start (not the passage). */
  readonly freeLetters: number;
  /** Stopped early because it already cost far more than a better one. */
  readonly abandoned: boolean;
}
