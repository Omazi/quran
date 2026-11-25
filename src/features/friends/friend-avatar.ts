import type { UserId } from '@/domain/social';
import { avatarColorCount } from '@/ui';

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

/**
 * A friend's colour, as the place of one of the friends' avatar colours (accueil.png gives Imane
 * violet, Bilal ochre, Sara blue): always the same for the same person, on the home screen and in
 * this tab, which `Avatar` and `DottedProgress` take. It identifies, it says nothing: the name is
 * always written beside it.
 */
export function avatarIndexOf(userId: UserId): number {
  // FNV-1a, a small string hash: identifiers that differ by a few letters spread well.
  let hash = FNV_OFFSET_BASIS;
  for (const character of userId) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), FNV_PRIME) >>> 0;
  }
  return hash % avatarColorCount;
}

/** The first letter of a name, in capitals where the script has them. */
export function initialOf(name: string): string {
  const [first = ''] = Array.from(name.trim());
  return first.toLocaleUpperCase();
}
