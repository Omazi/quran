import type { SyncEvent } from './types';

/** What a sync with the account answers, besides its data: the server's clock. */
export interface SyncAnswer {
  /** The server's clock when it answered, in milliseconds since 1970. */
  readonly serverNow: number;
}

export interface PushAnswer extends SyncAnswer {
  /** Events kept by the server (new ones; one already there is not counted). */
  readonly accepted: number;
  /** Events the server refused as malformed: they are dropped, never sent again. */
  readonly rejected: number;
}

export interface PullAnswer extends SyncAnswer {
  /** Events after the cursor, oldest first. Not trusted: every one is checked before use. */
  readonly events: readonly unknown[];
  /** The sequence number to ask from next time. */
  readonly cursor: number;
  /** True when the server has more events after `cursor`. */
  readonly hasMore: boolean;
}

/** Why a sync failed: decides what the person is told and when the app tries again. */
export type SyncFailure =
  /** No network, or the server could not be reached in time. */
  | 'offline'
  /** The session is missing or expired. */
  | 'unauthorized'
  /** Too many requests: the server asks to wait. */
  | 'rate-limited'
  /** The account holds as much as the server allows. */
  | 'quota'
  /** Anything else the server answered. */
  | 'server';

export class SyncBackendError extends Error {
  constructor(
    readonly failure: SyncFailure,
    message: string,
  ) {
    super(message);
    this.name = 'SyncBackendError';
  }
}

/**
 * The account's copy of the progress, on a server: the events of all the person's phones.
 * Declared here, implemented in src/data/sync (Supabase, and an in-memory one). Every call is
 * for the signed-in person only; it fails with a `SyncBackendError`.
 */
export interface SyncBackend {
  /** Sends events. Sending an event the server already has changes nothing. */
  push: (events: readonly SyncEvent[]) => Promise<PushAnswer>;
  /** Asks for the events after `cursor` (0 for all), at most `limit`. */
  pull: (cursor: number, limit: number) => Promise<PullAnswer>;
}
