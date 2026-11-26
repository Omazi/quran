/**
 * The voice benchmark (README.md here): real recitations through the app's own speech engine,
 * the app's Whisper model in whisper.cpp (the version whisper.rn bundles), and the app's passage
 * search. Skipped unless VOICE_BENCH_MANIFEST names a manifest written by prepare-clips.py.
 *
 *   VOICE_BENCH_MANIFEST=<dir>/manifest.json VOICE_BENCH_WORK=<dir> VOICE_BENCH_CONFIG=app \
 *   npx jest tools/voice-bench --runInBand
 *
 * Phase "listen" runs the engine on every clip and appends what it gave (words and their times)
 * to <work>/listen-<config>.jsonl; phase "score" replays those words through the searches and
 * prints the table. Audio never leaves <dir>; only text is written.
 */
import { whisperWords } from '@/data/speech/transcript';
import type { AudioCapture, EngineTimers, Transcriber } from '@/data/speech/whisper-speech-engine';
import { searchHeardWords, type SpeechEngine } from '@/domain/listening';
import {
  createVerseIndex,
  type PassageCandidate,
  type SearchResult,
  type VerseIndex,
} from '@/domain/recognition';
import { loadUthmaniCorpus } from '@/domain/recognition/test-support/corpus';

import {
  APP_DECODING,
  createWhisperDriver,
  fs,
  readWav,
  simulateListening,
  type LatencyModel,
  type WhisperDecoding,
} from './bench-support';

const env = process.env;
const manifestPath = env.VOICE_BENCH_MANIFEST;
const work = env.VOICE_BENCH_WORK ?? '/tmp/voice-bench';
const describeBench = manifestPath === undefined ? describe.skip : describe;

interface VerseTiming {
  readonly surah: number;
  readonly verse: number;
  readonly start: number | null;
  readonly end: number | null;
}
interface Stream {
  readonly id: string;
  readonly source: string;
  readonly reciter: string;
  readonly professional: boolean;
  readonly seconds: number;
  readonly verses: readonly VerseTiming[];
}
interface Clip {
  readonly id: string;
  readonly stream: Stream;
  readonly condition: string;
  readonly start: number;
  readonly length: number;
  readonly midVerse: boolean;
  /** The verses heard in the clip. */
  readonly truth: readonly { surah: number; verse: number }[];
}

// ---- Configurations ------------------------------------------------------------------------

interface BenchConfig {
  readonly model: string;
  readonly decoding: WhisperDecoding;
  readonly engine: Readonly<Record<string, number>>;
}

const QURAN_PROMPT = 'بسم الله الرحمن الرحيم';
const CONFIGS: Readonly<Record<string, BenchConfig>> = {
  app: { model: 'ggml-quran-tiny-q8_0.bin', decoding: APP_DECODING, engine: {} },
  'no-fallback': {
    model: 'ggml-quran-tiny-q8_0.bin',
    decoding: { ...APP_DECODING, temperatureInc: 0 },
    engine: {},
  },
  beam5: {
    model: 'ggml-quran-tiny-q8_0.bin',
    decoding: { ...APP_DECODING, beam: 5 },
    engine: {},
  },
  prompt: {
    model: 'ggml-quran-tiny-q8_0.bin',
    decoding: { ...APP_DECODING, prompt: QURAN_PROMPT },
    engine: {},
  },
  'pass-800': {
    model: 'ggml-quran-tiny-q8_0.bin',
    decoding: APP_DECODING,
    engine: { passEveryMs: 800 },
  },
  'pass-2000': {
    model: 'ggml-quran-tiny-q8_0.bin',
    decoding: APP_DECODING,
    engine: { passEveryMs: 2000 },
  },
  'base-q5_1': { model: 'ggml-quran-base-q5_1.bin', decoding: APP_DECODING, engine: {} },
};
const configName = env.VOICE_BENCH_CONFIG ?? 'app';
/** Extra engine settings for a run, as JSON (`{"phraseEndSilenceMs":500}`). */
const engineOverrides = JSON.parse(env.VOICE_BENCH_ENGINE ?? '{}') as Record<string, number>;
/** Extra decoding settings for a run, as JSON (`{"beam":2}`), and another model file. */
const decodingOverrides = JSON.parse(env.VOICE_BENCH_DECODING ?? '{}') as Partial<WhisperDecoding>;

