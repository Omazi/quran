/**
 * The one door to the screen check (docs/BUILD.md, "Contrôle des écrans"). The iOS check builds
 * the app with `EXPO_PUBLIC_SCREEN_CHECK=1` so that it can open each screen on its own and fill
 * the app with a made-up history; no other build sets it (TestFlight does not). Expo writes the
 * value of an `EXPO_PUBLIC_` variable into the code, so a bundle built without it loses the
 * branch below, and the launcher with it. The condition must stay written out next to the
 * `require`, or the bundler could not drop it.
 *
 * With the flag off, nothing here reads a launch argument or an address: every answer is "nothing
 * asked".
 */

import type { ComponentType, ReactNode } from 'react';
import { Platform, Settings } from 'react-native';

import type { PagerDrive } from '@/ui';

import { parseCheckLaunch, parseCheckPage, type CheckLaunch } from './parse';

type Launcher = typeof import('./launcher');

const launcher: Launcher | null =
  process.env.EXPO_PUBLIC_SCREEN_CHECK === '1'
    ? // A conditional `require` is the only form the bundler can leave out; it has no type of its own.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./launcher') as Launcher)
    : null;

type AutoRun = typeof import('./auto-run');

const autoRun: AutoRun | null =
  process.env.EXPO_PUBLIC_SCREEN_CHECK === '1'
    ? // Same rule as above: the bundler can only leave out a conditional `require`.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./auto-run') as AutoRun)
    : null;

type VoiceProof = typeof import('./voice-proof');

const voiceProof: VoiceProof | null =
  process.env.EXPO_PUBLIC_SCREEN_CHECK === '1'
    ? // Same rule as above: the bundler can only leave out a conditional `require`.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./voice-proof') as VoiceProof)
    : null;

/** Opens the screen the check asked for; null in every build but the check's. */
export const ScreenCheckLauncher: ComponentType<{ launch: CheckLaunch }> | null =
  launcher?.ScreenCheckLauncher ?? null;

/** What this launch of the app was asked to show; null unless it is the check's build. */
export const screenCheckLaunch: CheckLaunch | null = readLaunch();

/**
 * What swipes the introduction by itself (`-screenCheckAutoSwipe 1`): given to the pager as its
 * driver. Null in every build but the check's, and in the check's own unless asked.
 */
export const screenCheckPagerDriver: ((drive: PagerDrive) => ReactNode) | null =
  autoRun !== null && screenCheckLaunch?.autoSwipe === true ? autoRun.pagerDriver : null;

/** The whole automatic run (swipe, friend page, garden), mounted once at the root; same rule. */
export const ScreenCheckAutoRun: ComponentType | null =
  autoRun !== null && screenCheckLaunch?.autoSwipe === true ? autoRun.ScreenCheckAutoRun : null;

/**
 * The voice proof (`-screenCheckVoiceProof 1`): recordings played to the real speech engine, what
 * it recognised written to a file. Null in every build but the check's, and in the check's own
 * unless asked.
 */
export const ScreenCheckVoiceProof: ComponentType | null =
  voiceProof !== null && screenCheckLaunch?.voiceProof === true
    ? voiceProof.ScreenCheckVoiceProof
    : null;

function readLaunch(): CheckLaunch | null {
  if (launcher === null || Platform.OS !== 'ios') return null;
  return parseCheckLaunch((argument) => Settings.get(argument), true);
}

/** The introduction's page asked by `?page=N` (1-based); null when the flag is off. */
export function screenCheckPage(raw: unknown, pageCount: number): number | null {
  return parseCheckPage(raw, launcher !== null, pageCount);
}
