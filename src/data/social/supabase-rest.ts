import type { SupabaseConfig } from '@/data/sync';
import { SocialRuleError, type SocialRefusal } from '@/domain/social';

/**
 * The REST API of the Supabase project (PostgREST: `/rest/v1/<table>` and
 * `/rest/v1/rpc/<function>`), with the public key and the token of the account. No library:
 * `fetch` is enough, as for the sync. The paths, headers and error shapes follow the
 * documentation of Supabase read on 25 and 27 November 2026; NOT VERIFIED against the project.
 */
export interface SupabaseRest {
  /** Calls a function of the migrations; resolves to its answer (JSON). */
  rpc(name: string, args?: Readonly<Record<string, unknown>>): Promise<unknown>;
  /** Reads rows: `path` is the table and its query, e.g. `groups?select=id,name`. */
  select(path: string): Promise<readonly unknown[]>;
  /** Inserts rows. `prefer` adds to the `Prefer` header (e.g. `resolution=ignore-duplicates`). */
  insert(path: string, rows: unknown, prefer?: string): Promise<void>;
  /** Changes rows; resolves to the rows changed. */
  update(path: string, changes: Readonly<Record<string, unknown>>): Promise<readonly unknown[]>;
}

export interface SupabaseRestOptions {
  readonly config: SupabaseConfig;
  /** The account's access token, or null: then every call is `not-signed-in`. */
  readonly getAccessToken: () => Promise<string | null>;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

/**
 * The machine codes the functions of the migrations raise (snake_case), turned into the
 * refusals of the domain: the server answers "with the same words" (docs/specs/social-database.md,
 * 3.4). A code not listed here is a plain `SupabaseRequestError`.
 */
const REFUSAL_BY_CODE: Readonly<Record<string, SocialRefusal>> = {
  name_empty: 'name-empty',
  name_too_long: 'name-too-long',
  name_forbidden_character: 'name-forbidden-character',
  name_has_edge_spaces: 'name-forbidden-character',
  cannot_befriend_yourself: 'cannot-befriend-yourself',
  already_friends: 'already-friends',
  request_already_sent: 'request-already-sent',
  request_declined_recently: 'request-declined-recently',
  no_pending_request: 'no-pending-request',
  not_the_addressee: 'not-the-addressee',
  not_friends: 'not-friends',
  cannot_block_yourself: 'cannot-block-yourself',
  already_blocked: 'already-blocked',
  not_blocked: 'not-blocked',
  you_blocked_them: 'you-blocked-them',
  person_unavailable: 'person-unavailable',
  invite_code_malformed: 'invite-code-malformed',
  invite_not_found: 'invite-not-found',
  invite_expired: 'invite-expired',
  invite_is_yours: 'invite-is-yours',
  search_query_too_short: 'search-query-too-short',
  search_query_too_long: 'search-query-too-long',
  search_query_forbidden_character: 'search-query-forbidden-character',
  too_many_searches: 'too-many-searches',
  already_nudged_today: 'already-nudged-today',
  group_not_found: 'group-not-found',
  already_a_member: 'already-a-member',
  group_full: 'group-full',
  owner_must_hand_over: 'owner-must-hand-over',
  successor_not_a_member: 'successor-not-a-member',
  not_authenticated: 'not-signed-in',
};

/** A machine code of the server as a refusal of the domain, or null when it is not one. */
export function refusalOfCode(code: string): SocialRefusal | null {
  return Object.prototype.hasOwnProperty.call(REFUSAL_BY_CODE, code)
    ? (REFUSAL_BY_CODE[code] ?? null)
    : null;
}

/** The server could not do it, for a reason that is not a rule of the domain. */
export class SupabaseRequestError extends Error {
  /** HTTP status; 0 when there was no answer. */
  readonly status: number;
  /** The machine code (`profile_required`, `23505`, ...) or ''. */
  readonly code: string;

  constructor(status: number, code: string, detail: string) {
    super(`${detail} (HTTP ${status}${code === '' ? '' : `, ${code}`})`);
    this.name = 'SupabaseRequestError';
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createSupabaseRest({
  config,
  getAccessToken,
  fetch: request = fetch,
  timeoutMs = 15_000,
}: SupabaseRestOptions): SupabaseRest {
  async function send(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
    prefer?: string,
  ): Promise<unknown> {
    const token = await getAccessToken();
    if (token === null) throw new SocialRuleError('not-signed-in', 'no account on this phone');
    const headers: Record<string, string> = {
      apikey: config.publicKey,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer !== undefined) headers.Prefer = prefer;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await request(`${config.url}/rest/v1/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new SupabaseRequestError(0, '', `${method} ${path.split('?')[0]}: no answer`);
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text().catch(() => '');
    let payload: unknown = null;
    if (text !== '') {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    if (response.ok) return payload;
    // A function that raised: `{ code: "P0001", message: "<machine code>" }`; a constraint:
    // `{ code: "23505", ... }`; a refused right: `{ code: "42501", ... }`.
    const message = isRecord(payload) && typeof payload.message === 'string' ? payload.message : '';
    const sqlState = isRecord(payload) && typeof payload.code === 'string' ? payload.code : '';
    const refusal = refusalOfCode(message);
    if (refusal !== null) throw new SocialRuleError(refusal, `server: ${message}`);
    const code = sqlState === 'P0001' && message !== '' ? message : sqlState;
    throw new SupabaseRequestError(response.status, code, `${method} ${path.split('?')[0]}`);
  }

  return {
    rpc: (name, args = {}) => send('POST', `rpc/${name}`, args),
    select: async (path) => {
      const rows = await send('GET', path);
      if (!Array.isArray(rows)) throw new SupabaseRequestError(200, '', `GET ${path}: not a list`);
      return rows;
    },
    insert: async (path, rows, prefer) => {
      await send('POST', path, rows, ['return=minimal', prefer].filter(Boolean).join(','));
    },
    update: async (path, changes) => {
      const rows = await send('PATCH', path, changes, 'return=representation');
      return Array.isArray(rows) ? rows : [];
    },
  };
}
