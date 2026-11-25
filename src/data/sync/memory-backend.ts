import {
  SYNC_CONFIG,
  SyncBackendError,
  eventId,
  type SyncBackend,
  type SyncEvent,
  type SyncFailure,
} from '@/domain/sync';

/** One row of the in-memory server, as the migration keeps it. */
export interface MemoryServerRow {
  readonly seq: number;
  readonly id: string;
  readonly event: SyncEvent;
}

/** A server in memory, for tests and demonstrations: it can also be cut off or fail. */
export interface MemorySyncBackend extends SyncBackend {
  /** Every event kept, oldest first. */
  readonly rows: () => readonly MemoryServerRow[];
  /** While true, every call fails as when there is no network. */
  offline: boolean;
  /** The next `count` calls of this kind fail with `failure`. */
  failNext: (call: 'push' | 'pull', failure: SyncFailure, count?: number) => void;
  /** Calls made so far. */
  readonly calls: { push: number; pull: number };
}

export interface MemorySyncBackendOptions {
  /** The server's clock. Defaults to `Date.now`. */
  readonly now?: () => number;
}

/**
 * A `SyncBackend` that keeps the events in memory, one per id with a sequence number, like the
 * Supabase tables (supabase/migrations, `sync_events`). It does not compact: the merge rules make
 * that unnecessary for correctness. Nothing leaves the phone.
 */
export function createMemorySyncBackend({
  now = Date.now,
}: MemorySyncBackendOptions = {}): MemorySyncBackend {
  const rows: MemoryServerRow[] = [];
  const ids = new Set<string>();
  const failures: { push: SyncFailure[]; pull: SyncFailure[] } = { push: [], pull: [] };
  const calls = { push: 0, pull: 0 };
  let seq = 0;

  const backend: MemorySyncBackend = {
    offline: false,
    calls,
    rows: () => rows,
    failNext: (call, failure, count = 1) => {
      for (let index = 0; index < count; index += 1) failures[call].push(failure);
    },
    push: async (events) => {
      calls.push += 1;
      check('push');
      if (events.length > SYNC_CONFIG.pushBatchSize) {
        throw new SyncBackendError('server', 'too many events in one request');
      }
      let accepted = 0;
      for (const event of events) {
        const id = eventId(event);
        if (ids.has(id)) continue;
        ids.add(id);
        rows.push({ seq: (seq += 1), id, event: JSON.parse(JSON.stringify(event)) });
        accepted += 1;
      }
      return { accepted, rejected: 0, serverNow: now() };
    },
    pull: async (cursor, limit) => {
      calls.pull += 1;
      check('pull');
      const after = rows.filter((row) => row.seq > cursor);
      const page = after.slice(0, Math.min(limit, 1000));
      return {
        events: page.map((row) => row.event),
        cursor: page.at(-1)?.seq ?? cursor,
        hasMore: after.length > page.length,
        serverNow: now(),
      };
    },
  };

  function check(call: 'push' | 'pull'): void {
    if (backend.offline) throw new SyncBackendError('offline', 'the network is off');
    const failure = failures[call].shift();
    if (failure !== undefined) throw new SyncBackendError(failure, `planned ${failure}`);
  }

  return backend;
}
