/**
 * "Jardins voisins" (docs/design/accueil.png): friends' gardens in a row under the day's card.
 * The words of a card come from what each friend published (docs/specs/social.md, rule 5), and
 * the garden from the garden module, as the Proches tab draws it.
 */

import { useEffect, useState } from 'react';

import { HIZB_COUNT } from '@/domain/quran';
import type { GardenState } from '@/domain/garden';
import type { LocalDate } from '@/domain/shared/local-date';
import type { FriendView, UserId } from '@/domain/social';
import {
  avatarIndexOf,
  gardenStateOf,
  useSession,
  useSocialStore,
  useSocialVersion,
  waterStatusOf,
} from '@/features/friends';

/** The line under a friend's name. */
export type NeighbourDetail =
  /** "38 hizb, arrosé depuis 21 j": read today or yesterday, a streak running. */
  | { readonly kind: 'watered'; readonly hizb: number; readonly days: number }
  /** "38 hizb, arrosé il y a 2 j": in good health, no streak. */
  | { readonly kind: 'rested'; readonly hizb: number; readonly days: number }
  /** "14 hizb, a soif depuis 6 j": the garden module says the garden suffers. */
  | { readonly kind: 'thirsty'; readonly hizb: number; readonly days: number }
  | { readonly kind: 'dry'; readonly hizb: number }
  | { readonly kind: 'complete' }
  | { readonly kind: 'new'; readonly hizb: number }
  | { readonly kind: 'hidden' };

export interface NeighbourGarden {
  readonly userId: UserId;
  readonly name: string;
  readonly initial: string | null;
  /** The friend's colour (`avatarIndexOf`): the same as in the Proches tab. */
  readonly colorIndex: number;
  /** Null when the friend hides their garden. */
  readonly garden: GardenState | null;
  readonly detail: NeighbourDetail;
}

/** The first letter of a name, in capitals; null for an empty name. */
export function initialOf(name: string): string | null {
  const first = Array.from(name.trim())[0];
  return first === undefined ? null : first.toLocaleUpperCase();
}

const SUFFERING: ReadonlySet<GardenState['phase']> = new Set(['thirsty', 'wilting', 'dying']);

function detailOf(
  friend: FriendView,
  garden: GardenState | null,
  today: LocalDate,
): NeighbourDetail {
  const shared = friend.garden;
  if (shared === null || garden === null) return { kind: 'hidden' };
  const hizb = shared.hizbCompleted;
  if (hizb >= HIZB_COUNT) return { kind: 'complete' };
  if (garden.phase === 'dead') return { kind: 'dry', hizb };
  const water = waterStatusOf(shared.lastWateredOn, today);
  if (water.kind === 'never' || garden.phase === 'bare') return { kind: 'new', hizb };
  if (shared.streakDays > 0) return { kind: 'watered', hizb, days: shared.streakDays };
  const days = water.kind === 'today' ? 0 : water.days;
  if (SUFFERING.has(garden.phase)) return { kind: 'thirsty', hizb, days };
  return { kind: 'rested', hizb, days };
}

/** A friend's card: name, initial, garden and the line under the name. Pure. */
export function neighbourGardenOf(
  friend: FriendView,
  colorIndex: number,
  today: LocalDate,
): NeighbourGarden {
  const garden = friend.garden === null ? null : gardenStateOf(friend.garden, today);
  return {
    userId: friend.userId,
    name: friend.displayName,
    initial: initialOf(friend.displayName),
    colorIndex,
    garden,
    detail: detailOf(friend, garden, today),
  };
}

export type NeighbourGardens =
  | { readonly status: 'loading' }
  | { readonly status: 'signed-out' }
  | { readonly status: 'ready'; readonly gardens: readonly NeighbourGarden[] };

/** The friends' gardens of the signed-in person, read again after every action of Proches. */
export function useNeighbourGardens(today: LocalDate): NeighbourGardens {
  const session = useSession();
  const store = useSocialStore();
  const version = useSocialVersion(store);
  const [gardens, setGardens] = useState<readonly NeighbourGarden[] | null>(null);
  const isSignedIn = session.status === 'signed-in';
  useEffect(() => {
    if (!isSignedIn) return undefined;
    let isCurrent = true;
    store.client.repository.listFriends().then(
      (friends) => {
        if (isCurrent) {
          setGardens(
            friends.map((friend) => neighbourGardenOf(friend, avatarIndexOf(friend.userId), today)),
          );
        }
      },
      // Friends that cannot be read are no friends to show: the home screen stays usable.
      () => isCurrent && setGardens([]),
    );
    return () => {
      isCurrent = false;
    };
  }, [isSignedIn, store, version, today]);
  if (session.status === 'loading') return { status: 'loading' };
  if (session.status === 'signed-out') return { status: 'signed-out' };
  return gardens === null ? { status: 'loading' } : { status: 'ready', gardens };
}

/** The initial of the signed-in person, for the avatar of the header; null when signed out. */
export function useSelfInitial(): string | null {
  const session = useSession();
  const store = useSocialStore();
  const version = useSocialVersion(store);
  const [initial, setInitial] = useState<string | null>(null);
  const isSignedIn = session.status === 'signed-in';
  useEffect(() => {
    if (!isSignedIn) return undefined;
    let isCurrent = true;
    store.client.repository.getMyProfile().then(
      (profile) => isCurrent && setInitial(initialOf(profile.displayName)),
      () => isCurrent && setInitial(null),
    );
    return () => {
      isCurrent = false;
    };
  }, [isSignedIn, store, version]);
  // Signed out, no initial, whatever was read before.
  return isSignedIn ? initial : null;
}
