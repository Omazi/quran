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
  audioCheckCandidates,
  decideByAudio,
  heldText,
  minLettersFor,
  type AudioCheckCandidate,
  type HeldReading,
} from '@/domain/listening/audio-check';
import {
  createVerseIndex,
  normalizeArabic,
  type VerseText,
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
  type HeldOptions,
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
  /** The length asked by the plan (the clip is shorter when the recording is). */
  readonly wanted: number;
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
  app: { model: 'ggml-quran-base-q5_1.bin', decoding: APP_DECODING, engine: {} },
  /** The app before D47: Whisper tiny. */
  tiny: { model: 'ggml-quran-tiny-q8_0.bin', decoding: APP_DECODING, engine: {} },
  /** The app before D45: whisper.cpp's temperature fallback left on. */
  before: {
    model: 'ggml-quran-tiny-q8_0.bin',
    decoding: { ...APP_DECODING, temperatureInc: 0.2 },
    engine: {},
  },
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
          wanted,
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

interface NamedSearch {
  readonly name: string;
  readonly search: Search;
  readonly partial: boolean;
  /** The index this search runs on (a matcher variant has its own). */
  readonly index?: VerseIndex;
}

/**
 * Other settings of the passage search, as JSON:
 * `{"close-0.6":{"recognition":{"closeWordSimilarity":0.6},"recentWords":8,"partial":true}}`.
 * Each variant gets its own index, built with those settings (the module's config is replaced).
 */
function matcherVariants(corpus: readonly VerseText[]): NamedSearch[] {
  const asked = JSON.parse(env.VOICE_BENCH_MATCHERS ?? '{}') as Record<
    string,
    { recognition?: Record<string, number>; recentWords?: number; partial?: boolean }
  >;
  return Object.entries(asked).map(([name, variant]) => {
    const actual = jest.requireActual<typeof import('@/domain/recognition/config')>(
      '../../src/domain/recognition/config',
    );
    const config = { ...actual.RECOGNITION_CONFIG, ...variant.recognition };
    let build: ((verses: readonly VerseText[]) => VerseIndex) | null = null;
    jest.isolateModules(() => {
      jest.doMock('../../src/domain/recognition/config', () => ({ RECOGNITION_CONFIG: config }));
      build = jest.requireActual<typeof import('@/domain/recognition')>(
        '../../src/domain/recognition',
      ).createVerseIndex;
    });
    const variantIndex = build!(corpus);
    const recent = variant.recentWords ?? 8;
    const search: Search = (_index, words) => {
      const all = variantIndex.search(words);
      if (all.status === 'found' || words.length <= recent || recent <= 0) return all;
      const latest = variantIndex.search(words.slice(-recent));
      return latest.status === 'found' ? latest : all;
    };
    return { name, search, partial: variant.partial ?? false, index: variantIndex };
  });
}

/**
 * How often a search says `found` on inputs of 3 to 14 words drawn at random from the Quran's own
 * words (never a real passage, except by chance): the price of a looser search.
 */
function falseFoundRate(search: Search, index: VerseIndex, corpus: readonly VerseText[]): string {
  const words = corpus.flatMap((verse) => normalizeArabic(verse.text));
  let seed = 20261126;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const inputs = Number(env.VOICE_BENCH_RANDOM_INPUTS ?? 1000);
  let found = 0;
  for (let i = 0; i < inputs; i += 1) {
    const length = 3 + Math.floor(next() * 12);
    const input = Array.from({ length }, () => words[Math.floor(next() * words.length)]!);
    // Words arrive one by one, as on the screen: any `found` on the way counts.
    for (let count = 3; count <= length; count += 1) {
      if (search(index, input.slice(0, count)).status === 'found') {
        found += 1;
        break;
      }
    }
  }
  return `${found}/${inputs}`;
}

const SEARCHES: readonly NamedSearch[] = [
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
  /** Names the scores of one scoring (matcher variants) without changing what is read. */
  const scoreTag = env.VOICE_BENCH_SCORE_TAG ?? '';
  const outFile = `${work}/listen-${configName}${tag}.jsonl`;
  let index: VerseIndex;

  let searches: readonly NamedSearch[] = SEARCHES;
  let corpus: VerseText[] = [];
  beforeAll(() => {
    corpus = loadUthmaniCorpus() ?? [];
    index = createVerseIndex(corpus);
    searches = [...SEARCHES, ...matcherVariants(corpus)];
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
    /** Each clip's answer through the first search, for a look at the misses. */
    const perClip: string[] = [];
    for (const { name: searchName, search, partial, index: own } of searches) {
      const searchIndex = own ?? index;
      const groups = new Map<string, { clip: Clip; score: ClipScore }[]>();
      for (const clip of clips) {
        const record = listened.get(clip.id);
        if (record === undefined) continue;
        const score = scoreListening(
          searchIndex,
          search,
          heardViews(record, partial),
          record.batches.flatMap((batch) => batch.words),
          clip.truth,
        );
        if (searchName === searches[0]!.name) {
          const record2 = listened.get(clip.id)!;
          perClip.push(
            JSON.stringify({
              clip: clip.id,
              answer: score.answer,
              top3: score.inTopThree,
              at: score.answeredAt,
              text: record2.passes.map((pass) => pass.text).slice(-1)[0] ?? '',
            }),
          );
        }
        const reader = clip.stream.professional ? 'pro' : 'ordinary';
        for (const key of [
          `${clip.condition} ${clip.wanted}s`,
          `${clip.condition} all`,
          `${reader} ${clip.condition}`,
          `${reader} all`,
          `${clip.midVerse ? 'mid-verse' : 'verse start'}`,
          'all',
        ]) {
          groups.set(key, [...(groups.get(key) ?? []), { clip, score }]);
        }
      }
      lines.push(
        `\n${name} / search ${searchName}` +
          (env.VOICE_BENCH_RANDOM_INPUTS === '0'
            ? ''
            : ` (found on random Quran words: ${falseFoundRate(search, searchIndex, corpus)})`),
      );
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
    fs.writeFileSync(`${work}/clips-${name}.jsonl`, `${perClip.join('\n')}\n`);
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
    writeScores(listened, `${configName}${tag}${scoreTag}`);
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
    writeScores(listened, `offline-${configName}${tag}${scoreTag}`);
    expect(listened.size).toBeGreaterThan(0);
  });

  // ---- Held readings: each proposed passage read again from the audio (D47) -------------------

  const heldTag = env.VOICE_BENCH_HELD_TAG ?? '';
  const heldFile = `${work}/held-${configName}${tag}${heldTag}.jsonl`;
  interface HeldRecord {
    readonly clip: string;
    readonly free: string;
    readonly candidates: readonly AudioCheckCandidate[];
    readonly readings: readonly HeldReading[];
    readonly ms: number;
    readonly audioMs: number;
  }
  const heldOptions = (): Omit<HeldOptions, 'minLetters'> => ({
    freeLetterCost: Number(env.VOICE_BENCH_HELD_FREE_COST ?? 2),
    firstChoices: Number(env.VOICE_BENCH_HELD_FIRSTS ?? 3),
    margin: Number(env.VOICE_BENCH_HELD_MARGIN ?? 0),
    threads: Number(env.VOICE_BENCH_HELD_THREADS ?? 1),
  });

  /** Imla'i verse texts (the spelling the model writes), from the app's generated data. */
  function imlaei(): {
    text: (ref: { surah: number; verse: number }) => string | undefined;
    count: (surah: number) => number;
  } {
    const data = JSON.parse(fs.readFileSync('assets/data/verses/imlaei.json', 'utf8')) as Record<
      string,
      string[]
    >;
    return {
      text: ({ surah, verse }) => data[String(surah)]?.[verse - 1],
      count: (surah) => data[String(surah)]?.length ?? 0,
    };
  }

  (phase.includes('held') ? it : it.skip)(
    'reads every clip again, held to each proposed passage',
    async () => {
      const config = chosenConfig();
      const done = new Set(readJsonl<HeldRecord>(heldFile).map((r) => r.clip));
      const free = new Map(readJsonl<OfflineReading>(offlineFile).map((r) => [r.clip, r.text]));
      const verses = imlaei();
      const driver = createWhisperDriver(
        env.VOICE_BENCH_HELD_DRIVER ?? `${work}/whisper-driver-q`,
        `${work}/${config.model}`,
        `${work}/cache-held-unused.jsonl`,
      );
      const audioOf = new Map<string, Int16Array>();
      try {
        for (const clip of clips) {
          const text = free.get(clip.id);
          if (done.has(clip.id) || text === undefined) continue;
          const candidates = audioCheckCandidates(index, whisperWords(text), verses.count);
          let readings: HeldReading[] = [];
          let ms = 0;
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
          if (candidates.length > 0) {
            const answer = await driver.held(
              audio,
              candidates.map((candidate) => heldText(candidate, verses.text)),
              { ...heldOptions(), minLetters: minLettersFor(text) },
            );
            readings = answer.readings;
            ms = answer.ms;
          }
          const record: HeldRecord = {
            clip: clip.id,
            free: text,
            candidates,
            readings,
            ms,
            audioMs: (audio.length * 1000) / 16000,
          };
          fs.appendFileSync(heldFile, `${JSON.stringify(record)}\n`);
        }
      } finally {
        driver.close();
      }
    },
    24 * 3600 * 1000,
  );

  (phase.includes('held-score') ? it : it.skip)('scores the held readings', () => {
    const records = readJsonl<HeldRecord>(heldFile);
    /** What the app's search said of the free reading alone (offline-score's per-clip dump). */
    const appAnswers = new Map(
      readJsonl<{ clip: string; answer: string }>(
        `${work}/clips-offline-${configName}${tag}.jsonl`,
      ).map((r) => [r.clip, r.answer]),
    );
    const groups = new Map<
      string,
      {
        right: number;
        wrong: number;
        wrongIfLeftOut: number;
        n: number;
        app: number;
        both: number;
        bothWrong: number;
      }
    >();
    const byClip = new Map(clips.map((clip) => [clip.id, clip]));
    for (const record of records) {
      const clip = byClip.get(record.clip);
      if (clip === undefined) continue;
      const truthOf = (candidate: AudioCheckCandidate) => isRight(candidate.passage, clip.truth);
      const decision = decideByAudio(index, record.candidates, record.readings, record.free);
      // The same, with the right passage taken out: anything announced then is wrong.
      const kept = record.candidates
        .map((c, i) => [c, record.readings[i]!] as const)
        .filter(([c]) => !truthOf(c));
      const leftOut = decideByAudio(
        index,
        kept.map(([c]) => c),
        kept.map(([, r]) => r),
        record.free,
      );
      const reader = clip.stream.professional ? 'pro' : 'ordinary';
      for (const key of [`${clip.condition} ${clip.wanted}s`, `${reader} all`, 'all']) {
        const g = groups.get(key) ?? {
          right: 0,
          wrong: 0,
          wrongIfLeftOut: 0,
          n: 0,
          app: 0,
          both: 0,
          bothWrong: 0,
        };
        g.n += 1;
        const app = appAnswers.get(record.clip) ?? 'none';
        const held =
          decision.status === 'found' ? (truthOf(decision.candidate) ? 'right' : 'wrong') : 'none';
        const both = app !== 'none' ? app : held;
        if (app === 'right') g.app += 1;
        if (both === 'right') g.both += 1;
        if (both === 'wrong') g.bothWrong += 1;
        if (decision.status === 'found') {
          if (truthOf(decision.candidate)) g.right += 1;
          else g.wrong += 1;
        }
        if (leftOut.status === 'found') g.wrongIfLeftOut += 1;
        groups.set(key, g);
      }
    }
    const lines = [
      'group | clips | app search | held check | wrong | wrong with the right passage left out | app then held | wrong',
    ];
    for (const [key, g] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(
        `${key} | ${g.n} | ${percent(g.app, g.n)} | ${percent(g.right, g.n)} | ${g.wrong} | ` +
          `${g.wrongIfLeftOut} | ${percent(g.both, g.n)} | ${g.bothWrong}`,
      );
    }
    fs.writeFileSync(`${work}/score-held-${configName}${tag}${heldTag}.txt`, lines.join('\n'));
    expect(records.length).toBeGreaterThan(0);
  });
});
