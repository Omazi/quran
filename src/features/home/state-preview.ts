/**
 * The one door to the preview of the garden's states (`dev-preview/`), which lets a person
 * choose which state the home screen shows before the reader exists.
 *
 * The door is open in development (`__DEV__`) and in a build made with the variable
 * `EXPO_PUBLIC_STATE_PREVIEW=1`: a test build sets it, the published build does not
 * (docs/BUILD.md). Both conditions are known when the bundle is built: Expo writes the value of an
 * `EXPO_PUBLIC_` variable into the code, so a bundle built without it loses the whole branch
 * below, and the preview module with it. The condition must stay written out here, next to the
 * `require`: moved behind a function or another module, the bundler could no longer drop it.
 *
 * Behind a closed door the home screen shows the person's data as it is, and nothing else.
 */

import type { LocalDate } from '@/domain/shared/local-date';

import type { HomeSource } from './home-model';

type Preview = typeof import('./dev-preview/dev-preview');

const preview: Preview | null =
  __DEV__ || process.env.EXPO_PUBLIC_STATE_PREVIEW === '1'
    ? // A conditional `require` is the only form the bundler can leave out; it has no type of its own.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./dev-preview/dev-preview') as Preview)
    : null;

/** True where the preview exists (development, test builds); false in a published build. */
export const isStatePreviewAvailable = preview !== null;

type Handle = import('./dev-preview/dev-preview').StatePreviewHandle;
const NO_PREVIEW: Handle = { open: () => undefined, hint: '', sheet: null };

/**
 * The preview as a sheet opened by a long-press on the home screen's date. Where the door is
 * closed it offers nothing: no trigger (`isStatePreviewAvailable`), no sheet. Where it is open,
 * nothing of it is drawn over the garden until the long-press (screen-check photos stay clean).
 */
export const useStatePreviewSheet: () => Handle =
  preview?.useStatePreviewSheet ?? (() => NO_PREVIEW);

/**
 * What the home screen shows: the person's data, unless the preview exists and a made-up
 * history is chosen in it. Without the preview, the data as it is.
 */
export const usePreviewedSource: (source: HomeSource, today: LocalDate) => HomeSource =
  preview?.usePreviewedSource ?? ((source) => source);
