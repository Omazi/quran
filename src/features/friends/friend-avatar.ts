import type { UserId } from '@/domain/social';
import { visitAvatarRoles, type VisitAvatarRole } from '@/ui';

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

/**
 * A friend's colour: always the same for the same person, taken from the palette of the mockups
 * (docs/design/accueil.png gives Imane violet, Bilal ochre, Sara blue). It identifies, it says
 * nothing: the name is always written beside it.
 */
export function avatarRoleOf(userId: UserId): VisitAvatarRole {
  // FNV-1a, a small string hash: identifiers that differ by a few letters spread well.
  let hash = FNV_OFFSET_BASIS;
  for (const character of userId) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), FNV_PRIME) >>> 0;
  }
  // The index is in range: a remainder of the length.
  return visitAvatarRoles[hash % visitAvatarRoles.length] as VisitAvatarRole;
}

/** The first letter of a name, in capitals where the script has them. */
export function initialOf(name: string): string {
  const [first = ''] = Array.from(name.trim());
  return first.toLocaleUpperCase();
}
