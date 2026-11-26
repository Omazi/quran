import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand/react';

import type { AppStore } from './app-store';
import type { AppState } from './types';

const AppStoreContext = createContext<AppStore | null>(null);

export interface AppStoreProviderProps {
  /** A store already loaded from the device (`loadAppStore`). */
  store: AppStore;
  children: ReactNode;
}

/** Gives the screens below it the store of the app. */
export function AppStoreProvider({ store, children }: AppStoreProviderProps) {
  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}

/**
 * Reads a value of the store, or one of its actions, and renders again when it changes. Select a
 * stored value or an action, not a new object: a selector that builds an object renders forever.
 */
export function useAppStore<Selected>(selector: (state: AppState) => Selected): Selected {
  const store = useContext(AppStoreContext);
  if (store === null) {
    throw new Error('useAppStore must be used below an AppStoreProvider.');
  }
  return useStore(store, selector);
}

/**
 * The store itself, for the rare code that must change many values in one write or wait for the
 * device to hold them (the iOS check's demonstration history). A screen reads through
 * `useAppStore` and changes through the actions.
 */
export function useAppStoreApi(): AppStore {
  const store = useContext(AppStoreContext);
  if (store === null) {
    throw new Error('useAppStoreApi must be used below an AppStoreProvider.');
  }
  return store;
}
