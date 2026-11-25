import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { UserId } from '@/domain/social';
import {
  GARDEN_PICTURE_ASPECT_RATIO,
  GardenScene,
  WATER_SYMBOLS,
  WATER_TONES,
} from '@/features/garden';
import { AppText, Icon, layout, Placeholder, radius, spacing, stateOpacity, useColors } from '@/ui';

import { cardDetails, cardLabel } from './friend-words';
import type { FriendCard } from './friends-model';

/**
 * Above this text size a card is too narrow for its words: the grid becomes one column
 * (typography.md › Supporting Dynamic Type; layout.md › Adaptability).
 */
const ONE_COLUMN_FONT_SCALE = 1.35;
const COLUMNS = 2;

export interface FriendCardGridProps {
  cards: readonly FriendCard[];
  onOpen: (userId: UserId) => void;
}

/**
 * Friends' gardens as a grid of cards, the "Jardins voisins" row of the validated home screen
 * (docs/design/accueil.png): the picture of the garden, the name, the hizb and the water. A grid
 * because each item is a picture first (collections.md › Best practices: the standard grid;
 * lists-and-tables.md › Best practices: a collection for items that are not text). Two columns,
 * one at large text sizes. Place it in a `ContentRow`.
 */
export function FriendCardGrid({ cards, onOpen }: FriendCardGridProps) {
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const columns = fontScale > ONE_COLUMN_FONT_SCALE ? 1 : COLUMNS;
  const cardWidth = width === 0 ? undefined : (width - layout.controlGap * (columns - 1)) / columns;
  return (
    <View
      style={styles.grid}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      testID="friends-grid"
    >
      {cards.map((card) => (
        <FriendCardView key={card.userId} card={card} width={cardWidth} onOpen={onOpen} />
      ))}
    </View>
  );
}

function FriendCardView({
  card,
  width,
  onOpen,
}: {
  card: FriendCard;
  width: number | undefined;
  onOpen: (userId: UserId) => void;
}) {
  const { t } = useTranslation('friends');
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardLabel(card, t)}
      onPress={() => onOpen(card.userId)}
      testID={`friend-card-${card.userId}`}
      style={({ pressed }) => [
        styles.card,
        { width, backgroundColor: colors.secondaryGroupedBackground },
        pressed && styles.pressed,
      ]}
    >
      {card.garden === null ? (
        <Placeholder name={t('card.hidden')} style={styles.hidden} />
      ) : (
        <GardenScene state={card.garden} size="band" />
      )}
      <View style={styles.words}>
        <AppText variant="headline">{card.name}</AppText>
        <View style={styles.detailRow}>
          {card.garden === null || card.hizbCompleted === null ? null : (
            <Icon
              symbol={WATER_SYMBOLS[card.garden.water]}
              textStyle="footnote"
              color={WATER_TONES[card.garden.water]}
            />
          )}
          <AppText variant="footnote" color="secondaryLabel" style={styles.detail}>
            {cardDetails(card, t)}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: layout.controlGap,
    paddingVertical: spacing.sm,
  },
  card: {
    minHeight: layout.touchTarget,
    borderRadius: radius.lg,
    overflow: 'hidden',
    paddingTop: spacing.sm,
  },
  hidden: { aspectRatio: GARDEN_PICTURE_ASPECT_RATIO, marginHorizontal: spacing.sm },
  words: { padding: spacing.md, paddingTop: spacing.sm, gap: spacing.xs },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  detail: { flexShrink: 1 },
  pressed: { opacity: stateOpacity.pressed },
});
