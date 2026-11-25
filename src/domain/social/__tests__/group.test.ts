import { addDays } from '@/domain/shared/local-date';

import {
  acceptFriendRequest,
  addGroupMember,
  blockPerson,
  createGroup,
  leaveGroup,
  NO_BOND,
  removeGroupMember,
  requestFriendship,
  SOCIAL_CONFIG,
  type Bond,
  type GroupMember,
  type GroupState,
} from '../index';
import {
  day,
  expectRefusal,
  IMPOSSIBLE_DAY,
  MUSTAPHA,
  NOT_TEXT,
  OMAR,
  SARAH,
  TAGHREAD,
  TODAY,
} from '../test-support/social-test-kit';

const GROUP_ID = 'group-family';
const TOMORROW = addDays(TODAY, 1);

function friendsBond(first: string, second: string): Bond {
  return acceptFriendRequest(requestFriendship(NO_BOND, first, second, TODAY), second, TODAY);
}

const OMAR_ALONE: GroupState = createGroup(GROUP_ID, 'Family', OMAR, TODAY);
const WITH_MUSTAPHA: GroupState = addGroupMember(
  OMAR_ALONE,
  OMAR,
  MUSTAPHA,
  friendsBond(OMAR, MUSTAPHA),
  TOMORROW,
);

function member(userId: string, role: 'owner' | 'member', joinedOn = TODAY): GroupMember {
  return { groupId: GROUP_ID, userId, role, joinedOn };
}

