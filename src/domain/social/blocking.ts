import type { LocalDate } from '@/domain/shared/local-date';

import { assertBond, assertBondBetween, type Bond } from './bond';
import { SocialRuleError } from './errors';
import type { Block, UserId } from './types';
import { assertId, assertLocalDate } from './validation';

/**
 * Rule 3: blocks. A block is one row from the blocker to the blocked person; each of the two
 * can block the other, so a bond holds at most two.
 */

function blockOf(bond: Bond, blockerId: UserId): Block | undefined {
  return bond.blocks.find((block) => block.blockerId === blockerId);
}

/** Whether either of the two people blocked the other. */
export function isBlockedEitherWay(bond: Bond): boolean {
  assertBond(bond);
  return bond.blocks.length > 0;
}

/** Whether `blockerId` blocked the other person of the bond. */
export function hasBlocked(bond: Bond, blockerId: UserId): boolean {
  assertBond(bond);
  assertId(blockerId, 'blocker');
  return blockOf(bond, blockerId) !== undefined;
}

/**
 * Throws unless `actorId` is free to deal with `otherId`: no block in either direction.
 *
 * Whoever blocked is told so, because they can undo it. The blocked person is not: they get
 * `person-unavailable`, the answer about an account that does not exist, so that nothing
 * shows them that they were blocked.
 */
export function assertNoBlock(bond: Bond, actorId: UserId, otherId: UserId): void {
  assertBondBetween(bond, actorId, otherId);
  if (blockOf(bond, actorId) !== undefined) {
    throw new SocialRuleError('you-blocked-them', 'unblock this person first');
  }
  if (blockOf(bond, otherId) !== undefined) {
    throw new SocialRuleError('person-unavailable', 'this person cannot be reached');
  }
}

/**
 * `blockerId` blocks `blockedId`. An accepted friendship and a pending request disappear. A
 * declined request stays: it is not a friendship, and removing it would let a block followed
 * by an unblock erase the sender's waiting time.
 */
export function blockPerson(
  bond: Bond,
  blockerId: UserId,
  blockedId: UserId,
  today: LocalDate,
): Bond {
  assertId(blockerId, 'blocker');
  assertId(blockedId, 'blocked person');
  assertLocalDate(today, 'today');
  if (blockerId === blockedId) {
    throw new SocialRuleError('cannot-block-yourself', 'a block is against someone else');
  }
  assertBondBetween(bond, blockerId, blockedId);
  if (blockOf(bond, blockerId) !== undefined) {
    throw new SocialRuleError('already-blocked', 'this person is already blocked');
  }

  const block: Block = { blockerId, blockedId, createdOn: today };
  const keepsFriendship = bond.friendship !== null && bond.friendship.status === 'declined';
  return {
    friendship: keepsFriendship ? bond.friendship : null,
    blocks: [...bond.blocks, block],
  };
}

/** Only the blocker lifts their own block. The friendship that was removed does not return. */
export function unblockPerson(bond: Bond, blockerId: UserId, blockedId: UserId): Bond {
  assertId(blockerId, 'blocker');
  assertId(blockedId, 'blocked person');
  assertBondBetween(bond, blockerId, blockedId);
  if (blockOf(bond, blockerId) === undefined) {
    throw new SocialRuleError('not-blocked', 'this person is not blocked');
  }
  return { ...bond, blocks: bond.blocks.filter((block) => block.blockerId !== blockerId) };
}
