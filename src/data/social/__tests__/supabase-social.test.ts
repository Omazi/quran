import { createAnonymousAuth, createMemorySessionStorage } from '@/data/auth';
import { createSupabaseSocial, SupabaseRequestError } from '@/data/social';
import type { LocalDate } from '@/domain/shared/local-date';
import { SocialRuleError } from '@/domain/social';

const CONFIG = { url: 'https://project.supabase.co', publicKey: 'sb_publishable_test_key_123456' };
const ME = '11111111-1111-4111-8111-111111111111';
const SARAH = '22222222-2222-4222-8222-222222222222';
const TODAY = '2026-11-27' as LocalDate;

interface Call {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

type Handler = (call: Call) => { status: number; body?: unknown } | undefined;

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** A fake project: Supabase Auth answers an anonymous sign-up; the REST API asks `handle`. */
function fakeProject(handle: Handler) {
  const calls: Call[] = [];
  const request = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace(CONFIG.url, '');
    const call: Call = {
      method: init?.method ?? 'GET',
      path,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    if (path === '/auth/v1/signup') {
      return json(200, {
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        expires_in: 3600,
        user: { id: ME, is_anonymous: true },
      });
    }
    const answer = handle(call);
    if (answer === undefined) throw new Error(`unexpected ${call.method} ${path}`);
    return json(answer.status, answer.body);
  }) as typeof fetch;
  return { calls, request };
}

function setup(handle: Handler) {
  const project = fakeProject(handle);
  const auth = createAnonymousAuth({
    config: CONFIG,
    storage: createMemorySessionStorage(),
    fetch: project.request,
  });
  const social = createSupabaseSocial({
    config: CONFIG,
    auth,
    today: () => TODAY,
    newProfileName: () => 'Proche',
    fetch: project.request,
  });
  return { ...project, auth, social };
}

/** The profile already exists: the first read of `profiles` finds it. */
const profileExists: Handler = (call) =>
  call.method === 'GET' && call.path.startsWith('/rest/v1/profiles?select=id&')
    ? { status: 200, body: [{ id: ME }] }
    : undefined;

const either =
  (...handlers: Handler[]): Handler =>
  (call) => {
    for (const handler of handlers) {
      const answer = handler(call);
      if (answer !== undefined) return answer;
    }
    return undefined;
  };

const sarahRow = (overrides: Record<string, unknown> = {}) => ({
  friend_id: SARAH,
  display_name: 'Sarah',
  garden_visible: true,
  level_visible: true,
  level: 2,
  hizb_completed: 14,
  health: 0.8,
  last_watered_on: '2026-11-26',
  streak_days: 5,
  badge_count: 1,
  words_read: 100,
  verses_read: 10,
  hasanat_estimate: 4000,
  updated_on: '2026-11-26',
  ...overrides,
});

