import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAppStore, type ForegroundTime } from '@/store';

import { PROFILE_STATS_CONFIG } from './config';
import { createForegroundTimeRecorder } from './foreground-time';
import { isReaderOpen, subscribeToReaderPresence } from './reader-presence';

export interface ForegroundTimeClocks {
  /** Defaults to `performance.now`. */
  readonly monotonicClock?: () => number;
  /** Defaults to the device clock. */
  readonly clock?: () => Date;
}

const systemMonotonicClock = () => performance.now();
const systemClock = () => new Date();

/**
 * Records the time spent in the app, and in the reader, for as long as it is mounted: once, at
 * the root of the app. The store receives a batch every minute and when the app goes to the
 * background (D37), and what is left when it stops.
 */
export function useForegroundTimeRecording({
  monotonicClock = systemMonotonicClock,
  clock = systemClock,
}: ForegroundTimeClocks = {}): void {
  const addForegroundTime = useAppStore((state) => state.addForegroundTime);
  const latestAdd = useRef(addForegroundTime);
  useEffect(() => {
    latestAdd.current = addForegroundTime;
  });

  useEffect(() => {
    const record = (time: ForegroundTime) => {
      try {
        latestAdd.current(time);
      } catch (error) {
        // A clock far off: the time is not counted, the app goes on.
        console.error('Foreground time could not be recorded.', error);
      }
    };
    const recorder = createForegroundTimeRecorder({
      monotonicClock,
      clock,
      record,
      isForeground: AppState.currentState === 'active',
    });
    recorder.setReaderOpen(isReaderOpen());
    const stopListening = subscribeToReaderPresence(recorder.setReaderOpen);
    const subscription = AppState.addEventListener('change', (state) => {
      recorder.setForeground(state === 'active');
    });
    const timer = setInterval(recorder.flush, PROFILE_STATS_CONFIG.foregroundFlushIntervalMs);
    return () => {
      clearInterval(timer);
      subscription.remove();
      stopListening();
      recorder.flush();
    };
  }, [monotonicClock, clock]);
}
