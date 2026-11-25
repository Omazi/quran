import { removeGroupMember } from './group';
import type { Group, GroupId, GroupMember, SocialData, UserId } from './types';
import { assertId, assertList, assertObject } from './validation';

/**
 * Rule 10: what is left of the data when an account is deleted. The server does the same with
 * foreign keys and one function (docs/specs/social-database.md); this is the reference the
 * demonstration data follows and the tests of the server are compared with.
 */

const TABLES = [
  'profiles',
  'gardenSummaries',
  'friendships',
  'blocks',
  'invites',
  'nudges',
  'groups',
  'groupMembers',
  'dailyReadings',
  'badges',
  'readingBackups',
] as const;

interface GroupOutcome {
  /** Groups that disappear: the person was their owner and alone in them. */
  readonly gone: ReadonlySet<GroupId>;
  /** Groups whose owner is now another member: group id to the new owner. */
  readonly newOwners: ReadonlyMap<GroupId, UserId>;
}

/** What happens to each group the person owns or belongs to (rule 8 and rule 10). */
function groupOutcome(data: SocialData, userId: UserId): GroupOutcome {
  const gone = new Set<GroupId>();
  const newOwners = new Map<GroupId, UserId>();
  for (const group of data.groups) {
    const members: GroupMember[] = data.groupMembers.filter((row) => row.groupId === group.id);
    const concerned = group.ownerId === userId || members.some((row) => row.userId === userId);
    if (!concerned) continue;

    const state = removeGroupMember({ group, members }, userId);
    if (state === null) gone.add(group.id);
    else if (state.group.ownerId !== group.ownerId) newOwners.set(group.id, state.group.ownerId);
  }
  return { gone, newOwners };
}

function withNewOwner(group: Group, newOwners: ReadonlyMap<GroupId, UserId>): Group {
  const ownerId = newOwners.get(group.id);
  return ownerId === undefined ? group : { ...group, ownerId };
}

function memberWithNewRole(
  member: GroupMember,
  newOwners: ReadonlyMap<GroupId, UserId>,
): GroupMember {
  return newOwners.get(member.groupId) === member.userId ? { ...member, role: 'owner' } : member;
}

/** The data without the person; idempotent, so that a retried deletion is safe. */
export function deleteAccountData(data: SocialData, userId: UserId): SocialData {
  assertObject(data, 'social data');
  for (const table of TABLES) assertList(data[table], table);
  assertId(userId, 'user');

  const { gone, newOwners } = groupOutcome(data, userId);
  return {
    profiles: data.profiles.filter((row) => row.id !== userId),
    gardenSummaries: data.gardenSummaries.filter((row) => row.userId !== userId),
    friendships: data.friendships.filter(
      (row) => row.requesterId !== userId && row.addresseeId !== userId,
    ),
    blocks: data.blocks.filter((row) => row.blockerId !== userId && row.blockedId !== userId),
    invites: data.invites.filter((row) => row.ownerId !== userId),
    nudges: data.nudges.filter((row) => row.fromId !== userId && row.toId !== userId),
    groups: data.groups
      .filter((row) => !gone.has(row.id))
      .map((row) => withNewOwner(row, newOwners)),
    groupMembers: data.groupMembers
      .filter((row) => row.userId !== userId && !gone.has(row.groupId))
      .map((row) => memberWithNewRole(row, newOwners)),
    dailyReadings: data.dailyReadings.filter((row) => row.userId !== userId),
    badges: data.badges.filter((row) => row.userId !== userId),
    readingBackups: data.readingBackups.filter((row) => row.userId !== userId),
  };
}
