import { createDemoSocial, DEMO_GROUP_ID, DEMO_USERS } from '@/data/social';
import { parseLocalDate } from '@/domain/shared/local-date';

import { buildFriendPageModel, buildFriendsModel, buildGroupModel } from '../friends-model';
import { shownInviteCode, typedInviteCode } from '../invite-code-text';

const TODAY = parseLocalDate('2026-11-25');

async function signedInDemo() {
  const demo = createDemoSocial({ today: () => TODAY });
  await demo.auth.signInWithApple();
  return demo;
}

describe('buildFriendsModel', () => {
  it('shows each friend with their garden, hizb and water, and the requests sent to me', async () => {
    const { repository } = await signedInDemo();
    const model = buildFriendsModel({
      isDemonstration: true,
      friends: await repository.listFriends(),
      requests: await repository.listFriendRequests(),
      groups: [],
      today: TODAY,
    });
    expect(model.isDemonstration).toBe(true);
    expect(model.requests).toEqual([{ userId: DEMO_USERS.yacine, name: 'Yacine' }]);
    const sarah = model.friends.find((card) => card.userId === DEMO_USERS.sarah);
    expect(sarah).toMatchObject({ name: 'Sarah', hizbCompleted: 9 });
    expect(sarah?.water).toEqual({ kind: 'days-ago', days: 6 });
    expect(sarah?.garden?.water).toBe('dry');
    const mustapha = model.friends.find((card) => card.userId === DEMO_USERS.mustapha);
    expect(mustapha?.water).toEqual({ kind: 'today' });
  });

  it('shows no picture for a friend who hides their garden', async () => {
    const demo = await signedInDemo();
    await demo.repositoryAs(DEMO_USERS.sarah).updateMyProfile({ showGarden: false });
    const model = buildFriendsModel({
      isDemonstration: true,
      friends: await demo.repository.listFriends(),
      requests: { incoming: [], outgoing: [] },
      groups: [],
      today: TODAY,
    });
    const sarah = model.friends.find((card) => card.userId === DEMO_USERS.sarah);
    expect(sarah).toMatchObject({ garden: null, hizbCompleted: null, water: null });
  });
});

describe('buildFriendPageModel', () => {
  it('shows a friend: garden, streak, level, counters, and whether encouraged today', async () => {
    const { repository } = await signedInDemo();
    const model = buildFriendPageModel({
      isDemonstration: true,
      view: await repository.getPersonView(DEMO_USERS.mustapha),
      encouragedToday: false,
      today: TODAY,
    });
    if (model.status !== 'friend') throw new Error(`expected a friend, got ${model.status}`);
    expect(model.card.name).toBe('Mustapha');
    expect(model.streakDays).toBe(21);
    expect(model.level).toMatchObject({ level: 3, badgeCount: 2 });
    expect(model.level?.wordsRead).toEqual(expect.any(Number));
    expect(model.level?.hasanatEstimate).toEqual(expect.any(Number));
    expect(model.encouragedToday).toBe(false);
  });

  it('hides level, badges and counters when the friend hides their level', async () => {
    const demo = await signedInDemo();
    await demo.repositoryAs(DEMO_USERS.mustapha).updateMyProfile({ showLevel: false });
    const model = buildFriendPageModel({
      isDemonstration: true,
      view: await demo.repository.getPersonView(DEMO_USERS.mustapha),
      encouragedToday: false,
      today: TODAY,
    });
    expect(model).toMatchObject({ status: 'friend', level: null });
  });

  it('shows only the name of someone who is not a friend, and nothing across a block', async () => {
    const { repository } = await signedInDemo();
    expect(
      buildFriendPageModel({
        isDemonstration: true,
        view: await repository.getPersonView(DEMO_USERS.yacine),
        encouragedToday: false,
        today: TODAY,
      }),
    ).toEqual({
      status: 'not-friend',
      isDemonstration: true,
      userId: DEMO_USERS.yacine,
      name: 'Yacine',
    });
    await repository.blockPerson(DEMO_USERS.sarah);
    expect(
      buildFriendPageModel({
        isDemonstration: true,
        view: await repository.getPersonView(DEMO_USERS.sarah),
        encouragedToday: false,
        today: TODAY,
      }),
    ).toEqual({ status: 'unavailable', isDemonstration: true });
  });
});

describe('buildGroupModel', () => {
  it('ranks the members, marks me, and lists the friends I can add', async () => {
    const { repository } = await signedInDemo();
    const [group] = await repository.listMyGroups();
    if (group === undefined) throw new Error('the demonstration has a group');
    const members = await repository.listGroupMembers(DEMO_GROUP_ID);
    const model = buildGroupModel({
      isDemonstration: true,
      group,
      period: 'week',
      leaderboard: await repository.getGroupLeaderboard(DEMO_GROUP_ID, {
        kind: 'week',
        day: TODAY,
      }),
      memberIds: members.map((member) => member.userId),
      friends: await repository.listFriends(),
      myId: DEMO_USERS.omar,
    });
    expect(model.leaderboard[0]?.rank).toBe(1);
    expect(model.leaderboard.filter((line) => line.isMe)).toHaveLength(1);
    const memberIds = new Set(members.map((member) => member.userId));
    expect(model.friendsToAdd.every((friend) => !memberIds.has(friend.userId))).toBe(true);
  });
});

describe('invitation code on screen', () => {
  it('takes what was typed in capitals, without spaces or hyphens', () => {
    expect(typedInviteCode(' abcd efgh ')).toBe('ABCDEFGH');
    expect(typedInviteCode('abcd-efgh')).toBe('ABCDEFGH');
  });

  it('shows the code in two groups', () => {
    expect(shownInviteCode('ABCDEFGH')).toBe('ABCD EFGH');
  });
});
