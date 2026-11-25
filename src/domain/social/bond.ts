import type { Block, Friendship, FriendshipStatus, UserId } from './types';
import { assertId, assertList, assertLocalDate, assertObject } from './validation';

/**
 * Everything that exists between two people: their friendship row, if there is one, and the
 * blocks between them, at most one in each direction.
 *
 * The rules about two people (requests, blocks, invitation codes) all take the bond of the
 * pair and give back the bond as it becomes. Whoever stores the rows reads the bond of a pair
 * before a rule and writes it back after.
 */
export interface Bond {
  readonly friendship: Friendship | null;
  readonly blocks: readonly Block[];
}

/** Two people with nothing between them. */
export const NO_BOND: Bond = Object.freeze({ friendship: null, blocks: Object.freeze([]) });

const FRIENDSHIP_STATUSES: readonly FriendshipStatus[] = ['pending', 'accepted', 'declined'];
const MAX_BLOCKS_IN_A_BOND = 2;

function assertFriendship(friendship: Friendship): void {
  assertObject(friendship, 'friendship');
  assertId(friendship.requesterId, 'friendship requester');
  assertId(friendship.addresseeId, 'friendship addressee');
  if (friendship.requesterId === friendship.addresseeId) {
    throw new RangeError('Invalid friendship: the requester and the addressee are the same person');
  }
  if (!FRIENDSHIP_STATUSES.includes(friendship.status)) {
    throw new RangeError(`Invalid friendship status: ${String(friendship.status)}`);
  }
  assertLocalDate(friendship.createdOn, 'friendship createdOn');
  if (friendship.status === 'pending') {
    if (friendship.respondedOn !== null) {
      throw new RangeError('Invalid friendship: a pending request has no answer day');
    }
  } else {
    if (friendship.respondedOn === null) {
      throw new RangeError(`Invalid friendship: a request ${friendship.status} has an answer day`);
    }
    assertLocalDate(friendship.respondedOn, 'friendship respondedOn');
  }
}

function assertBlock(block: Block): void {
  assertObject(block, 'block');
  assertId(block.blockerId, 'blocker');
  assertId(block.blockedId, 'blocked person');
  if (block.blockerId === block.blockedId) {
    throw new RangeError('Invalid block: nobody blocks themselves');
  }
  assertLocalDate(block.createdOn, 'block createdOn');
}

/** The two people of a row, in a fixed order, so that the direction of the row does not count. */
function pairOf(first: UserId, second: UserId): readonly [UserId, UserId] {
  return first < second ? [first, second] : [second, first];
}

function isSamePair(pair: readonly [UserId, UserId], other: readonly [UserId, UserId]): boolean {
  return pair[0] === other[0] && pair[1] === other[1];
}

/**
 * Throws unless the bond is well formed: valid rows, all between the same two people, and at
 * most one block in each direction. Returns those two people, or null for an empty bond.
 */
function checkedPairOf(bond: Bond): readonly [UserId, UserId] | null {
  assertObject(bond, 'bond');
  assertList(bond.blocks, 'bond blocks');
  if (bond.blocks.length > MAX_BLOCKS_IN_A_BOND) {
    throw new RangeError('Invalid bond: more than one block in each direction');
  }

  const pairs: (readonly [UserId, UserId])[] = [];
  if (bond.friendship !== null) {
    assertFriendship(bond.friendship);
    pairs.push(pairOf(bond.friendship.requesterId, bond.friendship.addresseeId));
  }
  for (const block of bond.blocks) {
    assertBlock(block);
    pairs.push(pairOf(block.blockerId, block.blockedId));
  }
  const [first, second] = bond.blocks;
  if (first !== undefined && second !== undefined && first.blockerId === second.blockerId) {
    throw new RangeError('Invalid bond: the same block twice');
  }

  const pair = pairs[0];
  if (pair === undefined) return null;
  if (!pairs.every((other) => isSamePair(pair, other))) {
    throw new RangeError('Invalid bond: its rows are not all between the same two people');
  }
  return pair;
}

/** Throws unless the bond is well formed (see `checkedPairOf`). */
export function assertBond(bond: Bond): void {
  checkedPairOf(bond);
}

/** Throws unless the bond is well formed and links these two people, or nobody yet. */
export function assertBondBetween(bond: Bond, first: UserId, second: UserId): void {
  const pair = checkedPairOf(bond);
  if (pair !== null && !isSamePair(pair, pairOf(first, second))) {
    throw new RangeError('Invalid bond: it links two other people');
  }
}

/** The two tables a bond is read from and written to. */
export interface BondTables {
  readonly friendships: readonly Friendship[];
  readonly blocks: readonly Block[];
}

function isBetween(first: UserId, second: UserId, one: UserId, other: UserId): boolean {
  return isSamePair(pairOf(first, second), pairOf(one, other));
}

/**
 * The bond of two people, read from the tables, whichever way the rows were written. Two
 * friendship rows for one pair mean damaged data, which the table's unique index forbids.
 */
export function bondBetween(tables: BondTables, first: UserId, second: UserId): Bond {
  const friendships = tables.friendships.filter((row) =>
    isBetween(row.requesterId, row.addresseeId, first, second),
  );
  if (friendships.length > 1) {
    throw new RangeError('Invalid friendships: more than one row for a pair of people');
  }
  const bond: Bond = {
    friendship: friendships[0] ?? null,
    blocks: tables.blocks.filter((row) => isBetween(row.blockerId, row.blockedId, first, second)),
  };
  assertBondBetween(bond, first, second);
  return bond;
}

/** The tables with the rows of the pair replaced by the bond: every other row is kept. */
export function replaceBond(
  tables: BondTables,
  first: UserId,
  second: UserId,
  bond: Bond,
): BondTables {
  assertBondBetween(bond, first, second);
  return {
    friendships: [
      ...tables.friendships.filter(
        (row) => !isBetween(row.requesterId, row.addresseeId, first, second),
      ),
      ...(bond.friendship === null ? [] : [bond.friendship]),
    ],
    blocks: [
      ...tables.blocks.filter((row) => !isBetween(row.blockerId, row.blockedId, first, second)),
      ...bond.blocks,
    ],
  };
}
