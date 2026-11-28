import { addDays, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';
import {
  isGender,
  periodRange,
  SOCIAL_CONFIG,
  SocialRuleError,
  toBadges,
  toDailyReading,
  toGardenSummary,
  type Badge,
  type BlockedPerson,
  type FriendRequestView,
  type FriendView,
  type GardenSummary,
  type Group,
  type GroupMemberView,
  type Invite,
  type NamedLeaderboardEntry,
  type PersonSearchResult,
  type PersonView,
  type Profile,
  type ReceivedNudge,
  type SearchRelation,
  type SocialRepository,
  type UserId,
} from '@/domain/social';

import { SupabaseRequestError, refusalOfCode, type SupabaseRest } from './supabase-rest';

/**
 * `SocialRepository` on the Supabase project (docs/specs/social-database.md, section 6, step 8):
 * the tables and functions of the social migration, through the REST API. It decides nothing:
 * the server holds every rule and answers with the refusals of the domain; this module only
 * reads its answers, which it does not trust (each row is checked before use).
 */
export interface SupabaseRepositoryOptions {
  readonly rest: SupabaseRest;
  /** The account of this phone, created silently when there is none (the anonymous account). */
  readonly myId: () => Promise<UserId>;
  /** The day of the phone, asked at each action. */
  readonly today: () => LocalDate;
  /**
   * The name given to the profile the first time the account is used (rule 1: 1 to 30
   * characters). There is no screen to choose it yet: see docs/AUTH-SETUP.md.
   */
  readonly newProfileName: () => string;
}

type Row = Readonly<Record<string, unknown>>;

function damaged(what: string): SupabaseRequestError {
  return new SupabaseRequestError(200, 'unexpected_answer', what);
}

function asRow(value: unknown): Row {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw damaged('a row');
  return value as Row;
}

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || value === '') throw damaged(key);
  return value;
}

function whole(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw damaged(key);
  return value;
}

function day(row: Row, key: string): LocalDate {
  try {
    return parseLocalDate(text(row, key));
  } catch {
    throw damaged(key);
  }
}

function dayOrNull(row: Row, key: string): LocalDate | null {
  return row[key] === null || row[key] === undefined ? null : day(row, key);
}

function flag(row: Row, key: string): boolean {
  const value = row[key];
  if (typeof value !== 'boolean') throw damaged(key);
  return value;
}

/** A user id in a filter of the REST API: checked first, so that nothing else is ever sent. */
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function idFilter(id: string): string {
  if (!ID_PATTERN.test(id)) throw new RangeError('Invalid id');
  return id;
}

const SEARCH_RELATIONS: readonly SearchRelation[] = [
  'none',
  'friend',
  'request-sent',
  'request-received',
];

/** The garden of a row of `list_friends()` / `get_friend_garden()`, as rule 4 shows it to me. */
function friendViewOf(row: Row, badges: readonly Badge[]): FriendView {
  const userId = text(row, 'friend_id');
  const gardenVisible = flag(row, 'garden_visible');
  const levelVisible = flag(row, 'level_visible');
  // Before the friend's app publishes a first summary, the values are null.
  const hasGarden =
    gardenVisible && row.hizb_completed !== null && row.hizb_completed !== undefined;
  const hasLevel = levelVisible && row.level !== null && row.level !== undefined;
  const health = row.health;
  if (hasGarden && (typeof health !== 'number' || !(health >= 0 && health <= 1))) {
    throw damaged('health');
  }
  return {
    kind: 'friend',
    userId,
    displayName: text(row, 'display_name'),
    // The column exists once the migration of the gender is applied; before, nobody said it.
    gender: isGender(row.gender) ? row.gender : null,
    garden: hasGarden
      ? {
          hizbCompleted: whole(row, 'hizb_completed'),
          health: health as number,
          lastWateredOn: dayOrNull(row, 'last_watered_on'),
          streakDays: whole(row, 'streak_days'),
          updatedOn: day(row, 'updated_on'),
        }
      : null,
    level: hasLevel
      ? {
          level: whole(row, 'level'),
          badgeCount: whole(row, 'badge_count'),
          wordsRead: whole(row, 'words_read'),
          versesRead: whole(row, 'verses_read'),
          hasanatEstimate: whole(row, 'hasanat_estimate'),
          badges: badges.filter((badge) => badge.userId === userId),
        }
      : null,
  };
}

