import type { SupabaseConfig, SyncSession } from '@/data/sync';

import type { SessionStorage } from './session-storage';

/**
 * The anonymous account of this phone (owner's decision, 27 November 2026: no sign-in screen
 * for now; docs/AUTH-SETUP.md, "Connexion anonyme"). Supabase Auth creates it without an address
 * (`POST /auth/v1/signup` with no e-mail nor phone: an anonymous sign-up), and it is an ordinary
 * account for the database: the `authenticated` role, its own rows only.
 *
 * Through the REST API of Supabase Auth, with `fetch`: no library is added to the app (like the
 * sync, src/data/sync/supabase-backend.ts). The paths and bodies follow the documentation of
 * Supabase Auth read on 27 November 2026; they are NOT VERIFIED against the real project.
 *
 * Rules that protect the account, because an anonymous account cannot be found again once its
 * token is lost:
 * - only the account id and the refresh token are kept (a short text, in the keychain); the
 *   access token lives in memory and is refreshed shortly before it expires;
 * - a second account is created only when there is none, or when the server says the kept one
 *   no longer exists; never because the network, the server or the keychain failed;
 * - after a failed creation the next try waits (1 min, doubled up to 1 h), so that a phone never
 *   uses up the limit of anonymous sign-ups of its network (30 per hour and per IP address).
 */
export interface AnonymousSession {
  /** The account id (`auth.users.id`). */
  readonly userId: string;
  readonly accessToken: string;
  /** When the access token expires, in milliseconds since 1970. */
  readonly expiresAt: number;
}

/**
 * Why the account could not be read or made. `offline`: no answer. `unavailable`: the server
 * answered something else than expected (busy, limited, damaged). `refused`: the creation was
 * refused (anonymous sign-ins switched off in the dashboard, a CAPTCHA asked for). `waiting`:
 * too soon after a failed creation. `storage`: the keychain could not be read or written.
 */
export type AnonymousAuthFailure = 'offline' | 'unavailable' | 'refused' | 'waiting' | 'storage';

export class AnonymousAuthError extends Error {
  readonly failure: AnonymousAuthFailure;

  /** `detail` goes to the logs: never a token. */
  constructor(failure: AnonymousAuthFailure, detail: string) {
    super(`${failure}: ${detail}`);
    this.name = 'AnonymousAuthError';
    this.failure = failure;
  }
}

export interface AnonymousAuth {
  /** The account of this phone, without ever creating one: null when there is none (yet). */
  current(): Promise<AnonymousSession | null>;
  /** The account of this phone, created silently the first time. */
  ensure(): Promise<AnonymousSession>;
  /** A valid access token of the account, or null when there is none. Never creates one. */
  getAccessToken(): Promise<string | null>;
  /** Forgets the account on this phone (sign-out, or after the account was deleted). */
  forget(): Promise<void>;
  /** What the sync needs: the account is created on its first sync. */
  syncSession(): SyncSession;
}

export interface AnonymousAuthOptions {
  readonly config: SupabaseConfig;
  readonly storage: SessionStorage;
  /** Defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  /** Defaults to `Date.now`. */
  readonly now?: () => number;
  readonly timeoutMs?: number;
}

const STORED_VERSION = 1;
/** The access token is refreshed this long before it expires. */
const REFRESH_MARGIN_MS = 60_000;
const FIRST_RETRY_DELAY_MS = 60_000;
const LAST_RETRY_DELAY_MS = 60 * 60_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]{1,4096}$/;

/**
 * The answers of a refresh that mean "this account is gone for good" (Supabase Auth error codes).
 * Any other refusal keeps the account: losing it would lose the person's friends.
 */
const ACCOUNT_GONE_CODES: ReadonlySet<string> = new Set([
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
  'session_expired',
  'user_not_found',
]);

interface StoredSession {
  readonly version: typeof STORED_VERSION;
  readonly userId: string;
  readonly refreshToken: string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStored(text: string | null): StoredSession | null {
  if (text === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== STORED_VERSION) return null;
  const { userId, refreshToken } = value;
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) return null;
  if (typeof refreshToken !== 'string' || !TOKEN_PATTERN.test(refreshToken)) return null;
  return { version: STORED_VERSION, userId, refreshToken };
}

/** A session answered by Supabase Auth, or null when the answer is not one. */
function parseAnswer(
  value: unknown,
  now: number,
): { session: AnonymousSession; refreshToken: string } | null {
  if (!isRecord(value) || !isRecord(value.user)) return null;
  const { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn } = value;
  const userId = value.user.id;
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) return null;
  if (typeof accessToken !== 'string' || !TOKEN_PATTERN.test(accessToken)) return null;
  if (typeof refreshToken !== 'string' || !TOKEN_PATTERN.test(refreshToken)) return null;
  if (typeof expiresIn !== 'number' || !(expiresIn > 0)) return null;
  return { session: { userId, accessToken, expiresAt: now + expiresIn * 1000 }, refreshToken };
}

