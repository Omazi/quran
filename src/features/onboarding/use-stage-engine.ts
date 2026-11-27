import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { playHaptic } from '@/features/feedback';

import { STORY_MOTION } from './config';
import { turnsRed, type Recitation } from './recitation';
import {
  clamp,
  heartProgress,
  isFoundBetween,
  mix,
  pageValue,
  voiceLevel,
  type StoryMarks,
} from './story-math';

/** The three haptics of the demonstrations (motion spec §13), played on the JavaScript side. */
export type StageHaptic = 'wrong-word' | 'found' | 'heart';

export function playStageHaptic(kind: StageHaptic): void {
  switch (kind) {
    case 'wrong-word':
      playHaptic('warning');
      return;
    case 'found':
      playHaptic('success');
      return;
    case 'heart':
      playHaptic('light');
  }
}

/**
 * What the stage reads at each frame besides the position, all kept on the UI thread (no React
 * state per frame):
 * - `clock`: seconds since the stage opened, for what breathes at rest;
 * - `introMs`: milliseconds since it opened, for the arrival of the first page;
 * - `speed`: how fast the finger moves the pages, smoothed (the prototype's `scrollLv`);
 * - `level`: the voice's level as the thread, the water and the rosette show it;
 * - `recitationMs`: the voice page's demonstration clock, or -1 when it is not shown;
 * - `recognitionMs`: the listening page's, or -1.
 */
export interface StageEngine {
  readonly clock: SharedValue<number>;
  readonly introMs: SharedValue<number>;
  readonly speed: SharedValue<number>;
  readonly level: SharedValue<number>;
  readonly recitationMs: SharedValue<number>;
  readonly recognitionMs: SharedValue<number>;
}

export interface StageEngineInput {
  readonly position: SharedValue<number>;
  /** How alive the voice is on each page (`OnboardingPage.voice`). */
  readonly voices: readonly number[];
  readonly marks: StoryMarks;
  /** The voice page's demonstration, once page 1 of the mushaf is loaded. */
  readonly recitation: Recitation | null;
  readonly reducedMotion: boolean;
}

/** A demonstration runs while its page is within this distance (`|pos − 11| < .55`). */
const DEMO_RANGE = 0.55;

/** The engine's shared values, created where both the stage and the pages can read them. */
export function useStageEngine(reducedMotion: boolean): StageEngine {
  const clock = useSharedValue(0);
  const introMs = useSharedValue(0);
  const speed = useSharedValue(0);
  const level = useSharedValue(reducedMotion ? STORY_MOTION.reducedLevel : 0);
  const recitationMs = useSharedValue(-1);
  const recognitionMs = useSharedValue(-1);
  return { clock, introMs, speed, level, recitationMs, recognitionMs };
}

/** Runs the engine at every frame, from the position the pager gives (rendered inside it). */
export function useRunStageEngine(
  engine: StageEngine,
  { position, voices, marks, recitation, reducedMotion }: StageEngineInput,
): void {
  const { clock, introMs, speed, level, recitationMs, recognitionMs } = engine;
  // The engine's own memory: where the pages were last frame, how fast they went, the voice's pulse.
  const lastPosition = useSharedValue(Number.NaN);
  const velocity = useSharedValue(0);
  const pulse = useSharedValue(0);
  const pulseLevel = useSharedValue(0);
  const recitationStart = useSharedValue(-1);
  const recognitionStart = useSharedValue(-1);
  const lastWord = useSharedValue(-1);
  const lastHeart = useSharedValue(-1);

  useFrameCallback((frame) => {
    'worklet';
    const m = STORY_MOTION;
    const now = frame.timeSinceFirstFrame;
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    clock.set(now / 1000);
    introMs.set(now);
    const pos = position.get();

    // The finger's speed, smoothed: quick to rise, slow to fall (`vel`, `scrollLv`).
    const before = Number.isNaN(lastPosition.get()) ? pos : lastPosition.get();
    const moved = (pos - before) / Math.max(dt, 0.001);
    lastPosition.set(pos);
    velocity.set(mix(velocity.get(), moved, 1 - Math.exp(-dt * m.speedSmoothing)));
    const target = clamp(Math.abs(velocity.get()) * m.speedGain);
    const rate = target > speed.get() ? m.speedRise : m.speedFall;
    speed.set(mix(speed.get(), target, 1 - Math.exp(-dt * rate)));

    // The two demonstrations keep their own clock while their page is near.
    if (Math.abs(pos - marks.voice) < DEMO_RANGE) {
      if (recitationStart.get() < 0) recitationStart.set(now);
      const loop = recitation?.duration ?? 1;
      const t = (now - recitationStart.get()) % loop;
      // The word read wrong turns red: a warning, on the frame it shakes (each loop).
      if (recitation !== null && !reducedMotion && turnsRed(recitation, recitationMs.get(), t)) {
        scheduleOnRN(playStageHaptic, 'wrong-word');
      }
      recitationMs.set(t);
      if (recitation !== null && !reducedMotion) {
        // A breath of voice at each new word (the prototype's `pulse(.16 + …)` while not playing).
        let word = -1;
        for (let k = 0; k < recitation.starts.length; k += 1) {
          if (t >= (recitation.starts[k] ?? 0)) word = k;
        }
        if (word !== lastWord.get()) {
          lastWord.set(word);
          if (word >= 0)
            pulse.set(Math.max(pulse.get(), m.wordPulse + Math.random() * m.wordPulseRange));
        }
      }
    } else {
      recitationStart.set(-1);
      recitationMs.set(-1);
      lastWord.set(-1);
    }
    if (Math.abs(pos - marks.recognition) < DEMO_RANGE) {
      if (recognitionStart.get() < 0) recognitionStart.set(now);
      const t = (now - recognitionStart.get()) % m.recognitionLoopMs;
      // The passage is recognised: a success, as the card starts to rise (each loop).
      if (!reducedMotion && isFoundBetween(recognitionMs.get(), t)) {
        scheduleOnRN(playStageHaptic, 'found');
      }
      recognitionMs.set(t);
      // While it listens, the reciter's voice comes in bursts (`pulse(.5 + …)`, 3.6 a second).
      if (
        !reducedMotion &&
        t < m.recognitionListenMs &&
        Math.random() < dt * m.listeningPulsesPerS
      ) {
        pulse.set(Math.max(pulse.get(), m.listeningPulse + Math.random() * m.listeningPulseRange));
      }
    } else {
      recognitionStart.set(-1);
      recognitionMs.set(-1);
    }

    // The heart lands on the thirsty friend's card, going forwards (motion spec §10).
    const heart = heartProgress(pos, marks.friends);
    if (heart >= m.encouragedAt && lastHeart.get() < m.encouragedAt && lastHeart.get() >= 0) {
      scheduleOnRN(playStageHaptic, 'heart');
    }
    lastHeart.set(heart);

    // The pulse decays, the level follows it: quick up, slower down (`vTarget`, `vLevel`).
    pulse.set(pulse.get() * Math.pow(m.pulseDecayPerFrame, dt * 60));
    const heard = pulseLevel.get();
    const toward = pulse.get() > heard ? m.levelRise : m.levelFall;
    pulseLevel.set(heard + (pulse.get() - heard) * (1 - Math.exp(-dt * toward)));
    level.set(
      voiceLevel(
        speed.get(),
        pulseLevel.get(),
        now / 1000,
        pos,
        pageValue(voices, pos),
        reducedMotion,
      ),
    );
  });
}
