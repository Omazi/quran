import {
  AnonymousAuthError,
  createAnonymousAuth,
  createMemorySessionStorage,
  type SessionStorage,
} from '@/data/auth';

const CONFIG = { url: 'https://project.supabase.co', publicKey: 'sb_publishable_test_key_123456' };
const USER = '11111111-1111-4111-8111-111111111111';

interface Call {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

/** A fake Supabase Auth: answers are queued per path, every call is recorded. */
function fakeServer() {
  const calls: Call[] = [];
  const queue = new Map<string, (() => Response | Promise<Response>)[]>();
  const answer = (path: string, ...answers: (() => Response | Promise<Response>)[]) => {
    queue.set(path, [...(queue.get(path) ?? []), ...answers]);
  };
  const request = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    const path = url.replace(CONFIG.url, '');
    const next = queue.get(path)?.shift();
    if (next === undefined) throw new Error(`no answer queued for ${path}`);
    return next();
  }) as typeof fetch;
  return { calls, answer, request };
}

const json = (status: number, body: unknown) => () =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const session = (n: number, user = USER) =>
  json(200, {
    access_token: `access-${n}`,
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: `refresh-${n}`,
    user: { id: user, is_anonymous: true },
  });

const SIGNUP = '/auth/v1/signup';
const REFRESH = '/auth/v1/token?grant_type=refresh_token';

