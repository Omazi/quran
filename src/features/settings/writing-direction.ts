/**
 * Writing direction: Arabic is written from right to left, which mirrors the whole interface.
 *
 * React Native decides the direction when the app starts and keeps it until the app stops:
 * `I18nManager.isRTL` is a constant read at launch, and `I18nManager.forceRTL` only takes effect
 * "on the next app reload". So a change of direction is never instant. This file records the
 * direction for the next start and restarts the app when that is the right thing to do; it never
 * pretends the interface was mirrored when it was not.
 */

import { reloadAppAsync } from 'expo';
import { I18nManager } from 'react-native';

import { isRightToLeftLanguage, type AppLanguage } from '@/i18n';
import type { KeyValueStorage } from '@/store';

/** What changing the direction needs from the platform. */
export interface WritingDirectionPlatform {
  /** Whether the running app is laid out from right to left. On a phone this is fixed at launch. */
  isRightToLeft: () => boolean;
  /** Records the direction the app will take the next time it starts. */
  setRightToLeft: (rightToLeft: boolean) => void;
  /** Starts the app again, which applies the recorded direction. */
  restart: () => Promise<void>;
}

/** The writing direction of the phone, through React Native and Expo. */
export const deviceWritingDirection: WritingDirectionPlatform = {
  isRightToLeft: () => I18nManager.isRTL,
  setRightToLeft: (rightToLeft) => {
    // Both are needed. `forceRTL` alone cannot bring back left to right on a device set to an
    // Arabic language, and `allowRTL` alone cannot mirror the app on a device set to French.
    I18nManager.allowRTL(rightToLeft);
    I18nManager.forceRTL(rightToLeft);
  },
  restart: () => reloadAppAsync('The writing direction changed'),
};

/** Whether the running app is already laid out the way a language is written. */
export function isLaidOutFor(language: AppLanguage, platform: WritingDirectionPlatform): boolean {
  return platform.isRightToLeft() === isRightToLeftLanguage(language);
}

/**
 * Records the direction of a language the person has just chosen. Returns true when the running
 * app already has that direction, false when it will only have it after a restart.
 */
export function chooseDirectionFor(
  language: AppLanguage,
  platform: WritingDirectionPlatform,
): boolean {
  // Recorded even when nothing changes on screen: it also cancels a change recorded earlier.
  platform.setRightToLeft(isRightToLeftLanguage(language));
  return isLaidOutFor(language, platform);
}

/** The key under which the direction of the last automatic restart is remembered. */
export const DIRECTION_RESTART_KEY = 'writing-direction-restart';

/** How long a restart may take. An app still running after that has not restarted. */
export const RESTART_GRACE_MS = 3000;

export interface DirectionAtStartupDependencies {
  readonly platform: WritingDirectionPlatform;
  readonly storage: KeyValueStorage;
  /** Resolves after the given time. */
  readonly wait: (milliseconds: number) => Promise<void>;
}

/**
 * At start-up, gives the app the direction of its language. When the two differ (the first launch
 * on a phone set to Arabic, for instance), the app restarts itself once, before showing anything.
 *
 * Returns true when the app is laid out for the language. It returns false only if a restart did
 * not happen or did not help: the direction asked for is remembered, so the app never restarts
 * twice for the same thing, and it then runs in the direction it has.
 */
export async function alignDirectionAtStartup(
  language: AppLanguage,
  { platform, storage, wait }: DirectionAtStartupDependencies,
): Promise<boolean> {
  const wanted = isRightToLeftLanguage(language) ? 'rtl' : 'ltr';
  try {
    const lastRestart = await storage.getItem(DIRECTION_RESTART_KEY);

    if (isLaidOutFor(language, platform)) {
      if (lastRestart !== null) await storage.removeItem(DIRECTION_RESTART_KEY);
      return true;
    }
    // Some platforms apply the direction at once.
    if (chooseDirectionFor(language, platform)) return true;
    if (lastRestart === wanted) return false;

    await storage.setItem(DIRECTION_RESTART_KEY, wanted);
  } catch (error) {
    // Without a memory of the last restart, restarting could repeat for ever: the app keeps the
    // direction it has, and the direction recorded above applies at its next start.
    console.warn('The writing direction could not be remembered.', error);
    return isLaidOutFor(language, platform);
  }
  try {
    await platform.restart();
    // The app normally stops here. If it is still running after the wait, it did not restart.
    await wait(RESTART_GRACE_MS);
  } catch (error) {
    console.warn('The app could not restart to change its writing direction.', error);
  }
  return false;
}
