import type { ReadingJournal } from '@/domain/khatm';
import type { LocalDate } from '@/domain/shared/local-date';

/**
 * The model of docs/specs/social.md, section 2. The server tables carry the same names in
 * `snake_case`: a field renamed here must be renamed there.
 *
 * Every day is a `LocalDate` written by the phone of the person who acted. Two people do not
 * share a calendar: the days of one row can be a day apart from what the other person calls
 * today, in either direction.
 */

/** The identifier of an account. It is also the identifier of its profile. */
export type UserId = string;

export type GroupId = string;

export interface Profile {
  /** The identifier of the account. */
  readonly id: UserId;
  /** 1 to 30 characters, without spaces at the ends (rule 1). */
  readonly displayName: string;
  /** Whether friends see the garden. True by default (docs/DECISIONS.md, D23). */
  readonly showGarden: boolean;
  /** Whether friends see the level and the badges. True by default (D23). */
  readonly showLevel: boolean;
  readonly createdOn: LocalDate;
}

/**
 * One row per person, published by their own app: all a friend can ever see of a garden. It
 * holds no page number and no time of day (rule 5).
 */
export interface GardenSummary {
  readonly userId: UserId;
  /** Number of the khatma in progress, 1 for the first. */
  readonly level: number;
  /** 0 to 60. */
  readonly hizbCompleted: number;
  /** 0 (dead earth) to 1 (full health). */
  readonly health: number;
  /** Last day the person read a new page, or null when they never did. */
  readonly lastWateredOn: LocalDate | null;
  readonly streakDays: number;
  readonly badgeCount: number;
  readonly updatedOn: LocalDate;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

/**
 * What two people are to each other. There is at most one row per pair of people, whoever
 * asked: a new request replaces the row instead of adding one.
 */
export interface Friendship {
  /** Who sent the request that this row stands for. */
  readonly requesterId: UserId;
  readonly addresseeId: UserId;
  readonly status: FriendshipStatus;
  /** Day the request was sent. */
  readonly createdOn: LocalDate;
  /** Day it was accepted or declined; null while it is pending. */
  readonly respondedOn: LocalDate | null;
}

export interface Block {
  readonly blockerId: UserId;
  readonly blockedId: UserId;
  readonly createdOn: LocalDate;
}

/** A code its owner hands out so that someone can become their friend without a search. */
export interface Invite {
  readonly code: string;
  readonly ownerId: UserId;
  readonly createdOn: LocalDate;
  /** Last day the code can be used. */
  readonly expiresOn: LocalDate;
}

export type NudgeKind = 'encourage' | 'congratulate';

/** A word of encouragement between friends. */
export interface Nudge {
  readonly fromId: UserId;
  readonly toId: UserId;
  readonly kind: NudgeKind;
  /** The sender's day. */
  readonly sentOn: LocalDate;
}

export interface Group {
  readonly id: GroupId;
  /** Checked like a display name (rule 8). */
  readonly name: string;
  /** Always the member whose role is `owner`. */
  readonly ownerId: UserId;
  readonly createdOn: LocalDate;
}

export type GroupRole = 'owner' | 'member';

export interface GroupMember {
  readonly groupId: GroupId;
  readonly userId: UserId;
  readonly role: GroupRole;
  readonly joinedOn: LocalDate;
}

/**
 * The pages a person read for the first time in their khatma on one day (D8: reading a page
 * again never counts). One row per person and per day. It feeds the group leaderboards.
 */
export interface DailyReading {
  readonly userId: UserId;
  readonly day: LocalDate;
  /** 0 to 604. */
  readonly newPages: number;
}

/** A completed khatma. */
export interface Badge {
  readonly userId: UserId;
  readonly khatmNumber: number;
  readonly completedOn: LocalDate;
}

/**
 * The whole reading journal of a person, kept so that they find their progress on another
 * phone (D16). Only its owner may read or change it. Not in service: the owner of the project
 * must confirm it first, because the journal reveals a religious practice.
 */
export interface ReadingBackup {
  readonly userId: UserId;
  readonly journal: ReadingJournal;
  readonly updatedOn: LocalDate;
}

/** Every table of the model, as plain lists: what account deletion (rule 10) works on. */
export interface SocialData {
  readonly profiles: readonly Profile[];
  readonly gardenSummaries: readonly GardenSummary[];
  readonly friendships: readonly Friendship[];
  readonly blocks: readonly Block[];
  readonly invites: readonly Invite[];
  readonly nudges: readonly Nudge[];
  readonly groups: readonly Group[];
  readonly groupMembers: readonly GroupMember[];
  readonly dailyReadings: readonly DailyReading[];
  readonly badges: readonly Badge[];
  readonly readingBackups: readonly ReadingBackup[];
}