function chosenConfig(): BenchConfig {
  const config = CONFIGS[configName];
  if (config === undefined) throw new Error(`unknown config ${configName}`);
  return {
    model: env.VOICE_BENCH_MODEL ?? config.model,
    decoding: { ...config.decoding, ...decodingOverrides },
    engine: { ...config.engine, ...engineOverrides },
  };
}

/**
 * The iPhone being simulated: how long one reading takes. Whisper's encoder reads 30 s whatever
 * the length (fixed part), the decoder a few tokens per word. An estimate for an iPhone 12 with
 * Metal, not a measurement (README.md, "Ce qui n'est pas vérifié").
 */
const latency: LatencyModel = {
  fixedMs: Number(env.VOICE_BENCH_FIXED_MS ?? 350),
  perWordMs: Number(env.VOICE_BENCH_PER_WORD_MS ?? 20),
};

// ---- Clips ---------------------------------------------------------------------------------

/** Which lengths of clip in which condition: `clean:3,6,10;noise10:10;phone8k:10`. */
const planText: string = env.VOICE_BENCH_PLAN ?? 'clean:3,6,10;noise20:10;noise10:10;phone8k:10';
const PLAN: readonly (readonly [string, readonly number[]])[] = planText
  .split(';')
  .map((part: string) => {
    const [condition, lengths] = part.split(':');
    return [condition!, lengths!.split(',').map(Number)] as const;
  });

function clipsOf(streams: readonly Stream[]): Clip[] {
  const clips: Clip[] = [];
  streams.forEach((stream, index) => {
    const midVerse = index % 2 === 1;
    const first = stream.verses[0]!;
    const start = !midVerse
      ? 0
      : first.end !== null
        ? Math.round((first.end / 2) * 10) / 10
        : Math.round(stream.seconds * 0.4 * 10) / 10;
    for (const [condition, lengths] of PLAN) {
      for (const wanted of lengths) {
        const length = Math.min(wanted, Math.floor((stream.seconds - start) * 10) / 10);
        const end = start + length;
        const truth = stream.verses
          .filter((v) => v.start === null || (v.start < end && (v.end ?? Infinity) > start))
          .map(({ surah, verse }) => ({ surah, verse }));
        clips.push({
          id: `${stream.id}|${condition}|${start}|${wanted}`,
          stream,
          condition,
          start,
          length,
          midVerse,
          truth,
        });
      }
    }
  });
  return clips;
}

function order(surah: number, verse: number): number {
  return surah * 1000 + verse;
}

/** A passage is right when its verses overlap the verses heard. */
function isRight(candidate: PassageCandidate, truth: Clip['truth']): boolean {
  const from = order(candidate.start.surah, candidate.start.verse);
  const to = order(candidate.end.surah, candidate.end.verse);
  return truth.some((v) => order(v.surah, v.verse) >= from && order(v.surah, v.verse) <= to);
}

// ---- Engines with other settings -------------------------------------------------------------

type CreateEngine = (
  capture: AudioCapture,
  transcriber: Transcriber,
  timers: EngineTimers,
) => SpeechEngine;

function engineWith(overrides: Readonly<Record<string, number>>): {
  create: CreateEngine;
  config: Record<string, number>;
} {
  const actual = jest.requireActual<typeof import('@/data/speech/config')>(
    '../../src/data/speech/config',
  );
  const config = { ...actual.SPEECH_ENGINE_CONFIG, ...overrides };
  let create: CreateEngine | null = null;
  jest.isolateModules(() => {
    jest.doMock('../../src/data/speech/config', () => ({ SPEECH_ENGINE_CONFIG: config }));
    const engine = jest.requireActual<typeof import('@/data/speech/whisper-speech-engine')>(
      '../../src/data/speech/whisper-speech-engine',
    );
    create = (capture, transcriber, timers) =>
      engine.createWhisperSpeechEngine({ capture, transcriber, mode: 'search', timers });
  });
  return { create: create!, config: config as unknown as Record<string, number> };
}

/**
 * The quiet of the room after the reciter stops, as a steady noise: in a noisy condition, the
 * room noise of that condition (the clip's voice level minus the SNR); otherwise the clip's
 * quietest tenth, at most -52 dB of full scale (a quiet room, under the engine's floor for a voice).
 */
