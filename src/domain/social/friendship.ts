import { daysBetween, type LocalDate } from '@/domain/shared/local-date';

import { assertBond, type Bond } from './bond';
import { assertNoBlock } from './blocking';
import { SOCIAL_CONFIG } from './config';
import { SocialRuleError } from './errors';
import type { Friendship, UserId } from './types';
import { assertId, assertLocalDate } from './validation';

/**
 * Rule 2: friend requests. One row per pair of people, whoever asked: every function takes
 * the bond of the pair and returns the bond as it becomes.
 */

function pendingRequest(fromId: UserId, toId: UserId, today: LocalDate): Friendship {
  return {
    requesterId: fromId,
    addresseeId: toId,
    status: 'pending',
    createdOn: today,
    respondedOn: null,
  };
}

function answered(
  request: Friendship,
  status: 'accepted' | 'declined',
  today: LocalDate,
): Friendship {
  return { ...request, status, respondedOn: today };
}

/**
 * Whether the sender of a declined request must still wait. The wait runs from the day of the
 * refusal: with 7 days, a request declined on the 1st can be sent again on the 8th.
 */
function isStillCoolingDown(declined: Friendship, today: LocalDate): boolean {
  // Never null: `assertBond` refuses an answered request without its answer day.
  if (declined.respondedOn === null) return false;
  return daysBetween(declined.respondedOn, today) < SOCIAL_CONFIG.friendRequestCooldownDays;
}

/**
 * Sends a friend request from `fromId` to `toId`.
 *
 * - Nobody adds themselves.
 * - If the other person has already asked, their request is accepted: still one row.
 * - Nobody can ask across a block, in either direction (rule 3).
 * - A sender whose request was declined waits `friendRequestCooldownDays` days. The person
 *   who declined does not wait: their request replaces the row, in the other direction.
 */
export function requestFriendship(
  bond: Bond,
  fromId: UserId,
  toId: UserId,
  today: LocalDate,
): Bond {
  assertId(fromId, 'sender');
  assertId(toId, 'addressee');
  assertLocalDate(today, 'today');
  if (fromId === toId) {
    throw new SocialRuleError('cannot-befriend-yourself', 'a request goes to someone else');
  }
  assertNoBlock(bond, fromId, toId);

  const existing = bond.friendship;
  if (existing === null) return { ...bond, friendship: pendingRequest(fromId, toId, today) };

  switch (existing.status) {
    case 'accepted':
      throw new SocialRuleError('already-friends', 'these two people are already friends');
    case 'pending':
      if (existing.requesterId === fromId) {
        throw new SocialRuleError('request-already-sent', 'the request is waiting for an answer');
      }
      return { ...bond, friendship: answered(existing, 'accepted', today) };
    case 'declined':
      if (existing.requesterId === fromId && isStillCoolingDown(existing, today)) {
        throw new SocialRuleError(
          'request-declined-recently',
          `a declined request can be sent again after ${SOCIAL_CONFIG.friendRequestCooldownDays} days`,
        );
      }
      return { ...bond, friendship: pendingRequest(fromId, toId, today) };
  }
}

/** The pending request of the bond, once checked that `actorId` is the one it was sent to. */
function requestToAnswer(bond: Bond, actorId: UserId, today: LocalDate): Friendship {
  assertId(actorId, 'actor');
  assertLocalDate(today, 'today');
  assertBond(bond);

  const request = bond.friendship;
  if (request === null || request.status !== 'pending') {
    throw new SocialRuleError('no-pending-request', 'there is no request waiting for an answer');
  }
  if (request.addresseeId !== actorId) {
    throw new SocialRuleError('not-the-addressee', 'only the person asked can answer a request');
  }
  assertNoBlock(bond, actorId, request.requesterId);
  return request;
}

/** Only the addressee accepts. */
export function acceptFriendRequest(bond: Bond, actorId: UserId, today: LocalDate): Bond {
  const request = requestToAnswer(bond, actorId, today);
  return { ...bond, friendship: answered(request, 'accepted', today) };
}

/** Only the addressee declines. The row stays, declined: it is what makes the sender wait. */
export function declineFriendRequest(bond: Bond, actorId: UserId, today: LocalDate): Bond {
  const request = requestToAnswer(bond, actorId, today);
  return { ...bond, friendship: answered(request, 'declined', today) };
}

/**
 * Either friend removes an accepted friendship: the row disappears, and either of them can ask
 * again at once. Nothing else can be removed: not a pending request, and above all not a
 * declined one, whose removal would erase the sender's wait.
 */
export function removeFriendship(bond: Bond, actorId: UserId): Bond {
  assertId(actorId, 'actor');
  assertBond(bond);

  const friendship = bond.friendship;
  if (friendship === null || friendship.status !== 'accepted') {
    throw new SocialRuleError('not-friends', 'these two people are not friends');
  }
  if (friendship.requesterId !== actorId && friendship.addresseeId !== actorId) {
    throw new SocialRuleError('not-your-friendship', 'only the two friends can end a friendship');
  }
  return { ...bond, friendship: null };
}
