import { addDays, compareLocalDates, type LocalDate } from '@/domain/shared/local-date';

import { assertBondBetween, type Bond } from './bond';
import { assertNoBlock } from './blocking';
import { INVITE_CODE_ALPHABET, INVITE_LINK_PREFIX, SOCIAL_CONFIG } from './config';
import { SocialRuleError } from './errors';
import type { Invite, UserId } from './types';
import { assertId, assertLocalDate, assertObject } from './validation';

/**
 * Rule 6: invitation codes. A code is handed out by its owner; whoever types it becomes the
 * owner's friend at once, because the owner already agreed by handing it out.
 */

/**
 * The code as it is, or a refusal. Nothing is corrected: no capitals, no trimmed spaces. The
 * screen turns what is typed into capitals; the rule only says whether the result is a code.
 */
export function parseInviteCode(raw: string): string {
  if (typeof raw !== 'string') {
    throw new TypeError(
      `Invalid invitation code: expected text, got ${raw === null ? 'null' : typeof raw}`,
    );
  }
  const wellFormed =
    raw.length === SOCIAL_CONFIG.inviteCodeLength &&
    Array.from(raw).every((character) => INVITE_CODE_ALPHABET.includes(character));
  if (!wellFormed) {
    throw new SocialRuleError(
      'invite-code-malformed',
      `a code has ${SOCIAL_CONFIG.inviteCodeLength} characters, capitals and digits without look-alikes`,
    );
  }
  return raw;
}

/**
 * The text a QR code carries: `quranapp://invite/<CODE>` (D36). The code is checked first: a
 * link is never made from a bad code.
 */
export function inviteLink(code: string): string {
  return `${INVITE_LINK_PREFIX}${parseInviteCode(code)}`;
}

/**
 * The code held by scanned or pasted text: exactly the link of `inviteLink`, or a bare valid
 * code. Anything else is refused as a malformed code; the text is never trimmed or corrected,
 * so a link with a path, a query or a space after it is not an invitation.
 */
export function parseInviteLink(text: string): string {
  if (typeof text !== 'string') {
    throw new TypeError(
      `Invalid invitation link: expected text, got ${text === null ? 'null' : typeof text}`,
    );
  }
  return parseInviteCode(
    text.startsWith(INVITE_LINK_PREFIX) ? text.slice(INVITE_LINK_PREFIX.length) : text,
  );
}

/**
 * A new code. The randomness is injected (`randomIndex(size)` answers a whole number from 0 to
 * `size - 1`): the domain draws nothing itself, so tests are repeatable. The real source must be
 * a secure one: a guessable code is a way into someone's friends.
 */
export function generateInviteCode(randomIndex: (size: number) => number): string {
  const size = INVITE_CODE_ALPHABET.length;
  let code = '';
  for (let position = 0; position < SOCIAL_CONFIG.inviteCodeLength; position += 1) {
    const index = randomIndex(size);
    if (!Number.isInteger(index) || index < 0 || index >= size) {
      throw new RangeError(`Invalid random index: ${String(index)} (expected 0 to ${size - 1})`);
    }
    code += INVITE_CODE_ALPHABET.charAt(index);
  }
  return code;
}

export function createInvite(ownerId: UserId, code: string, today: LocalDate): Invite {
  assertId(ownerId, 'owner');
  assertLocalDate(today, 'today');
  return {
    code: parseInviteCode(code),
    ownerId,
    createdOn: today,
    expiresOn: addDays(today, SOCIAL_CONFIG.inviteValidityDays),
  };
}

function assertInvite(invite: Invite): void {
  assertObject(invite, 'invite');
  parseInviteCode(invite.code);
  assertId(invite.ownerId, 'invite owner');
  assertLocalDate(invite.createdOn, 'invite createdOn');
  assertLocalDate(invite.expiresOn, 'invite expiresOn');
  if (compareLocalDates(invite.expiresOn, invite.createdOn) < 0) {
    throw new RangeError('Invalid invite: it expires before it was made');
  }
}

/**
 * `accepterId` types the code of `invite`. The code can be used by several people, until its
 * last day. A pending or declined request between the two is replaced: one row per pair.
 */
export function acceptInvite(
  bond: Bond,
  invite: Invite,
  accepterId: UserId,
  today: LocalDate,
): Bond {
  assertInvite(invite);
  assertId(accepterId, 'accepter');
  assertLocalDate(today, 'today');
  if (invite.ownerId === accepterId) {
    throw new SocialRuleError('invite-is-yours', 'a code is for someone else');
  }
  if (compareLocalDates(today, invite.expiresOn) > 0) {
    throw new SocialRuleError('invite-expired', 'this code is no longer valid');
  }
  assertBondBetween(bond, accepterId, invite.ownerId);
  assertNoBlock(bond, accepterId, invite.ownerId);
  if (bond.friendship !== null && bond.friendship.status === 'accepted') {
    throw new SocialRuleError('already-friends', 'these two people are already friends');
  }
  return {
    ...bond,
    friendship: {
      requesterId: accepterId,
      addresseeId: invite.ownerId,
      status: 'accepted',
      createdOn: today,
      respondedOn: today,
    },
  };
}
