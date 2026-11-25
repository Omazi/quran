import {
  acceptFriendRequest,
  blockPerson,
  declineFriendRequest,
  NO_BOND,
  requestFriendship,
  viewOf,
  type Badge,
  type Bond,
  type GardenSummary,
  type PersonData,
} from '../index';
import {
  day,
  MUSTAPHA,
  NOT_AN_OBJECT,
  OMAR,
  profileOf,
  SARAH,
  TAGHREAD,
  TODAY,
} from '../test-support/social-test-kit';

const GARDEN: GardenSummary = {
  userId: SARAH,
  level: 3,
  hizbCompleted: 42,
  health: 0.75,
  lastWateredOn: day('2026-11-23'),
  streakDays: 12,
  badgeCount: 2,
  updatedOn: TODAY,
};
const BADGES: readonly Badge[] = [
  { userId: SARAH, khatmNumber: 1, completedOn: day('2026-03-01') },
  { userId: SARAH, khatmNumber: 2, completedOn: day('2026-08-01') },
];

function sarah(overrides: Partial<{ showGarden: boolean; showLevel: boolean }> = {}): PersonData {
  return { profile: profileOf(SARAH, 'Sarah', overrides), garden: GARDEN, badges: BADGES };
}

const FRIENDS: Bond = acceptFriendRequest(
  requestFriendship(NO_BOND, OMAR, SARAH, TODAY),
  SARAH,
  TODAY,
);

describe('Rule 4 — what another person sees of me (viewOf)', () => {
  describe('myself', () => {
    it('I see everything, even what I hide from my friends', () => {
      const view = viewOf(sarah({ showGarden: false, showLevel: false }), SARAH, NO_BOND);

      expect(view).toEqual({
        kind: 'self',
        profile: profileOf(SARAH, 'Sarah', { showGarden: false, showLevel: false }),
        garden: GARDEN,
        badges: BADGES,
      });
    });
  });

  describe('an accepted friend who is not blocked', () => {
    it('sees the name, the garden and the level by default', () => {
      expect(viewOf(sarah(), OMAR, FRIENDS)).toEqual({
        kind: 'friend',
        userId: SARAH,
        displayName: 'Sarah',
        garden: {
          hizbCompleted: 42,
          health: 0.75,
          lastWateredOn: day('2026-11-23'),
          streakDays: 12,
          updatedOn: TODAY,
        },
        level: { level: 3, badgeCount: 2, badges: BADGES },
      });
    });

    it('does not see the garden when showGarden is off, but still sees the level', () => {
      const view = viewOf(sarah({ showGarden: false }), OMAR, FRIENDS);

      expect(view).toMatchObject({ kind: 'friend', displayName: 'Sarah', garden: null });
      expect(view).toMatchObject({ level: { level: 3 } });
    });

    it('does not see the level or the badges when showLevel is off, but still sees the garden', () => {
      const view = viewOf(sarah({ showLevel: false }), OMAR, FRIENDS);

      expect(view).toMatchObject({ kind: 'friend', level: null, garden: { hizbCompleted: 42 } });
      expect(JSON.stringify(view)).not.toContain('badgeCount');
      expect(JSON.stringify(view)).not.toContain('khatmNumber');
    });

    it('sees the name only when both are off', () => {
      expect(viewOf(sarah({ showGarden: false, showLevel: false }), OMAR, FRIENDS)).toEqual({
        kind: 'friend',
        userId: SARAH,
        displayName: 'Sarah',
        garden: null,
        level: null,
      });
    });

    it('sees no garden and no level before the app of the person has published a summary', () => {
      const unpublished: PersonData = {
        profile: profileOf(SARAH, 'Sarah'),
        garden: null,
        badges: [],
      };

      expect(viewOf(unpublished, OMAR, FRIENDS)).toMatchObject({
        kind: 'friend',
        garden: null,
        level: null,
      });
    });

    it('sees nothing that is a page number or an hour: a summary has no such field', () => {
      const text = JSON.stringify(viewOf(sarah(), OMAR, FRIENDS));

      expect(text).not.toMatch(/page|hour|time|journal/i);
    });
  });

  describe('anyone else', () => {
    it.each([
      ['a stranger', NO_BOND],
      ['someone whose request is pending', requestFriendship(NO_BOND, OMAR, SARAH, TODAY)],
      [
        'someone whose request was declined',
        declineFriendRequest(requestFriendship(NO_BOND, OMAR, SARAH, TODAY), SARAH, TODAY),
      ],
    ])('%s sees the name only', (_label, bond) => {
      expect(viewOf(sarah(), OMAR, bond)).toEqual({
        kind: 'other',
        userId: SARAH,
        displayName: 'Sarah',
      });
    });
  });

  describe('a block between the two', () => {
    it('shows nothing at all when the viewer is blocked by the owner', () => {
      expect(viewOf(sarah(), OMAR, blockPerson(FRIENDS, SARAH, OMAR, TODAY))).toBeNull();
    });

    it('shows nothing at all when the viewer blocked the owner', () => {
      expect(viewOf(sarah(), OMAR, blockPerson(FRIENDS, OMAR, SARAH, TODAY))).toBeNull();
    });

    it('shows nothing, not even the name, between two strangers who are blocked', () => {
      expect(viewOf(sarah(), OMAR, blockPerson(NO_BOND, OMAR, SARAH, TODAY))).toBeNull();
    });

    it('a block row left next to an accepted friendship still wins', () => {
      const stale: Bond = {
        friendship: FRIENDS.friendship,
        blocks: blockPerson(NO_BOND, SARAH, OMAR, TODAY).blocks,
      };

      expect(viewOf(sarah(), OMAR, stale)).toBeNull();
    });
  });

  describe('invalid input', () => {
    it('a bond between other people is a RangeError', () => {
      expect(() => viewOf(sarah(), MUSTAPHA, FRIENDS)).toThrow(RangeError);
    });

    it('a garden summary of someone else is a RangeError', () => {
      const mixed: PersonData = { ...sarah(), garden: { ...GARDEN, userId: TAGHREAD } };

      expect(() => viewOf(mixed, OMAR, FRIENDS)).toThrow(RangeError);
    });

    it('a badge of someone else is a RangeError', () => {
      const [first] = BADGES;
      const mixed: PersonData = { ...sarah(), badges: [{ ...first!, userId: TAGHREAD }] };

      expect(() => viewOf(mixed, OMAR, FRIENDS)).toThrow(RangeError);
    });

    it('data that is not an object is a TypeError', () => {
      expect(() => viewOf(NOT_AN_OBJECT, OMAR, FRIENDS)).toThrow(TypeError);
    });

    it('an empty viewer identifier is a RangeError', () => {
      expect(() => viewOf(sarah(), '', FRIENDS)).toThrow(RangeError);
    });
  });
});
