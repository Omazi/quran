import { useCallback, useEffect, useRef, useState } from 'react';

import { hasLaunchPlayed, markLaunchPlayed } from './launch-session';
import { fadeOutDuration, settledAt, type LaunchMotion } from './launch-timeline';

export type LaunchPhase = 'playing' | 'leaving';

export interface UseLaunchOptions {
  /** The first screen can be shown: fonts loaded, settings read. */
  isReady: boolean;
  /** Hides the native launch screen. Called once, when the overlay has taken its place. */
  hideSplash: () => void;
  /** Whether the device asks for reduced motion. Asked once, before anything moves. */
  readReducedMotion: () => Promise<boolean>;
  /** The overlay is never shown: the iOS check's pictures of each screen (docs/BUILD.md). */
  isSkipped?: boolean;
}

export interface LaunchState {
  /** The overlay is on screen (mounted), from the first frame until its fade-out ends. */
  isShown: boolean;
  phase: LaunchPhase;
  /** Null until the device has answered: nothing is drawn but the water before that. */
  motion: LaunchMotion | null;
  /** To call when the overlay has laid out its first frame. */
  onLayout: () => void;
}

/**
 * Drives the launch overlay: it takes over from the native launch screen (same colour, so there
 * is nothing to see), plays the animation once, waits for the app to be ready, fades out, and
 * is gone for the rest of the run. The animation itself lives in `LaunchOverlay`; this decides
 * only when each part starts, so that its timing is testable without a screen.
 */
export function useLaunch({
  isReady,
  hideSplash,
  readReducedMotion,
  isSkipped = false,
}: UseLaunchOptions): LaunchState {
  // Decided once: an overlay that is already gone must not come back when the layout renders.
  const [isShown, setIsShown] = useState(() => !isSkipped && !hasLaunchPlayed());
  const [isLaidOut, setIsLaidOut] = useState(false);
  const [motion, setMotion] = useState<LaunchMotion | null>(null);
  const [isSettled, setIsSettled] = useState(false);
  const hasHiddenSplash = useRef(false);

  const hideSplashOnce = useCallback(() => {
    if (hasHiddenSplash.current) return;
    hasHiddenSplash.current = true;
    hideSplash();
  }, [hideSplash]);

  // Reduce Motion is read once, at the start, before the mark moves. A device that cannot tell
  // is treated as "motion allowed", as the rest of the app does (device-settings.ts).
  useEffect(() => {
    if (!isShown) return;
    let isCurrent = true;
    readReducedMotion().then(
      (reduced) => {
        if (isCurrent) setMotion(reduced ? 'reduced' : 'full');
      },
      () => {
        if (isCurrent) setMotion('full');
      },
    );
    return () => {
      isCurrent = false;
    };
    // Asked once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLayout = useCallback(() => {
    setIsLaidOut(true);
    hideSplashOnce();
  }, [hideSplashOnce]);

  // The native launch screen never outlives the app being ready, whatever happens to the overlay.
  useEffect(() => {
    if (isReady) hideSplashOnce();
  }, [isReady, hideSplashOnce]);

  const isPlaying = isShown && isLaidOut && motion !== null;
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => setIsSettled(true), settledAt(motion));
    return () => clearTimeout(timer);
  }, [isPlaying, motion]);

  const shouldLeave = isPlaying && isSettled && isReady;
  useEffect(() => {
    if (!shouldLeave) return;
    const timer = setTimeout(() => {
      markLaunchPlayed();
      setIsShown(false);
    }, fadeOutDuration(motion));
    return () => clearTimeout(timer);
  }, [shouldLeave, motion]);

  const phase: LaunchPhase = shouldLeave ? 'leaving' : 'playing';
  return { isShown, phase, motion, onLayout };
}
