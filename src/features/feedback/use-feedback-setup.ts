import { useEffect } from 'react';
import { AppState } from 'react-native';

import { appSuppression, deviceFeedback } from '@/data/feedback';
import type { AppStore } from '@/store';

import { startFeedback } from './start-feedback';

/**
 * Starts the feedback with the app (the root layout calls it once, with the loaded store, or null
 * while the app starts): the two switches, the sounds loaded in advance, the silence in the
 * background.
 */
export function useFeedbackSetup(store: AppStore | null): void {
  useEffect(() => {
    if (store === null) return undefined;
    return startFeedback({
      store,
      service: deviceFeedback,
      suppression: appSuppression,
      appState: AppState,
    });
  }, [store]);
}
