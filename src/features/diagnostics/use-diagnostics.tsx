import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

import type { Diagnostics, DiagnosticsSnapshot } from './diagnostics';

const DiagnosticsContext = createContext<Diagnostics | null>(null);

/** Gives the screens below it the diagnostics the app started (the root layout does). */
export function DiagnosticsProvider({
  diagnostics,
  children,
}: {
  diagnostics: Diagnostics;
  children: ReactNode;
}) {
  return <DiagnosticsContext.Provider value={diagnostics}>{children}</DiagnosticsContext.Provider>;
}

/** The diagnostics, or null outside the app's root (a screen then shows nothing about them). */
export function useDiagnostics(): Diagnostics | null {
  return useContext(DiagnosticsContext);
}

const EMPTY: DiagnosticsSnapshot = { previous: null, isSheetOpen: false };
const noSubscription = () => () => {};

/** The last record and whether its sheet is open. */
export function useDiagnosticsSnapshot(diagnostics: Diagnostics | null): DiagnosticsSnapshot {
  return useSyncExternalStore(
    diagnostics === null ? noSubscription : diagnostics.subscribe,
    diagnostics === null ? () => EMPTY : diagnostics.getSnapshot,
  );
}
