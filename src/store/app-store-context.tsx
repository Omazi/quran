import { createContext, useContext, type ReactNode } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
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

/** What `useOptionalAppStore` reads when there is no store: nothing. */
const NO_STORE: StoreApi<AppState | null> = createStore<AppState | null>(() => null);

/**
 * Like `useAppStore`, for words and screens that must also work outside the app's store (the
 * pages of the Proches tab rendered on their own): without a store it gives `fallback`.
 */
export function useOptionalAppStore<Selected, Fallback>(
  selector: (state: AppState) => Selected,
  fallback: Fallback,
): Selected | Fallback {
  const store = useContext(AppStoreContext);
  // `AppStore` is a `StoreApi<AppState>`: read as a store that may hold nothing, it is only read.
  const readable = (store ?? NO_STORE) as StoreApi<AppState | null>;
  return useStore(readable, (state) => (state === null ? fallback : selector(state)));
}
