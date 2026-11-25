import type { LocalDate } from '@/domain/shared/local-date';
import {
  acceptFriendRequest,
  acceptInvite,
  addGroupMember,
  applyProfileChanges,
  blockPerson,
  bondBetween,
  computeLeaderboard,
  createGroup,
  createInvite,
  declineFriendRequest,
  generateInviteCode,
  isBlockedEitherWay,
  leaveGroup,
  parseInviteCode,
  removeFriendship,
  replaceBond,
  requestFriendship,
  searchPeople,
  sendNudge,
  SocialRuleError,
  toBadges,
  toDailyReading,
  toGardenSummary,
  unblockPerson,
  viewOf,
  type Block,
  type Bond,
  type FriendRequestView,
  type FriendView,
  type Group,
  type GroupMemberView,
  type GroupState,
  type NamedLeaderboardEntry,
  type PersonData,
  type PersonView,
  type Profile,
  type SocialData,
  type SocialRepository,
  type UserId,
} from '@/domain/social';

import type { DemoStore } from './demo-store';

/**
 * `SocialRepository` on memory. It decides nothing: each method reads the rows it needs, calls
 * the function of the domain that holds the rule, and writes back what that function returns.
 * What a rule refuses reaches the caller as a rejected promise, as a server's answer will.
 */

export interface DemoRepositoryOptions {
  readonly store: DemoStore;
  /** The day of the phone, asked at each action: a long session sees midnight go by. */
  readonly today: () => LocalDate;
  /** A whole number from 0 to `size - 1`, for invitation codes. */
  readonly randomIndex: (size: number) => number;
  /** Who acts: the signed-in person, or a fixed person for a demonstration of the other side. */
  readonly actingUser: () => UserId;
}

/** Tries a new code until one is free: two live invitations never share a code. */
const MAX_CODE_ATTEMPTS = 20;

function byName(
  first: { displayName: string; userId: UserId },
  second: { displayName: string; userId: UserId },
): number {
  return (
    first.displayName.localeCompare(second.displayName) || first.userId.localeCompare(second.userId)
  );
}