function quietOf(audio: Int16Array, chunkSamples: number, condition: string): () => Int16Array {
  const levels: number[] = [];
  for (let i = 0; i + chunkSamples <= audio.length; i += chunkSamples) {
    let sum = 0;
    for (let j = i; j < i + chunkSamples; j += 1) sum += audio[j]! * audio[j]!;
    levels.push(Math.sqrt(sum / chunkSamples));
  }
  levels.sort((a, b) => a - b);
  const loudest = levels[levels.length - 1] ?? 0;
  const voiced = levels.filter((level) => level > loudest * 0.1);
  const voice = Math.sqrt(voiced.reduce((sum, l) => sum + l * l, 0) / Math.max(1, voiced.length));
  const snr = /^noise(\d+)$/.exec(condition);
  const rms =
    snr !== null
      ? voice / 10 ** (Number(snr[1]) / 20)
      : Math.max(
          2,
          Math.min(levels[Math.floor(levels.length * 0.1)] ?? 2, 32768 * 10 ** (-52 / 20)),
        );
  let seed = 12345;
  return () => {
    const chunk = new Int16Array(chunkSamples);
    for (let i = 0; i < chunkSamples; i += 1) {
      // Uniform noise of the same RMS: sqrt(3) times the RMS at most.
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      chunk[i] = Math.round(((seed / 0x7fffffff) * 2 - 1) * rms * Math.sqrt(3));
    }
    return chunk;
  };
}

// ---- Scoring --------------------------------------------------------------------------------

interface Listened {
  readonly clip: string;
  readonly batches: readonly { at: number; words: readonly string[] }[];
  readonly partials?: readonly { at: number; afterFinal: number; words: readonly string[] }[];
  readonly passes: readonly {
    at: number;
    audioMs: number;
    computeMs: number;
    cached: boolean;
    text: string;
  }[];
  readonly endedAt: number;
}

type Search = (index: VerseIndex, words: readonly string[]) => SearchResult;

export interface ClipScore {
  /** The first passage announced, as the listening screen announces it. */
  readonly answer: 'right' | 'wrong' | 'none';
  /** Audio time (ms from the first sound of the clip) of the first right announcement. */
  readonly answeredAt: number | null;
  /** The right passage is among the first three places the search ranks at the end. */
  readonly inTopThree: boolean;
  readonly words: number;
}

/** What the screen would search, moment by moment: the final words, and maybe the partial ones. */
export function heardViews(
  record: Pick<Listened, 'batches' | 'partials'>,
  withPartial: boolean,
): { at: number; words: readonly string[] }[] {
  const finals: string[] = [];
  const views: { at: number; order: number; words: readonly string[] }[] = [];
  record.batches.forEach((batch, i) => {
    finals.push(...batch.words);
    views.push({ at: batch.at, order: 2 * i, words: [...finals] });
  });
  if (withPartial) {
    (record.partials ?? []).forEach((partial, i) => {
      if (partial.words.length === 0) return;
      views.push({
        at: partial.at,
        order: 2 * i + 1,
        words: [...finals.slice(0, partial.afterFinal), ...partial.words],
      });
    });
  }
  // Same time: the final words are given before the partial ones are shown (the engine's order).
  return views
    .sort((x, y) => x.at - y.at || (x.order % 2) - (y.order % 2) || x.order - y.order)
    .map(({ at, words }) => ({ at, words }));
}

/** Replays the words of one listening through a search, as `useListening` does. */
export function scoreListening(
  index: VerseIndex,
  search: Search,
  views: readonly { at: number; words: readonly string[] }[],
  finalWords: readonly string[],
  truth: Clip['truth'],
): ClipScore {
  for (const view of views) {
    const result = search(index, view.words);
    if (result.status === 'found') {
      const right = isRight(result.candidates[0]!, truth);
      return {
        answer: right ? 'right' : 'wrong',
        answeredAt: right ? view.at : null,
        inTopThree: right,
        words: view.words.length,
      };
    }
  }
  const ranked =
    finalWords.length === 0 ? [] : index.search(finalWords, { minScore: 0.4 }).candidates;
  return {
    answer: 'none',
    answeredAt: null,
    inTopThree: ranked.slice(0, 3).some((candidate) => isRight(candidate, truth)),
    words: finalWords.length,
  };
}

const SEARCHES: readonly { name: string; search: Search; partial: boolean }[] = [
  { name: 'app', search: searchHeardWords, partial: false },
  { name: 'app+partial', search: searchHeardWords, partial: true },
  { name: 'all-words-only', search: (index, words) => index.search(words), partial: false },
];

