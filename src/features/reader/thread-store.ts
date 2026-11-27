import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

import { isSameThreadState, type ThreadState } from './page-thread';

/**
 * Where the water thread of each page stands, shared by the reader (which observes the reading)
 * and the threads drawn in the margins (`page-thread-view.tsx`). Each thread listens to its own
 * page: a second of reading redraws one thin line, never the pages of text around it.
 */
export interface ThreadStore {
  /** The thread of a page now. */
  readonly get: (page: number) => ThreadState;
  /** Calls `listener` whenever the thread of `page` changes. Returns the unsubscription. */
  readonly subscribe: (page: number, listener: () => void) => () => void;
  /** Works the threads of every page listened to out again, and tells those that changed. */
  readonly refresh: () => void;
  /** Where the threads come from from now on; they are worked out again. */
  readonly setSource: (stateOf: (page: number) => ThreadState) => void;
}

const EMPTY_THREAD: ThreadState = Object.freeze({ kind: 'filling', share: 0 });

/**
 * A store whose threads come from `stateOf` (empty threads until it is given), worked out again on
 * each `refresh`.
 */
export function createThreadStore(
  initialSource: (page: number) => ThreadState = () => EMPTY_THREAD,
): ThreadStore {
  let stateOf = initialSource;
  const shown = new Map<number, ThreadState>();
  const listeners = new Map<number, Set<() => void>>();

  function get(page: number): ThreadState {
    let state = shown.get(page);
    if (state === undefined) {
      state = stateOf(page);
      shown.set(page, state);
    }
    return state;
  }

  function refresh(): void {
    for (const [page, forPage] of listeners) {
      const before = shown.get(page);
      const now = stateOf(page);
      if (before !== undefined && isSameThreadState(before, now)) continue;
      shown.set(page, now);
      for (const listener of forPage) listener();
    }
  }

  return {
    get,
    refresh,
    setSource(source) {
      stateOf = source;
      refresh();
    },
    subscribe(page, listener) {
      let forPage = listeners.get(page);
      if (forPage === undefined) {
        forPage = new Set();
        listeners.set(page, forPage);
      }
      forPage.add(listener);
      return () => {
        forPage.delete(listener);
        if (forPage.size === 0) {
          listeners.delete(page);
          shown.delete(page);
        }
      };
    },
  };
}

export const ThreadStoreContext = createContext<ThreadStore | null>(null);

/** The thread of a page, from the reader's store; null outside a reader. */
export function useThreadState(page: number): ThreadState | null {
  const store = useContext(ThreadStoreContext);
  const subscribe = useCallback(
    (listener: () => void) => store?.subscribe(page, listener) ?? (() => undefined),
    [page, store],
  );
  return useSyncExternalStore(subscribe, () => store?.get(page) ?? null);
}
