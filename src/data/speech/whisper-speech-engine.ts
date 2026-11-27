/**
 * The real speech engine (docs/DECISIONS.md, D5 and D42): the microphone, cut into phrases by
 * the loudness of the voice, transcribed on the phone by Whisper, and given to the app as final
 * words. It implements the domain's `SpeechEngine`; the microphone and Whisper are reached
 * through two small interfaces, so this file is plain TypeScript, tested without a phone.
 *
 * How a recitation becomes words:
 * - audio arrives in chunks of `chunkMs`; each gives a level, and counts as voice or not;
 * - a phrase opens with the first voice (plus a little audio before it) and closes after a
 *   pause, or when it grows too long for Whisper;
 * - while the phrase grows, it is transcribed again every `passEveryMs`; a word is given once
 *   two passes agree on it, the rest when the phrase closes (`transcript.ts`);
 * - silence is never transcribed: Whisper writes words over silence.
 * Passes run one at a time; audio that arrives during a pass waits for the next.
 *
 * What the person sees of it, so they always know the phone hears them: the level (from the
 * native module, about 25 times a second, or from each chunk), and the activity (a voice heard,
 * a reading in progress, the words of that reading not final yet).
 *
 * Nothing may hang without saying so. The limits of a listening are counted on the audio received,
 * and also on the clock: no sound at all after the microphone opened, a model that does not load,
 * a reading that does not answer, each ends the listening with what broke (`SpeechFailure`).
 */
import {
  SpeechEngineError,
  failureOf,
  minLettersFor,
  type HeldReading,
  type MicrophonePermission,
  type SpeechActivity,
  type SpeechEndReason,
  type SpeechEngine,
  type SpeechFailure,
  type Unsubscribe,
} from '@/domain/listening';

import { chunkLoudness, createVoiceActivity, type VoiceActivity } from './audio-level';
import { SPEECH_ENGINE_CONFIG, type SpeechEngineMode } from './config';
import type { VoiceDiagnosticsUpdate } from './diagnostics';
import { createTranscriptStabilizer, whisperWords, type TranscriptStabilizer } from './transcript';

export interface AudioListeners {
  /** 16 kHz mono 16-bit samples, `chunkMs` long, in the order they were recorded. */
  onAudio(samples: Int16Array): void;
  /**
   * The level of the microphone from 0 to 1, measured by the native side more often than the
   * chunks arrive. Optional: without it, the level of each chunk is given.
   */
  onLevel?(level: number): void;
  /** The system took the microphone away, or the capture broke (`message` says how). */
  onEnd(reason: SpeechEndReason, message?: string): void;
}

/** The microphone (`native-audio-capture.ts` on the phone). */
export interface AudioCapture {
  getPermission(): Promise<MicrophonePermission>;
  requestPermission(): Promise<MicrophonePermission>;
  start(listeners: AudioListeners): Promise<void>;
  /** Harmless when not recording. */
  stop(): Promise<void>;
}

/** Whisper (`whisper-transcriber.ts` on the phone). */
export interface Transcriber {
  /** Loads the model; quick once it is loaded. Rejects with a `SpeechEngineError` when it can. */
  prepare(): Promise<void>;
  /** The text Whisper reads in 16 kHz mono 16-bit samples. */
  transcribe(samples: Int16Array): Promise<string>;
  /**
   * Reads the samples again, once per text, held to it (D47). Null when this build cannot (the
   * native function is missing). Optional.
   */
  readHeld?(
    samples: Int16Array,
    texts: readonly string[],
    minLetters: number,
  ): Promise<HeldReading[] | null>;
}

/** The clock of the engine: the global timers, replaced in tests. */
export interface EngineTimers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const GLOBAL_TIMERS: EngineTimers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface WhisperSpeechEngineOptions {
  readonly capture: AudioCapture;
  readonly transcriber: Transcriber;
  /** What the engine listens for; it decides when the engine ends by itself. Default `search`. */
  readonly mode?: SpeechEngineMode;
  /** Where the engine writes what it saw, for the diagnostics of the settings. */
  readonly record?: (update: VoiceDiagnosticsUpdate) => void;
  readonly timers?: EngineTimers;
}

type Action = 'pass' | 'close' | 'finish';

