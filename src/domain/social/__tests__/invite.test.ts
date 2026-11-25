import { addDays } from '@/domain/shared/local-date';

import {
  acceptFriendRequest,
  acceptInvite,
  blockPerson,
  createInvite,
  declineFriendRequest,
  generateInviteCode,
  INVITE_CODE_ALPHABET,
  NO_BOND,
  parseInviteCode,
  removeFriendship,
  requestFriendship,
  SOCIAL_CONFIG,
  type Bond,
  type Invite,
} from '../index';
import {
  day,
  expectRefusal,
  IMPOSSIBLE_DAY,
  NOT_TEXT,
  OMAR,
  SARAH,
  TODAY,
} from '../test-support/social-test-kit';

const CODE = 'K7M2QXP9';
const SARAHS_INVITE: Invite = createInvite(SARAH, CODE, TODAY);
const LAST_DAY = SARAHS_INVITE.expiresOn;

describe('Rule 6 — invitation code (code d’invitation)', () => {
  describe('the form of a code', () => {
    it('has the configured length and only characters of the alphabet', () => {
      expect(parseInviteCode(CODE)).toBe(CODE);
      expect(CODE).toHaveLength(SOCIAL_CONFIG.inviteCodeLength);
    });

    it('the alphabet holds no character that is easily mistaken for another', () => {
      for (const ambiguous of ['0', 'O', '1', 'I', 'L']) {
        expect(INVITE_CODE_ALPHABET).not.toContain(ambiguous);
      }
    });

    it.each([
      ['too short', CODE.slice(1)],
      ['too long', `${CODE}A`],
      ['empty', ''],
      ['lower case: the screen turns it to capitals, the rule does not guess', CODE.toLowerCase()],
      ['with an edge space', ` ${CODE}`],
      ['with an ambiguous character', 'K7M2QXP0'],
      ['with a symbol', 'K7M2QXP-'],
      ['with an Arabic digit', 'K7M2QXP٩'],
    ])('refuses a code that is %s', (_label, raw) => {
      expectRefusal(() => parseInviteCode(raw), 'invite-code-malformed');
    });

    it('refuses a value that is not text with a TypeError', () => {
      expect(() => parseInviteCode(NOT_TEXT)).toThrow(TypeError);
    });
  });

  describe('making a code', () => {
    it('is a code of the owner, valid for the configured number of days, last day included', () => {
      expect(SARAHS_INVITE).toEqual({
        code: CODE,
        ownerId: SARAH,
        createdOn: TODAY,
        expiresOn: addDays(TODAY, SOCIAL_CONFIG.inviteValidityDays),
      });
    });

    it('draws each character from the injected random source, so that tests are repeatable', () => {
      const calls: number[] = [];
      const code = generateInviteCode((size) => {
        calls.push(size);
        return calls.length - 1;
      });

      expect(code).toBe(INVITE_CODE_ALPHABET.slice(0, SOCIAL_CONFIG.inviteCodeLength));
      expect(new Set(calls)).toEqual(new Set([INVITE_CODE_ALPHABET.length]));
    });

    it('refuses a random source that answers outside the alphabet', () => {
      expect(() => generateInviteCode(() => INVITE_CODE_ALPHABET.length)).toThrow(RangeError);
      expect(() => generateInviteCode(() => -1)).toThrow(RangeError);
      expect(() => generateInviteCode(() => 0.5)).toThrow(RangeError);
    });

    it('refuses a malformed code and an impossible day', () => {
      expectRefusal(() => createInvite(SARAH, 'abc', TODAY), 'invite-code-malformed');
      expect(() => createInvite(SARAH, CODE, IMPOSSIBLE_DAY)).toThrow(RangeError);
    });
  });

  describe('accepting a code', () => {
    it('creates an accepted friendship: the one who types the code asked, the owner agreed', () => {
      const bond = acceptInvite(NO_BOND, SARAHS_INVITE, OMAR, TODAY);

      expect(bond.friendship).toEqual({
        requesterId: OMAR,
        addresseeId: SARAH,
        status: 'accepted',
        createdOn: TODAY,
        respondedOn: TODAY,
      });
    });

    it('works on the last day and not the day after', () => {
      expect(acceptInvite(NO_BOND, SARAHS_INVITE, OMAR, LAST_DAY).friendship?.status).toBe(
        'accepted',
      );
      expectRefusal(
        () => acceptInvite(NO_BOND, SARAHS_INVITE, OMAR, addDays(LAST_DAY, 1)),
        'invite-expired',
      );
    });

    it('is refused for the owner: it is their own code', () => {
      expectRefusal(() => acceptInvite(NO_BOND, SARAHS_INVITE, SARAH, TODAY), 'invite-is-yours');
    });

    it('is refused between two friends already', () => {
      const friends: Bond = acceptFriendRequest(
        requestFriendship(NO_BOND, OMAR, SARAH, TODAY),
        SARAH,
        TODAY,
      );

      expectRefusal(() => acceptInvite(friends, SARAHS_INVITE, OMAR, TODAY), 'already-friends');
    });

    it('turns a pending request, in either direction, into the one accepted row', () => {
      const askedBySarah = requestFriendship(NO_BOND, SARAH, OMAR, TODAY);
      const askedByOmar = requestFriendship(NO_BOND, OMAR, SARAH, TODAY);

      expect(acceptInvite(askedBySarah, SARAHS_INVITE, OMAR, TODAY).friendship?.status).toBe(
        'accepted',
      );
      expect(acceptInvite(askedByOmar, SARAHS_INVITE, OMAR, TODAY).friendship?.status).toBe(
        'accepted',
      );
    });

    it('overrides a declined request, even within the waiting time: the owner chose to hand out the code', () => {
      const declined = declineFriendRequest(
        requestFriendship(NO_BOND, OMAR, SARAH, TODAY),
        SARAH,
        TODAY,
      );

      expect(acceptInvite(declined, SARAHS_INVITE, OMAR, TODAY).friendship?.status).toBe(
        'accepted',
      );
    });

    it('is refused when the owner blocked the person, who is told the person is unavailable', () => {
      const blocked = blockPerson(NO_BOND, SARAH, OMAR, TODAY);

      expectRefusal(() => acceptInvite(blocked, SARAHS_INVITE, OMAR, TODAY), 'person-unavailable');
    });

    it('is refused when the person blocked the owner', () => {
      const blocked = blockPerson(NO_BOND, OMAR, SARAH, TODAY);

      expectRefusal(() => acceptInvite(blocked, SARAHS_INVITE, OMAR, TODAY), 'you-blocked-them');
    });

    it('works again after the friendship was removed, while the code lasts', () => {
      const friends = acceptInvite(NO_BOND, SARAHS_INVITE, OMAR, TODAY);

      expect(
        acceptInvite(removeFriendship(friends, OMAR), SARAHS_INVITE, OMAR, LAST_DAY).friendship
          ?.status,
      ).toBe('accepted');
    });

    it('refuses an invite row that is damaged', () => {
      expect(() =>
        acceptInvite(NO_BOND, { ...SARAHS_INVITE, expiresOn: IMPOSSIBLE_DAY }, OMAR, TODAY),
      ).toThrow(RangeError);
      expectRefusal(
        () => acceptInvite(NO_BOND, { ...SARAHS_INVITE, code: 'x' }, OMAR, TODAY),
        'invite-code-malformed',
      );
      expect(() =>
        acceptInvite(NO_BOND, { ...SARAHS_INVITE, expiresOn: day('2026-11-01') }, OMAR, TODAY),
      ).toThrow(RangeError);
    });
  });
});
