import { useEffect, useRef, useState } from 'react';

import type { GardenState } from '@/domain/garden';
import type { KeyValueStorage } from '@/store';

import {
  growingTarget,
  growthSegments,
  lastShownGrowth,
  readGrowthMemory,
  rememberGrowth,
  shownGrowth,
  writeGrowthMemory,
  type GrowthMemory,
  type GrowthSegment,
} from '../growth-motion';
import type { ShownGrowthFrame } from './growth-player';

/** Where the growth last shown of each plant is kept, so that each growth plays once. */
export const GROWTH_MEMORY_KEY = 'garden-growth-shown';

/** What shows the growth: the 3D garden (`GardenSurface`). */
export interface GrowthSink {
  setGrowth(growth: ShownGrowthFrame | null): void;
  playGrowth(segments: readonly GrowthSegment[]): void;
}

export interface GrowthPlaybackOptions {
  /**
   * The person's own garden: the growth since it was last shown plays once, and is remembered.
   * Otherwise (a friend's garden) the growth is shown as it is.
   */
  readonly remembers: boolean;
  /** The screen is in front (not under the reader): a growth waits for it. */
  readonly isActive: boolean;
  /** The 3D garden has drawn its first frame: a growth waits to be seen. */
  readonly isReady: boolean;
  /** Reduce Motion: the plant is shown at its growth, without the animation. */
  readonly isMotionReduced: boolean;
  /** Tests give one; the app uses the device's storage. */
  readonly storage?: KeyValueStorage | null;
}

function deviceStorageOrNull(): KeyValueStorage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('@/data/storage') as typeof import('@/data/storage')).deviceStorage;
  } catch {
    return null;
  }
}

/**
 * The growth of the plant of the hizb in progress, on the 3D garden (owner, 25 November 2026):
 * when the garden is shown after some reading (the home screen in front again, back from the
 * reader), the plant grows from the growth last shown to its growth now, once; the growth shown
 * is then kept on the device. Without a memory (a friend's garden, or no storage) the plant is
 * shown at its growth.
 */
export function useGrowthPlayback(
  sink: GrowthSink,
  state: GardenState,
  options: GrowthPlaybackOptions,
): void {
  const { remembers, isActive, isReady, isMotionReduced } = options;
  const [storage] = useState(() =>
    options.storage !== undefined ? options.storage : remembers ? deviceStorageOrNull() : null,
  );
  // What was shown, once the storage has answered: kept in a ref, so that remembering a growth
  // does not render again.
  const memory = useRef<GrowthMemory>(readGrowthMemory(null));
  const [isLoaded, setLoaded] = useState(storage === null);

  useEffect(() => {
    if (storage === null) return undefined;
    let isCurrent = true;
    storage.getItem(GROWTH_MEMORY_KEY).then(
      (text) => {
        if (!isCurrent) return;
        memory.current = readGrowthMemory(text);
        setLoaded(true);
      },
      // A storage that cannot answer: as if nothing had ever been shown.
      () => {
        if (isCurrent) setLoaded(true);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [storage]);

  const target = growingTarget(state);
  const targetKey = target === null ? 'none' : `${target.plant}@${target.growth}`;

  useEffect(() => {
    if (target === null) {
      sink.setGrowth(null);
      return;
    }
    const still: ShownGrowthFrame = { hizb: target.hizb, growth: target.growth };
    if (!remembers || storage === null) {
      sink.setGrowth(still);
      return;
    }
    // Nothing grows on screen until the memory says from where.
    if (!isLoaded) {
      sink.setGrowth(null);
      return;
    }
    const same = shownGrowth(memory.current, target.plant);
    const previous =
      same === null ? lastShownGrowth(memory.current) : { plant: target.plant, growth: same };
    const segments = growthSegments(previous, target);
    if (segments.length === 0) {
      sink.setGrowth(still);
      return;
    }
    const first = segments[0] as GrowthSegment;
    if (!isActive || !isReady) {
      // Where the growth will start from, until it can be seen.
      sink.setGrowth({ hizb: first.hizb, growth: first.from });
      return;
    }
    if (isMotionReduced) sink.setGrowth(still);
    else sink.playGrowth(segments);
    memory.current = rememberGrowth(memory.current, target.plant, target.growth);
    storage.setItem(GROWTH_MEMORY_KEY, writeGrowthMemory(memory.current)).catch(() => undefined);
    // The target as a value: a new state object with the same plant and growth changes nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, isLoaded, isActive, isReady, isMotionReduced, remembers, storage, sink]);
}
