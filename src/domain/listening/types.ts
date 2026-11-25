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
   * cannot (microphone not granted, engine not ready).
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
  /** The engine stopped by itself. Not called after `stop`. */
  onEnd(listener: (reason: SpeechEndReason) => void): Unsubscribe;
}
