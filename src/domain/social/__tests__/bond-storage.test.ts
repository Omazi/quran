import {
  acceptFriendRequest,
  blockPerson,
  bondBetween,
  NO_BOND,
  replaceBond,
  requestFriendship,
  type Block,
  type Friendship,
} from '../index';
import { MUSTAPHA, OMAR, SARAH, TODAY } from '../test-support/social-test-kit';

const OMAR_SARAH: Friendship = {
  requesterId: OMAR,
  addresseeId: SARAH,
  status: 'accepted',
  createdOn: TODAY,
  respondedOn: TODAY,
};
const SARAH_MUSTAPHA: Friendship = { ...OMAR_SARAH, requesterId: SARAH, addresseeId: MUSTAPHA };
const SARAH_BLOCKS_OMAR: Block = { blockerId: SARAH, blockedId: OMAR, createdOn: TODAY };

describe('Bond of a pair, read from and written back to the tables', () => {
  it('reads the friendship and the blocks of a pair, whatever the order of the two people', () => {
    const tables = { friendships: [SARAH_MUSTAPHA, OMAR_SARAH], blocks: [SARAH_BLOCKS_OMAR] };

    expect(bondBetween(tables, SARAH, OMAR)).toEqual({
      friendship: OMAR_SARAH,
      blocks: [SARAH_BLOCKS_OMAR],
    });
    expect(bondBetween(tables, OMAR, SARAH)).toEqual(bondBetween(tables, SARAH, OMAR));
  });

  it('two people with no row have no bond', () => {
    expect(bondBetween({ friendships: [OMAR_SARAH], blocks: [] }, OMAR, MUSTAPHA)).toEqual(NO_BOND);
  });

  it('two friendship rows for one pair, in either direction, are damaged data', () => {
    const twice = {
      friendships: [OMAR_SARAH, { ...OMAR_SARAH, requesterId: SARAH, addresseeId: OMAR }],
      blocks: [],
    };

    expect(() => bondBetween(twice, OMAR, SARAH)).toThrow(RangeError);
  });

  it('writing a bond back replaces the rows of the pair and keeps every other row', () => {
    const tables = { friendships: [SARAH_MUSTAPHA, OMAR_SARAH], blocks: [SARAH_BLOCKS_OMAR] };
    const blocked = blockPerson(bondBetween(tables, OMAR, SARAH), OMAR, SARAH, TODAY);

    const written = replaceBond(tables, OMAR, SARAH, blocked);

    expect(written.friendships).toEqual([SARAH_MUSTAPHA]);
    expect(written.blocks).toHaveLength(2);
  });

  it('writing a new request adds a row for a pair that had none', () => {
    const bond = requestFriendship(NO_BOND, OMAR, MUSTAPHA, TODAY);

    expect(
      replaceBond({ friendships: [OMAR_SARAH], blocks: [] }, OMAR, MUSTAPHA, bond).friendships,
    ).toHaveLength(2);
  });

  it('accepting then writing back keeps one row per pair', () => {
    const pending = requestFriendship(NO_BOND, OMAR, SARAH, TODAY);
    const tables = replaceBond({ friendships: [], blocks: [] }, OMAR, SARAH, pending);
    const accepted = acceptFriendRequest(bondBetween(tables, OMAR, SARAH), SARAH, TODAY);

    expect(replaceBond(tables, OMAR, SARAH, accepted).friendships).toHaveLength(1);
  });

  it('refuses to write a bond of two other people', () => {
    expect(() =>
      replaceBond(
        { friendships: [], blocks: [] },
        OMAR,
        MUSTAPHA,
        bondBetween({ friendships: [OMAR_SARAH], blocks: [] }, OMAR, SARAH),
      ),
    ).toThrow(RangeError);
  });
});