describe('the Proches tab on the Supabase project, with the anonymous account', () => {
  it('is not a demonstration and has no session until it opens one, silently', async () => {
    const { social, calls } = setup(() => undefined);
    expect(social.isDemonstration).toBe(false);
    expect(social.repository.isDemonstration).toBe(false);
    expect(await social.auth.getSession()).toBeNull();
    expect(calls).toHaveLength(0);
    const opened = await social.openSilently();
    expect(opened).toEqual({ userId: ME, provider: 'anonymous', isDemonstration: false });
    expect(await social.auth.getSession()).toEqual(opened);
  });

  it('makes my profile the first time, then my code, with the token of the account', async () => {
    const { social, calls } = setup((call) => {
      if (call.method === 'GET' && call.path === `/rest/v1/profiles?select=id&id=eq.${ME}`) {
        return { status: 200, body: [] };
      }
      if (call.method === 'POST' && call.path === '/rest/v1/profiles') return { status: 201 };
      if (call.path === '/rest/v1/rpc/create_invite') {
        return { status: 200, body: [{ code: 'ABCDEFGH', expires_on: '2026-12-04' }] };
      }
      return undefined;
    });
    const invite = await social.repository.createInvite();
    expect(invite).toEqual({
      code: 'ABCDEFGH',
      ownerId: ME,
      createdOn: '2026-11-27',
      expiresOn: '2026-12-04',
    });
    const insert = calls.find(
      (call) => call.method === 'POST' && call.path === '/rest/v1/profiles',
    );
    expect(insert?.body).toEqual({ id: ME, display_name: 'Proche' });
    for (const call of calls.filter((each) => each.path.startsWith('/rest/'))) {
      expect(call.headers.Authorization).toBe('Bearer access-1');
      expect(call.headers.apikey).toBe(CONFIG.publicKey);
    }
    // The profile is known now: a second code does not look for it again.
    await social.repository.createInvite();
    expect(calls.filter((call) => call.path.startsWith('/rest/v1/profiles'))).toHaveLength(2);
  });

  it('accepting a code shows the new friend, with the garden they share', async () => {
    let friends: unknown[] = [];
    const { social, calls } = setup(
      either(profileExists, (call) => {
        if (call.path === '/rest/v1/rpc/list_friends') return { status: 200, body: friends };
        if (call.path === '/rest/v1/rpc/accept_invite') {
          friends = [sarahRow()];
          return { status: 200, body: 'accepted' };
        }
        if (call.path.startsWith('/rest/v1/badges?')) {
          return {
            status: 200,
            body: [{ user_id: SARAH, khatm_number: 1, completed_on: '2026-10-01' }],
          };
        }
        return undefined;
      }),
    );
    const friend = await social.repository.acceptInvite('ABCDEFGH');
    expect(calls.find((call) => call.path === '/rest/v1/rpc/accept_invite')?.body).toEqual({
      p_code: 'ABCDEFGH',
    });
    expect(friend).toEqual({
      kind: 'friend',
      userId: SARAH,
      displayName: 'Sarah',
      gender: null,
      garden: {
        hizbCompleted: 14,
        health: 0.8,
        lastWateredOn: '2026-11-26',
        streakDays: 5,
        updatedOn: '2026-11-26',
      },
      level: {
        level: 2,
        badgeCount: 1,
        wordsRead: 100,
        versesRead: 10,
        hasanatEstimate: 4000,
        badges: [{ userId: SARAH, khatmNumber: 1, completedOn: '2026-10-01' }],
      },
    });
  });

  it.each([
    ['invite_expired', 'invite-expired'],
    ['invite_not_found', 'invite-not-found'],
    ['invite_is_yours', 'invite-is-yours'],
    ['already_friends', 'already-friends'],
    ['invite_code_malformed', 'invite-code-malformed'],
    ['you_blocked_them', 'you-blocked-them'],
  ])('a refused code (%s) is the refusal of the domain', async (answer, refusal) => {
    const { social } = setup(
      either(profileExists, (call) => {
        if (call.path === '/rest/v1/rpc/list_friends') return { status: 200, body: [] };
        if (call.path === '/rest/v1/rpc/accept_invite') return { status: 200, body: answer };
        return undefined;
      }),
    );
    await expect(social.repository.acceptInvite('ABCDEFGH')).rejects.toMatchObject({
      name: 'SocialRuleError',
      reason: refusal,
    });
  });

  it('too many wrong codes is an error, never a friend', async () => {
    const { social } = setup(
      either(profileExists, (call) => {
        if (call.path === '/rest/v1/rpc/list_friends') return { status: 200, body: [] };
        if (call.path === '/rest/v1/rpc/accept_invite') {
          return { status: 200, body: 'too_many_attempts' };
        }
        return undefined;
      }),
    );
    const error = await social.repository.acceptInvite('ABCDEFGH').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SupabaseRequestError);
    expect(error).toMatchObject({ code: 'too_many_attempts' });
  });

  it('what a function of the server refuses reaches the screen as the same refusal', async () => {
    const { social, calls } = setup(
      either(profileExists, (call) =>
        call.path === '/rest/v1/rpc/send_nudge'
          ? { status: 400, body: { code: 'P0001', message: 'already_nudged_today' } }
          : undefined,
      ),
    );
    const error = await social.repository.sendNudge(SARAH, 'encourage').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SocialRuleError);
    expect(error).toMatchObject({ reason: 'already-nudged-today' });
    // The day sent is the phone's.
    expect(calls.find((call) => call.path === '/rest/v1/rpc/send_nudge')?.body).toEqual({
      p_to: SARAH,
      p_kind: 'encourage',
      p_sent_on: TODAY,
    });
  });

  it('makes the profile again when the server says it is missing, and tries once more', async () => {
    let profileRows: unknown[] = [{ id: ME }];
    let listed = 0;
    const { social } = setup((call) => {
      if (call.method === 'GET' && call.path.startsWith('/rest/v1/profiles?select=id&')) {
        return { status: 200, body: profileRows };
      }
      if (call.method === 'POST' && call.path === '/rest/v1/profiles') {
        profileRows = [{ id: ME }];
        return { status: 201 };
      }
      if (call.path === '/rest/v1/rpc/list_friends') {
        listed += 1;
        if (listed === 1) {
          profileRows = [];
          return { status: 400, body: { code: 'P0001', message: 'profile_required' } };
        }
        return { status: 200, body: [] };
      }
      return undefined;
    });
    expect(await social.repository.listFriends()).toEqual([]);
    expect(listed).toBe(2);
  });

  it('reads a friend who hides the garden, or has not published it, without inventing it', async () => {
    const { social } = setup(
      either(profileExists, (call) =>
        call.path === '/rest/v1/rpc/list_friends'
          ? {
              status: 200,
              body: [
                sarahRow({
                  garden_visible: false,
                  level_visible: false,
                  level: null,
                  hizb_completed: null,
                  health: null,
                  last_watered_on: null,
                  streak_days: null,
                  badge_count: null,
                  words_read: null,
                  verses_read: null,
                  hasanat_estimate: null,
                  updated_on: null,
                  gender: 'female',
                }),
              ],
            }
          : undefined,
      ),
    );
    const [friend] = await social.repository.listFriends();
    expect(friend).toMatchObject({
      displayName: 'Sarah',
      gender: 'female',
      garden: null,
      level: null,
    });
  });

  it('refuses a damaged answer instead of showing it', async () => {
    const { social } = setup(
      either(profileExists, (call) =>
        call.path === '/rest/v1/rpc/list_friends'
          ? { status: 200, body: [sarahRow({ health: 7 })] }
          : undefined,
      ),
    );
    await expect(social.repository.listFriends()).rejects.toBeInstanceOf(SupabaseRequestError);
  });

  it('publishes my garden: changed when it exists, added otherwise', async () => {
    const { social, calls } = setup(
      either(profileExists, (call) => {
        if (call.method === 'PATCH' && call.path.startsWith('/rest/v1/garden_summaries?')) {
          return { status: 200, body: [] };
        }
        if (call.method === 'POST' && call.path === '/rest/v1/garden_summaries') {
          return { status: 201 };
        }
        return undefined;
      }),
    );
    await social.repository.publishGardenSummary({
      khatmNumber: 1,
      hizbCompleted: 3,
      health: 1,
      lastWateredOn: TODAY,
      streakDays: 2,
      badgeCount: 0,
      wordsRead: 10,
      versesRead: 2,
      hasanatEstimate: 300,
    });
    const insert = calls.find((call) => call.method === 'POST' && call.path.includes('garden'));
    expect(insert?.body).toMatchObject({
      user_id: ME,
      level: 1,
      hizb_completed: 3,
      updated_on: TODAY,
    });
  });

  it('an unreachable server is an error the screens show calmly, not a refusal', async () => {
    const { social } = setup((call) => {
      if (call.path.startsWith('/rest/')) throw new TypeError('Network request failed');
      return undefined;
    });
    const error = await social.repository.listFriends().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SupabaseRequestError);
    expect(error).not.toBeInstanceOf(SocialRuleError);
  });

  it('deleting the account asks the server, then forgets the account on the phone', async () => {
    const { social, auth } = setup((call) =>
      call.path === '/rest/v1/rpc/delete_my_account' ? { status: 204 } : undefined,
    );
    await social.openSilently();
    await social.auth.deleteAccount().catch(() => undefined);
    // The logout of a deleted account may fail: the phone forgets it either way.
    expect(await auth.current()).toBeNull();
  });
});
