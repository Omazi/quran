import { addDays } from '@/domain/shared/local-date';

import {
  acceptFriendRequest,
  declineFriendRequest,
  NO_BOND,
  removeFriendship,
  requestFriendship,
  SocialRuleError,
  type Bond,
  type Friendship,
} from '../index';
import {
  day,
  expectRefusal,
  IMPOSSIBLE_DAY,
  MUSTAPHA,
  NOT_AN_OBJECT,
  NOT_TEXT,
  OMAR,
  SARAH,
  TODAY,
} from '../test-support/social-test-kit';

const TOMORROW = addDays(TODAY, 1);

/** Omar asked Sarah today. */
const PENDING: Bond = requestFriendship(NO_BOND, OMAR, SARAH, TODAY);
/** Sarah said yes the next day. */
const ACCEPTED: Bond = acceptFriendRequest(PENDING, SARAH, TOMORROW);
/** Or Sarah said no the next day. */
const DECLINED: Bond = declineFriendRequest(PENDING, SARAH, TOMORROW);

describe('Rule 2 — friend request (demande d’amitié)', () => {
  describe('sending', () => {
    it('a first request is a pending row from the sender to the other person', () => {
      const expected: Friendship = {
        requesterId: OMAR,
        addresseeId: SARAH,
        status: 'pending',
        createdOn: TODAY,
        respondedOn: null,
      };

      expect(PENDING).toEqual({ friendship: expected, blocks: [] });
    });

    it('nobody adds themselves', () => {
      expectRefusal(
        () => requestFriendship(NO_BOND, OMAR, OMAR, TODAY),
        'cannot-befriend-yourself',
      );
    });

    it('one relation per pair: the sender cannot ask twice while the request is pending', () => {
      expectRefusal(
        () => requestFriendship(PENDING, OMAR, SARAH, TOMORROW),
        'request-already-sent',
      );
    });

    it('one relation per pair: two friends cannot ask each other again, in either direction', () => {
      expectRefusal(() => requestFriendship(ACCEPTED, OMAR, SARAH, TOMORROW), 'already-friends');
      expectRefusal(() => requestFriendship(ACCEPTED, SARAH, OMAR, TOMORROW), 'already-friends');
    });

    it('a request to someone who has already sent one accepts theirs', () => {
      const crossed = requestFriendship(PENDING, SARAH, OMAR, TOMORROW);

      // Still one row, still Omar's request: it is now accepted, on the day Sarah asked.
      expect(crossed.friendship).toEqual({
        requesterId: OMAR,
        addresseeId: SARAH,
        status: 'accepted',
        createdOn: TODAY,
        respondedOn: TOMORROW,
      });
    });
  });

  describe('answering', () => {
    it('the addressee accepts: the row is accepted on that day', () => {
      expect(ACCEPTED.friendship).toEqual({
        requesterId: OMAR,
        addresseeId: SARAH,
        status: 'accepted',
        createdOn: TODAY,
        respondedOn: TOMORROW,
      });
    });

    it('the addressee declines: the row is declined on that day', () => {
      expect(DECLINED.friendship).toEqual({
        requesterId: OMAR,
        addresseeId: SARAH,
        status: 'declined',
        createdOn: TODAY,
        respondedOn: TOMORROW,
      });
    });

    it('only the addressee accepts: the sender cannot accept their own request', () => {
      expectRefusal(() => acceptFriendRequest(PENDING, OMAR, TOMORROW), 'not-the-addressee');
    });

    it('only the addressee declines: the sender cannot decline their own request', () => {
      expectRefusal(() => declineFriendRequest(PENDING, OMAR, TOMORROW), 'not-the-addressee');
    });

    it('a third person can neither accept nor decline', () => {
      expectRefusal(() => acceptFriendRequest(PENDING, MUSTAPHA, TOMORROW), 'not-the-addressee');
      expectRefusal(() => declineFriendRequest(PENDING, MUSTAPHA, TOMORROW), 'not-the-addressee');
    });

    it.each([
      ['no request at all', NO_BOND],
      ['a request already accepted', ACCEPTED],
      ['a request already declined', DECLINED],
    ])('there is nothing to answer with %s', (_label, bond) => {
      expectRefusal(() => acceptFriendRequest(bond, SARAH, TOMORROW), 'no-pending-request');
      expectRefusal(() => declineFriendRequest(bond, SARAH, TOMORROW), 'no-pending-request');
    });

    it('the answer may be dated before the request: two people do not share a calendar', () => {
      // Omar, ahead of Sarah by a time zone, asked on what was still the day before for her.
      const yesterdayForSarah = addDays(TODAY, -1);

      expect(acceptFriendRequest(PENDING, SARAH, yesterdayForSarah).friendship?.respondedOn).toBe(
        yesterdayForSarah,
      );
    });
  });

  describe('removing', () => {
    it('either friend removes an accepted friendship: no row is left', () => {
      expect(removeFriendship(ACCEPTED, OMAR)).toEqual(NO_BOND);
      expect(removeFriendship(ACCEPTED, SARAH)).toEqual(NO_BOND);
    });

    it('a third person cannot remove it', () => {
      expectRefusal(() => removeFriendship(ACCEPTED, MUSTAPHA), 'not-your-friendship');
    });

    it('only an accepted friendship is removed: a pending request is not', () => {
      expectRefusal(() => removeFriendship(PENDING, OMAR), 'not-friends');
      expectRefusal(() => removeFriendship(PENDING, SARAH), 'not-friends');
    });

    it('a declined request cannot be removed, which would erase the waiting time', () => {
      expectRefusal(() => removeFriendship(DECLINED, OMAR), 'not-friends');
      expectRefusal(() => removeFriendship(DECLINED, SARAH), 'not-friends');
    });

    it('there is nothing to remove between two people without a row', () => {
      expectRefusal(() => removeFriendship(NO_BOND, OMAR), 'not-friends');
    });

    it('after a removal, either of them can ask again at once', () => {
      const removed = removeFriendship(ACCEPTED, SARAH);

      expect(requestFriendship(removed, OMAR, SARAH, TOMORROW).friendship?.status).toBe('pending');
    });
  });

  describe('asking again after a refusal (friendRequestCooldownDays)', () => {
    // Declined on TOMORROW: the waiting time is counted from that day.
    const declinedOn = TOMORROW;

    it('the same day, the sender cannot ask again', () => {
      expectRefusal(
        () => requestFriendship(DECLINED, OMAR, SARAH, declinedOn),
        'request-declined-recently',
      );
    });

    it('6 days after the refusal, the sender still cannot ask again', () => {
      expectRefusal(
        () => requestFriendship(DECLINED, OMAR, SARAH, addDays(declinedOn, 6)),
        'request-declined-recently',
      );
    });

    it('7 days after the refusal, the sender can ask again: a new pending request', () => {
      const askedAgainOn = addDays(declinedOn, 7);

      expect(requestFriendship(DECLINED, OMAR, SARAH, askedAgainOn).friendship).toEqual({
        requesterId: OMAR,
        addresseeId: SARAH,
        status: 'pending',
        createdOn: askedAgainOn,
        respondedOn: null,
      });
    });

    it('long after the refusal, the sender can still ask again', () => {
      const muchLater = day('2027-11-24');

      expect(requestFriendship(DECLINED, OMAR, SARAH, muchLater).friendship?.status).toBe(
        'pending',
      );
    });

    it('the person who declined can ask at once: the row changes direction', () => {
      expect(requestFriendship(DECLINED, SARAH, OMAR, declinedOn).friendship).toEqual({
        requesterId: SARAH,
        addresseeId: OMAR,
        status: 'pending',
        createdOn: declinedOn,
        respondedOn: null,
      });
    });

    it('a sender whose day is behind the day of the refusal waits like anyone else', () => {
      expectRefusal(
        () => requestFriendship(DECLINED, OMAR, SARAH, addDays(declinedOn, -1)),
        'request-declined-recently',
      );
    });
  });

  describe('invalid input', () => {
    it('an impossible date is a RangeError, not a refusal', () => {
      const send = () => requestFriendship(NO_BOND, OMAR, SARAH, IMPOSSIBLE_DAY);

      expect(send).toThrow(RangeError);
      expect(send).not.toThrow(SocialRuleError);
      expect(() => acceptFriendRequest(PENDING, SARAH, IMPOSSIBLE_DAY)).toThrow(RangeError);
      expect(() => declineFriendRequest(PENDING, SARAH, IMPOSSIBLE_DAY)).toThrow(RangeError);
    });

    it('an empty identifier is a RangeError, not a refusal', () => {
      expect(() => requestFriendship(NO_BOND, '', SARAH, TODAY)).toThrow(RangeError);
      expect(() => requestFriendship(NO_BOND, '', SARAH, TODAY)).not.toThrow(SocialRuleError);
      expect(() => requestFriendship(NO_BOND, OMAR, '', TODAY)).toThrow(RangeError);
      expect(() => acceptFriendRequest(PENDING, '', TODAY)).toThrow(RangeError);
      expect(() => removeFriendship(ACCEPTED, '')).toThrow(RangeError);
    });

    it('an identifier that is not text is a TypeError', () => {
      expect(() => requestFriendship(NO_BOND, NOT_TEXT, SARAH, TODAY)).toThrow(TypeError);
      expect(() => requestFriendship(NO_BOND, OMAR, NOT_TEXT, TODAY)).toThrow(TypeError);
    });

    it('a bond that is not an object is a TypeError', () => {
      expect(() => requestFriendship(NOT_AN_OBJECT, OMAR, SARAH, TODAY)).toThrow(TypeError);
      expect(() => acceptFriendRequest(NOT_AN_OBJECT, SARAH, TODAY)).toThrow(TypeError);
    });

    it('a request cannot be sent over the bond of two other people', () => {
      // PENDING links Omar and Sarah: Mostapha has no place in it.
      expect(() => requestFriendship(PENDING, MUSTAPHA, SARAH, TODAY)).toThrow(RangeError);
      expect(() => requestFriendship(PENDING, MUSTAPHA, SARAH, TODAY)).not.toThrow(SocialRuleError);
    });
  });

  it('no function changes the bond it receives', () => {
    const pending: Friendship = {
      requesterId: OMAR,
      addresseeId: SARAH,
      status: 'pending',
      createdOn: TODAY,
      respondedOn: null,
    };
    const frozen: Bond = Object.freeze({
      friendship: Object.freeze(pending),
      blocks: Object.freeze([]),
    });

    // Writing to a frozen object throws in strict mode: a mutation would fail the test.
    expect(() => {
      acceptFriendRequest(frozen, SARAH, TOMORROW);
      declineFriendRequest(frozen, SARAH, TOMORROW);
      requestFriendship(frozen, SARAH, OMAR, TOMORROW);
    }).not.toThrow();
    expect(frozen.friendship).toEqual(pending);
  });
});
