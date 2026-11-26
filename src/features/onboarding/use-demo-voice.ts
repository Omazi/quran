import { useCallback, useEffect, useRef } from 'react';

import type { Unsubscribe } from '@/domain/listening';
import { storyMotion } from '@/ui';

/**
 * The level of a voice that recites, 0 to 1, for the step `step` of the demonstration: bursts
 * like syllables with short silences between, always the same (nothing random, so a test and a
 * screenshot see the same rosette). Not a recording and not a microphone: the introduction never
 * asks for one.
 */
export function demoVoiceLevel(step: number): number {
  const syllable = Math.abs(Math.sin(step * 0.83) * Math.sin(step * 0.31 + 1));
  return Math.min(1, 0.08 + 0.92 * syllable ** 0.7);
}

/**
 * A made-up voice for the introduction's demonstrations of listening and following: the same
 * shape as the real engine's level stream (`SpeechEngine.onLevel`), so the real rosette and the
 * real voice meter move with it. It runs only while `isActive` (the page is shown, the demo is
 * listening, and the person has not asked for reduced motion).
 */
export function useDemoVoice(
  isActive: boolean,
): (listener: (level: number) => void) => Unsubscribe {
  const listeners = useRef(new Set<(level: number) => void>());
  const subscribe = useCallback((listener: (level: number) => void): Unsubscribe => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!isActive) return undefined;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      const level = demoVoiceLevel(step);
      for (const listener of [...listeners.current]) listener(level);
    }, storyMotion.demoLevelMs);
    return () => clearInterval(timer);
  }, [isActive]);

  return subscribe;
}
