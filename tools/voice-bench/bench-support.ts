/**
 * The voice benchmark's plumbing (README.md here): WAV files, the whisper.cpp driver, a virtual
 * clock, and the app's real speech engine run on recorded audio as if it came from the
 * microphone. Used only by `voice-bench.test.ts`, which is skipped unless VOICE_BENCH_MANIFEST
 * is set. Nothing here ships in the app.
 */
import type { EngineTimers, Transcriber } from '@/data/speech/whisper-speech-engine';
import type { SpeechEngine } from '@/domain/listening';

// ---- Node, reached through jest.requireActual (Node's types are not part of the app's tsconfig)

interface Readable {
  on(event: 'data', listener: (chunk: Uint8Array) => void): void;
}
interface ChildProcess {
  stdin: { write(data: Uint8Array | string): boolean };
  stdout: Readable;
  stderr: Readable;
  kill(): void;
  on(event: 'exit', listener: (code: number | null) => void): void;
}
interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
  readFileSync(path: string, encoding: 'utf8'): string;
  appendFileSync(path: string, data: string): void;
  writeFileSync(path: string, data: string): void;
}
interface NodeBuffer {
  from(data: string | Uint8Array, encoding?: string): Uint8Array & { toString(e?: string): string };
  concat(list: Uint8Array[]): Uint8Array & { toString(e?: string): string };
}

export const fs = jest.requireActual<NodeFs>('fs');
const childProcess = jest.requireActual<{
  spawn(cmd: string, args: string[], options?: object): ChildProcess;
}>('child_process');
interface Hash {
  update(data: Uint8Array | string): Hash;
  digest(encoding: 'hex'): string;
}
const crypto = jest.requireActual<{ createHash(algorithm: string): Hash }>('crypto');
const NodeBufferClass = (globalThis as unknown as { Buffer: NodeBuffer }).Buffer;

// ---- Audio files ----------------------------------------------------------------------------

/** 16 kHz mono 16-bit PCM from a WAV file written by prepare-clips.py. */
export function readWav(path: string): Int16Array {
  const bytes = fs.readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    if (id === 'data') {
      const count = Math.floor(size / 2);
      const samples = new Int16Array(count);
      for (let i = 0; i < count; i += 1) samples[i] = view.getInt16(offset + 8 + 2 * i, true);
      return samples;
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`no data chunk in ${path}`);
}

// ---- The whisper.cpp driver ------------------------------------------------------------------

/** What the app can pass to whisper.rn's transcribeData, as the driver takes it. */
export interface WhisperDecoding {
  readonly beam: number;
  readonly bestOf: number;
  readonly temperature: number;
  readonly temperatureInc: number;
  readonly maxContext: number;
  readonly prompt: string;
  readonly threads: number;
}

/** whisper.rn's defaults with the app's options (whisper-transcriber.ts, WHISPER_OPTIONS). */
export const APP_DECODING: WhisperDecoding = Object.freeze({
  beam: 0,
  bestOf: 5,
  temperature: 0,
  temperatureInc: 0,
  maxContext: 0,
  prompt: '',
  threads: 2,
});

export interface Reading {
  readonly text: string;
  /** Compute time on this computer, in milliseconds (0 when it came from the cache). */
  readonly ms: number;
  readonly cached: boolean;
}

/** How a held reading runs (native/quran-decoding, ReadOptions). */
export interface HeldOptions {
  readonly minLetters: number;
  readonly freeLetterCost: number;
  readonly firstChoices: number;
  readonly margin: number;
  readonly threads: number;
}

export interface HeldAnswer {
  readonly readings: {
    text: string;
    cost: number;
    letters: number;
    freeLetters: number;
    tokens: number;
    deadEnd: boolean;
    abandoned: boolean;
  }[];
  readonly ms: number;
}

export interface WhisperDriver {
  transcribe(samples: Int16Array, decoding: WhisperDecoding): Promise<Reading>;
  /** Reads the samples again, once per text, held to it (see quran-decoding.h). */
  held(samples: Int16Array, texts: readonly string[], options: HeldOptions): Promise<HeldAnswer>;
  close(): void;
}

/**
 * The driver binary (whisper-driver.cpp) on one model, with a cache of its readings on disk:
 * a reading depends only on the model, the decoding and the samples.
 */
