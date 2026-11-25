/**
 * The one door to the preview of the statistics (`dev-preview/`), like the home screen's
 * (`src/features/home/state-preview.ts`): open in development and in a test build made with
 * `EXPO_PUBLIC_STATE_PREVIEW=1`, absent from the published bundle. The condition stays written
 * next to the `require`, so the bundler can drop the branch.
 */

import type { ComponentType } from 'react';

import type { StatsSource } from './stats-source';

type Preview = typeof import('./dev-preview/stats-preview');

const preview: Preview | null =
  __DEV__ || process.env.EXPO_PUBLIC_STATE_PREVIEW === '1'
    ? // A conditional `require` is the only form the bundler can leave out; it has no type of its own.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./dev-preview/stats-preview') as Preview)
    : null;

/** The last section of the profile where the preview exists; null everywhere else. */
export const StatsPreviewSection: ComponentType | null = preview?.StatsPreviewSection ?? null;

/** The person's journal and time, unless the preview exists and an example is chosen in it. */
export const usePreviewedStatsSource: (source: StatsSource) => StatsSource =
  preview?.usePreviewedStatsSource ?? ((source) => source);
