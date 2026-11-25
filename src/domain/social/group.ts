import { compareLocalDates, type LocalDate } from '@/domain/shared/local-date';

import { assertBondBetween, type Bond } from './bond';
import { assertNoBlock } from './blocking';
import { SOCIAL_CONFIG } from './config';
import { parseDisplayName } from './display-name';
import { SocialRuleError } from './errors';
import type { GroupId, GroupMember, GroupRole, GroupState, UserId } from './types';
import { assertId, assertList, assertLocalDate, assertObject } from './validation';

/**
 * Rule 8: groups. A group is its row and its members; every function takes the state of one
 * group and gives the state it becomes, or `null` when the group disappears.
 */

const GROUP_ROLES: readonly GroupRole[] = ['owner', 'member'];

function assertGroupState(state: GroupState): void {
  assertObject(state, 'group state');
  assertObject(state.group, 'group');
  assertId(state.group.id, 'group id');
  assertId(state.group.ownerId, 'group owner');
  assertLocalDate(state.group.createdOn, 'group createdOn');
  assertList(state.members, 'group members');

  if (state.members.length < 1 || state.members.length > SOCIAL_CONFIG.maxGroupMembers) {
    throw new RangeError(
      `Invalid group: ${state.members.length} members (expected 1 to ${SOCIAL_CONFIG.maxGroupMembers})`,
    );
  }
  const seen = new Set<UserId>();
  for (const member of state.members) {
    assertObject(member, 'group member');
    assertId(member.userId, 'group member id');
    assertLocalDate(member.joinedOn, 'group member joinedOn');
    if (!GROUP_ROLES.includes(member.role)) {
      throw new RangeError(`Invalid group member role: ${String(member.role)}`);
    }
    if (member.groupId !== state.group.id) {
      throw new RangeError('Invalid group: a member belongs to another group');
    }
    if (seen.has(member.userId)) {
      throw new RangeError('Invalid group: the same person is a member twice');
    }
    seen.add(member.userId);
  }
  const owners = state.members.filter((member) => member.role === 'owner');
  const [owner] = owners;
  if (owners.length !== 1 || owner === undefined || owner.userId !== state.group.ownerId) {
    throw new RangeError(
      'Invalid group: exactly one member, the owner of the group, has the owner role',
    );
  }
}

function isMember(state: GroupState, userId: UserId): boolean {
  return state.members.some((member) => member.userId === userId);
}

/** Oldest first: by the day they joined, then by identifier so that every copy chooses alike. */
function compareSeniority(first: GroupMember, second: GroupMember): number {
  const byDay = compareLocalDates(first.joinedOn, second.joinedOn);
  if (byDay !== 0) return byDay;
  return first.userId < second.userId ? -1 : first.userId > second.userId ? 1 : 0;
}

/** A new group: the creator is its owner and its only member. */
export function createGroup(
  id: GroupId,
  rawName: string,
  ownerId: UserId,
  today: LocalDate,
): GroupState {
  assertId(id, 'group id');
  assertId(ownerId, 'owner');
  assertLocalDate(today, 'today');
  const name = parseDisplayName(rawName);
  return {
    group: { id, name, ownerId, createdOn: today },
    members: [{ groupId: id, userId: ownerId, role: 'owner', joinedOn: today }],
  };
}

/**
 * `inviterId`, a member, brings in `newMemberId`, who must be their accepted friend, with no
 * block between them. `bond` is the bond between those two.
 */
export function addGroupMember(
  state: GroupState,
  inviterId: UserId,
  newMemberId: UserId,
  bond: Bond,
  today: LocalDate,
): GroupState {
  assertGroupState(state);
  assertId(inviterId, 'inviter');
  assertId(newMemberId, 'new member');
  assertLocalDate(today, 'today');

  if (!isMember(state, inviterId)) {
    throw new SocialRuleError('not-a-member', 'only a member invites');
  }
  assertBondBetween(bond, inviterId, newMemberId);
  assertNoBlock(bond, inviterId, newMemberId);
  if (isMember(state, newMemberId)) {
    throw new SocialRuleError('already-a-member', 'this person is already in the group');
  }
  if (bond.friendship === null || bond.friendship.status !== 'accepted') {
    throw new SocialRuleError('not-friends', 'only a friend of the inviter can be invited');
  }
  if (state.members.length >= SOCIAL_CONFIG.maxGroupMembers) {
    throw new SocialRuleError(
      'group-full',
      `a group has ${SOCIAL_CONFIG.maxGroupMembers} members at most`,
    );
  }
  const joined: GroupMember = {
    groupId: state.group.id,
    userId: newMemberId,
    role: 'member',
    joinedOn: today,
  };
  return { ...state, members: [...state.members, joined] };
}

/** The group without `userId`; the owner's seat goes to the oldest remaining member. */
function without(state: GroupState, userId: UserId, successorId: UserId | null): GroupState | null {
  const remaining = state.members.filter((member) => member.userId !== userId);
  if (remaining.length === 0) return null;
  if (state.group.ownerId !== userId) return { ...state, members: remaining };

  const successor =
    remaining.find((member) => member.userId === successorId) ??
    [...remaining].sort(compareSeniority)[0];
  // Never undefined: `remaining` is not empty.
  if (successor === undefined) return null;
  return {
    group: { ...state.group, ownerId: successor.userId },
    members: remaining.map((member) =>
      member.userId === successor.userId ? { ...member, role: 'owner' } : member,
    ),
  };
}

/**
 * A member leaves. The owner of a group that has other members names who takes over; the owner
 * of a group they are alone in takes the group with them (`null`).
 */
export function leaveGroup(
  state: GroupState,
  userId: UserId,
  successorId: UserId | null,
): GroupState | null {
  assertGroupState(state);
  assertId(userId, 'member');
  if (successorId !== null) assertId(successorId, 'successor');

  if (!isMember(state, userId)) {
    throw new SocialRuleError('not-a-member', 'only a member leaves a group');
  }
  if (state.group.ownerId !== userId) {
    if (successorId !== null) {
      throw new RangeError('Invalid hand-over: only the owner hands a group over');
    }
    return without(state, userId, null);
  }
  if (state.members.length === 1) {
    if (successorId !== null) {
      throw new SocialRuleError('successor-not-a-member', 'there is nobody to hand the group to');
    }
    return null;
  }
  if (successorId === null) {
    throw new SocialRuleError('owner-must-hand-over', 'name a member to take over before leaving');
  }
  if (successorId === userId || !isMember(state, successorId)) {
    throw new SocialRuleError(
      'successor-not-a-member',
      'the new owner is another member of the group',
    );
  }
  return without(state, userId, successorId);
}

/**
 * A person is taken out of the group without their say: their account is deleted (rule 10).
 * The owner's seat goes to the oldest member; a group left empty disappears. A person who is
 * not a member changes nothing.
 */
export function removeGroupMember(state: GroupState, userId: UserId): GroupState | null {
  assertGroupState(state);
  assertId(userId, 'member');
  if (!isMember(state, userId)) return state;
  return without(state, userId, null);
}
