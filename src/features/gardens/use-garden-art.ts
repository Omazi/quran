import { useEffect, useState } from 'react';

import { loadGardenArtFiles, type GardenArtFiles } from '@/data/garden-art';
import type { GardenStyleId } from '@/domain/levels';
import {
  LEVEL_1_ART,
  packedGardenArt,
  type GardenArt,
  type GardenSceneTint,
} from '@/features/garden';

import { packLevelOf } from './garden-style-art';
import { useGardenTint } from './use-garden-tint';

/**
 * What draws a garden style now: its own art once its pack is on the device, the level-1 pictures
 * with the style's colour cast until then (`loading`), or for good when the pack cannot be had
 * (`unavailable`: offline, a server down, a file that failed its check; tried again next time).
 */
export interface StyleArt {
  readonly art: GardenArt;
  readonly tint: GardenSceneTint | null;
  readonly status: 'ready' | 'loading' | 'unavailable';
}

/**
 * The art of `styleId` (null: the level-1 garden, e.g. a friend who hides their level). The pack
 * of a level garden is downloaded the first time a screen shows it, once for the whole app.
 */
export function useGardenArt(
  styleId: GardenStyleId | null,
  {
    appearance,
    load = loadGardenArtFiles,
  }: {
    /** Fixes the placeholder's appearance (a picture that is always light). */
    appearance?: 'light' | 'dark';
    load?: (level: number) => Promise<GardenArtFiles>;
  } = {},
): StyleArt {
  const level = styleId === null ? null : packLevelOf(styleId);
  const tint = useGardenTint(styleId ?? 'fountain-courtyard', appearance);
  const [loaded, setLoaded] = useState<{ level: number; art: GardenArt | null } | null>(null);

  useEffect(() => {
    if (level === null) return undefined;
    let isCurrent = true;
    load(level).then(
      (files) => {
        if (isCurrent) setLoaded({ level, art: packedGardenArt(files) });
      },
      (error: unknown) => {
        console.warn(
          `The garden of level ${level} is not available; its placeholder stays.`,
          error,
        );
        if (isCurrent) setLoaded({ level, art: null });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [level, load]);

  if (level === null) return { art: LEVEL_1_ART, tint: null, status: 'ready' };
  if (loaded?.level !== level) return { art: LEVEL_1_ART, tint, status: 'loading' };
  if (loaded.art === null) return { art: LEVEL_1_ART, tint, status: 'unavailable' };
  return { art: loaded.art, tint: null, status: 'ready' };
}
