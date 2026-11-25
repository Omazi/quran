import { addDays, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';
import { SocialRuleError, type SocialRefusal } from '@/domain/social';

import {
  createDemoSocial,
  DEMO_GROUP_ID,
  DEMO_SIGNED_IN_USER,
  DEMO_USERS,
  type DemoSocial,
} from '../index';

const START = parseLocalDate('2026-11-24');
const { omar, mustapha, sarah, taghread, yacine } = DEMO_USERS;

/** A demonstration with a clock the test moves, signed in as Omar. */
async function signedIn(): Promise<{ demo: DemoSocial; clock: { day: LocalDate } }> {
  const clock = { day: START };
  const demo = createDemoSocial({ today: () => clock.day });
  await demo.auth.signInWithApple();
  return { demo, clock };
}

async function refusedWith(action: () => Promise<unknown>, reason: SocialRefusal): Promise<void> {
  const outcome = await action().then(
    () => null,
    (error: unknown) => error,
  );
  if (!(outcome instanceof SocialRuleError))
    throw new Error(`Expected "${reason}", got ${String(outcome)}`);
  expect(outcome.reason).toBe(reason);
}

describe('Demonstration of accounts and friends', () => {
  describe('it says that it is a demonstration', () => {
    it('the gateway, the repository and the session all say so', async () => {
      const { demo } = await signedIn();

      expect(demo.isDemonstration).toBe(true);
      expect(demo.auth.isDemonstration).toBe(true);
      expect(demo.repository.isDemonstration).toBe(true);
      expect((await demo.auth.getSession())?.isDemonstration).toBe(true);
    });
  });

  describe('sign-in', () => {
    it('nobody is signed in at the start', async () => {
      const demo = createDemoSocial({ today: () => START });

      expect(await demo.auth.getSession()).toBeNull();
    });

    it('the three ways open the same session of the demonstration, only the provider differs', async () => {
      const demo = createDemoSocial({ today: () => START });

      const apple = await demo.auth.signInWithApple();
      const google = await demo.auth.signInWithGoogle();
      const email = await demo.auth.signInWithEmail('omar@example.com', '123456');

      expect([apple.userId, google.userId, email.userId]).toEqual([
        DEMO_SIGNED_IN_USER,
        DEMO_SIGNED_IN_USER,
        DEMO_SIGNED_IN_USER,
      ]);
      expect([apple.provider, google.provider, email.provider]).toEqual([
        'apple',
        'google',
        'email',
      ]);
    });

    it('the e-mail way still refuses a malformed address or code, as the real one will', async () => {
      const demo = createDemoSocial({ today: () => START });

      await refusedWith(() => demo.auth.requestEmailCode('omar'), 'email-malformed');
      await refusedWith(
        () => demo.auth.signInWithEmail('omar@example.com', '12'),
        'email-code-malformed',
      );
      expect(await demo.auth.getSession()).toBeNull();
    });

    it('before sign-in and after sign-out, nothing can be read or done', async () => {
      const demo = createDemoSocial({ today: () => START });
      await refusedWith(() => demo.repository.getMyProfile(), 'not-signed-in');

      await demo.auth.signInWithGoogle();
      await demo.auth.signOut();

      await refusedWith(() => demo.repository.listFriends(), 'not-signed-in');
    });

    it('deleting the account when nobody is signed in is refused', async () => {
      const demo = createDemoSocial({ today: () => START });

      await refusedWith(() => demo.auth.deleteAccount(), 'not-signed-in');
    });
  });

  describe('account deletion (rule 10)', () => {
    it('removes the person, signs them out, and the group passes to its oldest member', async () => {
      const { demo } = await signedIn();

      await demo.auth.deleteAccount();

      expect(await demo.auth.getSession()).toBeNull();
      const sarahsGroups = await demo.repositoryAs(sarah).listMyGroups();
      expect(sarahsGroups.map((group) => group.ownerId)).toEqual([mustapha]);
      // In the starting data every friendship is with Omar: Sarah is left with none.
      expect(await demo.repositoryAs(sarah).listFriends()).toEqual([]);
      await refusedWith(() => demo.repositoryAs(sarah).getPersonView(omar), 'person-unavailable');
    });

    it('signing in again after a deletion starts the demonstration over', async () => {
      const { demo } = await signedIn();
      await demo.auth.deleteAccount();

      await demo.auth.signInWithGoogle();

      expect((await demo.repository.getMyProfile()).displayName).toBe('Omar');
      expect(await demo.repository.listFriends()).toHaveLength(3);
    });
  });

  describe('profile (rule 1)', () => {
    it('is the profile of Omar, friends see his garden and level by default', async () => {
      const { demo } = await signedIn();

      expect(await demo.repository.getMyProfile()).toMatchObject({
        id: omar,
        displayName: 'Omar',
        showGarden: true,
        showLevel: true,
      });
    });

    it('a new name is checked by the rule, and a refused name changes nothing', async () => {
      const { demo } = await signedIn();

      await refusedWith(
        () => demo.repository.updateMyProfile({ displayName: '   ' }),
        'name-empty',
      );
      expect((await demo.repository.getMyProfile()).displayName).toBe('Omar');
      expect(
        (await demo.repository.updateMyProfile({ displayName: ' Abu Omar ' })).displayName,
      ).toBe('Abu Omar');
    });

    it('hiding the garden hides it from friends at once (rule 4)', async () => {
      const { demo } = await signedIn();
      await demo.repository.updateMyProfile({ showGarden: false, showLevel: false });

      const seenBySarah = await demo.repositoryAs(sarah).getPersonView(omar);

      expect(seenBySarah).toMatchObject({ kind: 'friend', garden: null, level: null });
    });
  });

  describe('friends (rules 2 and 4)', () => {
    it('lists three friends in three states, by name', async () => {
      const { demo } = await signedIn();

      const friends = await demo.repository.listFriends();

      expect(friends.map((friend) => friend.displayName)).toEqual([
        'Mustapha',
        'Sarah',
        'Taghread',
      ]);
      expect(friends.map((friend) => friend.garden?.hizbCompleted)).toEqual([42, 9, 60]);
    });

    it('lists the request that waits, and accepting it makes a fourth friend', async () => {
      const { demo } = await signedIn();
      const before = await demo.repository.listFriendRequests();
      expect(before.incoming.map((request) => request.person.displayName)).toEqual(['Yacine']);
      expect(before.outgoing).toEqual([]);

      await demo.repository.acceptFriendRequest(yacine);

      expect((await demo.repository.listFriends()).map((friend) => friend.displayName)).toContain(
        'Yacine',
      );
      expect((await demo.repository.listFriendRequests()).incoming).toEqual([]);
    });

    it('a request is answered by the other side: Mustapha asks Yacine, Yacine accepts, only he can', async () => {
      const { demo } = await signedIn();
      await demo.repositoryAs(mustapha).sendFriendRequest(yacine);

      await refusedWith(
        () => demo.repositoryAs(mustapha).acceptFriendRequest(yacine),
        'not-the-addressee',
      );
      await demo.repositoryAs(yacine).acceptFriendRequest(mustapha);

      expect(
        (await demo.repositoryAs(mustapha).listFriends()).map((friend) => friend.userId),
      ).toContain(yacine);
    });

    it('a request to someone who asked first accepts theirs: one relation per pair', async () => {
      const { demo } = await signedIn();

      await demo.repository.sendFriendRequest(yacine);

      expect((await demo.repository.listFriends()).map((friend) => friend.userId)).toContain(
        yacine,
      );
    });

    it('nobody adds themselves, and nobody asks a person who does not exist', async () => {
      const { demo } = await signedIn();

      await refusedWith(() => demo.repository.sendFriendRequest(omar), 'cannot-befriend-yourself');
      await refusedWith(
        () => demo.repository.sendFriendRequest('demo-nobody'),
        'person-unavailable',
      );
    });

    it('a declined request can be sent again after the waiting time, not before', async () => {
      const { demo, clock } = await signedIn();
      await demo.repositoryAs(mustapha).sendFriendRequest(yacine);
      await demo.repositoryAs(yacine).declineFriendRequest(mustapha);

      await refusedWith(
        () => demo.repositoryAs(mustapha).sendFriendRequest(yacine),
        'request-declined-recently',
      );
      clock.day = addDays(START, 7);
      await demo.repositoryAs(mustapha).sendFriendRequest(yacine);

      // Still one row for the pair: the new request replaced the declined one.
      const incoming = (await demo.repositoryAs(yacine).listFriendRequests()).incoming;
      expect(incoming.map((request) => [request.person.userId, request.sentOn])).toEqual([
        [mustapha, addDays(START, 7)],
      ]);
    });

    it('a friend can be removed by either of the two, and then asked again at once', async () => {
      const { demo } = await signedIn();

      await demo.repositoryAs(sarah).removeFriend(omar);

      expect((await demo.repository.listFriends()).map((friend) => friend.displayName)).toEqual([
        'Mustapha',
        'Taghread',
      ]);
      await demo.repository.sendFriendRequest(sarah);
      expect((await demo.repository.listFriendRequests()).outgoing).toHaveLength(1);
    });

    it('a person who is not a friend shows a name only', async () => {
      const { demo } = await signedIn();

      expect(await demo.repository.getPersonView(yacine)).toEqual({
        kind: 'other',
        userId: yacine,
        displayName: 'Yacine',
      });
    });
  });

  describe('blocking (rule 3)', () => {
    it('removes the friend, hides them both ways, and the blocked person cannot tell why', async () => {
      const { demo } = await signedIn();

      await demo.repository.blockPerson(sarah);

      expect((await demo.repository.listFriends()).map((friend) => friend.userId)).not.toContain(
        sarah,
      );
      expect(await demo.repository.getPersonView(sarah)).toBeNull();
      expect(await demo.repositoryAs(sarah).getPersonView(omar)).toBeNull();
      await refusedWith(
        () => demo.repositoryAs(sarah).sendFriendRequest(omar),
        'person-unavailable',
      );
      await refusedWith(
        () => demo.repositoryAs(sarah).sendNudge(omar, 'encourage'),
        'person-unavailable',
      );
      expect(await demo.repository.listBlockedPeople()).toEqual([
        { userId: sarah, displayName: 'Sarah', blockedOn: START },
      ]);
    });

    it('a blocked person cannot be added to a group by the one who blocked, and the nudges received from them are hidden', async () => {
      const { demo } = await signedIn();
      await demo.repositoryAs(mustapha).sendNudge(omar, 'encourage');
      const group = await demo.repository.createGroup('Work');
      await demo.repository.blockPerson(mustapha);

      await refusedWith(
        () => demo.repository.addGroupMember(group.id, mustapha),
        'you-blocked-them',
      );
      expect(await demo.repository.listReceivedNudges()).toEqual([]);
    });

    it('unblocking does not bring the friendship back: the two are strangers who may ask again', async () => {
      const { demo } = await signedIn();
      await demo.repository.blockPerson(sarah);

      await demo.repository.unblockPerson(sarah);

      expect(await demo.repository.listBlockedPeople()).toEqual([]);
      expect((await demo.repository.getPersonView(sarah))?.kind).toBe('other');
      await refusedWith(() => demo.repository.unblockPerson(sarah), 'not-blocked');
    });

    it('nobody blocks themselves', async () => {
      const { demo } = await signedIn();

      await refusedWith(() => demo.repository.blockPerson(omar), 'cannot-block-yourself');
    });
  });

  describe('invitation code (rule 6)', () => {
    it('a code makes the person who types it a friend of the owner', async () => {
      const { demo } = await signedIn();
      const invite = await demo.repository.createInvite();

      const view = await demo.repositoryAs(yacine).acceptInvite(invite.code);

      expect(view).toMatchObject({ kind: 'friend', userId: omar, displayName: 'Omar' });
      expect(invite.createdOn).toBe(START);
    });

    it('two codes are never the same, and the same run gives the same codes', async () => {
      const first = await signedIn();
      const second = await signedIn();

      const codes = [
        await first.demo.repository.createInvite(),
        await first.demo.repository.createInvite(),
      ];

      expect(codes[0]!.code).not.toBe(codes[1]!.code);
      expect((await second.demo.repository.createInvite()).code).toBe(codes[0]!.code);
    });

    it('refuses a malformed code, an unknown code, an own code and an expired code', async () => {
      const { demo, clock } = await signedIn();
      const invite = await demo.repository.createInvite();

      await refusedWith(
        () => demo.repositoryAs(yacine).acceptInvite('abc'),
        'invite-code-malformed',
      );
      await refusedWith(
        () => demo.repositoryAs(yacine).acceptInvite('AAAAAAAA'),
        'invite-not-found',
      );
      await refusedWith(() => demo.repository.acceptInvite(invite.code), 'invite-is-yours');
      clock.day = addDays(invite.expiresOn, 1);
      await refusedWith(
        () => demo.repositoryAs(yacine).acceptInvite(invite.code),
        'invite-expired',
      );
    });
  });

  describe('nudges (rule 7)', () => {
    it('Omar encourages a friend once a day, and the friend finds it with his name', async () => {
      const { demo, clock } = await signedIn();

      await demo.repository.sendNudge(mustapha, 'congratulate');
      await refusedWith(
        () => demo.repository.sendNudge(mustapha, 'encourage'),
        'already-nudged-today',
      );
      clock.day = addDays(START, 1);
      await demo.repository.sendNudge(mustapha, 'encourage');

      const received = await demo.repositoryAs(mustapha).listReceivedNudges();
      expect(received.map((nudge) => [nudge.fromName, nudge.kind, nudge.sentOn])).toEqual([
        ['Omar', 'encourage', addDays(START, 1)],
        ['Omar', 'congratulate', START],
      ]);
    });

    it('Omar has already received one, newest first', async () => {
      const { demo } = await signedIn();

      expect(await demo.repository.listReceivedNudges()).toEqual([
        { fromId: mustapha, fromName: 'Mustapha', kind: 'encourage', sentOn: addDays(START, -1) },
      ]);
    });

    it('is refused to someone who is not a friend', async () => {
      const { demo } = await signedIn();

      await refusedWith(() => demo.repository.sendNudge(yacine, 'encourage'), 'not-friends');
    });
  });

  describe('groups (rules 8 and 9)', () => {
    it('lists the group of Omar with its members and a weekly leaderboard that counts everybody', async () => {
      const { demo } = await signedIn();

      const groups = await demo.repository.listMyGroups();
      const members = await demo.repository.listGroupMembers(DEMO_GROUP_ID);
      const board = await demo.repository.getGroupLeaderboard(DEMO_GROUP_ID, {
        kind: 'week',
        day: START,
      });

      expect(groups.map((group) => group.name)).toEqual(['Famille']);
      expect(members.map((member) => [member.displayName, member.role])).toEqual([
        ['Omar', 'owner'],
        ['Mustapha', 'member'],
        ['Sarah', 'member'],
        ['Taghread', 'member'],
      ]);
      expect(board.map((entry) => entry.displayName).sort()).toEqual([
        'Mustapha',
        'Omar',
        'Sarah',
        'Taghread',
      ]);
      expect(board[0]!.rank).toBe(1);
    });

    it('publishing the pages read today changes the leaderboard', async () => {
      const { demo } = await signedIn();
      await demo.repository.publishDailyReading(START, 600);

      const board = await demo.repository.getGroupLeaderboard(DEMO_GROUP_ID, {
        kind: 'week',
        day: START,
      });

      expect(board[0]).toMatchObject({ userId: omar, rank: 1 });
    });

    it('a group is created with its creator as owner, and a friend can be added, a non-friend cannot', async () => {
      const { demo } = await signedIn();

      const group = await demo.repository.createGroup('  Work  ');
      await demo.repository.addGroupMember(group.id, mustapha);

      expect(group).toMatchObject({ name: 'Work', ownerId: omar });
      expect(
        (await demo.repository.listGroupMembers(group.id)).map((member) => member.userId),
      ).toEqual([omar, mustapha]);
      await refusedWith(() => demo.repository.addGroupMember(group.id, yacine), 'not-friends');
      await refusedWith(() => demo.repository.createGroup(''), 'name-empty');
    });

    it('two groups never share an identifier', async () => {
      const { demo } = await signedIn();

      const first = await demo.repository.createGroup('A');
      const second = await demo.repository.createGroup('B');

      expect(new Set([DEMO_GROUP_ID, first.id, second.id]).size).toBe(3);
    });

    it('the owner must hand the group over to leave it; the next owner takes it', async () => {
      const { demo } = await signedIn();

      await refusedWith(
        () => demo.repository.leaveGroup(DEMO_GROUP_ID, null),
        'owner-must-hand-over',
      );
      await refusedWith(
        () => demo.repository.leaveGroup(DEMO_GROUP_ID, yacine),
        'successor-not-a-member',
      );
      await demo.repository.leaveGroup(DEMO_GROUP_ID, taghread);

      expect(await demo.repository.listMyGroups()).toEqual([]);
      expect((await demo.repositoryAs(taghread).listMyGroups())[0]?.ownerId).toBe(taghread);
    });

    it('a group of other people cannot be seen: it is the answer for a group that does not exist', async () => {
      const { demo } = await signedIn();
      const group = await demo.repositoryAs(mustapha).createGroup('Private');

      await refusedWith(() => demo.repository.listGroupMembers(group.id), 'group-not-found');
      await refusedWith(
        () => demo.repository.getGroupLeaderboard(group.id, { kind: 'week', day: START }),
        'group-not-found',
      );
      await refusedWith(
        () => demo.repository.listGroupMembers('demo-group-404'),
        'group-not-found',
      );
    });

    it('a group disappears when its owner leaves it alone', async () => {
      const { demo } = await signedIn();
      const group = await demo.repository.createGroup('Solo');

      await demo.repository.leaveGroup(group.id, null);

      expect((await demo.repository.listMyGroups()).map((row) => row.id)).toEqual([DEMO_GROUP_ID]);
    });
  });

  describe('publishing (rule 5)', () => {
    it('the garden summary of Omar, seen by a friend, follows what his app published', async () => {
      const { demo } = await signedIn();

      await demo.repository.publishGardenSummary({
        khatmNumber: 2,
        hizbCompleted: 30,
        health: 0.6,
        lastWateredOn: START,
        streakDays: 6,
        badgeCount: 1,
      });

      const view = await demo.repositoryAs(mustapha).getPersonView(omar);
      expect(view).toMatchObject({
        kind: 'friend',
        garden: { hizbCompleted: 30, health: 0.6, updatedOn: START },
        level: { level: 2 },
      });
    });

    it('refuses an invalid summary, a duplicate badge and an impossible reading, and keeps what was there', async () => {
      const { demo } = await signedIn();

      await expect(
        demo.repository.publishGardenSummary({
          khatmNumber: 2,
          hizbCompleted: 61,
          health: 0.6,
          lastWateredOn: START,
          streakDays: 6,
          badgeCount: 1,
        }),
      ).rejects.toThrow(RangeError);
      await expect(
        demo.repository.publishBadges([
          { khatmNumber: 1, completedOn: START },
          { khatmNumber: 1, completedOn: START },
        ]),
      ).rejects.toThrow(RangeError);
      await expect(demo.repository.publishDailyReading(START, 605)).rejects.toThrow(RangeError);

      const view = await demo.repositoryAs(mustapha).getPersonView(omar);
      expect(view).toMatchObject({
        garden: { hizbCompleted: 17 },
        level: { badges: [{ khatmNumber: 1 }] },
      });
    });

    it('publishing the reading of a day twice keeps the last value: one row per person and per day', async () => {
      const { demo } = await signedIn();
      await demo.repository.publishDailyReading(START, 10);
      await demo.repository.publishDailyReading(START, 20);

      const board = await demo.repository.getGroupLeaderboard(DEMO_GROUP_ID, {
        kind: 'week',
        day: START,
      });
      const month = await demo.repository.getGroupLeaderboard(DEMO_GROUP_ID, {
        kind: 'month',
        day: START,
      });

      expect(board.find((entry) => entry.userId === omar)!.newPages).toBeGreaterThanOrEqual(20);
      expect(month.find((entry) => entry.userId === omar)!.newPages).toBeGreaterThanOrEqual(20);
    });

    it('publishing badges replaces the list', async () => {
      const { demo } = await signedIn();
      await demo.repository.publishBadges([
        { khatmNumber: 1, completedOn: START },
        { khatmNumber: 2, completedOn: START },
      ]);

      const view = await demo.repositoryAs(mustapha).getPersonView(omar);

      expect(view).toMatchObject({ level: { badges: [{ khatmNumber: 1 }, { khatmNumber: 2 }] } });
    });
  });

  it('what a friend sees of Omar holds no page number and no hour', async () => {
    const { demo } = await signedIn();

    const text = JSON.stringify(await demo.repositoryAs(taghread).getPersonView(omar));

    expect(text).not.toMatch(/page|journal|hour|time/i);
  });
});
