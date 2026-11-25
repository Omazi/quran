/**
 * A SIMULATED speech engine: it opens no microphone and hears nothing. It replays a script of
 * voice levels and words, to test the listening screen and to let it be tried before the real
 * engine exists (docs/specs/listening.md, section 2). It is never part of a published build:
 * the only way in is `speech-engine-door.ts`.
 */
import type {
  MicrophonePermission,
  SpeechEndReason,
  SpeechEngine,
  Unsubscribe,
} from '@/domain/listening';

import { SIMULATED_VOICE } from '../config';

/** One thing the engine says, `at` milliseconds after it starts. */
export type SimulatedStep =
  | { readonly at: number; readonly level: number }
  | { readonly at: number; readonly words: readonly string[] }
  | { readonly at: number; readonly end: SpeechEndReason };

export interface SimulatedScript {
  /** The decision about the microphone when the engine is created. */
  readonly permission: MicrophonePermission;
  /** What the person answers when asked. Defaults to `granted`. */
  readonly answer?: Exclude<MicrophonePermission, 'undetermined'>;
  readonly steps: readonly SimulatedStep[];
  /** Replays the steps every this many milliseconds until stopped. Not with an `end` step. */
  readonly loopEvery?: number;
  /** `start` rejects, as an engine that cannot be used. */
  readonly startFails?: boolean;
}

type Timer = ReturnType<typeof setTimeout>;

const LAST_FALL_MS = Math.max(...SIMULATED_VOICE.fallSteps.map((fall) => fall.afterMs));

function assertScript({ steps, loopEvery }: SimulatedScript): void {
  for (const step of steps) {
    if (!Number.isFinite(step.at) || step.at < 0) {
      throw new RangeError(`A step must have a time of 0 ms or more, got ${step.at}`);
    }
    if ('level' in step && !(step.level >= 0 && step.level <= 1)) {
      throw new RangeError(`A level must be between 0 and 1, got ${step.level}`);
    }
  }
  if (loopEvery !== undefined) {
    if (!(loopEvery > 0)) throw new RangeError(`loopEvery must be positive, got ${loopEvery}`);
    if (steps.some((step) => 'end' in step)) {
      throw new RangeError('A looping script never ends: it cannot have an end step');
    }
  }
}

/** Creates a simulated engine that plays `script`. Timers are the global ones (fakeable in tests). */
export function createSimulatedSpeechEngine(script: SimulatedScript): SpeechEngine {
  assertScript(script);
  let permission = script.permission;
  let timers: Timer[] = [];
  const levelListeners = new Set<(level: number) => void>();
  const wordListeners = new Set<(words: readonly string[]) => void>();
  const endListeners = new Set<(reason: SpeechEndReason) => void>();

  function listen<Listener>(listeners: Set<Listener>, listener: Listener): Unsubscribe {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function clear(): void {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
  }

  function play(step: SimulatedStep): void {
    if ('level' in step) for (const listener of [...levelListeners]) listener(step.level);
    else if ('words' in step) for (const listener of [...wordListeners]) listener(step.words);
    else {
      clear();
      for (const listener of [...endListeners]) listener(step.end);
    }
  }

  function schedule(offset: number): void {
    for (const step of script.steps) {
      timers.push(setTimeout(() => play(step), offset + step.at));
    }
    const { loopEvery } = script;
    if (loopEvery !== undefined) {
      timers.push(setTimeout(() => schedule(0), offset + loopEvery));
    }
  }

  return {
    getMicrophonePermission: () => Promise.resolve(permission),
    requestMicrophonePermission: () => {
      if (permission === 'undetermined') permission = script.answer ?? 'granted';
      return Promise.resolve(permission);
    },
    start: () => {
      if (permission !== 'granted') {
        return Promise.reject(new Error('Simulated engine: the microphone is not granted'));
      }
      if (script.startFails === true) {
        return Promise.reject(new Error('Simulated engine: told to fail on start'));
      }
      clear();
      schedule(0);
      return Promise.resolve();
    },
    stop: () => {
      clear();
      return Promise.resolve();
    },
    onLevel: (listener) => listen(levelListeners, listener),
    onWords: (listener) => listen(wordListeners, listener),
    onEnd: (listener) => listen(endListeners, listener),
  };
}

export interface RecitationOptions {
  /** When the first syllable is said, in milliseconds after the start. */
  readonly startAt: number;
  /** Seed of the rhythm: the same seed gives the same recitation. */
  readonly seed: number;
}

/** A small seeded generator (mulberry32): a simulation that can be replayed exactly. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The voice of a person reciting `words`: for each word, a few syllables (a level that jumps up
 * then falls back), then the word itself, as an engine gives a word once it was said. The
 * rhythm is the prototype's: short gaps inside a phrase, a longer breath now and then.
 */
export function recitationSteps(
  words: readonly string[],
  { startAt, seed }: RecitationOptions,
): SimulatedStep[] {
  const random = seededRandom(seed);
  const voice = SIMULATED_VOICE;
  const steps: SimulatedStep[] = [];
  let time = startAt;
  for (const word of words) {
    for (let syllable = 0; syllable < voice.syllablesPerWord; syllable += 1) {
      const strength = Math.min(1, voice.minStrength + random() * voice.strengthSpread);
      steps.push({ at: time, level: strength });
      for (const fall of voice.fallSteps) {
        steps.push({ at: time + fall.afterMs, level: strength * fall.share });
      }
      const gap =
        random() < voice.breathChance
          ? voice.minBreathMs + random() * voice.breathSpreadMs
          : voice.minGapMs + random() * voice.gapSpreadMs;
      // A syllable lasts at least as long as its fall, so the steps stay in time order.
      time += Math.max(gap, LAST_FALL_MS + 1);
    }
    steps.push({ at: time, words: [word] });
  }
  return steps;
}
