import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import { createDeviceSync, type SyncClock, type SyncEngine, type SyncSession } from '@/data/sync';
import type { AppStore } from '@/store';

export interface AppSyncDependencies {
  readonly clock: SyncClock;
  /** The real sign-in, or null while it does not exist (the sync then stays off). */
  readonly session: SyncSession | null;
  /** Builds the engine. Defaults to the device's (Supabase when the build is configured). */
  readonly createEngine?: typeof createDeviceSync;
}

/**
 * Starts the sync once the store is loaded, for the life of the app: it follows the changes of
 * the phone, and the app coming to the foreground or leaving it. `dependencies` must not change
 * between renders. Null until the store exists.
 */
export function useAppSync(
  store: AppStore | null,
  { clock, session, createEngine = createDeviceSync }: AppSyncDependencies,
): SyncEngine | null {
  // Building the engine starts nothing: the effect below starts it, and stops it when it goes.
  const engine = useMemo(
    () => (store === null ? null : createEngine({ store, clock, session })),
    [store, clock, session, createEngine],
  );

  useEffect(() => {
    if (engine === null) return;
    engine.start();
    engine.setActive(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      engine.setActive(state === 'active');
    });
    return () => {
      subscription.remove();
      engine.stop();
    };
  }, [engine]);

  return engine;
}
