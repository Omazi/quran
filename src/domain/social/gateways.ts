import type { LocalDate } from '@/domain/shared/local-date';

import type {
  BadgeInput,
  BlockedPerson,
  FriendRequests,
  FriendView,
  GardenSummaryInput,
  Group,
  GroupId,
  GroupMemberView,
  Invite,
  LeaderboardPeriod,
  NamedLeaderboardEntry,
  NudgeKind,
  PersonSearchResult,
  PersonView,
  Profile,
  ProfileChanges,
  ReceivedNudge,
  UserId,
} from './types';

/**
 * What the domain needs from the outside (docs/specs/social.md, section 4). `src/data/social`
 * implements it on demonstration data; a second implementation will talk to the server, and no
 * screen changes.
 *
 * Every method that cannot be done answers with a `SocialRuleError` (a rule said no) or a plain
 * error (something is damaged or unreachable). Nothing is ever corrected in silence.
 */

export type SignInProvider = 'apple' | 'google' | 'email';
export type SignInPlatform = 'ios' | 'android';
/**
 * How a session was opened: a way to sign in, or `anonymous`, the account the phone makes by
 * itself, without a screen (owner's decision, 27 November 2026; docs/AUTH-SETUP.md).
 */
export type SessionProvider = SignInProvider | 'anonymous';

/** Who is signed in. */
export interface Session {
  readonly userId: UserId;
  readonly provider: SessionProvider;
  /**
   * True when nothing here is real: a screen shows it (docs/specs/social.md, section 4) and
   * never presents the data as someone's real friends.
   */
  readonly isDemonstration: boolean;
}

export interface AuthGateway {
  /** True when this gateway is a demonstration: no account is created, nothing leaves the phone. */
  readonly isDemonstration: boolean;
  /** The session in progress, or null when nobody is signed in. */
  getSession(): Promise<Session | null>;
  signInWithApple(): Promise<Session>;
  signInWithGoogle(): Promise<Session>;
  /** Sends a one-time code to the address (`parseEmail` has checked it). */
  requestEmailCode(email: string): Promise<void>;
  signInWithEmail(email: string, code: string): Promise<Session>;
  signOut(): Promise<void>;
  /** Deletes the account and everything of rule 10. Required by the stores. */
  deleteAccount(): Promise<void>;
}

/**
 * Everything the signed-in person can read and do. "Me" is the session: no method takes my
 * own identifier. The day of an action is the day of the phone, given to the implementation
 * when it is built (time is injected, never read here).
 */
export interface SocialRepository {
  readonly isDemonstration: boolean;

  getMyProfile(): Promise<Profile>;
  updateMyProfile(changes: ProfileChanges): Promise<Profile>;

  /** My accepted friends, as each shows themselves to me (rule 4). */
  listFriends(): Promise<readonly FriendView[]>;
  listFriendRequests(): Promise<FriendRequests>;
  /** What I see of a person; null when a block separates us. */
  getPersonView(userId: UserId): Promise<PersonView | null>;

  /**
   * People whose name starts like `query` (rule 11), at most 20, never me nor anyone blocked
   * either way. A refused query is a `SocialRuleError`; too many searches in a minute is
   * `too-many-searches` (the server counts them).
   */
  searchPeople(query: string): Promise<readonly PersonSearchResult[]>;

  sendFriendRequest(toId: UserId): Promise<void>;
  acceptFriendRequest(fromId: UserId): Promise<void>;
  declineFriendRequest(fromId: UserId): Promise<void>;
  removeFriend(friendId: UserId): Promise<void>;

  blockPerson(userId: UserId): Promise<void>;
  unblockPerson(userId: UserId): Promise<void>;
  listBlockedPeople(): Promise<readonly BlockedPerson[]>;

  createInvite(): Promise<Invite>;
  /** Becomes friends with the owner of the code, and shows them. */
  acceptInvite(code: string): Promise<FriendView>;

  sendNudge(toId: UserId, kind: NudgeKind): Promise<void>;
  listReceivedNudges(): Promise<readonly ReceivedNudge[]>;

  /** The groups I am a member of: no other group can be seen (a group of others is `group-not-found`). */
  listMyGroups(): Promise<readonly Group[]>;
  createGroup(name: string): Promise<Group>;
  listGroupMembers(groupId: GroupId): Promise<readonly GroupMemberView[]>;
  addGroupMember(groupId: GroupId, friendId: UserId): Promise<void>;
  /** The owner of a group that has other members names who takes over. */
  leaveGroup(groupId: GroupId, successorId: UserId | null): Promise<void>;
  getGroupLeaderboard(
    groupId: GroupId,
    period: LeaderboardPeriod,
  ): Promise<readonly NamedLeaderboardEntry[]>;

  /** Publishes my garden summary (rule 5), dated today. */
  publishGardenSummary(input: GardenSummaryInput): Promise<void>;
  publishBadges(badges: readonly BadgeInput[]): Promise<void>;
  /** The pages I read for the first time on `day` (D8). */
  publishDailyReading(day: LocalDate, newPages: number): Promise<void>;
}