const config = SPEECH_ENGINE_CONFIG;
const msOf = (samples: number) => (samples * 1000) / config.sampleRate;

const NO_ACTIVITY: SpeechActivity = Object.freeze({
  voice: false,
  transcribing: false,
  partial: Object.freeze([]) as readonly string[],
});

function concat(chunks: readonly Int16Array[], length: number): Int16Array {
  const all = new Int16Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, Math.min(chunk.length, length - offset));
    all.set(part, offset);
    offset += part.length;
    if (offset >= length) break;
  }
  return all;
}

function sameWords(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((word, index) => word === second[index]);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** `promise`, or a `SpeechEngineError` of `failure` if it takes longer than `ms`. */
function withinTime<T>(
  promise: Promise<T>,
  ms: number,
  failure: SpeechFailure,
  what: string,
  timers: EngineTimers,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handle = timers.setTimeout(
      () => reject(new SpeechEngineError(failure, `${what} took longer than ${ms} ms`)),
      ms,
    );
    promise.then(
      (value) => {
        timers.clearTimeout(handle);
        resolve(value);
      },
      (error: unknown) => {
        timers.clearTimeout(handle);
        reject(error);
      },
    );
  });
}

export function createWhisperSpeechEngine({
  capture,
  transcriber,
  mode = 'search',
  record = () => undefined,
  timers = GLOBAL_TIMERS,
}: WhisperSpeechEngineOptions): SpeechEngine {
  const limits = config[mode];
  const levelListeners = new Set<(level: number) => void>();
  const wordListeners = new Set<(words: readonly string[]) => void>();
  const endListeners = new Set<(reason: SpeechEndReason, failure?: SpeechFailure) => void>();
  const activityListeners = new Set<(activity: SpeechActivity) => void>();

  /** Each listening has its number: what an earlier one finishes late is dropped. */
  let session = 0;
  let listening = false;
  let busy = false;

  // The state of one listening, reset by `start`.
  let activity: VoiceActivity = createVoiceActivity();
  let stabilizer: TranscriptStabilizer = createTranscriptStabilizer();
  let totalMs = 0;
  let voiceHeard = false;
  let silenceMs = 0;
  /** The clock said the listening is over, whatever the audio counted. */
  let deadlinePassed = false;
  /** The native side gives the level itself: the chunks' own level is then not given. */
  let levelFromCapture = false;
  let audioReceived = false;
  let shown: SpeechActivity = NO_ACTIVITY;
  let watchdogs: unknown[] = [];
  /** Audio before the phrase opens, at most `preRollMs`. */
  let preRoll: Int16Array[] = [];
  /** The open phrase: its chunks, and how many of its samples end with the last voice. */
  let phrase: Int16Array[] = [];
  let phraseSamples = 0;
  let phraseVoiceMs = 0;
  let samplesUpToLastVoice = 0;
  let samplesAtLastPass = 0;

  function reset(): void {
    activity = createVoiceActivity();
    stabilizer = createTranscriptStabilizer();
    totalMs = 0;
    voiceHeard = false;
    silenceMs = 0;
    deadlinePassed = false;
    levelFromCapture = false;
    audioReceived = false;
    shown = NO_ACTIVITY;
    preRoll = [];
    clearPhrase();
  }

  function clearPhrase(): void {
    phrase = [];
    phraseSamples = 0;
    phraseVoiceMs = 0;
    samplesUpToLastVoice = 0;
    samplesAtLastPass = 0;
  }

  function clearWatchdogs(): void {
    for (const handle of watchdogs) timers.clearTimeout(handle);
    watchdogs = [];
  }

  function listen<Listener>(listeners: Set<Listener>, listener: Listener): Unsubscribe {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function giveWords(words: readonly string[]): void {
    if (words.length === 0) return;
    for (const listener of [...wordListeners]) listener(words);
  }

  function giveLevel(level: number): void {
    for (const listener of [...levelListeners]) listener(level);
  }

  /** Tells the activity listeners, only when something they show changed. */
  function show(change: Partial<SpeechActivity>): void {
    const next: SpeechActivity = { ...shown, ...change };
    if (
      next.voice === shown.voice &&
      next.transcribing === shown.transcribing &&
      sameWords(next.partial, shown.partial)
    ) {
      return;
    }
    shown = next;
    for (const listener of [...activityListeners]) listener(next);
  }

  /** Ends this listening: the microphone is closed, then the listeners are told why. */
  async function end(reason: SpeechEndReason, failure?: SpeechFailure): Promise<void> {
    if (!listening) return;
    listening = false;
    session += 1;
    clearWatchdogs();
    await capture.stop().catch(() => undefined);
    show(NO_ACTIVITY);
    for (const listener of [...endListeners]) listener(reason, failure);
  }

  function fail(failure: SpeechFailure, message: string): Promise<void> {
    record({ lastError: { failure, message } });
    return end('failed', failure);
  }

  function onAudio(samples: Int16Array, current: number): void {
    if (!listening || current !== session) return;
    audioReceived = true;
    const { level, db } = chunkLoudness(samples);
    if (!levelFromCapture) {
      giveLevel(level);
      record({ lastLevel: { level, db } });
    }
    record({ audioChunks: 1 });
    const isVoice = activity.isSpeech(samples);
    const ms = msOf(samples.length);
    totalMs += ms;
    if (isVoice) {
      voiceHeard = true;
      silenceMs = 0;
    } else {
      silenceMs += ms;
    }
    // A voice stays "heard" through the short gaps between syllables.
    show({ voice: isVoice || (voiceHeard && silenceMs < config.voiceHoldMs) });

    if (phrase.length === 0 && isVoice) {
      phrase = preRoll;
      phraseSamples = preRoll.reduce((sum, chunk) => sum + chunk.length, 0);
      preRoll = [];
    }
    if (phrase.length > 0) {
      phrase.push(samples);
      phraseSamples += samples.length;
      if (isVoice) {
        phraseVoiceMs += ms;
        samplesUpToLastVoice = phraseSamples;
      }
    } else {
      preRoll.push(samples);
      while (preRoll.length > 0 && msOf(preRoll.length * samples.length) > config.preRollMs) {
        preRoll.shift();
      }
    }
    void pump();
  }

  function onNativeLevel(level: number, current: number): void {
    if (!listening || current !== session) return;
    levelFromCapture = true;
    giveLevel(level);
    record({ lastLevel: { level, db: null } });
  }

  function nextAction(): Action | null {
    if (
      deadlinePassed ||
      totalMs >= limits.maxListenMs ||
      (voiceHeard && silenceMs >= limits.endAfterSilenceMs) ||
      (!voiceHeard && totalMs >= limits.endWithoutVoiceMs)
    ) {
      return 'finish';
    }
    if (phrase.length === 0) return null;
    if (silenceMs >= config.phraseEndSilenceMs || msOf(phraseSamples) >= config.maxPhraseMs) {
      return 'close';
    }
    if (
      phraseVoiceMs >= config.minSpeechToTranscribeMs &&
      msOf(phraseSamples - samplesAtLastPass) >= config.passEveryMs
    ) {
      return 'pass';
    }
    return null;
  }

  /** The phrase's audio for Whisper: up to its last voice, plus a short tail of silence. */
  function phraseAudio(): Int16Array {
    const tail = (config.tailSilenceMs * config.sampleRate) / 1000;
    return concat(phrase, Math.min(phraseSamples, samplesUpToLastVoice + tail));
  }

  /** The audio of the latest reading and what Whisper read in it, for the audio check (D47). */
  let lastRead: { audio: Int16Array; text: string } | null = null;

  async function transcribeWords(audio: Int16Array): Promise<string[]> {
    show({ transcribing: true });
    const text = await withinTime(
      transcriber.transcribe(audio),
      config.transcribeTimeoutMs,
      'transcription-failed',
      'A reading of the voice',
      timers,
    );
    record({ lastTranscript: text });
    lastRead = { audio, text };
    return whisperWords(text);
  }

  async function pass(current: number): Promise<void> {
    samplesAtLastPass = phraseSamples;
    const words = await transcribeWords(phraseAudio());
    if (current !== session) return;
    giveWords(stabilizer.update(words));
    show({ transcribing: false, partial: words.slice(stabilizer.given()) });
  }

  /** Closes the phrase: new audio starts the next one while this one is transcribed. */
  async function closePhrase(current: number): Promise<void> {
    const hasVoice = phraseVoiceMs >= config.minSpeechToTranscribeMs;
    const audio = phraseAudio();
    clearPhrase();
    const words = hasVoice ? await transcribeWords(audio) : [];
    if (current !== session) return;
    giveWords(stabilizer.close(words));
    show({ transcribing: false, partial: [] });
  }

  async function pump(): Promise<void> {
    if (busy || !listening) return;
    const action = nextAction();
    if (action === null) return;
    const current = session;
    busy = true;
    try {
      if (action === 'pass') await pass(current);
      else if (action === 'close') await closePhrase(current);
      else {
        if (phrase.length > 0) await closePhrase(current);
        if (current === session) await end('finished');
      }
    } catch (error) {
      if (current === session) {
        const failure = failureOf(error);
        await fail(failure === 'unknown' ? 'transcription-failed' : failure, messageOf(error));
      }
    } finally {
      // Only the listening that set it may clear it: a new one may already be at work.
      if (current === session || !listening) busy = false;
    }
    if (current === session) void pump();
  }

  /** The clock's limits of one listening, once the microphone is open. */
  function watch(current: number): void {
    clearWatchdogs();
    watchdogs.push(
      timers.setTimeout(() => {
        if (current !== session || audioReceived) return;
        void fail('no-audio', `No sound from the microphone after ${config.noAudioMs} ms`);
      }, config.noAudioMs),
    );
    if (Number.isFinite(limits.maxListenMs)) {
      watchdogs.push(
        timers.setTimeout(() => {
          if (current !== session) return;
          deadlinePassed = true;
          void pump();
        }, limits.maxListenMs + config.clockSlackMs),
      );
    }
  }

  return {
    getMicrophonePermission: () => capture.getPermission(),
    requestMicrophonePermission: () => capture.requestPermission(),
    async start() {
      if (listening) await this.stop();
      const permission = await capture.getPermission();
      record({ permission });
      if (permission !== 'granted') {
        throw new Error('Speech engine: the microphone is not granted');
      }
      try {
        await withinTime(
          transcriber.prepare(),
          config.prepareTimeoutMs,
          'model-failed',
          'Loading the voice model',
          timers,
        );
        record({ whisperLoaded: true });
      } catch (error) {
        const failure = failureOf(error);
        const known = new SpeechEngineError(
          failure === 'unknown' ? 'model-failed' : failure,
          messageOf(error),
        );
        record({
          whisperLoaded: false,
          lastError: { failure: known.failure, message: known.message },
        });
        throw known;
      }
      session += 1;
      const current = session;
      reset();
      busy = false;
      listening = true;
      try {
        await capture.start({
          onAudio: (samples) => onAudio(samples, current),
          onLevel: (level) => onNativeLevel(level, current),
          onEnd: (reason, message) => {
            if (current !== session) return;
            if (reason === 'failed') {
              void fail('microphone-unavailable', message ?? 'The microphone stopped');
            } else {
              void end(reason);
            }
          },
        });
      } catch (error) {
        listening = false;
        session += 1;
        const failure = failureOf(error);
        const known = new SpeechEngineError(
          failure === 'unknown' ? 'microphone-unavailable' : failure,
          messageOf(error),
        );
        record({ lastError: { failure: known.failure, message: known.message } });
        throw known;
      }
      if (current === session) watch(current);
    },
    async stop() {
      if (!listening) return;
      listening = false;
      session += 1;
      clearWatchdogs();
      shown = NO_ACTIVITY;
      await capture.stop();
    },
    onLevel: (listener) => listen(levelListeners, listener),
    onWords: (listener) => listen(wordListeners, listener),
    onEnd: (listener) => listen(endListeners, listener),
    onActivity: (listener) => listen(activityListeners, listener),
    async checkHeard(texts, sameAudioAs) {
      const read =
        sameAudioAs?.audio instanceof Int16Array
          ? { audio: sameAudioAs.audio, text: sameAudioAs.freeText }
          : lastRead;
      if (read === null || transcriber.readHeld === undefined || texts.length === 0) return null;
      const readings = await withinTime(
        transcriber.readHeld(read.audio, texts, minLettersFor(read.text)),
        config.transcribeTimeoutMs,
        'transcription-failed',
        'Reading the voice again',
        timers,
      );
      return readings === null ? null : { readings, freeText: read.text, audio: read.audio };
    },
  };
}
