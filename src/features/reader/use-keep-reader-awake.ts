import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { AppState } from 'react-native';

/** The reader's own lock, so that another screen's lock is never released by the reader. */
export const READER_KEEP_AWAKE_TAG = 'reader';

/**
 * Keeps the screen awake while the reader is open and the app in the foreground (owner's decision,
 * 25 November 2026): a person reading does not touch the screen for a while, and a phone that
 * locks in the middle of a page interrupts the reading. The lock is released when the app leaves
 * the foreground and when the reader closes. A device that cannot keep the screen awake (some web
 * browsers) simply reads as before.
 */
export function useKeepReaderAwake(): void {
  useEffect(() => {
    let isHeld = false;
    const hold = (wanted: boolean) => {
      if (wanted === isHeld) return;
      isHeld = wanted;
      Promise.resolve()
        .then(() =>
          wanted
            ? activateKeepAwakeAsync(READER_KEEP_AWAKE_TAG)
            : deactivateKeepAwake(READER_KEEP_AWAKE_TAG),
        )
        .catch((error: unknown) => console.warn('The screen could not be kept awake.', error));
    };
    hold(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => hold(state === 'active'));
    return () => {
      subscription.remove();
      hold(false);
    };
  }, []);
}