function badgeOf(value: unknown): Badge {
  const row = asRow(value);
  return {
    userId: text(row, 'user_id'),
    khatmNumber: whole(row, 'khatm_number'),
    completedOn: day(row, 'completed_on'),
  };
}

function groupOf(value: unknown): Group {
  const row = asRow(value);
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    ownerId: text(row, 'owner_id'),
    createdOn: day(row, 'created_on'),
  };
}

function profileOf(value: unknown): Profile {
  const row = asRow(value);
  return {
    id: text(row, 'id'),
    displayName: text(row, 'display_name'),
    showGarden: flag(row, 'show_garden'),
    showLevel: flag(row, 'show_level'),
    gender: isGender(row.gender) ? row.gender : null,
    createdOn: day(row, 'created_on'),
  };
}

function gardenOf(value: unknown): GardenSummary {
  const row = asRow(value);
  const health = row.health;
  if (typeof health !== 'number' || !(health >= 0 && health <= 1)) throw damaged('health');
  return {
    userId: text(row, 'user_id'),
    level: whole(row, 'level'),
    hizbCompleted: whole(row, 'hizb_completed'),
    health,
    lastWateredOn: dayOrNull(row, 'last_watered_on'),
    streakDays: whole(row, 'streak_days'),
    badgeCount: whole(row, 'badge_count'),
    wordsRead: whole(row, 'words_read'),
    versesRead: whole(row, 'verses_read'),
    hasanatEstimate: whole(row, 'hasanat_estimate'),
    updatedOn: day(row, 'updated_on'),
  };
}

const GARDEN_COLUMNS =
  'user_id,level,hizb_completed,health,last_watered_on,streak_days,badge_count,words_read,verses_read,hasanat_estimate,updated_on';

