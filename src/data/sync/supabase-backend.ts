import {
  SYNC_CONFIG,
  SyncBackendError,
  eventId,
  type PullAnswer,
  type PushAnswer,
  type SyncBackend,
  type SyncFailure,
} from '@/domain/sync';

import type { SupabaseConfig } from './supabase-config';

export interface SupabaseSyncBackendOptions {
  readonly config: SupabaseConfig;
  /**
   * The signed-in person's access token (a Supabase Auth session), or null. Kept by the
   * authentication, in the keychain (docs/SECURITY.md); this module never stores it.
   */
  readonly getAccessToken: () => Promise<string | null>;
  /** Defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  /** How long a request may take before it counts as offline. */
  readonly timeoutMs?: number;
}

/** Machine codes raised by the functions of the migration (supabase/migrations, sync). */
const FAILURE_BY_CODE: Readonly<Record<string, SyncFailure>> = {
  not_authenticated: 'unauthorized',
  sync_rate_limited: 'rate-limited',
  sync_quota_exceeded: 'quota',
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWhole(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * The account's server on Supabase: the two functions of the sync migration, called through the
 * REST API (`POST /rest/v1/rpc/<function>`), with the public key and the person's token. No
 * library: `fetch` is enough, and nothing else is added to the app.
 */
export function createSupabaseSyncBackend({
  config,
  getAccessToken,
  fetch: request = fetch,
  timeoutMs = 15_000,
}: SupabaseSyncBackendOptions): SyncBackend {
  async function call(name: string, body: unknown): Promise<Readonly<Record<string, unknown>>> {
    const token = await getAccessToken();
    if (token === null) throw new SyncBackendError('unauthorized', 'nobody is signed in');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await request(`${config.url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: config.publicKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      // No network, a refused connection or the time limit: the request never got an answer.
      throw new SyncBackendError('offline', `${name}: no answer`);
    } finally {
      clearTimeout(timer);
    }
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const code = isRecord(payload) && typeof payload.message === 'string' ? payload.message : '';
      const failure =
        FAILURE_BY_CODE[code] ??
        (response.status === 401 || response.status === 403
          ? 'unauthorized'
          : response.status === 429
            ? 'rate-limited'
            : 'server');
      throw new SyncBackendError(failure, `${name}: HTTP ${response.status} ${code}`.trim());
    }
    if (!isRecord(payload)) throw new SyncBackendError('server', `${name}: unexpected answer`);
    return payload;
  }

  return {
    push: async (events): Promise<PushAnswer> => {
      if (events.length > SYNC_CONFIG.pushBatchSize) {
        throw new RangeError(`At most ${SYNC_CONFIG.pushBatchSize} events per request.`);
      }
      const answer = await call('sync_push', {
        p_events: events.map((event) => ({ id: eventId(event), event })),
      });
      const { accepted, rejected, server_now: serverNow } = answer;
      if (!isWhole(accepted) || !isWhole(rejected) || !isWhole(serverNow)) {
        throw new SyncBackendError('server', 'sync_push: unexpected answer');
      }
      return { accepted, rejected, serverNow };
    },
    pull: async (cursor, limit): Promise<PullAnswer> => {
      const answer = await call('sync_pull', { p_after: cursor, p_limit: limit });
      const { events, cursor: next, has_more: hasMore, server_now: serverNow } = answer;
      if (
        !Array.isArray(events) ||
        !isWhole(next) ||
        next < cursor ||
        typeof hasMore !== 'boolean' ||
        !isWhole(serverNow)
      ) {
        throw new SyncBackendError('server', 'sync_pull: unexpected answer');
      }
      return { events, cursor: next, hasMore, serverNow };
    },
  };
}
