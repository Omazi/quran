/**
 * The one door to the preview of the garden's states (`dev-preview/`), which lets a person
 * choose which state the home screen shows before the reader exists.
 *
 * The door is open in development (`__DEV__`) and in a build made with the variable
 * `EXPO_PUBLIC_STATE_PREVIEW=1`: the `testflight` build profile sets it, the `production` profile
 * does not. Both conditions are known when the bundle is built: Expo writes the value of an
 * `EXPO_PUBLIC_` variable into the code, so a bundle built without it loses the whole branch
 * below, and the preview module with it. The condition must stay written out here, next to the
 * `require`: moved behind a function or another module, the bundler could no longer drop it.
 *
 * Behind a closed door the home screen shows the person's data as it is, and nothing else.
 */

import type { ComponentType } from 'react';

import type { LocalDate } from '@/domain/shared/local-date';

import type { HomeSource } from './home-model';

type Preview = typeof import('./dev-preview/dev-preview');

const preview: Preview | null =
  __DEV__ || process.env.EXPO_PUBLIC_STATE_PREVIEW === '1'
    ? // A conditional `require` is the only form the bundler can leave out; it has no type of its own.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./dev-preview/dev-preview') as Preview)
    : null;

/** The last section of the home screen where the preview exists; null everywhere else. */
export const StatePreviewSection: ComponentType | null = preview?.DevPreviewSection ?? null;

/**
 * What the home screen shows: the person's data, unless the preview exists and a made-up
 * history is chosen in it. Without the preview, the data as it is.
 */
export const usePreviewedSource: (source: HomeSource, today: LocalDate) => HomeSource =
  preview?.usePreviewedSource ?? ((source) => source);