describe('Rule 8 — group (groupe)', () => {
  describe('creating', () => {
    it('the creator is the owner and the only member', () => {
      expect(OMAR_ALONE).toEqual({
        group: { id: GROUP_ID, name: 'Family', ownerId: OMAR, createdOn: TODAY },
        members: [member(OMAR, 'owner')],
      });
    });

    it('the name is checked like a display name: edge spaces are removed', () => {
      expect(createGroup(GROUP_ID, '  Family  ', OMAR, TODAY).group.name).toBe('Family');
    });

    it('a name of 30 characters is accepted; 31 is refused', () => {
      expect(createGroup(GROUP_ID, 'a'.repeat(30), OMAR, TODAY).group.name).toHaveLength(30);
      expectRefusal(() => createGroup(GROUP_ID, 'a'.repeat(31), OMAR, TODAY), 'name-too-long');
    });

    it('an empty name and a name with a line break are refused', () => {
      expectRefusal(() => createGroup(GROUP_ID, '   ', OMAR, TODAY), 'name-empty');
      expectRefusal(
        () => createGroup(GROUP_ID, 'Fam\nily', OMAR, TODAY),
        'name-forbidden-character',
      );
    });

    it('refuses a name that is not text, an empty identifier and an impossible day', () => {
      expect(() => createGroup(GROUP_ID, NOT_TEXT, OMAR, TODAY)).toThrow(TypeError);
      expect(() => createGroup('', 'Family', OMAR, TODAY)).toThrow(RangeError);
      expect(() => createGroup(GROUP_ID, 'Family', OMAR, IMPOSSIBLE_DAY)).toThrow(RangeError);
    });
  });

  describe('joining by the invitation of a member who is a friend', () => {
    it('adds the friend as a member, on the day of the invitation', () => {
      expect(WITH_MUSTAPHA.members).toEqual([
        member(OMAR, 'owner'),
        member(MUSTAPHA, 'member', TOMORROW),
      ]);
      expect(WITH_MUSTAPHA.group.ownerId).toBe(OMAR);
    });

    it('any member can invite, not only the owner', () => {
      const withSarah = addGroupMember(
        WITH_MUSTAPHA,
        MUSTAPHA,
        SARAH,
        friendsBond(MUSTAPHA, SARAH),
        TOMORROW,
      );

      expect(withSarah.members.map((m) => m.userId)).toEqual([OMAR, MUSTAPHA, SARAH]);
    });

    it('someone who is not a member cannot invite', () => {
      expectRefusal(
        () => addGroupMember(OMAR_ALONE, SARAH, MUSTAPHA, friendsBond(SARAH, MUSTAPHA), TODAY),
        'not-a-member',
      );
    });

    it('a person who is not the friend of the inviter cannot be invited', () => {
      expectRefusal(() => addGroupMember(OMAR_ALONE, OMAR, SARAH, NO_BOND, TODAY), 'not-friends');
      expectRefusal(
        () =>
          addGroupMember(
            OMAR_ALONE,
            OMAR,
            SARAH,
            requestFriendship(NO_BOND, OMAR, SARAH, TODAY),
            TODAY,
          ),
        'not-friends',
      );
    });

    it('a person already in the group cannot be invited again', () => {
      expectRefusal(
        () => addGroupMember(WITH_MUSTAPHA, OMAR, MUSTAPHA, friendsBond(OMAR, MUSTAPHA), TODAY),
        'already-a-member',
      );
    });

    it('a blocked person cannot be invited, and cannot invite', () => {
      const friendsThenBlocked = (blocker: string, blocked: string): Bond =>
        blockPerson(friendsBond(OMAR, SARAH), blocker, blocked, TODAY);

      expectRefusal(
        () => addGroupMember(OMAR_ALONE, OMAR, SARAH, friendsThenBlocked(OMAR, SARAH), TODAY),
        'you-blocked-them',
      );
      expectRefusal(
        () => addGroupMember(OMAR_ALONE, OMAR, SARAH, friendsThenBlocked(SARAH, OMAR), TODAY),
        'person-unavailable',
      );
    });

    it('a group holds maxGroupMembers members at most: the last seat is free, the next is refused', () => {
      const almostFull = fillGroup(SOCIAL_CONFIG.maxGroupMembers - 1);

      const full = addGroupMember(almostFull, OMAR, TAGHREAD, friendsBond(OMAR, TAGHREAD), TODAY);

      expect(full.members).toHaveLength(SOCIAL_CONFIG.maxGroupMembers);
      expectRefusal(
        () => addGroupMember(full, OMAR, SARAH, friendsBond(OMAR, SARAH), TODAY),
        'group-full',
      );
    });
  });

  describe('leaving', () => {
    it('a member leaves: the group keeps its owner', () => {
      const after = leaveGroup(WITH_MUSTAPHA, MUSTAPHA, null);

      expect(after).toEqual(OMAR_ALONE);
    });

    it('someone who is not a member cannot leave', () => {
      expectRefusal(() => leaveGroup(WITH_MUSTAPHA, SARAH, null), 'not-a-member');
    });

    it('the owner cannot leave a group that has other members without handing it over', () => {
      expectRefusal(() => leaveGroup(WITH_MUSTAPHA, OMAR, null), 'owner-must-hand-over');
    });

    it('the owner hands the group to a member, who becomes the owner, and leaves', () => {
      const after = leaveGroup(WITH_MUSTAPHA, OMAR, MUSTAPHA);

      expect(after?.group.ownerId).toBe(MUSTAPHA);
      expect(after?.members).toEqual([member(MUSTAPHA, 'owner', TOMORROW)]);
    });

    it('the owner cannot hand the group to someone outside it, or to themselves', () => {
      expectRefusal(() => leaveGroup(WITH_MUSTAPHA, OMAR, SARAH), 'successor-not-a-member');
      expectRefusal(() => leaveGroup(WITH_MUSTAPHA, OMAR, OMAR), 'successor-not-a-member');
    });

    it('the owner alone leaves: the group disappears', () => {
      expect(leaveGroup(OMAR_ALONE, OMAR, null)).toBeNull();
    });

    it('a member who is not the owner has nobody to hand over to: naming a successor is an error', () => {
      expect(() => leaveGroup(WITH_MUSTAPHA, MUSTAPHA, OMAR)).toThrow(RangeError);
    });
  });

  describe('removing a member whose account is deleted (rule 10)', () => {
    it('the group passes to the oldest member', () => {
      const three = addGroupMember(
        WITH_MUSTAPHA,
        OMAR,
        SARAH,
        friendsBond(OMAR, SARAH),
        addDays(TODAY, 5),
      );

      const after = removeGroupMember(three, OMAR);

      expect(after?.group.ownerId).toBe(MUSTAPHA);
      expect(after?.members.map((m) => [m.userId, m.role])).toEqual([
        [MUSTAPHA, 'owner'],
        [SARAH, 'member'],
      ]);
    });

    it('members who joined the same day: the lowest identifier is the oldest, so that every copy picks the same', () => {
      const sameDay = addGroupMember(
        WITH_MUSTAPHA,
        OMAR,
        SARAH,
        friendsBond(OMAR, SARAH),
        TOMORROW,
      );

      expect(removeGroupMember(sameDay, OMAR)?.group.ownerId).toBe(MUSTAPHA);
    });

    it('the group disappears if the owner was alone', () => {
      expect(removeGroupMember(OMAR_ALONE, OMAR)).toBeNull();
    });

    it('a member who is not the owner just goes', () => {
      expect(removeGroupMember(WITH_MUSTAPHA, MUSTAPHA)).toEqual(OMAR_ALONE);
    });

    it('someone who is not a member changes nothing', () => {
      expect(removeGroupMember(WITH_MUSTAPHA, SARAH)).toEqual(WITH_MUSTAPHA);
    });
  });

  describe('a group that is damaged is refused', () => {
    const base = WITH_MUSTAPHA;
    const damaged: readonly (readonly [string, GroupState])[] = [
      [
        'an owner that is not the member with the owner role',
        { ...base, group: { ...base.group, ownerId: MUSTAPHA } },
      ],
      ['two owners', { ...base, members: [member(OMAR, 'owner'), member(MUSTAPHA, 'owner')] }],
      ['no owner', { ...base, members: [member(OMAR, 'member')] }],
      [
        'the same member twice',
        { ...base, members: [member(OMAR, 'owner'), member(OMAR, 'member')] },
      ],
      [
        'a member of another group',
        {
          ...base,
          members: [member(OMAR, 'owner'), { ...member(SARAH, 'member'), groupId: 'other' }],
        },
      ],
      ['no member', { ...base, members: [] }],
      [
        'an unknown role',
        {
          ...base,
          members: [
            member(OMAR, 'owner'),
            { ...member(SARAH, 'member'), role: 'admin' as 'member' },
          ],
        },
      ],
      ['an impossible join day', { ...base, members: [member(OMAR, 'owner', IMPOSSIBLE_DAY)] }],
    ];

    it.each(damaged)('%s', (_label, state) => {
      expect(() => leaveGroup(state, OMAR, null)).toThrow(RangeError);
    });

    it('more members than the maximum', () => {
      const tooMany = fillGroup(SOCIAL_CONFIG.maxGroupMembers + 1, true);

      expect(() => leaveGroup(tooMany, OMAR, null)).toThrow(RangeError);
    });

    it('a state that is not an object is a TypeError', () => {
      expect(() => leaveGroup(null as unknown as GroupState, OMAR, null)).toThrow(TypeError);
    });
  });

  it('no function changes the group it receives', () => {
    const before = JSON.stringify(WITH_MUSTAPHA);
    leaveGroup(WITH_MUSTAPHA, OMAR, MUSTAPHA);
    removeGroupMember(WITH_MUSTAPHA, OMAR);

    expect(JSON.stringify(WITH_MUSTAPHA)).toBe(before);
  });
});

/** A group of Omar with `count` members in all, built row by row (not through the rule). */
function fillGroup(count: number, allowTooMany = false): GroupState {
  const members: GroupMember[] = [member(OMAR, 'owner', day('2026-01-01'))];
  for (let number = 1; number < count; number += 1) {
    members.push(member(`user-filler-${number}`, 'member', day('2026-01-02')));
  }
  if (!allowTooMany && members.length > SOCIAL_CONFIG.maxGroupMembers)
    throw new Error('test setup');
  return { group: OMAR_ALONE.group, members };
}
