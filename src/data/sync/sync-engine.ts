import {
  SYNC_CONFIG,
  SyncBackendError,
  nextRetryDelay,
  type SyncBackend,
  type SyncEvent,
  type SyncFailure,
} from '@/domain/sync';
import type { AppStore } from '@/store';

import { createSyncClock, type SyncClock } from './sync-clock';

/**
 * Where the sync stands, for the settings row (docs/specs/sync.md, 5). The progress is always
 * saved on the phone first; this only says whether the account has it too.
 */
export type SyncStatus =
  /** No server configured, or nobody signed in: the progress is on this phone only. */
  | { readonly state: 'local-only' }
  | { readonly state: 'syncing'; readonly lastSyncedAt: number | null }
  | { readonly state: 'synced'; readonly lastSyncedAt: number }
  /** No network: changes wait on the phone and go when it comes back. */
  | { readonly state: 'offline'; readonly lastSyncedAt: number | null; readonly pending: number }
  /** The server could not take them now: the app tries again by itself. */
  | { readonly state: 'waiting'; readonly lastSyncedAt: number | null; readonly pending: number };

export interface SyncEngineOptions {
  readonly store: AppStore;
  /** The account's server, or null while there is none (no project configured). */
  readonly backend: SyncBackend | null;
  /** The signed-in person's account id, or null. Sync only starts after the sign-in. */
  readonly getAccount: () => Promise<string | null>;
  /** The corrected clock, shared with the store's stamps. */
  readonly clock?: SyncClock;
  /** A number from 0 to 1, to spread the retries. Defaults to `Math.random`. */
  readonly random?: () => number;
  readonly setTimer?: (run: () => void, ms: number) => unknown;
  readonly clearTimer?: (timer: unknown) => void;
}

export interface SyncEngine {
  /** Syncs once now, and follows the changes of the phone from now on. */
  start: () => void;
  /** Stops following changes and cancels every timer. */
  stop: () => void;
  /** The app came to the foreground (true) or left it (false). */
  setActive: (active: boolean) => void;
  /** Syncs now; resolves once done (or failed: it never rejects). */
  syncNow: () => Promise<void>;
  getStatus: () => SyncStatus;
  /** Calls `listener` at each change of status; returns how to stop. */
  subscribe: (listener: (status: SyncStatus) => void) => () => void;
}

/** The most requests of one kind in one sync: far above any real need, a guard against loops. */
const MAX_REQUESTS_PER_SYNC = 1_000;

function failureOf(error: unknown): SyncFailure {
  return error instanceof SyncBackendError ? error.failure : 'server';
}

/**
 * Moves the events between the store and the account (docs/specs/sync.md, 2). Each sync pulls
 * everything new first (the store merges it, page by page, and remembers how far it got), then
 * settles the time found before the sync, then sends the outbox in batches, each batch forgotten
 * once the server has it. A failure anywhere leaves the phone's data whole and what was not sent
 * in the outbox; the next attempt comes after a wait that grows (2 s up to 5 min), sooner if the
 * app comes back to the foreground or the person changes something.
 */
