/**
 * Scenarios of the SIMULATED engine, to try every state of the listening screen before the real
 * engine exists: `/listening?scenario=several`, for instance. The words are what a speech engine
 * might write (plain Arabic, without vowels); they are searched, never shown.
 */
import type { SpeechEngine } from '@/domain/listening';

import {
  createSimulatedSpeechEngine,
  recitationSteps,
  type SimulatedScript,
} from './simulated-speech-engine';

export const SCENARIOS = [
  'found',
  'several',
  'nothing',
  'silence',
  'denied',
  'failed',
  'listening',
  'follow',
] as const;

export type ScenarioName = (typeof SCENARIOS)[number];

/** The scenario when none, or an unknown one, is asked for. */
export const DEFAULT_SCENARIO: ScenarioName = 'found';

/** Silence before the first word, and after the last one before the engine ends. */
const LEAD_IN_MS = 1500;
const TAIL_MS = 1500;
/** How long the endless listening waits before replaying its voice. */
const LISTENING_LOOP_MS = 12000;
/** How long "silence" listens before the engine gives up. */
const SILENCE_MS = 6000;

/** The beginning of 2:255: ambiguous with 3:2 at first. */
const AYAT_AL_KURSI = 'الله لا إله إلا هو الحي القيوم لا تأخذه سنة ولا نوم'.split(' ');
/** 18:10, the passage of the validated mockup (shazam.png). */
const AL_KAHF_10 =
  'إذ أوى الفتية إلى الكهف فقالوا ربنا آتنا من لدنك رحمة وهيئ لنا من أمرنا رشدا'.split(' ');
/** "Praise be to God, Lord of the worlds": six places in the Quran. */
const PRAISE = 'الحمد لله رب العالمين'.split(' ');
/** "I went to the market this morning to buy bread": not from the Quran. */
const UNRELATED = 'ذهبت إلى السوق صباحا لشراء الخبز'.split(' ');

/**
 * 18:10 as recited for the voice-following screen (voix.png): « إذ », then « الفتية », the
 * word after « أوى », which was left out; then the voice goes on without a word the follower
 * can place, for a minute.
 */
const FOLLOW_WORDS = ['إذ', 'الفتية'];
const FOLLOW_VOICE_MS = 60000;
/** Plain syllables of voice, for the time after the last word. */
const VOICE_ONLY = Array.from({ length: 80 }, () => 'و');

function recitation(words: readonly string[], seed: number): SimulatedScript {
  const steps = recitationSteps(words, { startAt: LEAD_IN_MS, seed });
  const last = steps[steps.length - 1]?.at ?? LEAD_IN_MS;
  return { permission: 'undetermined', steps: [...steps, { at: last + TAIL_MS, end: 'finished' }] };
}

function scriptOf(name: ScenarioName): SimulatedScript {
  switch (name) {
    case 'found':
      return recitation(AL_KAHF_10, 1);
    case 'several':
      return recitation(PRAISE, 2);
    case 'nothing':
      return recitation(UNRELATED, 3);
    case 'silence':
      return { permission: 'undetermined', steps: [{ at: SILENCE_MS, end: 'finished' }] };
    case 'denied':
      return { permission: 'undetermined', answer: 'denied', steps: [] };
    case 'failed':
      return { permission: 'granted', steps: [], startFails: true };
    case 'follow': {
      const words = recitationSteps(FOLLOW_WORDS, { startAt: LEAD_IN_MS, seed: 5 });
      const last = words[words.length - 1]?.at ?? LEAD_IN_MS;
      const voice = recitationSteps(VOICE_ONLY, { startAt: last + LEAD_IN_MS, seed: 6 }).filter(
        (step) => 'level' in step,
      );
      return {
        permission: 'undetermined',
        steps: [...words, ...voice, { at: last + FOLLOW_VOICE_MS, end: 'finished' }],
      };
    }
    case 'listening': {
      // The voice of a recitation without its words: the screen keeps listening.
      const voice = recitationSteps(AYAT_AL_KURSI, { startAt: LEAD_IN_MS, seed: 4 });
      return {
        permission: 'undetermined',
        steps: voice.filter((step) => 'level' in step),
        loopEvery: LISTENING_LOOP_MS,
      };
    }
  }
}

export function parseScenario(value: string | undefined): ScenarioName {
  return SCENARIOS.find((name) => name === value) ?? DEFAULT_SCENARIO;
}

/** A simulated engine that plays the named scenario. */
export function createScenarioEngine(name: ScenarioName): SpeechEngine {
  return createSimulatedSpeechEngine(scriptOf(name));
}
