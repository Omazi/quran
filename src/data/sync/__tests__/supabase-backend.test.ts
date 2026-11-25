import { SyncBackendError, eventId, type SyncEvent } from '@/domain/sync';
import { parseLocalDate } from '@/domain/shared/local-date';

import { createSupabaseSyncBackend } from '../supabase-backend';
import { readAppConfigEnvironment, readSupabaseConfig } from '../supabase-config';

const CONFIG = { url: 'https://abc.supabase.co', publicKey: 'sb_publishable_0123456789abcdef' };
const PAGE: SyncEvent = { kind: 'page', khatm: 1, page: 2, date: parseLocalDate('2026-11-20') };

function answer(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function backendWith(fetch: jest.Mock, token: string | null = 'user-token') {
  return createSupabaseSyncBackend({
    config: CONFIG,
    getAccessToken: async () => token,
    fetch: fetch as unknown as typeof globalThis.fetch,
    timeoutMs: 50,
  });
}

async function failureOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error instanceof SyncBackendError ? error.failure : `not a sync error: ${String(error)}`;
  }
  return 'no failure';
}

describe('the Supabase backend', () => {
  it('calls sync_push with the public key, the person’s token and the events with their ids', async () => {
    const fetch = jest.fn(async () => answer(200, { accepted: 1, rejected: 0, server_now: 99 }));
    const result = await backendWith(fetch).push([PAGE]);
    expect(result).toEqual({ accepted: 1, rejected: 0, serverNow: 99 });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://abc.supabase.co/rest/v1/rpc/sync_push');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      apikey: CONFIG.publicKey,
      Authorization: 'Bearer user-token',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      p_events: [{ id: eventId(PAGE), event: PAGE }],
    });
  });

  it('calls sync_pull with the cursor and reads its answer', async () => {
    const fetch = jest.fn(async () =>
      answer(200, { events: [PAGE], cursor: 12, has_more: false, server_now: 5 }),
    );
    expect(await backendWith(fetch).pull(3, 500)).toEqual({
      events: [PAGE],
      cursor: 12,
      hasMore: false,
      serverNow: 5,
    });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ p_after: 3, p_limit: 500 });
  });

  it('asks nothing of the server when nobody is signed in', async () => {
    const fetch = jest.fn();
    expect(await failureOf(backendWith(fetch, null).pull(0, 10))).toBe('unauthorized');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['no network', async () => Promise.reject(new TypeError('Network request failed')), 'offline'],
    ['an expired session', async () => answer(401, { message: 'JWT expired' }), 'unauthorized'],
    [
      'too many requests',
      async () => answer(400, { code: 'P0001', message: 'sync_rate_limited' }),
      'rate-limited',
    ],
    [
      'a full account',
      async () => answer(400, { code: 'P0001', message: 'sync_quota_exceeded' }),
      'quota',
    ],
    ['a server error', async () => answer(500, null), 'server'],
    ['an answer of the wrong shape', async () => answer(200, { events: 'x' }), 'server'],
    [
      'a cursor that goes back',
      async () => answer(200, { events: [], cursor: 1, has_more: false, server_now: 1 }),
      'server',
    ],
  ])('names the failure: %s', async (_name, respond, expected) => {
    const fetch = jest.fn(respond);
    expect(await failureOf(backendWith(fetch).pull(2, 10))).toBe(expected);
  });

  it('counts a request that takes too long as offline', async () => {
    const fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    expect(await failureOf(backendWith(fetch).pull(0, 10))).toBe('offline');
  });
});

describe('the configuration of the build', () => {
  it('needs an https address and a public key', () => {
    expect(readSupabaseConfig({})).toBeNull();
    expect(readSupabaseConfig({ url: 'https://abc.supabase.co' })).toBeNull();
    expect(
      readSupabaseConfig({ url: 'http://abc.supabase.co', publishableKey: CONFIG.publicKey }),
    ).toBeNull();
    expect(
      readSupabaseConfig({ url: 'https://abc.supabase.co/', publishableKey: CONFIG.publicKey }),
    ).toEqual(CONFIG);
  });

  it('takes the anon key of an older project when there is no publishable key', () => {
    const anonKey = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature0123';
    expect(readSupabaseConfig({ url: CONFIG.url, anonKey })).toEqual({
      url: CONFIG.url,
      publicKey: anonKey,
    });
  });
});

describe('the project of app.json', () => {
  it('is the public address and publishable key, nothing secret', () => {
    const appConfig = require('../../../../app.json');
    const config = readSupabaseConfig(readAppConfigEnvironment(appConfig.expo.extra));
    expect(config?.url).toBe('https://onjjwtegzeuajkcnzyvj.supabase.co');
    expect(config?.publicKey).toMatch(/^sb_publishable_/);
    expect(JSON.stringify(appConfig)).not.toMatch(/service_role|sb_secret_/);
  });

  it('reads nothing from a missing or malformed entry', () => {
    expect(readAppConfigEnvironment(undefined)).toEqual({});
    expect(readAppConfigEnvironment({ supabase: 3 })).toEqual({});
    expect(readAppConfigEnvironment({ supabase: { url: 1 } })).toEqual({
      url: undefined,
      publishableKey: undefined,
    });
  });
});
