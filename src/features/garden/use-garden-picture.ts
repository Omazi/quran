import { useEffect, useRef, useState } from 'react';

import { useReducedMotion } from '@/ui';

import { MAX_TRANSITION_MS, MIN_STEP_DURATION_MS, STEP_DURATION_MS } from './config';
import {
  pictureSteps,
  type GardenImageNames,
  type GardenPicture,
  type PictureStep,
} from './garden-picture';

/** What the scene draws now, and how long the change to it takes (0: at once, no fade). */
export interface ShownPicture {
  readonly picture: GardenPicture | null;
  readonly transitionMs: number;
}

/**
 * How long each step stays, in milliseconds. Drying is slower than reviving (D26), and the
 * whole walk never goes past `MAX_TRANSITION_MS`: the steps get shorter instead.
 */
export function stepDurations(steps: readonly PictureStep[]): number[] {
  const wanted = steps.map(({ direction }) => STEP_DURATION_MS[direction]);
  const total = wanted.reduce((sum, ms) => sum + ms, 0);
  const scale = total > MAX_TRANSITION_MS ? MAX_TRANSITION_MS / total : 1;
  return wanted.map((ms) => Math.max(MIN_STEP_DURATION_MS, Math.round(ms * scale)));
}

function sameStage(a: GardenPicture, b: GardenPicture): boolean {
  return (
    a.stage.count === b.stage.count &&
    a.stage.foliage === b.stage.foliage &&
    a.stage.water === b.stage.water
  );
}

/**
 * The picture to draw for a target one. It shows the target at once the first time, and when
 * the person asked for reduced motion. When the target changes later, it walks through the
 * pictures between the one on screen and the new one, in order (D26), each fading into the next.
 * A new target during the walk starts again from the picture on screen: nothing makes people
 * wait (motion.md › Providing feedback: let people cancel motion).
 */
export function useGardenPictureSequence(
  target: GardenPicture | null,
  images: GardenImageNames,
): ShownPicture {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState<ShownPicture>({ picture: target, transitionMs: 0 });
  const onScreen = useRef<GardenPicture | null>(target);

  const show = (next: ShownPicture): void => {
    onScreen.current = next.picture;
    setShown(next);
  };

  // The target as a value, so that a new object with the same content does not restart a walk.
  const targetKey = target === null ? 'none' : JSON.stringify(target);

  useEffect(() => {
    const from = onScreen.current;
    if (target === null || from === null || reducedMotion || sameStage(from, target)) {
      // Growth moves the opacity of one layer: it is not a step, and nothing slides.
      show({ picture: target, transitionMs: 0 });
      return undefined;
    }
    const steps = pictureSteps(from.stage, target.stage, images);
    const durations = stepDurations(steps);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = (index: number): void => {
      const step = steps[index];
      const duration = durations[index];
      if (step === undefined || duration === undefined) return;
      const isLast = index === steps.length - 1;
      show({
        picture: isLast ? target : { stage: step.stage, growth: null },
        transitionMs: duration,
      });
      if (!isLast) timer = setTimeout(() => run(index + 1), duration);
    };
    if (steps.length === 0) show({ picture: target, transitionMs: STEP_DURATION_MS.recovery });
    else run(0);
    return () => clearTimeout(timer);
    // The walk depends on the target's content and the setting, not on the identity of `images`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, reducedMotion]);

  return shown;
}
