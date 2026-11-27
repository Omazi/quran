import { parseGender } from '@/domain/shared/gender';
import type { LocalDate } from '@/domain/shared/local-date';

import { parseDisplayName } from './display-name';
import type { Profile, ProfileChanges, UserId } from './types';
import { assertId, assertLocalDate, assertObject } from './validation';

const CHANGEABLE_FIELDS: readonly string[] = ['displayName', 'showGarden', 'showLevel', 'gender'];

/** A new profile: the garden and the level are shown to friends until the person says no (D23). */
export function createProfile(id: UserId, rawName: string, today: LocalDate): Profile {
  assertId(id, 'profile id');
  assertLocalDate(today, 'today');
  return {
    id,
    displayName: parseDisplayName(rawName),
    showGarden: true,
    showLevel: true,
    gender: null,
    createdOn: today,
  };
}

function assertBoolean(value: boolean, label: string): void {
  if (typeof value !== 'boolean') {
    throw new TypeError(`Invalid ${label}: expected true or false, got ${typeof value}`);
  }
}

/**
 * The profile with the changes made. A field that is not in `changes` stays as it is; a field
 * that is there must be valid, `undefined` included: it is not read as "no change".
 */
export function applyProfileChanges(profile: Profile, changes: ProfileChanges): Profile {
  assertObject(profile, 'profile');
  assertObject(changes, 'profile changes');
  const unknown = Object.keys(changes).filter((key) => !CHANGEABLE_FIELDS.includes(key));
  if (unknown.length > 0) {
    throw new RangeError(`Invalid profile changes: ${unknown.join(', ')} cannot be changed`);
  }

  // `in` says the field is present; the casts below only hide `undefined`, which the checks
  // right after refuse (a name that is not text, a setting that is not a boolean).
  let next = profile;
  if ('displayName' in changes) {
    next = { ...next, displayName: parseDisplayName(changes.displayName as string) };
  }
  if ('showGarden' in changes) {
    assertBoolean(changes.showGarden as boolean, 'showGarden');
    next = { ...next, showGarden: changes.showGarden as boolean };
  }
  if ('showLevel' in changes) {
    assertBoolean(changes.showLevel as boolean, 'showLevel');
    next = { ...next, showLevel: changes.showLevel as boolean };
  }
  if ('gender' in changes) {
    // `undefined` is refused by parseGender (a TypeError), like the other fields.
    next = { ...next, gender: parseGender(changes.gender) };
  }
  return next;
}