function setup(storage: SessionStorage = createMemorySessionStorage()) {
  let now = 1_000_000;
  const server = fakeServer();
  const auth = createAnonymousAuth({
    config: CONFIG,
    storage,
    fetch: server.request,
    now: () => now,
  });
  return {
    auth,
    server,
    storage,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('the anonymous account of the phone', () => {
  it('has no account until one is asked for: reading never creates one', async () => {
    const { auth, server } = setup();
    expect(await auth.current()).toBeNull();
    expect(await auth.getAccessToken()).toBeNull();
    expect(server.calls).toHaveLength(0);
  });

  it('creates it silently the first time, with the public key only, and keeps it', async () => {
    const { auth, server, storage } = setup();
    server.answer(SIGNUP, session(1));
    const created = await auth.ensure();
    expect(created.userId).toBe(USER);
    expect(server.calls).toHaveLength(1);
    const call = server.calls[0]!;
    expect(call.method).toBe('POST');
    expect(call.headers.apikey).toBe(CONFIG.publicKey);
    expect(call.headers.Authorization).toBeUndefined();
    // No address, no phone number: an anonymous sign-up.
    expect(call.body).toEqual({ data: {} });
    expect(await auth.getAccessToken()).toBe('access-1');
    // Only the account and the refresh token are kept, never the access token.
    const kept = JSON.parse((await storage.read()) ?? '{}');
    expect(kept).toEqual({ version: 1, userId: USER, refreshToken: 'refresh-1' });
  });

  it('creates one account only when several screens ask at once', async () => {
    const { auth, server } = setup();
    server.answer(SIGNUP, session(1));
    const [a, b, c] = await Promise.all([auth.ensure(), auth.ensure(), auth.current()]);
    expect(a.userId).toBe(USER);
    expect(b.userId).toBe(USER);
    expect(c === null || c.userId === USER).toBe(true);
    expect(server.calls.filter((call) => call.url.endsWith(SIGNUP))).toHaveLength(1);
  });

  it('finds the same account after a restart of the app, by refreshing the kept token', async () => {
    const storage = createMemorySessionStorage();
    const first = setup(storage);
    first.server.answer(SIGNUP, session(1));
    await first.auth.ensure();

    const second = setup(storage);
    second.server.answer(REFRESH, session(2));
    const found = await second.auth.ensure();
    expect(found.userId).toBe(USER);
    expect(second.server.calls).toHaveLength(1);
    expect(second.server.calls[0]?.body).toEqual({ refresh_token: 'refresh-1' });
    // Supabase hands a new refresh token each time: the new one is kept.
    expect(JSON.parse((await storage.read()) ?? '{}').refreshToken).toBe('refresh-2');
  });

  it('refreshes the access token shortly before it expires, not at every request', async () => {
    const { auth, server, advance } = setup();
    server.answer(SIGNUP, session(1));
    await auth.ensure();
    advance(30 * 60_000);
    expect(await auth.getAccessToken()).toBe('access-1');
    server.answer(REFRESH, session(2));
    advance(29 * 60_000 + 30_000);
    expect(await auth.getAccessToken()).toBe('access-2');
    expect(server.calls).toHaveLength(2);
  });

  it('keeps the account when the network is out: a later try finds it again', async () => {
    const storage = createMemorySessionStorage();
    const first = setup(storage);
    first.server.answer(SIGNUP, session(1));
    await first.auth.ensure();

    const second = setup(storage);
    second.server.answer(
      REFRESH,
      () => {
        throw new TypeError('Network request failed');
      },
      session(2),
    );
    await expect(second.auth.ensure()).rejects.toMatchObject({ failure: 'offline' });
    expect(await storage.read()).not.toBeNull();
    expect((await second.auth.ensure()).userId).toBe(USER);
    // Never a second account for a phone that already has one.
    expect(second.server.calls.some((call) => call.url.endsWith(SIGNUP))).toBe(false);
  });

  it('keeps the account when the server is busy or limits the calls', async () => {
    const storage = createMemorySessionStorage();
    const first = setup(storage);
    first.server.answer(SIGNUP, session(1));
    await first.auth.ensure();

    const second = setup(storage);
    second.server.answer(REFRESH, json(429, { error_code: 'over_request_rate_limit' }));
    await expect(second.auth.current()).rejects.toBeInstanceOf(AnonymousAuthError);
    second.server.answer(REFRESH, json(503, {}));
    await expect(second.auth.current()).rejects.toMatchObject({ failure: 'unavailable' });
    expect(await storage.read()).not.toBeNull();
  });

  it('forgets an account the server no longer knows, and only then makes a new one', async () => {
    const storage = createMemorySessionStorage();
    const first = setup(storage);
    first.server.answer(SIGNUP, session(1));
    await first.auth.ensure();

    const second = setup(storage);
    second.server.answer(
      REFRESH,
      json(400, {
        code: 400,
        error_code: 'refresh_token_not_found',
        msg: 'Invalid Refresh Token: Refresh Token Not Found',
      }),
    );
    expect(await second.auth.current()).toBeNull();
    expect(await storage.read()).toBeNull();
    const other = '22222222-2222-4222-8222-222222222222';
    second.server.answer(SIGNUP, session(3, other));
    expect((await second.auth.ensure()).userId).toBe(other);
  });

  it('does not forget the account on an unknown refusal of the refresh', async () => {
    const storage = createMemorySessionStorage();
    const first = setup(storage);
    first.server.answer(SIGNUP, session(1));
    await first.auth.ensure();

    const second = setup(storage);
    second.server.answer(REFRESH, json(400, { error_code: 'something_new' }));
    await expect(second.auth.current()).rejects.toMatchObject({ failure: 'unavailable' });
    expect(await storage.read()).not.toBeNull();
  });

  it('waits before trying to create the account again after a refusal', async () => {
    const { auth, server, advance } = setup();
    // The switch "Allow anonymous sign-ins" still off in the dashboard.
    server.answer(SIGNUP, json(422, { error_code: 'anonymous_provider_disabled' }));
    await expect(auth.ensure()).rejects.toMatchObject({ failure: 'refused' });
    await expect(auth.ensure()).rejects.toMatchObject({ failure: 'waiting' });
    expect(server.calls).toHaveLength(1);
    advance(60_000);
    server.answer(SIGNUP, json(422, { error_code: 'anonymous_provider_disabled' }));
    await expect(auth.ensure()).rejects.toMatchObject({ failure: 'refused' });
    // The wait doubles: one minute is no longer enough.
    advance(60_000);
    await expect(auth.ensure()).rejects.toMatchObject({ failure: 'waiting' });
    advance(60_000);
    server.answer(SIGNUP, session(1));
    expect((await auth.ensure()).userId).toBe(USER);
  });

  it('refuses an answer that is not a session, and keeps nothing of it', async () => {
    const { auth, server, storage } = setup();
    server.answer(SIGNUP, json(200, { access_token: 'x', user: { id: 'not-a-uuid' } }));
    await expect(auth.ensure()).rejects.toMatchObject({ failure: 'unavailable' });
    expect(await storage.read()).toBeNull();
  });

  it('never creates an account when the kept one cannot be read', async () => {
    const broken: SessionStorage = {
      read: () => Promise.reject(new Error('keychain locked')),
      write: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    };
    const { auth, server } = setup(broken);
    await expect(auth.ensure()).rejects.toMatchObject({ failure: 'storage' });
    expect(server.calls).toHaveLength(0);
  });

  it('ignores a kept value it does not understand, as if there were none', async () => {
    const storage = createMemorySessionStorage('{"version":9}');
    const { auth } = setup(storage);
    expect(await auth.current()).toBeNull();
  });

  it('forgets the account on this phone when asked (sign-out, deletion)', async () => {
    const { auth, server, storage } = setup();
    server.answer(SIGNUP, session(1));
    await auth.ensure();
    server.answer('/auth/v1/logout', () => new Response(null, { status: 204 }));
    await auth.forget();
    expect(await storage.read()).toBeNull();
    expect(await auth.current()).toBeNull();
    const logout = server.calls.find((call) => call.url.endsWith('/auth/v1/logout'));
    expect(logout?.headers.Authorization).toBe('Bearer access-1');
  });

  it('gives the sync its account and token, creating the account on the first sync', async () => {
    const { auth, server } = setup();
    server.answer(SIGNUP, session(1));
    const sync = auth.syncSession();
    expect(await sync.getAccount()).toBe(USER);
    expect(await sync.getAccessToken()).toBe('access-1');
  });
});
