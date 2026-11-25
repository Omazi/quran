import { useEffect, useState } from 'react';

/** What a screen shows while its data comes: nothing yet, the data, or what went wrong. */
export type AsyncState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'failed'; readonly error: unknown };

/**
 * Runs `load` and keeps its result. It runs again when a dependency changes (the social store's
 * version after an action, the period of a leaderboard). An answer that arrives after a newer
 * request is dropped, so the screen never goes back to older data.
 */
export function useAsync<T>(
  load: () => Promise<T>,
  dependencies: readonly unknown[],
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  useEffect(() => {
    let isCurrent = true;
    load().then(
      (value) => {
        if (isCurrent) setState({ status: 'ready', value });
      },
      (error: unknown) => {
        if (isCurrent) setState({ status: 'failed', error });
      },
    );
    return () => {
      isCurrent = false;
    };
    // The caller names what `load` depends on, as for `useEffect`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  return state;
}
