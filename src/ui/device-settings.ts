/**
 * Accessibility settings of the device that the app must follow by itself.
 *
 * Each setting is asked once and listened to once for the whole app, however many components
 * read it. Until the device has answered, a setting is off; after that the last known value is
 * kept, also while nothing is listening.
 */

import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

type Listener = () => void;

interface DeviceSetting {
  /** False on the platforms where React Native cannot tell: the setting then stays off. */
  isExposed: () => boolean;
  query: () => Promise<boolean>;
  changeEvent: 'highTextContrastChanged' | 'reduceMotionChanged' | 'reduceTransparencyChanged';
}

function createSettingHook({ isExposed, query, changeEvent }: DeviceSetting): () => boolean {
  let isOn = false;
  const listeners = new Set<Listener>();
  /** Stops listening to the device. Defined while at least one component is subscribed. */
  let stopWatching: (() => void) | undefined;

  function set(next: boolean): void {
    if (next === isOn) return;
    isOn = next;
    for (const listener of listeners) listener();
  }

  function startWatching(): () => void {
    let isWatching = true;
    query().then(
      (answer) => {
        if (isWatching) set(answer);
      },
      () => {
        // The device cannot tell: the value stays what it was, off if it was never known.
      },
    );
    const subscription = AccessibilityInfo.addEventListener(changeEvent, set);
    return () => {
      isWatching = false;
      subscription.remove();
    };
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    if (isExposed()) stopWatching ??= startWatching();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        stopWatching?.();
        stopWatching = undefined;
      }
    };
  }

  return function useDeviceSetting(): boolean {
    return useSyncExternalStore(subscribe, () => isOn);
  };
}

/**
 * True when the person asked for more contrast and the system leaves the choice to the app.
 *
 * - iOS: never. A dynamic colour carries its high-contrast values and the system chooses them
 *   when Increase Contrast is on.
 * - Android: React Native exposes one setting, "high contrast text", and its changes. It does
 *   not expose the system's contrast level.
 * - Web: React Native exposes nothing, so the standard values stay.
 */
export const useHighContrast = createSettingHook({
  isExposed: () => Platform.OS === 'android',
  query: () => AccessibilityInfo.isHighTextContrastEnabled(),
  changeEvent: 'highTextContrastChanged',
});

/**
 * True when the person asked the device to reduce motion: Reduce Motion on iOS, "remove
 * animations" on Android, `prefers-reduced-motion` on the web. Anything the app animates by
 * itself must then appear without moving (accessibility.md › Cognitive; motion.md › Best
 * practices: make motion optional); the system's own components already do.
 */
export const useReducedMotion = createSettingHook({
  isExposed: () => true,
  query: () => AccessibilityInfo.isReduceMotionEnabled(),
  changeEvent: 'reduceMotionChanged',
});

/**
 * True when the person asked iOS to reduce transparency: what the app draws as glass by itself
 * becomes opaque (liquid-glass.md › Review checklist, item 5). The system's own glass already
 * does. React Native exposes the setting on iOS only; elsewhere it stays off.
 */
export const useReducedTransparency = createSettingHook({
  isExposed: () => Platform.OS === 'ios',
  query: () => AccessibilityInfo.isReduceTransparencyEnabled(),
  changeEvent: 'reduceTransparencyChanged',
});
