import { addDays } from '@/domain/shared/local-date';

import {
  acceptFriendRequest,
  blockPerson,
  declineFriendRequest,
  isBlockedEitherWay,
  NO_BOND,
  requestFriendship,
  unblockPerson,
  type Bond,
} from '../index';
import {
  day,
  expectRefusal,
  IMPOSSIBLE_DAY,
  MUSTAPHA,
  OMAR,
  SARAH,
  TODAY,
} from '../test-support/social-test-kit';

const TOMORROW = addDays(TODAY, 1);

const PENDING: Bond = requestFriendship(NO_BOND, OMAR, SARAH, TODAY);
const ACCEPTED: Bond = acceptFriendRequest(PENDING, SARAH, TODAY);
const DECLINED: Bond = declineFriendRequest(PENDING, SARAH, TODAY);
/** Omar blocked Sarah. */
const OMAR_BLOCKED_SARAH: Bond = blockPerson(NO_BOND, OMAR, SARAH, TODAY);

describe('Rule 3 — blocking (blocage)', () => {
  describe('blocking', () => {
    it('blocking adds one block row from the blocker to the blocked person', () => {
      expect(OMAR_BLOCKED_SARAH).toEqual({
        friendship: null,
        blocks: [{ blockerId: OMAR, blockedId: SARAH, createdOn: TODAY }],
      });
    });

    it('blocking removes an accepted friendship, whoever blocks', () => {
      expect(blockPerson(ACCEPTED, OMAR, SARAH, TOMORROW).friendship).toBeNull();
      expect(blockPerson(ACCEPTED, SARAH, OMAR, TOMORROW).friendship).toBeNull();
    });

    it('blocking removes a pending request, in either direction', () => {
      expect(blockPerson(PENDING, OMAR, SARAH, TOMORROW).friendship).toBeNull();
      expect(blockPerson(PENDING, SARAH, OMAR, TOMORROW).friendship).toBeNull();
    });

    it('blocking keeps a declined request: blocking and unblocking never erases the wait', () => {
      expect(blockPerson(DECLINED, SARAH, OMAR, TOMORROW).friendship).toEqual(DECLINED.friendship);
    });

    it('nobody blocks themselves', () => {
      expectRefusal(() => blockPerson(NO_BOND, OMAR, OMAR, TODAY), 'cannot-block-yourself');
    });

    it('blocking twice is refused: the first block stays as it is', () => {
      expectRefusal(
        () => blockPerson(OMAR_BLOCKED_SARAH, OMAR, SARAH, TOMORROW),
        'already-blocked',
      );
    });

    it('both people can block each other: two rows, one in each direction', () => {
      const both = blockPerson(OMAR_BLOCKED_SARAH, SARAH, OMAR, TOMORROW);

      expect(both.blocks).toHaveLength(2);
      expect(isBlockedEitherWay(both)).toBe(true);
    });
  });

  describe('unblocking', () => {
    it('only the blocker removes the block, and the friendship does not come back', () => {
      const unblocked = unblockPerson(blockPerson(ACCEPTED, OMAR, SARAH, TODAY), OMAR, SARAH);

      expect(unblocked).toEqual(NO_BOND);
    });

    it('the blocked person cannot remove the block', () => {
      expectRefusal(() => unblockPerson(OMAR_BLOCKED_SARAH, SARAH, OMAR), 'not-blocked');
    });

    it('there is nothing to unblock between two people without a block', () => {
      expectRefusal(() => unblockPerson(NO_BOND, OMAR, SARAH), 'not-blocked');
    });

    it('when both blocked, unblocking removes only my own block', () => {
      const both = blockPerson(OMAR_BLOCKED_SARAH, SARAH, OMAR, TODAY);

      const afterOmar = unblockPerson(both, OMAR, SARAH);

      expect(afterOmar.blocks).toEqual([{ blockerId: SARAH, blockedId: OMAR, createdOn: TODAY }]);
      expect(isBlockedEitherWay(afterOmar)).toBe(true);
    });
  });

  describe('what a block forbids', () => {
    it('a blocked person cannot send a request, and is told the person is unavailable', () => {
      expectRefusal(
        () => requestFriendship(OMAR_BLOCKED_SARAH, SARAH, OMAR, TOMORROW),
        'person-unavailable',
      );
    });

    it('the blocker cannot send a request either: they unblock first', () => {
      expectRefusal(
        () => requestFriendship(OMAR_BLOCKED_SARAH, OMAR, SARAH, TOMORROW),
        'you-blocked-them',
      );
    });

    it('a request is possible again after the block is lifted', () => {
      const lifted = unblockPerson(OMAR_BLOCKED_SARAH, OMAR, SARAH);

      expect(requestFriendship(lifted, SARAH, OMAR, TOMORROW).friendship?.status).toBe('pending');
    });

    it('a request left pending next to a block cannot be accepted', () => {
      // A state no rule produces, which damaged data or a race could: the block wins.
      const stale: Bond = { friendship: PENDING.friendship, blocks: OMAR_BLOCKED_SARAH.blocks };

      expectRefusal(() => acceptFriendRequest(stale, SARAH, TOMORROW), 'person-unavailable');
    });
  });

  describe('a block is not seen from the other side', () => {
    it('the blocked person gets the answer given for an account that does not exist', () => {
      // Same reason as for an unknown person: nothing tells "blocked" from "gone".
      expectRefusal(
        () => requestFriendship(OMAR_BLOCKED_SARAH, SARAH, OMAR, TOMORROW),
        'person-unavailable',
      );
    });
  });

  describe('invalid input', () => {
    it('an impossible date is a RangeError', () => {
      expect(() => blockPerson(NO_BOND, OMAR, SARAH, IMPOSSIBLE_DAY)).toThrow(RangeError);
    });

    it('a block over the bond of two other people is a RangeError', () => {
      expect(() => blockPerson(OMAR_BLOCKED_SARAH, MUSTAPHA, OMAR, TODAY)).toThrow(RangeError);
    });

    it('a block row between a person and themselves is damaged data', () => {
      const damaged: Bond = {
        friendship: null,
        blocks: [{ blockerId: OMAR, blockedId: OMAR, createdOn: day('2026-11-01') }],
      };

      expect(() => isBlockedEitherWay(damaged)).toThrow(RangeError);
    });

    it('no function changes the bond it receives', () => {
      const before = JSON.stringify(ACCEPTED);
      blockPerson(ACCEPTED, OMAR, SARAH, TODAY);

      expect(JSON.stringify(ACCEPTED)).toBe(before);
    });
  });
});
