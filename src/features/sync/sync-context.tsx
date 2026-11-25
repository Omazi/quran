import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type { SyncEngine, SyncStatus } from '@/data/sync';

/** What the screens need of the sync: where it stands, and being told when that changes. */
export type SyncStatusSource = Pick<SyncEngine, 'getStatus' | 'subscribe'>;

const LOCAL_ONLY: SyncStatus = { state: 'local-only' };

const SyncContext = createContext<SyncStatusSource | null>(null);

export interface SyncProviderProps {
  readonly source: SyncStatusSource | null;
  readonly children: ReactNode;
}

/** Gives the screens below it the sync of the app. */
export function SyncProvider({ source, children }: SyncProviderProps) {
  return <SyncContext.Provider value={source}>{children}</SyncContext.Provider>;
}

const noSubscription = () => () => {};
const localOnly = () => LOCAL_ONLY;

/** Where the sync stands; "on this phone only" when there is no sync above. */
export function useSyncStatus(): SyncStatus {
  const source = useContext(SyncContext);
  return useSyncExternalStore(
    source?.subscribe ?? noSubscription,
    source?.getStatus ?? localOnly,
    source?.getStatus ?? localOnly,
  );
}

/** The clock, read again every `intervalMs` while mounted: "il y a 2 min" moves on by itself. */
export function useNow(intervalMs: number, clock: () => number = Date.now): number {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const timer = setInterval(() => setNow(clock()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, clock]);
  return now;
}
