import { addDays } from '@/domain/shared/local-date';

import {
  acceptFriendRequest,
  blockPerson,
  NO_BOND,
  requestFriendship,
  sendNudge,
  type Bond,
  type Nudge,
  type NudgeRequest,
} from '../index';
import {
  expectRefusal,
  IMPOSSIBLE_DAY,
  MUSTAPHA,
  OMAR,
  SARAH,
  TODAY,
} from '../test-support/social-test-kit';

const FRIENDS: Bond = acceptFriendRequest(
  requestFriendship(NO_BOND, OMAR, SARAH, TODAY),
  SARAH,
  TODAY,
);
const REQUEST: NudgeRequest = { fromId: OMAR, toId: SARAH, kind: 'encourage', today: TODAY };

describe('Rule 7 — nudge (encouragement)', () => {
  it('goes to an accepted friend: the nudge carries the sender, the friend, the kind and the day', () => {
    expect(sendNudge(REQUEST, FRIENDS, [])).toEqual({
      fromId: OMAR,
      toId: SARAH,
      kind: 'encourage',
      sentOn: TODAY,
    });
  });

  it('both kinds are possible', () => {
    expect(sendNudge({ ...REQUEST, kind: 'congratulate' }, FRIENDS, []).kind).toBe('congratulate');
  });

  it('is refused to someone who is not a friend', () => {
    expectRefusal(() => sendNudge(REQUEST, NO_BOND, []), 'not-friends');
  });

  it('is refused while the request is still pending', () => {
    expectRefusal(
      () => sendNudge(REQUEST, requestFriendship(NO_BOND, OMAR, SARAH, TODAY), []),
      'not-friends',
    );
  });

  it('is refused to oneself', () => {
    expectRefusal(() => sendNudge({ ...REQUEST, toId: OMAR }, NO_BOND, []), 'not-friends');
  });

  it('is refused across a block, in either direction', () => {
    expectRefusal(
      () => sendNudge(REQUEST, blockPerson(FRIENDS, SARAH, OMAR, TODAY), []),
      'person-unavailable',
    );
    expectRefusal(
      () => sendNudge(REQUEST, blockPerson(FRIENDS, OMAR, SARAH, TODAY), []),
      'you-blocked-them',
    );
  });

  describe('one per friend and per local day', () => {
    const SENT_TODAY: Nudge = { fromId: OMAR, toId: SARAH, kind: 'encourage', sentOn: TODAY };

    it('a second nudge to the same friend the same day is refused, whatever its kind', () => {
      expectRefusal(() => sendNudge(REQUEST, FRIENDS, [SENT_TODAY]), 'already-nudged-today');
      expectRefusal(
        () => sendNudge({ ...REQUEST, kind: 'congratulate' }, FRIENDS, [SENT_TODAY]),
        'already-nudged-today',
      );
    });

    it('the next day, the same friend can be nudged again', () => {
      expect(
        sendNudge({ ...REQUEST, today: addDays(TODAY, 1) }, FRIENDS, [SENT_TODAY]).sentOn,
      ).toBe(addDays(TODAY, 1));
    });

    it('another friend can be nudged the same day', () => {
      const withMustapha = acceptFriendRequest(
        requestFriendship(NO_BOND, OMAR, MUSTAPHA, TODAY),
        MUSTAPHA,
        TODAY,
      );

      expect(sendNudge({ ...REQUEST, toId: MUSTAPHA }, withMustapha, [SENT_TODAY]).toId).toBe(
        MUSTAPHA,
      );
    });

    it('a nudge the friend sent me does not count against me', () => {
      const fromSarah: Nudge = { fromId: SARAH, toId: OMAR, kind: 'encourage', sentOn: TODAY };

      expect(sendNudge(REQUEST, FRIENDS, [fromSarah]).fromId).toBe(OMAR);
    });
  });

  describe('invalid input', () => {
    it('an impossible day is a RangeError', () => {
      expect(() => sendNudge({ ...REQUEST, today: IMPOSSIBLE_DAY }, FRIENDS, [])).toThrow(
        RangeError,
      );
    });

    it('an unknown kind is a RangeError', () => {
      expect(() => sendNudge({ ...REQUEST, kind: 'poke' as Nudge['kind'] }, FRIENDS, [])).toThrow(
        RangeError,
      );
    });

    it('a list of nudges that is not a list is a TypeError', () => {
      expect(() => sendNudge(REQUEST, FRIENDS, null as unknown as readonly Nudge[])).toThrow(
        TypeError,
      );
    });

    it('a bond of two other people is a RangeError', () => {
      expect(() => sendNudge({ ...REQUEST, toId: MUSTAPHA }, FRIENDS, [])).toThrow(RangeError);
    });
  });
});
