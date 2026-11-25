import type { TFunction } from 'i18next';

import type { WaterStatus } from './friend-garden';
import type { FriendCard } from './friends-model';

/** When a friend last watered, in words: always said, never left to the colour of a symbol. */
export function waterWords(water: WaterStatus, t: TFunction<'friends'>): string {
  switch (water.kind) {
    case 'today':
      return t('card.wateredToday');
    case 'days-ago':
      return water.days === 1
        ? t('card.wateredYesterday')
        : t('card.notWatered', { count: water.days });
    case 'never':
      return t('card.neverWatered');
  }
}

/**
 * The water as the mockups say it: "arrosé depuis 21 jours" while the streak runs (watered today
 * or yesterday, two days in a row or more), otherwise when they last watered.
 */
function waterSince(card: FriendCard, water: WaterStatus, t: TFunction<'friends'>): string {
  const streakRuns = water.kind === 'today' || (water.kind === 'days-ago' && water.days === 1);
  if (streakRuns && card.streakDays !== null && card.streakDays >= 2) {
    return t('card.wateredSince', { count: card.streakDays });
  }
  return waterWords(water, t);
}

/** The line of a garden card: "38 hizb, arrosé depuis 21 jours" (docs/design/accueil.png). */
export function cardDetails(card: FriendCard, t: TFunction<'friends'>): string {
  if (card.hizbCompleted === null || card.water === null) return t('card.hidden');
  return t('card.details', {
    hizb: t('card.hizb', { count: card.hizbCompleted }),
    water: waterSince(card, card.water, t),
  });
}

/**
 * The line under a friend's name on their page: "38 hizb sur 60, arrosé depuis 21 jours"
 * (docs/design/visite.png).
 */
export function visitSummary(card: FriendCard, t: TFunction<'friends'>): string {
  if (card.hizbCompleted === null || card.water === null) return t('card.hidden');
  return t('card.details', {
    hizb: t('friend.hizbOutOf', { count: card.hizbCompleted }),
    water: waterSince(card, card.water, t),
  });
}

/** What a screen reader says of a card: the name, then the same words as the screen. */
export function cardLabel(card: FriendCard, t: TFunction<'friends'>): string {
  if (card.hizbCompleted === null) return t('card.hiddenLabel', { name: card.name });
  return t('card.label', { name: card.name, details: cardDetails(card, t) });
}
