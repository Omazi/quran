import type { GardenState } from '@/domain/garden';
import type { LocalDate } from '@/domain/shared/local-date';
import type {
  FriendRequests,
  FriendView,
  Group,
  GroupId,
  LeaderboardPeriod,
  NamedLeaderboardEntry,
  PersonView,
  SharedLevel,
  UserId,
} from '@/domain/social';

import { gardenStateOf, waterStatusOf, type WaterStatus } from './friend-garden';

/** What a friend's card shows: the picture of their garden, their hizb, their water. */
export interface FriendCard {
  readonly userId: UserId;
  readonly name: string;
  /** Null when the friend hides their garden or has not published it yet. */
  readonly garden: GardenState | null;
  readonly hizbCompleted: number | null;
  readonly water: WaterStatus | null;
  /** Days in a row they have watered; null when the garden is hidden. */
  readonly streakDays: number | null;
}

export interface PendingRequest {
  readonly userId: UserId;
  readonly name: string;
}

export interface GroupLine {
  readonly id: GroupId;
  readonly name: string;
  readonly memberCount: number;
}

/** The Proches tab once signed in. */
export interface FriendsModel {
  /** True while the data is invented: the screen says so (docs/specs/social.md, section 4). */
  readonly isDemonstration: boolean;
  /** Requests sent to me, which I can accept or decline. */
  readonly requests: readonly PendingRequest[];
  readonly friends: readonly FriendCard[];
  readonly groups: readonly GroupLine[];
}

export interface FriendsModelInput {
  readonly isDemonstration: boolean;
  readonly friends: readonly FriendView[];
  readonly requests: FriendRequests;
  readonly groups: readonly { readonly group: Group; readonly memberCount: number }[];
  readonly today: LocalDate;
}

export function friendCardOf(friend: FriendView, today: LocalDate): FriendCard {
  const { garden } = friend;
  return {
    userId: friend.userId,
    name: friend.displayName,
    garden: garden === null ? null : gardenStateOf(garden, today),
    hizbCompleted: garden === null ? null : garden.hizbCompleted,
    water: garden === null ? null : waterStatusOf(garden.lastWateredOn, today),
    streakDays: garden === null ? null : garden.streakDays,
  };
}

export function buildFriendsModel(input: FriendsModelInput): FriendsModel {
  return {
    isDemonstration: input.isDemonstration,
    // Only what was sent to me: my own requests wait on the other side, and a search shows them.
    requests: input.requests.incoming.map(({ person }) => ({
      userId: person.userId,
      name: person.displayName,
    })),
    friends: input.friends.map((friend) => friendCardOf(friend, input.today)),
    groups: input.groups.map(({ group, memberCount }) => ({
      id: group.id,
      name: group.name,
      memberCount,
    })),
  };
}

/** A friend's page. */
export type FriendPageModel =
  | {
      readonly status: 'friend';
      readonly isDemonstration: boolean;
      readonly card: FriendCard;
      /** Null when the friend hides their garden or has not published it. */
      readonly streakDays: number | null;
      /** Level, badges and reading counters; null when the friend hides them (D23, D37). */
      readonly level: SharedLevel | null;
      /** One encouragement per friend and per day (rule 7): true once today's is sent. */
      readonly encouragedToday: boolean;
    }
  | {
      /** Someone who is not, or no longer, my friend: their name only (rule 4). */
      readonly status: 'not-friend';
      readonly isDemonstration: boolean;
      readonly userId: UserId;
      readonly name: string;
    }
  /** A block separates us, or the person does not exist: the same answer (rule 3). */
  | { readonly status: 'unavailable'; readonly isDemonstration: boolean };

export interface FriendPageInput {
  readonly isDemonstration: boolean;
  readonly view: PersonView | null;
  readonly encouragedToday: boolean;
  readonly today: LocalDate;
}

export function buildFriendPageModel(input: FriendPageInput): FriendPageModel {
  const { view, isDemonstration } = input;
  if (view === null || view.kind === 'self') return { status: 'unavailable', isDemonstration };
  if (view.kind === 'other') {
    return { status: 'not-friend', isDemonstration, userId: view.userId, name: view.displayName };
  }
  return {
    status: 'friend',
    isDemonstration,
    card: friendCardOf(view, input.today),
    streakDays: view.garden === null ? null : view.garden.streakDays,
    level: view.level,
    encouragedToday: input.encouragedToday,
  };
}

export interface LeaderboardLine {
  readonly userId: UserId;
  readonly name: string;
  readonly rank: number;
  readonly newPages: number;
  readonly isMe: boolean;
}

export interface GroupModel {
  readonly isDemonstration: boolean;
  readonly id: GroupId;
  readonly name: string;
  readonly period: LeaderboardPeriod['kind'];
  readonly leaderboard: readonly LeaderboardLine[];
  /** My friends who are not in the group yet: who I can add (rule 8, without their consent, D36). */
  readonly friendsToAdd: readonly PendingRequest[];
}

export interface GroupModelInput {
  readonly isDemonstration: boolean;
  readonly group: Group;
  readonly period: LeaderboardPeriod['kind'];
  readonly leaderboard: readonly NamedLeaderboardEntry[];
  readonly memberIds: readonly UserId[];
  readonly friends: readonly FriendView[];
  readonly myId: UserId;
}

export function buildGroupModel(input: GroupModelInput): GroupModel {
  const members = new Set(input.memberIds);
  return {
    isDemonstration: input.isDemonstration,
    id: input.group.id,
    name: input.group.name,
    period: input.period,
    leaderboard: input.leaderboard.map((entry) => ({
      userId: entry.userId,
      name: entry.displayName,
      rank: entry.rank,
      newPages: entry.newPages,
      isMe: entry.userId === input.myId,
    })),
    friendsToAdd: input.friends
      .filter((friend) => !members.has(friend.userId))
      .map((friend) => ({ userId: friend.userId, name: friend.displayName })),
  };
}