export function createWhisperDriver(
  binary: string,
  model: string,
  cacheFile: string,
): WhisperDriver {
  const cache = new Map<string, { text: string; ms: number }>();
  if (fs.existsSync(cacheFile)) {
    for (const line of fs.readFileSync(cacheFile, 'utf8').split('\n')) {
      if (line.trim() === '') continue;
      const entry = JSON.parse(line) as { key: string; text: string; ms: number };
      cache.set(entry.key, { text: entry.text, ms: entry.ms });
    }
  }
  let child: ChildProcess | null = null;
  let buffered = '';
  const waiting: ((line: string) => void)[] = [];
  let queue: Promise<unknown> = Promise.resolve();

  function process(): ChildProcess {
    if (child !== null) return child;
    const started = childProcess.spawn(binary, [model], { stdio: ['pipe', 'pipe', 'pipe'] });
    started.stdout.on('data', (chunk) => {
      buffered += NodeBufferClass.from(chunk).toString('utf8');
      let newline = buffered.indexOf('\n');
      while (newline >= 0) {
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        if (!line.startsWith('{"ready"')) waiting.shift()?.(line);
        newline = buffered.indexOf('\n');
      }
    });
    started.stderr.on('data', () => undefined);
    child = started;
    return started;
  }

  return {
    held(samples, texts, options) {
      const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
      const reading = queue.then(
        () =>
          new Promise<HeldAnswer>((resolve) => {
            const body = NodeBufferClass.from(texts.join('\f'), 'utf8');
            const header =
              `held samples=${samples.length} threads=${options.threads} ` +
              `minletters=${options.minLetters} freecost=${options.freeLetterCost} ` +
              `firsts=${options.firstChoices} margin=${options.margin} texts=${body.length}\n`;
            waiting.push((line) => resolve(JSON.parse(line) as HeldAnswer));
            process().stdin.write(NodeBufferClass.concat([NodeBufferClass.from(header), body, bytes]));
          }),
      );
      queue = reading.catch(() => undefined);
      return reading;
    },
    transcribe(samples, decoding) {
      const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
      const key = crypto
        .createHash('sha1')
        .update(model)
        .update(JSON.stringify(decoding))
        .update(bytes)
        .digest('hex');
      const hit = cache.get(key);
      if (hit !== undefined) return Promise.resolve({ ...hit, cached: true });
      const reading = queue.then(
        () =>
          new Promise<Reading>((resolve) => {
            const prompt = NodeBufferClass.from(decoding.prompt, 'utf8');
            const header =
              `samples=${samples.length} threads=${decoding.threads} beam=${decoding.beam} ` +
              `bestof=${decoding.bestOf} temp=${decoding.temperature} ` +
              `tinc=${decoding.temperatureInc} maxctx=${decoding.maxContext} ` +
              `prompt=${prompt.length}\n`;
            waiting.push((line) => {
              const answer = JSON.parse(line) as { text: string; ms: number };
              cache.set(key, answer);
              fs.appendFileSync(cacheFile, `${JSON.stringify({ key, ...answer })}\n`);
              resolve({ text: answer.text, ms: answer.ms, cached: false });
            });
            const target = process();
            target.stdin.write(
              NodeBufferClass.concat([NodeBufferClass.from(header), prompt, bytes]),
            );
          }),
      );
      queue = reading.catch(() => undefined);
      return reading;
    },
    close() {
      child?.kill();
      child = null;
    },
  };
}

// ---- A virtual clock -------------------------------------------------------------------------

export interface VirtualClock extends EngineTimers {
  now(): number;
  /** Runs the timers due up to `time`, in order. */
  advanceTo(time: number): void;
}

export function createVirtualClock(): VirtualClock {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  return {
    now: () => now,
    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { at: now + ms, callback });
      return id;
    },
    clearTimeout(handle) {
      timers.delete(handle as number);
    },
    advanceTo(time) {
      for (;;) {
        let due: [number, { at: number; callback: () => void }] | null = null;
        for (const entry of timers) {
          if (entry[1].at <= time && (due === null || entry[1].at < due[1].at)) due = entry;
        }
        if (due === null) break;
        timers.delete(due[0]);
        now = Math.max(now, due[1].at);
        due[1].callback();
      }
      now = time;
    },
  };
}

// ---- One recitation through the app's engine ------------------------------------------------

/** How long a reading takes on the phone being simulated, from what it wrote. */
export interface LatencyModel {
  readonly fixedMs: number;
  readonly perWordMs: number;
}

export interface SimulatedPass {
  readonly at: number;
  readonly audioMs: number;
  readonly computeMs: number;
  readonly cached: boolean;
  readonly text: string;
}