function percent(part: number, whole: number): string {
  return whole === 0 ? '-' : `${Math.round((part * 1000) / whole) / 10} %`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

// ---- The benchmark --------------------------------------------------------------------------

describeBench('voice benchmark', () => {
  const manifest =
    manifestPath === undefined
      ? null
      : (JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
          streams: Stream[];
        });
  const streamDir = manifestPath?.replace(/\/[^/]*$/, '') ?? '';
  const only = env.VOICE_BENCH_STREAMS === undefined ? null : new RegExp(env.VOICE_BENCH_STREAMS);
  const streams = (manifest?.streams ?? []).filter((s) => only === null || only.test(s.id));
  const clips = clipsOf(streams);
  const tag = env.VOICE_BENCH_TAG ?? '';
  const outFile = `${work}/listen-${configName}${tag}.jsonl`;
  let index: VerseIndex;

  beforeAll(() => {
    index = createVerseIndex(loadUthmaniCorpus() ?? []);
  });

  const phases = new Set((env.VOICE_BENCH_PHASE ?? 'listen,score').split(','));
  const phase = { includes: (name: string) => phases.has(name) };

  (phase.includes('listen') ? it : it.skip)(
    'listens to every clip with the app engine',
    async () => {
      const config = chosenConfig();
      const done = new Set<string>();
      if (fs.existsSync(outFile)) {
        for (const line of fs.readFileSync(outFile, 'utf8').split('\n')) {
          if (line.trim() !== '') done.add((JSON.parse(line) as Listened).clip);
        }
      }
      const driver = createWhisperDriver(
        env.VOICE_BENCH_DRIVER ?? `${work}/whisper-driver`,
        `${work}/${config.model}`,
        `${work}/cache-${config.model}.jsonl`,
      );
      const { create, config: engineConfig } = engineWith(config.engine);
      const sampleRate = engineConfig.sampleRate!;
      const chunkMs = engineConfig.chunkMs!;
      const audioOf = new Map<string, Int16Array>();
      try {
        for (const clip of clips) {
          if (done.has(clip.id)) continue;
          const path = `${streamDir}/${clip.condition}/${clip.stream.id}.wav`;
          if (!audioOf.has(path)) {
            audioOf.clear();
            audioOf.set(path, readWav(path));
          }
          const whole = audioOf.get(path)!;
          const audio = whole.subarray(
            Math.round(clip.start * sampleRate),
            Math.round((clip.start + clip.length) * sampleRate),
          );
          const listened = await simulateListening({
            createEngine: create,
            audio,
            quiet: quietOf(audio, (sampleRate * chunkMs) / 1000, clip.condition),
            chunkMs,
            sampleRate,
            read: (samples) => driver.transcribe(samples, config.decoding),
            latency,
            maxMs: clip.length * 1000 + 8000,
          });
          const record: Listened = { clip: clip.id, ...listened };
          fs.appendFileSync(outFile, `${JSON.stringify(record)}\n`);
        }
      } finally {
        driver.close();
      }
    },
    24 * 3600 * 1000,
  );

  /** The table of one run: every group of clips, through every search. */
  function writeScores(listened: ReadonlyMap<string, Listened>, name: string): void {
    const lines: string[] = [];
    const summary: Record<string, unknown> = { config: name, latency, groups: {} };
    for (const { name: searchName, search, partial } of SEARCHES) {
      const groups = new Map<string, { clip: Clip; score: ClipScore }[]>();
      for (const clip of clips) {
        const record = listened.get(clip.id);
        if (record === undefined) continue;
        const score = scoreListening(
          index,
          search,
          heardViews(record, partial),
          record.batches.flatMap((batch) => batch.words),
          clip.truth,
        );
        const reader = clip.stream.professional ? 'pro' : 'ordinary';
        for (const key of [
          `${clip.condition} ${clip.length >= 9.5 ? 10 : clip.length >= 5.5 ? 6 : 3}s`,
          `${clip.condition} all`,
          `${reader} ${clip.condition}`,
          `${reader} all`,
          `${clip.midVerse ? 'mid-verse' : 'verse start'}`,
          'all',
        ]) {
          groups.set(key, [...(groups.get(key) ?? []), { clip, score }]);
        }
      }
      lines.push(`\n${name} / search ${searchName}`);
      lines.push('group | clips | top-1 | wrong | top-3 | median time to right answer (s)');
      for (const [key, entries] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
        const right = entries.filter((e) => e.score.answer === 'right').length;
        const wrong = entries.filter((e) => e.score.answer === 'wrong').length;
        const top3 = entries.filter((e) => e.score.inTopThree).length;
        const times = entries.flatMap((e) =>
          e.score.answeredAt === null ? [] : [e.score.answeredAt],
        );
        const med = median(times);
        lines.push(
          `${key} | ${entries.length} | ${percent(right, entries.length)} | ${wrong} | ` +
            `${percent(top3, entries.length)} | ${med === null ? '-' : (med / 1000).toFixed(1)}`,
        );
        (summary.groups as Record<string, unknown>)[`${searchName}: ${key}`] = {
          clips: entries.length,
          right,
          wrong,
          top3,
          medianMs: med,
        };
      }
    }
    // Compute on this computer: real-time factor of the readings that were really run.
    let computeMs = 0;
    let audioMs = 0;
    let passes = 0;
    for (const record of listened.values()) {
      for (const pass of record.passes) {
        passes += 1;
        if (pass.cached) continue;
        computeMs += pass.computeMs;
        audioMs += pass.audioMs;
      }
    }
    lines.push(
      `\nreadings: ${passes}; computed here: ${(computeMs / 1000).toFixed(0)} s for ` +
        `${(audioMs / 1000).toFixed(0)} s of audio (RTF ${(computeMs / Math.max(1, audioMs)).toFixed(2)})`,
    );
    fs.writeFileSync(`${work}/score-${name}.txt`, lines.join('\n'));
    fs.writeFileSync(`${work}/score-${name}.json`, JSON.stringify(summary, null, 1));
  }

  function readJsonl<T>(path: string): T[] {
    if (!fs.existsSync(path)) return [];
    return fs
      .readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as T);
  }

  (phase.includes('score') ? it : it.skip)('scores what was heard', () => {
    const listened = new Map<string, Listened>();
    for (const record of readJsonl<Listened>(outFile)) listened.set(record.clip, record);
    writeScores(listened, `${configName}${tag}`);
    expect(listened.size).toBeGreaterThan(0);
  });

  // ---- Offline: each clip read whole, once (compares decodings and models cheaply) ----------

  const offlineFile = `${work}/offline-${configName}${tag}.jsonl`;
  interface OfflineReading {
    readonly clip: string;
    readonly text: string;
    readonly ms: number;
    readonly audioMs: number;
  }

  (phase.includes('offline') ? it : it.skip)(
    'reads every clip whole, once',
    async () => {
      const config = chosenConfig();
      const done = new Set(readJsonl<OfflineReading>(offlineFile).map((r) => r.clip));
      const driver = createWhisperDriver(
        env.VOICE_BENCH_DRIVER ?? `${work}/whisper-driver`,
        `${work}/${config.model}`,
        `${work}/cache-${config.model}.jsonl`,
      );
      const audioOf = new Map<string, Int16Array>();
      try {
        for (const clip of clips) {
          if (done.has(clip.id)) continue;
          const path = `${streamDir}/${clip.condition}/${clip.stream.id}.wav`;
          if (!audioOf.has(path)) {
            audioOf.clear();
            audioOf.set(path, readWav(path));
          }
          const audio = audioOf
            .get(path)!
            .subarray(
              Math.round(clip.start * 16000),
              Math.round((clip.start + clip.length) * 16000),
            );
          const reading = await driver.transcribe(audio, config.decoding);
          const record: OfflineReading = {
            clip: clip.id,
            text: reading.text,
            ms: reading.cached ? 0 : reading.ms,
            audioMs: (audio.length * 1000) / 16000,
          };
          fs.appendFileSync(offlineFile, `${JSON.stringify(record)}\n`);
        }
      } finally {
        driver.close();
      }
    },
    24 * 3600 * 1000,
  );

  (phase.includes('offline-score') ? it : it.skip)('scores the whole readings', () => {
    const listened = new Map<string, Listened>();
    for (const reading of readJsonl<OfflineReading>(offlineFile)) {
      const words = whisperWords(reading.text);
      // The words arrive one by one, as on the screen; their times are not known here.
      listened.set(reading.clip, {
        clip: reading.clip,
        batches: words.map((word, i) => ({
          at: ((i + 1) * reading.audioMs) / words.length,
          words: [word],
        })),
        passes: [
          {
            at: reading.audioMs,
            audioMs: reading.audioMs,
            computeMs: reading.ms,
            cached: reading.ms === 0,
            text: reading.text,
          },
        ],
        endedAt: reading.audioMs,
      });
    }
    writeScores(listened, `offline-${configName}${tag}`);
    expect(listened.size).toBeGreaterThan(0);
  });
});
