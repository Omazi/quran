import { assertBondBetween, type Bond } from './bond';
import { isBlockedEitherWay } from './blocking';
import type { PersonData, PersonView, SharedGarden, SharedLevel, UserId } from './types';
import { assertId, assertList, assertObject } from './validation';

/**
 * Rule 4: what a person sees of another. This is the one place that decides it: a screen, the
 * demonstration data and (as policies) the server all follow this list.
 */

function assertPersonData(data: PersonData): void {
  assertObject(data, 'person data');
  assertObject(data.profile, 'profile');
  assertId(data.profile.id, 'profile id');
  if (data.garden !== null) {
    assertObject(data.garden, 'garden summary');
    if (data.garden.userId !== data.profile.id) {
      throw new RangeError('Invalid person data: the garden summary is someone else’s');
    }
  }
  assertList(data.badges, 'badges');
  if (data.badges.some((badge) => badge.userId !== data.profile.id)) {
    throw new RangeError('Invalid person data: a badge is someone else’s');
  }
}

/**
 * What `viewerId` sees of the person described by `owner`, given the bond between the two.
 *
 * - The person themselves: everything.
 * - Blocked, in either direction: `null`, nothing at all (not even the name).
 * - An accepted friend: the name and the gender (how to speak of them); the garden if `showGarden`; the level, badges and reading
 *   counters (words, verses, hasanat estimate) if `showLevel`. A pending or declined request is not a friendship.
 * - Anyone else: the name only.
 *
 * A friend sees at most the fields of `SharedGarden` and `SharedLevel`: they hold no page
 * number and no time of day, so there is nothing to filter out later.
 */
export function viewOf(owner: PersonData, viewerId: UserId, bond: Bond): PersonView | null {
  assertPersonData(owner);
  assertId(viewerId, 'viewer');
  const { profile, garden, badges } = owner;

  if (viewerId === profile.id) {
    return { kind: 'self', profile, garden, badges };
  }

  assertBondBetween(bond, viewerId, profile.id);
  if (isBlockedEitherWay(bond)) return null;

  const isFriend = bond.friendship !== null && bond.friendship.status === 'accepted';
  if (!isFriend) {
    return { kind: 'other', userId: profile.id, displayName: profile.displayName };
  }

  const sharedGarden: SharedGarden | null =
    profile.showGarden && garden !== null
      ? {
          hizbCompleted: garden.hizbCompleted,
          health: garden.health,
          lastWateredOn: garden.lastWateredOn,
          streakDays: garden.streakDays,
          updatedOn: garden.updatedOn,
        }
      : null;
  const sharedLevel: SharedLevel | null =
    profile.showLevel && garden !== null
      ? {
          level: garden.level,
          badgeCount: garden.badgeCount,
          badges,
          wordsRead: garden.wordsRead,
          versesRead: garden.versesRead,
          hasanatEstimate: garden.hasanatEstimate,
        }
      : null;

  return {
    kind: 'friend',
    userId: profile.id,
    displayName: profile.displayName,
    gender: profile.gender,
    garden: sharedGarden,
    level: sharedLevel,
  };
}