export function createSupabaseRepository({
  rest,
  myId,
  today,
  newProfileName,
}: SupabaseRepositoryOptions): SocialRepository {
  /** Accounts whose profile is known to exist, so that it is not asked for at each call. */
  const withProfile = new Set<UserId>();

  /** Creates my profile if it does not exist yet (the server asks for one: `profile_required`). */
  async function ensureProfile(me: UserId): Promise<void> {
    if (withProfile.has(me)) return;
    const found = await rest.select(`profiles?select=id&id=eq.${idFilter(me)}`);
    if (found.length === 0) {
      try {
        await rest.insert('profiles', { id: me, display_name: newProfileName() });
      } catch (error) {
        // Made at the same moment by another screen: it exists, which is all that matters.
        if (!(error instanceof SupabaseRequestError && error.code === '23505')) throw error;
      }
    }
    withProfile.add(me);
  }

  /** Runs a call that needs my profile; if the server says it is missing, makes it and retries. */
  async function asMe<T>(work: (me: UserId) => Promise<T>): Promise<T> {
    const me = await myId();
    await ensureProfile(me);
    try {
      return await work(me);
    } catch (error) {
      if (!(error instanceof SupabaseRequestError && error.code === 'profile_required'))
        throw error;
      withProfile.delete(me);
      await ensureProfile(me);
      return work(me);
    }
  }

  /** Names of people, by id: those a block hides are missing (rule 3). */
  async function namesOf(ids: readonly UserId[]): Promise<Map<UserId, string>> {
    if (ids.length === 0) return new Map();
    const rows = await rest.rpc('get_public_profiles', { p_ids: [...new Set(ids)] });
    if (!Array.isArray(rows)) throw damaged('get_public_profiles');
    return new Map(
      rows.map((value) => {
        const row = asRow(value);
        return [text(row, 'id'), text(row, 'display_name')] as const;
      }),
    );
  }

  async function badgesOf(ids: readonly UserId[]): Promise<Badge[]> {
    if (ids.length === 0) return [];
    const list = ids.map(idFilter).join(',');
    const rows = await rest.select(
      `badges?select=user_id,khatm_number,completed_on&user_id=in.(${list})&order=khatm_number`,
    );
    return rows.map(badgeOf);
  }

  async function listFriendRows(): Promise<Row[]> {
    const rows = await rest.rpc('list_friends');
    if (!Array.isArray(rows)) throw damaged('list_friends');
    return rows.map(asRow);
  }

  async function friendsOf(rows: readonly Row[]): Promise<FriendView[]> {
    const withLevel = rows
      .filter((row) => row.level_visible === true && row.level !== null)
      .map((row) => text(row, 'friend_id'));
    const badges = await badgesOf(withLevel);
    return rows.map((row) => friendViewOf(row, badges));
  }

  async function rpcList(name: string, args: Readonly<Record<string, unknown>>): Promise<Row[]> {
    const rows = await rest.rpc(name, args);
    if (!Array.isArray(rows)) throw damaged(name);
    return rows.map(asRow);
  }

  const repository: SocialRepository = {
    isDemonstration: false,

    getMyProfile: () =>
      asMe(async (me) => {
        // `*`: the gender column exists only once its migration is applied.
        const rows = await rest.select(`profiles?select=*&id=eq.${idFilter(me)}`);
        if (rows.length !== 1) throw damaged('my profile');
        return profileOf(rows[0]);
      }),

    updateMyProfile: (changes) =>
      asMe(async (me) => {
        const columns: Record<string, unknown> = {};
        if (changes.displayName !== undefined) columns.display_name = changes.displayName;
        if (changes.showGarden !== undefined) columns.show_garden = changes.showGarden;
        if (changes.showLevel !== undefined) columns.show_level = changes.showLevel;
        if (changes.gender !== undefined) columns.gender = changes.gender;
        if (Object.keys(columns).length > 0) {
          await rest.update(`profiles?id=eq.${idFilter(me)}`, columns);
        }
        return repository.getMyProfile();
      }),

    listFriends: () => asMe(async () => friendsOf(await listFriendRows())),

    listFriendRequests: () =>
      asMe(async (me) => {
        const rows = (
          await rest.select(
            `friendships?select=requester_id,addressee_id,created_on&status=eq.pending&order=created_on`,
          )
        ).map(asRow);
        const otherOf = (row: Row) =>
          text(row, 'requester_id') === me ? text(row, 'addressee_id') : text(row, 'requester_id');
        const names = await namesOf(rows.map(otherOf));
        const views = (incoming: boolean): FriendRequestView[] =>
          rows
            .filter((row) => (text(row, 'addressee_id') === me) === incoming)
            .flatMap((row) => {
              const userId = otherOf(row);
              const displayName = names.get(userId);
              if (displayName === undefined) return [];
              return [
                { person: { kind: 'other', userId, displayName }, sentOn: day(row, 'created_on') },
              ];
            });
        return { incoming: views(true), outgoing: views(false) };
      }),

    getPersonView: (userId) =>
      asMe(async (me): Promise<PersonView | null> => {
        if (userId === me) {
          const [profile, gardens, badges] = await Promise.all([
            repository.getMyProfile(),
            rest.select(`garden_summaries?select=${GARDEN_COLUMNS}&user_id=eq.${idFilter(me)}`),
            badgesOf([me]),
          ]);
          return {
            kind: 'self',
            profile,
            garden: gardens.length === 0 ? null : gardenOf(gardens[0]),
            badges,
          };
        }
        const rows = await rpcList('get_friend_garden', { p_friend: idFilter(userId) });
        const [friend] = await friendsOf(rows);
        if (friend !== undefined) return friend;
        const displayName = (await namesOf([userId])).get(userId);
        return displayName === undefined ? null : { kind: 'other', userId, displayName };
      }),

    searchPeople: (query) =>
      asMe(async (): Promise<PersonSearchResult[]> => {
        const rows = await rpcList('search_profiles', { p_query: query });
        return rows.map((row) => {
          const relation = text(row, 'relation') as SearchRelation;
          if (!SEARCH_RELATIONS.includes(relation)) throw damaged('relation');
          return { userId: text(row, 'id'), displayName: text(row, 'display_name'), relation };
        });
      }),

    sendFriendRequest: (toId) =>
      asMe(async () => {
        await rest.rpc('send_friend_request', { p_to: idFilter(toId) });
      }),
    acceptFriendRequest: (fromId) =>
      asMe(async () => {
        await rest.rpc('respond_friend_request', { p_other: idFilter(fromId), p_accept: true });
      }),
    declineFriendRequest: (fromId) =>
      asMe(async () => {
        await rest.rpc('respond_friend_request', { p_other: idFilter(fromId), p_accept: false });
      }),
    removeFriend: (friendId) =>
      asMe(async () => {
        await rest.rpc('remove_friendship', { p_other: idFilter(friendId) });
      }),

    blockPerson: (userId) =>
      asMe(async () => {
        await rest.rpc('block_user', { p_target: idFilter(userId) });
      }),
    unblockPerson: (userId) =>
      asMe(async () => {
        await rest.rpc('unblock_user', { p_target: idFilter(userId) });
      }),
    listBlockedPeople: () =>
      asMe(async (me): Promise<BlockedPerson[]> => {
        const rows = (
          await rest.select(
            `blocks?select=blocked_id,created_on&blocker_id=eq.${idFilter(me)}&order=created_on`,
          )
        ).map(asRow);
        // The server gives no name across a block, in either direction (rule 3): no screen
        // lists them yet (src/features/friends/README.md); the name stays empty.
        return rows.map((row) => ({
          userId: text(row, 'blocked_id'),
          displayName: '',
          blockedOn: day(row, 'created_on'),
        }));
      }),

    createInvite: () =>
      asMe(async (me): Promise<Invite> => {
        const [row] = await rpcList('create_invite', {});
        if (row === undefined) throw damaged('create_invite');
        const expiresOn = day(row, 'expires_on');
        return {
          code: text(row, 'code'),
          ownerId: me,
          createdOn: addDays(expiresOn, -SOCIAL_CONFIG.inviteValidityDays),
          expiresOn,
        };
      }),

    acceptInvite: (code) =>
      asMe(async () => {
        // The server answers a word, not who owns the code: the new friend is the one the list
        // did not have before.
        const before = new Set((await listFriendRows()).map((row) => text(row, 'friend_id')));
        const answer = await rest.rpc('accept_invite', { p_code: code });
        if (answer !== 'accepted') {
          const refusal = typeof answer === 'string' ? refusalOfCode(answer) : null;
          if (refusal !== null) throw new SocialRuleError(refusal, `server: ${String(answer)}`);
          // `too_many_attempts` (10 wrong codes in an hour) has no sentence of its own yet.
          throw new SupabaseRequestError(
            200,
            typeof answer === 'string' ? answer : '',
            'accept_invite',
          );
        }
        const after = await listFriendRows();
        const added = after.filter((row) => !before.has(text(row, 'friend_id')));
        const [friend] = added.length === 1 ? await friendsOf(added) : [];
        if (friend === undefined) throw damaged('the new friend');
        return friend;
      }),

    sendNudge: (toId, kind) =>
      asMe(async () => {
        await rest.rpc('send_nudge', { p_to: idFilter(toId), p_kind: kind, p_sent_on: today() });
      }),
    listReceivedNudges: () =>
      asMe(async (me): Promise<ReceivedNudge[]> => {
        const rows = (
          await rest.select(
            `nudges?select=from_id,kind,sent_on&to_id=eq.${idFilter(me)}&order=sent_on.desc`,
          )
        ).map(asRow);
        const names = await namesOf(rows.map((row) => text(row, 'from_id')));
        return rows.flatMap((row) => {
          const fromId = text(row, 'from_id');
          const fromName = names.get(fromId);
          const kind = text(row, 'kind');
          if (fromName === undefined || (kind !== 'encourage' && kind !== 'congratulate'))
            return [];
          return [{ fromId, fromName, kind, sentOn: day(row, 'sent_on') }];
        });
      }),

    listMyGroups: () =>
      asMe(async () =>
        (await rest.select('groups?select=id,name,owner_id,created_on&order=created_on,id')).map(
          groupOf,
        ),
      ),
    createGroup: (name) =>
      asMe(async () => {
        const id = await rest.rpc('create_group', { p_name: name });
        if (typeof id !== 'string') throw damaged('create_group');
        const rows = await rest.select(
          `groups?select=id,name,owner_id,created_on&id=eq.${idFilter(id)}`,
        );
        if (rows.length !== 1) throw damaged('the new group');
        return groupOf(rows[0]);
      }),
    listGroupMembers: (groupId) =>
      asMe(async (): Promise<GroupMemberView[]> =>
        (await rpcList('list_group_members', { p_group: idFilter(groupId) })).map((row) => {
          const role = text(row, 'role');
          if (role !== 'owner' && role !== 'member') throw damaged('role');
          return {
            userId: text(row, 'user_id'),
            displayName: text(row, 'display_name'),
            role,
            joinedOn: day(row, 'joined_on'),
          };
        }),
      ),
    addGroupMember: (groupId, friendId) =>
      asMe(async () => {
        await rest.rpc('add_group_member', {
          p_group: idFilter(groupId),
          p_user: idFilter(friendId),
        });
      }),
    leaveGroup: (groupId, successorId) =>
      asMe(async () => {
        await rest.rpc('leave_group', {
          p_group: idFilter(groupId),
          p_successor: successorId === null ? null : idFilter(successorId),
        });
      }),
    getGroupLeaderboard: (groupId, period) =>
      asMe(async (): Promise<NamedLeaderboardEntry[]> => {
        const { from, to } = periodRange(period);
        const rows = await rpcList('group_leaderboard', {
          p_group: idFilter(groupId),
          p_from: from,
          p_to: to,
        });
        return rows.map((row) => ({
          userId: text(row, 'user_id'),
          displayName: text(row, 'display_name'),
          newPages: whole(row, 'total_pages'),
          rank: whole(row, 'rank'),
        }));
      }),

    publishGardenSummary: (input) =>
      asMe(async (me) => {
        const summary = toGardenSummary(me, input, today());
        const columns = {
          level: summary.level,
          hizb_completed: summary.hizbCompleted,
          health: summary.health,
          last_watered_on: summary.lastWateredOn,
          streak_days: summary.streakDays,
          badge_count: summary.badgeCount,
          words_read: summary.wordsRead,
          verses_read: summary.versesRead,
          hasanat_estimate: summary.hasanatEstimate,
          updated_on: summary.updatedOn,
        };
        // Changed when it exists, added otherwise: the rights allow no upsert of `user_id`.
        const changed = await rest.update(`garden_summaries?user_id=eq.${idFilter(me)}`, columns);
        if (changed.length === 0)
          await rest.insert('garden_summaries', { user_id: me, ...columns });
      }),
    publishBadges: (badges) =>
      asMe(async (me) => {
        const rows = toBadges(me, badges, today()).map((badge) => ({
          user_id: badge.userId,
          khatm_number: badge.khatmNumber,
          completed_on: badge.completedOn,
        }));
        if (rows.length === 0) return;
        await rest.insert(
          'badges?on_conflict=user_id,khatm_number',
          rows,
          'resolution=ignore-duplicates',
        );
      }),
    publishDailyReading: (readingDay, newPages) =>
      asMe(async (me) => {
        const reading = toDailyReading(me, readingDay, newPages, today());
        const changed = await rest.update(
          `daily_readings?user_id=eq.${idFilter(me)}&day=eq.${reading.day}`,
          { new_pages: reading.newPages },
        );
        if (changed.length === 0) {
          await rest.insert('daily_readings', {
            user_id: me,
            day: reading.day,
            new_pages: reading.newPages,
          });
        }
      }),
  };
  return repository;
}