export function createAnonymousAuth({
  config,
  storage,
  fetch: request = fetch,
  now = Date.now,
  timeoutMs = 15_000,
}: AnonymousAuthOptions): AnonymousAuth {
  let session: AnonymousSession | null = null;
  let failedCreations = 0;
  let nextCreationAt = 0;
  // Every operation runs after the previous one: two screens asking at once make one account.
  let queue: Promise<unknown> = Promise.resolve();

  function serial<T>(work: () => Promise<T>): Promise<T> {
    const run = queue.then(work, work);
    queue = run.catch(() => undefined);
    return run;
  }

  async function call(
    path: string,
    body: unknown,
    token?: string,
  ): Promise<{ status: number; payload: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = {
      apikey: config.publicKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token !== undefined) headers.Authorization = `Bearer ${token}`;
    let response: Response;
    try {
      response = await request(`${config.url}/auth/v1/${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new AnonymousAuthError('offline', `${path}: no answer`);
    } finally {
      clearTimeout(timer);
    }
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { status: response.status, payload };
  }

  async function readStored(): Promise<StoredSession | null> {
    let text: string | null;
    try {
      text = await storage.read();
    } catch {
      throw new AnonymousAuthError('storage', 'the kept account could not be read');
    }
    return parseStored(text);
  }

  async function keep(userId: string, refreshToken: string): Promise<void> {
    const stored: StoredSession = { version: STORED_VERSION, userId, refreshToken };
    try {
      await storage.write(JSON.stringify(stored));
    } catch {
      throw new AnonymousAuthError('storage', 'the account could not be kept');
    }
  }

  /** The kept account with a fresh access token, or null when there is none or it is gone. */
  async function refresh(stored: StoredSession): Promise<AnonymousSession | null> {
    const { status, payload } = await call('token?grant_type=refresh_token', {
      refresh_token: stored.refreshToken,
    });
    if (status >= 200 && status < 300) {
      const answer = parseAnswer(payload, now());
      if (answer === null || answer.session.userId !== stored.userId) {
        throw new AnonymousAuthError('unavailable', 'refresh: unexpected answer');
      }
      await keep(answer.session.userId, answer.refreshToken);
      return answer.session;
    }
    const code =
      isRecord(payload) && typeof payload.error_code === 'string' ? payload.error_code : '';
    const oauthError = isRecord(payload) && typeof payload.error === 'string' ? payload.error : '';
    const isGone =
      status >= 400 &&
      status < 500 &&
      status !== 429 &&
      (ACCOUNT_GONE_CODES.has(code) || (code === '' && oauthError === 'invalid_grant'));
    if (!isGone) throw new AnonymousAuthError('unavailable', `refresh: HTTP ${status} ${code}`);
    await storage.clear().catch(() => undefined);
    return null;
  }

  async function readCurrent(): Promise<AnonymousSession | null> {
    if (session !== null && now() < session.expiresAt - REFRESH_MARGIN_MS) return session;
    const stored = await readStored();
    if (stored === null) {
      session = null;
      return null;
    }
    session = await refresh(stored);
    return session;
  }

  async function create(): Promise<AnonymousSession> {
    if (now() < nextCreationAt) {
      throw new AnonymousAuthError('waiting', 'too soon after a failed creation');
    }
    try {
      const { status, payload } = await call('signup', { data: {} });
      if (status < 200 || status >= 300) {
        const failure = status === 429 || status >= 500 ? 'unavailable' : 'refused';
        const code =
          isRecord(payload) && typeof payload.error_code === 'string' ? payload.error_code : '';
        throw new AnonymousAuthError(failure, `signup: HTTP ${status} ${code}`.trim());
      }
      const answer = parseAnswer(payload, now());
      if (answer === null) throw new AnonymousAuthError('unavailable', 'signup: unexpected answer');
      await keep(answer.session.userId, answer.refreshToken);
      failedCreations = 0;
      nextCreationAt = 0;
      session = answer.session;
      return answer.session;
    } catch (error) {
      const delay = Math.min(FIRST_RETRY_DELAY_MS * 2 ** failedCreations, LAST_RETRY_DELAY_MS);
      failedCreations += 1;
      nextCreationAt = now() + delay;
      throw error;
    }
  }

  const auth: AnonymousAuth = {
    current: () => serial(readCurrent),
    ensure: () => serial(async () => (await readCurrent()) ?? create()),
    getAccessToken: async () => (await auth.current())?.accessToken ?? null,
    forget: () =>
      serial(async () => {
        const last = session;
        session = null;
        if (last !== null) {
          // Best effort: the token dies on the server too. The phone forgets it either way.
          await call('logout', {}, last.accessToken).catch(() => undefined);
        }
        await storage.clear();
      }),
    syncSession: () => ({
      getAccount: async () => (await auth.ensure()).userId,
      getAccessToken: () => auth.getAccessToken(),
    }),
  };
  return auth;
}
