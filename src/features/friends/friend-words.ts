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

/** The line under a friend's name: "42 hizb · arrosé aujourd'hui". */
export function cardDetails(card: FriendCard, t: TFunction<'friends'>): string {
  if (card.hizbCompleted === null || card.water === null) return t('card.hidden');
  return `${t('card.hizb', { count: card.hizbCompleted })} · ${waterWords(card.water, t)}`;
}

/** What a screen reader says of a card: the name, then the same words as the screen. */
export function cardLabel(card: FriendCard, t: TFunction<'friends'>): string {
  if (card.hizbCompleted === null) return t('card.hiddenLabel', { name: card.name });
  return t('card.label', { name: card.name, details: cardDetails(card, t) });
}