export function createSyncEngine({
  store,
  backend,
  getAccount,
  clock = createSyncClock(),
  random = Math.random,
  setTimer = (run, ms) => setTimeout(run, ms),
  clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
}: SyncEngineOptions): SyncEngine {
  let status: SyncStatus = { state: 'local-only' };
  const listeners = new Set<(status: SyncStatus) => void>();
  let running: Promise<void> | null = null;
  let isRerunWanted = false;
  let failures = 0;
  let retryTimer: unknown = null;
  let changeTimer: unknown = null;
  let pollTimer: unknown = null;
  let stopFollowing: (() => void) | null = null;
  let isActive = false;

  const setStatus = (next: SyncStatus) => {
    if (JSON.stringify(next) === JSON.stringify(status)) return;
    status = next;
    for (const listener of listeners) listener(status);
  };

  const cancel = (timer: unknown) => {
    if (timer !== null) clearTimer(timer);
    return null;
  };

  const scheduleRetry = () => {
    retryTimer = cancel(retryTimer);
    retryTimer = setTimer(
      () => {
        retryTimer = null;
        void syncNow();
      },
      nextRetryDelay(failures, random),
    );
  };

  const schedulePoll = () => {
    pollTimer = cancel(pollTimer);
    if (!isActive) return;
    pollTimer = setTimer(() => {
      pollTimer = null;
      void syncNow().then(schedulePoll);
    }, SYNC_CONFIG.pollIntervalMs);
  };

  async function runOnce(): Promise<void> {
    const account = backend === null ? null : await getAccount().catch(() => null);
    if (backend === null || account === null) {
      setStatus({ state: 'local-only' });
      return;
    }
    store.getState().syncStartAccount(account);
    const lastSyncedAt = () => store.getState().sync.lastSyncedAt;
    setStatus({ state: 'syncing', lastSyncedAt: lastSyncedAt() });
    try {
      for (let request = 0; request < MAX_REQUESTS_PER_SYNC; request += 1) {
        const answer = await backend.pull(store.getState().sync.cursor, SYNC_CONFIG.pullPageSize);
        clock.observeServer(answer.serverNow);
        // Not trusted: the merge checks every event again (parseSyncEvent) before using it.
        const events = answer.events as readonly SyncEvent[];
        store.getState().syncReceive(events, answer.cursor, clock.now());
        if (!answer.hasMore) break;
      }
      store.getState().syncSettleTime();
      for (let request = 0; request < MAX_REQUESTS_PER_SYNC; request += 1) {
        const batch = store.getState().sync.outbox.slice(0, SYNC_CONFIG.pushBatchSize);
        if (batch.length === 0) break;
        const answer = await backend.push(batch);
        clock.observeServer(answer.serverNow);
        store.getState().syncAcknowledge(batch);
      }
      const at = clock.now();
      store.getState().syncMarkSynced(at);
      failures = 0;
      retryTimer = cancel(retryTimer);
      setStatus({ state: 'synced', lastSyncedAt: at });
    } catch (error) {
      failures += 1;
      const failure = failureOf(error);
      const pending = store.getState().sync.outbox.length;
      setStatus(
        failure === 'offline'
          ? { state: 'offline', lastSyncedAt: lastSyncedAt(), pending }
          : { state: 'waiting', lastSyncedAt: lastSyncedAt(), pending },
      );
      scheduleRetry();
    }
  }

  function syncNow(): Promise<void> {
    if (running !== null) {
      isRerunWanted = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          isRerunWanted = false;
          await runOnce();
        } while (isRerunWanted);
      } catch (error) {
        // runOnce handles the server's failures; anything else must not stop the app.
        console.warn('The sync stopped unexpectedly.', error);
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    start: () => {
      if (stopFollowing === null) {
        stopFollowing = store.subscribe((state, previous) => {
          if (state.sync.outbox === previous.sync.outbox || state.sync.outbox.length === 0) return;
          if (state.sync.account === null) return;
          changeTimer = cancel(changeTimer);
          changeTimer = setTimer(() => {
            changeTimer = null;
            void syncNow();
          }, SYNC_CONFIG.changeDelayMs);
        });
      }
      void syncNow();
    },
    stop: () => {
      stopFollowing?.();
      stopFollowing = null;
      isActive = false;
      changeTimer = cancel(changeTimer);
      retryTimer = cancel(retryTimer);
      pollTimer = cancel(pollTimer);
    },
    setActive: (active) => {
      if (active === isActive) return;
      isActive = active;
      // Coming back: see what the other phones did. Leaving: send what is waiting while iOS
      // still gives the app a few seconds.
      void syncNow();
      schedulePoll();
    },
    syncNow,
    getStatus: () => status,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