export interface SimulatedListening {
  /** Each batch of final words the engine gave, with the time it gave them (ms of audio). */
  readonly batches: readonly { readonly at: number; readonly words: readonly string[] }[];
  /**
   * The words not final yet that the engine showed after each reading (`SpeechActivity.partial`),
   * with the number of final words given before them.
   */
  readonly partials?: readonly {
    readonly at: number;
    readonly afterFinal: number;
    readonly words: readonly string[];
  }[];
  readonly passes: readonly SimulatedPass[];
  readonly endedAt: number;
  readonly endReason: string;
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Plays `audio` to an engine as the microphone would (one chunk every `chunkMs`), then the quiet
 * of the room after the reciter stops, on a virtual clock. Each reading takes the time the
 * latency model says on that clock: audio that arrives meanwhile waits, as on the phone.
 */
export async function simulateListening(options: {
  readonly createEngine: (
    capture: import('@/data/speech/whisper-speech-engine').AudioCapture,
    transcriber: Transcriber,
    timers: EngineTimers,
  ) => SpeechEngine;
  readonly audio: Int16Array;
  readonly quiet: () => Int16Array;
  readonly chunkMs: number;
  readonly sampleRate: number;
  readonly read: (samples: Int16Array) => Promise<Reading>;
  readonly latency: LatencyModel;
  readonly maxMs: number;
}): Promise<SimulatedListening> {
  const { audio, chunkMs, sampleRate, latency } = options;
  const clock = createVirtualClock();
  const chunkSamples = (sampleRate * chunkMs) / 1000;
  // Set from the engine's callbacks: kept in one object so that TypeScript does not narrow them.
  const state: {
    listeners: import('@/data/speech/whisper-speech-engine').AudioListeners | null;
    pending: {
      startedAt: number;
      reading: Promise<Reading>;
      resolve: (text: string) => void;
      audioMs: number;
    } | null;
    ended: { at: number; reason: string } | null;
  } = { listeners: null, pending: null, ended: null };
  const passes: SimulatedPass[] = [];
  const batches: { at: number; words: readonly string[] }[] = [];
  const partials: { at: number; afterFinal: number; words: readonly string[] }[] = [];
  let finalCount = 0;
  let lastPartial: readonly string[] = [];

  const capture = {
    getPermission: async () => 'granted' as const,
    requestPermission: async () => 'granted' as const,
    async start(given: import('@/data/speech/whisper-speech-engine').AudioListeners) {
      state.listeners = given;
    },
    async stop() {
      state.listeners = null;
    },
  };
  const transcriber: Transcriber = {
    prepare: async () => undefined,
    transcribe(samples) {
      return new Promise<string>((resolve) => {
        state.pending = {
          startedAt: clock.now(),
          reading: options.read(samples),
          resolve,
          audioMs: (samples.length * 1000) / sampleRate,
        };
      });
    },
  };
  const engine = options.createEngine(capture, transcriber, clock);
  engine.onWords((words) => {
    batches.push({ at: clock.now(), words: [...words] });
    finalCount += words.length;
  });
  engine.onActivity?.((activity) => {
    const words = activity.partial;
    if (words.length === lastPartial.length && words.every((w, i) => w === lastPartial[i])) return;
    lastPartial = [...words];
    partials.push({ at: clock.now(), afterFinal: finalCount, words: lastPartial });
  });
  engine.onEnd((reason) => {
    state.ended = { at: clock.now(), reason };
  });
  await engine.start();

  for (let time = 0; time <= options.maxMs && state.ended === null; time += chunkMs) {
    // A reading that is over by now gives its words before this chunk arrives.
    for (;;) {
      const current = state.pending;
      if (current === null) break;
      const reading = await current.reading;
      const words = reading.text.trim() === '' ? 0 : reading.text.trim().split(/\s+/).length;
      const doneAt = current.startedAt + latency.fixedMs + latency.perWordMs * words;
      if (doneAt > time) break;
      clock.advanceTo(doneAt);
      state.pending = null;
      passes.push({
        at: doneAt,
        audioMs: current.audioMs,
        computeMs: reading.ms,
        cached: reading.cached,
        text: reading.text,
      });
      current.resolve(reading.text);
      for (let i = 0; i < 5; i += 1) await settle();
    }
    clock.advanceTo(time);
    const offset = (time / 1000) * sampleRate;
    const chunk =
      offset + chunkSamples <= audio.length
        ? audio.subarray(offset, offset + chunkSamples)
        : options.quiet();
    state.listeners?.onAudio(chunk.slice());
    for (let i = 0; i < 5; i += 1) await settle();
  }
  await engine.stop();
  const finished = state.ended;
  return {
    batches,
    partials,
    passes,
    endedAt: finished?.at ?? clock.now(),
    endReason: finished?.reason ?? 'time limit',
  };
}