export function createDemoRepository(options: DemoRepositoryOptions): SocialRepository {
  const { store, today, randomIndex } = options;

  function me(): UserId {
    return options.actingUser();
  }

  function profileOf(userId: UserId): Profile {
    const profile = store.data.profiles.find((row) => row.id === userId);
    // The answer for an account that does not exist is the same as for a blocked one.
    if (profile === undefined) throw new SocialRuleError('person-unavailable', 'no such person');
    return profile;
  }

  function personData(userId: UserId): PersonData {
    return {
      profile: profileOf(userId),
      garden: store.data.gardenSummaries.find((row) => row.userId === userId) ?? null,
      badges: store.data.badges.filter((row) => row.userId === userId),
    };
  }

  function bondWith(otherId: UserId): Bond {
    return bondBetween(store.data, me(), otherId);
  }

  function writeBond(otherId: UserId, bond: Bond): void {
    const tables = replaceBond(store.data, me(), otherId, bond);
    store.data = { ...store.data, ...tables };
  }

  function change(changes: Partial<SocialData>): void {
    store.data = { ...store.data, ...changes };
  }

  function groupState(groupId: string): GroupState {
    const group = store.data.groups.find((row) => row.id === groupId);
    const members = store.data.groupMembers.filter((row) => row.groupId === groupId);
    // A group of others and a group that does not exist are not told apart.
    if (group === undefined || !members.some((row) => row.userId === me())) {
      throw new SocialRuleError('group-not-found', 'no such group');
    }
    return { group, members };
  }

  function writeGroup(groupId: string, next: GroupState | null): void {
    const groups = store.data.groups.filter((row) => row.id !== groupId);
    const members = store.data.groupMembers.filter((row) => row.groupId !== groupId);
    change({
      groups: next === null ? groups : [...groups, next.group],
      groupMembers: next === null ? members : [...members, ...next.members],
    });
  }

  function friendViewOf(userId: UserId): FriendView {
    const view = viewOf(personData(userId), me(), bondWith(userId));
    if (view === null || view.kind !== 'friend') {
      throw new SocialRuleError('not-friends', 'this person is not a friend');
    }
    return view;
  }

  /** The other person of a row, or null when a block hides them. */
  function otherView(userId: UserId): PersonView | null {
    return viewOf(personData(userId), me(), bondWith(userId));
  }

  return {
    isDemonstration: true,

    async getMyProfile() {
      return profileOf(me());
    },

    async updateMyProfile(changes) {
      const updated = applyProfileChanges(profileOf(me()), changes);
      change({
        profiles: store.data.profiles.map((row) => (row.id === updated.id ? updated : row)),
      });
      return updated;
    },

    async listFriends() {
      const friendIds = store.data.friendships
        .filter(
          (row) =>
            row.status === 'accepted' && (row.requesterId === me() || row.addresseeId === me()),
        )
        .map((row) => (row.requesterId === me() ? row.addresseeId : row.requesterId));
      const views = friendIds.flatMap((id) => {
        const view = otherView(id);
        return view !== null && view.kind === 'friend' ? [view] : [];
      });
      return views.sort(byName);
    },

    async listFriendRequests() {
      const pending = store.data.friendships.filter(
        (row) => row.status === 'pending' && (row.requesterId === me() || row.addresseeId === me()),
      );
      const incoming: FriendRequestView[] = [];
      const outgoing: FriendRequestView[] = [];
      for (const row of pending) {
        const incomingRow = row.addresseeId === me();
        const view = otherView(incomingRow ? row.requesterId : row.addresseeId);
        if (view === null || view.kind !== 'other') continue;
        (incomingRow ? incoming : outgoing).push({ person: view, sentOn: row.createdOn });
      }
      const newestFirst = (a: FriendRequestView, b: FriendRequestView): number =>
        b.sentOn.localeCompare(a.sentOn) || byName(a.person, b.person);
      return { incoming: incoming.sort(newestFirst), outgoing: outgoing.sort(newestFirst) };
    },

    async getPersonView(userId) {
      return otherView(userId);
    },

    async searchPeople(query) {
      const candidates = store.data.profiles
        .filter((profile) => profile.id !== me())
        .map((profile) => ({ profile, bond: bondWith(profile.id) }));
      return searchPeople(me(), query, candidates);
    },

    async sendFriendRequest(toId) {
      profileOf(toId);
      writeBond(toId, requestFriendship(bondWith(toId), me(), toId, today()));
    },

    async acceptFriendRequest(fromId) {
      writeBond(fromId, acceptFriendRequest(bondWith(fromId), me(), today()));
    },

    async declineFriendRequest(fromId) {
      writeBond(fromId, declineFriendRequest(bondWith(fromId), me(), today()));
    },

    async removeFriend(friendId) {
      writeBond(friendId, removeFriendship(bondWith(friendId), me()));
    },

    async blockPerson(userId) {
      profileOf(userId);
      writeBond(userId, blockPerson(bondWith(userId), me(), userId, today()));
    },

    async unblockPerson(userId) {
      writeBond(userId, unblockPerson(bondWith(userId), me(), userId));
    },

    async listBlockedPeople() {
      return store.data.blocks
        .filter((row: Block) => row.blockerId === me())
        .map((row) => ({
          userId: row.blockedId,
          displayName: profileOf(row.blockedId).displayName,
          blockedOn: row.createdOn,
        }))
        .sort(byName);
    },

    async createInvite() {
      const taken = new Set(store.data.invites.map((row) => row.code));
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
        const code = generateInviteCode(randomIndex);
        if (taken.has(code)) continue;
        const invite = createInvite(me(), code, today());
        change({ invites: [...store.data.invites, invite] });
        return invite;
      }
      throw new Error('No free invitation code found: the source of randomness is stuck');
    },

    async acceptInvite(code) {
      const invite = store.data.invites.find((row) => row.code === parseInviteCode(code));
      if (invite === undefined) throw new SocialRuleError('invite-not-found', 'no such code');
      writeBond(invite.ownerId, acceptInvite(bondWith(invite.ownerId), invite, me(), today()));
      return friendViewOf(invite.ownerId);
    },

    async sendNudge(toId, kind) {
      profileOf(toId);
      const nudge = sendNudge(
        { fromId: me(), toId, kind, today: today() },
        bondWith(toId),
        store.data.nudges,
      );
      change({ nudges: [...store.data.nudges, nudge] });
    },

    async listReceivedNudges() {
      return store.data.nudges
        .filter((row) => row.toId === me() && !isBlockedEitherWay(bondWith(row.fromId)))
        .map((row) => ({
          fromId: row.fromId,
          fromName: profileOf(row.fromId).displayName,
          kind: row.kind,
          sentOn: row.sentOn,
        }))
        .sort((a, b) => b.sentOn.localeCompare(a.sentOn) || a.fromId.localeCompare(b.fromId));
    },

    async listMyGroups() {
      const mine = new Set(
        store.data.groupMembers.filter((row) => row.userId === me()).map((row) => row.groupId),
      );
      return store.data.groups
        .filter((row) => mine.has(row.id))
        .sort((a, b) => a.createdOn.localeCompare(b.createdOn) || a.id.localeCompare(b.id));
    },

    async createGroup(name): Promise<Group> {
      const id = `demo-group-${store.nextGroupNumber}`;
      const state = createGroup(id, name, me(), today());
      store.nextGroupNumber += 1;
      writeGroup(id, state);
      return state.group;
    },

    async listGroupMembers(groupId) {
      const views: GroupMemberView[] = groupState(groupId).members.map((member) => ({
        userId: member.userId,
        displayName: profileOf(member.userId).displayName,
        role: member.role,
        joinedOn: member.joinedOn,
      }));
      return views;
    },

    async addGroupMember(groupId, friendId) {
      profileOf(friendId);
      writeGroup(
        groupId,
        addGroupMember(groupState(groupId), me(), friendId, bondWith(friendId), today()),
      );
    },

    async leaveGroup(groupId, successorId) {
      writeGroup(groupId, leaveGroup(groupState(groupId), me(), successorId));
    },

    async getGroupLeaderboard(groupId, period) {
      const memberIds = groupState(groupId).members.map((row) => row.userId);
      const entries = computeLeaderboard(memberIds, store.data.dailyReadings, period);
      return entries.map((entry): NamedLeaderboardEntry => ({
        ...entry,
        displayName: profileOf(entry.userId).displayName,
      }));
    },

    async publishGardenSummary(input) {
      const summary = toGardenSummary(me(), input, today());
      change({
        gardenSummaries: [
          ...store.data.gardenSummaries.filter((row) => row.userId !== me()),
          summary,
        ],
      });
    },

    async publishBadges(badges) {
      const published = toBadges(me(), badges, today());
      change({ badges: [...store.data.badges.filter((row) => row.userId !== me()), ...published] });
    },

    async publishDailyReading(day, newPages) {
      const reading = toDailyReading(me(), day, newPages, today());
      change({
        dailyReadings: [
          ...store.data.dailyReadings.filter((row) => !(row.userId === me() && row.day === day)),
          reading,
        ],
      });
    },
  };
}
