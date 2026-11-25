import { EMPTY_JOURNAL } from '@/domain/khatm';
import { addDays } from '@/domain/shared/local-date';

import { deleteAccountData, type GardenSummary, type SocialData } from '../index';
import {
  day,
  IMPOSSIBLE_DAY,
  MUSTAPHA,
  OMAR,
  profileOf,
  SARAH,
  TAGHREAD,
  TODAY,
} from '../test-support/social-test-kit';

const GROUP_BIG = 'group-big';
const GROUP_SMALL = 'group-small';
const GROUP_SOLO = 'group-solo';
const GROUP_OTHERS = 'group-others';

function garden(userId: string): GardenSummary {
  return {
    userId,
    level: 1,
    hizbCompleted: 3,
    health: 1,
    lastWateredOn: TODAY,
    streakDays: 1,
    badgeCount: 0,
    wordsRead: 0,
    versesRead: 0,
    hasanatEstimate: 0,
    updatedOn: TODAY,
  };
}

/** Every table holds rows of Omar and of the others, so that nothing is deleted by luck. */
function fullData(): SocialData {
  const early = day('2026-01-01');
  const late = day('2026-06-01');
  return {
    profiles: [OMAR, MUSTAPHA, SARAH, TAGHREAD].map((id) => profileOf(id, id)),
    gardenSummaries: [OMAR, MUSTAPHA, SARAH].map(garden),
    friendships: [
      {
        requesterId: OMAR,
        addresseeId: MUSTAPHA,
        status: 'accepted',
        createdOn: TODAY,
        respondedOn: TODAY,
      },
      {
        requesterId: SARAH,
        addresseeId: OMAR,
        status: 'pending',
        createdOn: TODAY,
        respondedOn: null,
      },
      {
        requesterId: MUSTAPHA,
        addresseeId: SARAH,
        status: 'accepted',
        createdOn: TODAY,
        respondedOn: TODAY,
      },
    ],
    blocks: [
      { blockerId: OMAR, blockedId: TAGHREAD, createdOn: TODAY },
      { blockerId: TAGHREAD, blockedId: OMAR, createdOn: TODAY },
      { blockerId: SARAH, blockedId: TAGHREAD, createdOn: TODAY },
    ],
    invites: [
      { code: 'AAAAAAAA', ownerId: OMAR, createdOn: TODAY, expiresOn: addDays(TODAY, 7) },
      { code: 'BBBBBBBB', ownerId: SARAH, createdOn: TODAY, expiresOn: addDays(TODAY, 7) },
    ],
    nudges: [
      { fromId: OMAR, toId: MUSTAPHA, kind: 'encourage', sentOn: TODAY },
      { fromId: MUSTAPHA, toId: OMAR, kind: 'congratulate', sentOn: TODAY },
      { fromId: MUSTAPHA, toId: SARAH, kind: 'encourage', sentOn: TODAY },
    ],
    groups: [
      { id: GROUP_BIG, name: 'Big', ownerId: OMAR, createdOn: early },
      { id: GROUP_SMALL, name: 'Small', ownerId: MUSTAPHA, createdOn: early },
      { id: GROUP_SOLO, name: 'Solo', ownerId: OMAR, createdOn: early },
      { id: GROUP_OTHERS, name: 'Others', ownerId: SARAH, createdOn: early },
    ],
    groupMembers: [
      { groupId: GROUP_BIG, userId: OMAR, role: 'owner', joinedOn: early },
      { groupId: GROUP_BIG, userId: TAGHREAD, role: 'member', joinedOn: late },
      { groupId: GROUP_BIG, userId: SARAH, role: 'member', joinedOn: early },
      { groupId: GROUP_SMALL, userId: MUSTAPHA, role: 'owner', joinedOn: early },
      { groupId: GROUP_SMALL, userId: OMAR, role: 'member', joinedOn: late },
      { groupId: GROUP_SOLO, userId: OMAR, role: 'owner', joinedOn: early },
      { groupId: GROUP_OTHERS, userId: SARAH, role: 'owner', joinedOn: early },
    ],
    dailyReadings: [
      { userId: OMAR, day: TODAY, newPages: 5 },
      { userId: MUSTAPHA, day: TODAY, newPages: 6 },
    ],
    badges: [
      { userId: OMAR, khatmNumber: 1, completedOn: early },
      { userId: SARAH, khatmNumber: 1, completedOn: early },
    ],
    readingBackups: [
      { userId: OMAR, journal: EMPTY_JOURNAL, updatedOn: TODAY },
      { userId: SARAH, journal: EMPTY_JOURNAL, updatedOn: TODAY },
    ],
  };
}

