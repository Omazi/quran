import { addDays, parseLocalDate } from '@/domain/shared/local-date';
import {
  bondBetween,
  computeLeaderboard,
  removeGroupMember,
  viewOf,
  type PersonData,
} from '@/domain/social';

import { levelOfCompletedKhatmas } from '@/domain/levels';

import { createDemoSocialData, DEMO_GROUP_ID, DEMO_USERS } from '../index';

const TODAY = parseLocalDate('2026-11-24');
const { omar, mustapha, sarah, taghread, yacine } = DEMO_USERS;

function personData(userId: string): PersonData {
  const data = createDemoSocialData(TODAY);
  const profile = data.profiles.find((row) => row.id === userId);
  if (profile === undefined) throw new Error(`no profile for ${userId}`);
  return {
    profile,
    garden: data.gardenSummaries.find((row) => row.userId === userId) ?? null,
    badges: data.badges.filter((row) => row.userId === userId),
  };
}

describe('Demonstration data (createDemoSocialData)', () => {
  it('is deterministic: the same day gives the same data', () => {
    expect(createDemoSocialData(TODAY)).toEqual(createDemoSocialData(TODAY));
  });

  it('is counted back from the day it is given', () => {
    const later = createDemoSocialData(addDays(TODAY, 10));

    expect(later.gardenSummaries.find((row) => row.userId === omar)?.updatedOn).toBe(
      addDays(TODAY, 10),
    );
  });

  it('holds the first names of D25, Omar, Mostapha, Sarah and Taghread', () => {
    const names = createDemoSocialData(TODAY).profiles.map((row) => row.displayName);

    expect(names).toEqual(expect.arrayContaining(['Omar', 'Mostapha', 'Sarah', 'Taghread']));
  });

  it('gives three friends to Omar, and a request from one more person that waits', () => {
    const data = createDemoSocialData(TODAY);
    const friends = data.friendships.filter((row) => row.status === 'accepted');
    const pending = data.friendships.filter((row) => row.status === 'pending');

    expect(friends.map((row) => row.addresseeId).sort()).toEqual(
      [mustapha, sarah, taghread].sort(),
    );
    expect(pending).toEqual([
      {
        requesterId: yacine,
        addresseeId: omar,
        status: 'pending',
        createdOn: addDays(TODAY, -1),
        respondedOn: null,
      },
    ]);
  });

  it('has one flourishing garden, one thirsty and one complete', () => {
    const [flourishing, thirsty, complete] = [mustapha, sarah, taghread].map(
      (id) => personData(id).garden,
    );

    expect(flourishing).toMatchObject({ health: expect.any(Number), streakDays: 21 });
    expect(flourishing!.health).toBeGreaterThan(0.9);
    expect(thirsty!.health).toBeLessThan(0.3);
    expect(thirsty!.streakDays).toBe(0);
    expect(thirsty!.lastWateredOn).toBe(addDays(TODAY, -6));
    expect(complete).toMatchObject({ hizbCompleted: 60, health: 1 });
  });

  it('gives the three friends different levels, each with the badges of its khatmas (D46)', () => {
    const levels = [mustapha, sarah, taghread].map((id) => {
      const { garden, badges } = personData(id);
      expect(garden?.badgeCount).toBe(badges.length);
      expect(badges.map((badge) => badge.khatmNumber)).toEqual(
        badges.map((_badge, index) => index + 1),
      );
      return levelOfCompletedKhatmas(badges.length);
    });
    // Mostapha, the screen check's friend, is level 3; Sarah 4; Taghread, who has just completed
    // her first khatma, 2.
    expect(levels).toEqual([3, 4, 2]);
  });

  it('every pair has a valid bond: one friendship row per pair, as the rules say', () => {
    const data = createDemoSocialData(TODAY);
    const ids = data.profiles.map((row) => row.id);

    for (const first of ids) {
      for (const second of ids) {
        if (first !== second) expect(() => bondBetween(data, first, second)).not.toThrow();
      }
    }
  });

  it('seen by Omar, the friends are friends and the person who asked is a name only', () => {
    const data = createDemoSocialData(TODAY);

    for (const [id, kind] of [
      [mustapha, 'friend'],
      [sarah, 'friend'],
      [taghread, 'friend'],
      [yacine, 'other'],
    ] as const) {
      expect(viewOf(personData(id), omar, bondBetween(data, omar, id))?.kind).toBe(kind);
    }
  });

  it('has a group of Omar and his three friends, valid for the rules of groups', () => {
    const data = createDemoSocialData(TODAY);
    const group = data.groups.find((row) => row.id === DEMO_GROUP_ID);
    const members = data.groupMembers.filter((row) => row.groupId === DEMO_GROUP_ID);

    expect(group?.ownerId).toBe(omar);
    expect(members.map((row) => row.userId)).toEqual([omar, mustapha, sarah, taghread]);
    // Throws when the group breaks a rule: the function checks the state it receives.
    expect(() => removeGroupMember({ group: group!, members }, 'nobody')).not.toThrow();
  });

  it('the group has a weekly and a monthly leaderboard with different readers', () => {
    const data = createDemoSocialData(TODAY);
    const members = [omar, mustapha, sarah, taghread];

    const week = computeLeaderboard(members, data.dailyReadings, { kind: 'week', day: TODAY });
    const month = computeLeaderboard(members, data.dailyReadings, { kind: 'month', day: TODAY });

    expect(week).toHaveLength(4);
    expect(week[0]!.newPages).toBeGreaterThan(week[3]!.newPages);
    expect(month[0]!.newPages).toBeGreaterThan(week[0]!.newPages);
  });

  it('holds no reading backup and no invitation code at the start', () => {
    const data = createDemoSocialData(TODAY);

    expect(data.readingBackups).toEqual([]);
    expect(data.invites).toEqual([]);
  });
});
