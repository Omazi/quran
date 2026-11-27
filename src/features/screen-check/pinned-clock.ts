/**
 * The hour of the check's photographs (`-screenCheckHour`, docs/BUILD.md, "Contrôle des écrans").
 * Kept apart from `door.ts` because the home screen and the reader read it, and the door's
 * launcher imports the home screen: this module imports nothing of the app. The flag is written
 * out here for the bundler, as in `door.ts`: a build made without it loses the branch.
 */

import { Platform, Settings } from 'react-native';

import { CHECK_ARGUMENTS, parseCheckHour, pinnedClock } from './parse';

function readClock(): (() => Date) | null {
  if (process.env.EXPO_PUBLIC_SCREEN_CHECK !== '1' || Platform.OS !== 'ios') return null;
  const minutes = parseCheckHour(Settings.get(CHECK_ARGUMENTS.hour), true);
  return minutes === null ? null : pinnedClock(minutes);
}

/** A clock pinned to the hour the check asked for; null in every other case (the real clock). */
export const screenCheckClock: (() => Date) | null = readClock();
