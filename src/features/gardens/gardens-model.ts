import { HIZB_COUNT, PAGE_COUNT } from '@/domain/quran';
import type { LocalDate } from '@/domain/shared/local-date';
import {
  badgeShelf,
  levelOfCompletedKhatmas,
  levelOfKhatma,
  styleOfLevel,
  type CompletedKhatma,
  type GardenStyleId,
  type Progression,
} from '@/domain/levels';

/** One place of a badge shelf, as the screen draws it: the person's own, or a friend's. */
export type BadgeView =
  | {
      readonly kind: 'earned';
      readonly khatm: number;
      readonly styleId: GardenStyleId;
      readonly completedOn: LocalDate;
    }
  | {
      readonly kind: 'in-progress';
      readonly level: number;
      readonly styleId: GardenStyleId;
      /** Null when a friend hides their garden: their badges are shown, not their hizb. */
      readonly hizbCompleted: number | null;
    }
  | { readonly kind: 'locked'; readonly level: number };

/** The person's own shelf: badges, the garden in progress, the next level as a surprise. */
export function ownShelf(progression: Progression): readonly BadgeView[] {
  return badgeShelf(progression).map((item): BadgeView => {
    switch (item.kind) {
      case 'earned':
        return {
          kind: 'earned',
          khatm: item.badge.khatm,
          styleId: item.badge.styleId,
          completedOn: item.badge.completedOn,
        };
      case 'in-progress':
        return {
          kind: 'in-progress',
          level: item.level,
          styleId: item.styleId,
          hizbCompleted: item.hizbCompleted,
        };
      case 'locked':
        return item;
    }
  });
}

/** A badge a friend published: the khatma and the day (docs/specs/social.md, rule 5). */
export interface PublishedBadge {
  readonly khatmNumber: number;
  readonly completedOn: LocalDate;
}

export interface FriendShelf {
  readonly level: number;
  readonly styleId: GardenStyleId;
  readonly items: readonly BadgeView[];
}

/**
 * A friend's level and shelf from the badges they share: the level after their completed khatmas,
 * the same rule as for the person (`levelOfCompletedKhatmas`). No locked level: what comes next in
 * someone else's path is not this page's to tell.
 */
export function friendShelf(
  badges: readonly PublishedBadge[],
  hizbCompleted: number | null,
): FriendShelf {
  const level = levelOfCompletedKhatmas(badges.length);
  const styleId = styleOfLevel(level);
  const earned = [...badges]
    .sort((first, second) => first.khatmNumber - second.khatmNumber)
    .map((badge): BadgeView => ({
      kind: 'earned',
      khatm: badge.khatmNumber,
      styleId: styleOfLevel(levelOfKhatma(badge.khatmNumber)),
      completedOn: badge.completedOn,
    }));
  return {
    level,
    styleId,
    items: [...earned, { kind: 'in-progress', level, styleId, hizbCompleted }],
  };
}

/** What the celebration of a completed khatma shows. */
export interface Celebration {
  readonly khatm: number;
  readonly styleId: GardenStyleId;
  readonly completedOn: LocalDate;
  readonly hizb: number;
  readonly pages: number;
  readonly days: number;
  /** The garden the next khatma grows: the next level's, or the last style grown anew. */
  readonly next: {
    readonly level: number;
    readonly styleId: GardenStyleId;
    readonly isSameStyle: boolean;
  };
}

export function celebrationOf(khatma: CompletedKhatma): Celebration {
  const nextLevel = levelOfKhatma(khatma.khatm + 1);
  const nextStyle = styleOfLevel(nextLevel);
  return {
    khatm: khatma.khatm,
    styleId: khatma.styleId,
    completedOn: khatma.completedOn,
    hizb: HIZB_COUNT,
    pages: PAGE_COUNT,
    days: khatma.daysTaken,
    next: { level: nextLevel, styleId: nextStyle, isSameStyle: nextStyle === khatma.styleId },
  };
}