describe('Rule 10 — account deletion (suppression du compte)', () => {
  const after = deleteAccountData(fullData(), OMAR);

  it('removes the profile, the summary, the badges and the backup of the person', () => {
    expect(after.profiles.map((row) => row.id)).toEqual([MUSTAPHA, SARAH, TAGHREAD]);
    expect(after.gardenSummaries.map((row) => row.userId)).toEqual([MUSTAPHA, SARAH]);
    expect(after.badges.map((row) => row.userId)).toEqual([SARAH]);
    expect(after.readingBackups.map((row) => row.userId)).toEqual([SARAH]);
  });

  it('removes the friendships of the person, requests included, whichever side they are on', () => {
    expect(after.friendships).toEqual([fullData().friendships[2]]);
  });

  it('removes the blocks the person made and those made against them', () => {
    expect(after.blocks).toEqual([fullData().blocks[2]]);
  });

  it('removes the invitation codes of the person and keeps the others', () => {
    expect(after.invites.map((row) => row.code)).toEqual(['BBBBBBBB']);
  });

  it('removes the nudges the person sent and those they received', () => {
    expect(after.nudges).toEqual([fullData().nudges[2]]);
  });

  it('removes the daily readings of the person', () => {
    expect(after.dailyReadings.map((row) => row.userId)).toEqual([MUSTAPHA]);
  });

  it('removes the memberships of the person', () => {
    expect(after.groupMembers.some((row) => row.userId === OMAR)).toBe(false);
  });

  it('a group whose owner leaves passes to its oldest member, who takes the owner role', () => {
    // Sarah joined on the same early day as Omar; Taghread joined later.
    expect(after.groups.find((group) => group.id === GROUP_BIG)?.ownerId).toBe(SARAH);
    expect(after.groupMembers.filter((row) => row.groupId === GROUP_BIG)).toEqual([
      { groupId: GROUP_BIG, userId: TAGHREAD, role: 'member', joinedOn: day('2026-06-01') },
      { groupId: GROUP_BIG, userId: SARAH, role: 'owner', joinedOn: day('2026-01-01') },
    ]);
  });

  it('a group the person only belonged to keeps its owner', () => {
    expect(after.groups.find((group) => group.id === GROUP_SMALL)?.ownerId).toBe(MUSTAPHA);
    expect(after.groupMembers.filter((row) => row.groupId === GROUP_SMALL)).toHaveLength(1);
  });

  it('a group the owner was alone in disappears', () => {
    expect(after.groups.some((group) => group.id === GROUP_SOLO)).toBe(false);
    expect(after.groupMembers.some((row) => row.groupId === GROUP_SOLO)).toBe(false);
  });

  it('a group of other people is untouched', () => {
    expect(after.groups.find((group) => group.id === GROUP_OTHERS)).toEqual(fullData().groups[3]);
  });

  it('leaves no trace of the person in any table', () => {
    expect(JSON.stringify(after)).not.toContain(OMAR);
  });

  it('deleting an account that is already gone changes nothing: a retry is safe', () => {
    expect(deleteAccountData(after, OMAR)).toEqual(after);
  });

  it('does not change the data it receives', () => {
    const data = fullData();
    const before = JSON.stringify(data);
    deleteAccountData(data, OMAR);

    expect(JSON.stringify(data)).toBe(before);
  });

  describe('invalid input', () => {
    it('refuses an empty identifier', () => {
      expect(() => deleteAccountData(fullData(), '')).toThrow(RangeError);
    });

    it('refuses data that is not an object, and a table that is not a list', () => {
      expect(() => deleteAccountData(null as unknown as SocialData, OMAR)).toThrow(TypeError);
      expect(() =>
        deleteAccountData({ ...fullData(), blocks: null as unknown as [] }, OMAR),
      ).toThrow(TypeError);
    });

    it('refuses a group of the person that is damaged, instead of guessing an owner', () => {
      const data = fullData();
      const damaged: SocialData = {
        ...data,
        groupMembers: data.groupMembers.map((row) =>
          row.groupId === GROUP_BIG && row.userId === SARAH
            ? { ...row, joinedOn: IMPOSSIBLE_DAY }
            : row,
        ),
      };

      expect(() => deleteAccountData(damaged, OMAR)).toThrow(RangeError);
    });
  });
});
