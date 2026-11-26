import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { GardenPhase } from '@/domain/garden';
import type { UserId } from '@/domain/social';
import { GARDEN_PICTURE_ASPECT_RATIO, GardenScene } from '@/features/garden';
import {
  AppText,
  Avatar,
  Card,
  GradientBackdrop,
  layout,
  Placeholder,
  radius,
  spacing,
  useColors,
} from '@/ui';

import { avatarIndexOf, initialOf } from './friend-avatar';
import { cardDetails, cardLabel } from './friend-words';

import type { FriendCard } from './friends-model';

/**
 * Above this text size a card is too narrow for its words: the grid becomes one column
 * (typography.md › Supporting Dynamic Type; layout.md › Adaptability).
 */
const ONE_COLUMN_FONT_SCALE = 1.35;
const COLUMNS = 2;

/** The garden is drawn a little larger than its tile, so that it fills it (accueil.png). */
const TILE_ZOOM = 1.12;

/** The phases where a garden looks well: its tile keeps the warm sky. */
const WELL: ReadonlySet<GardenPhase> = new Set(['bare', 'thriving']);

export interface FriendCardGridProps {
  cards: readonly FriendCard[];
  /** The gardens are the demonstration's: each card says "Exemple", on its garden and aloud. */
  areExamples?: boolean;
  onOpen: (userId: UserId) => void;
}

/**
 * Friends' gardens as the cards of the "Jardins voisins" carousel of the validated home screen
 * (docs/design/accueil.png): a white card, the garden on a tile of sky (warm when it is well,
 * grey-beige when it is thirsty), the initial in the friend's colour, the name, and the line
 * "38 hizb, arrosé depuis 21 jours". Laid out as a grid, because the tab shows every friend
 * (collections.md › Best practices: the standard grid); two columns, one at large text sizes.
 */
export function FriendCardGrid({ cards, areExamples = false, onOpen }: FriendCardGridProps) {
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
        <FriendGardenCard
          key={card.userId}
          card={card}
          width={cardWidth}
          isExample={areExamples}
          onOpen={onOpen}
        />
      ))}
    </View>
  );
}

function FriendGardenCard({
  card,
  width,
  isExample,
  onOpen,
}: {
  card: FriendCard;
  width: number | undefined;
  isExample: boolean;
  onOpen: (userId: UserId) => void;
}) {
  const { t } = useTranslation('friends');
  const colors = useColors();
  const isWell = card.garden === null || WELL.has(card.garden.phase);
  const label = cardLabel(card, t);
  return (
    <Card
      tone="raised"
      padding="sm"
      contentGap="sm"
      accessibilityLabel={isExample ? t('card.exampleLabel', { label }) : label}
      onPress={() => onOpen(card.userId)}
      style={{ width }}
      testID={`friend-card-${card.userId}`}
    >
      {/* The sky of a garden card on the home screen (neighbour-gardens.tsx): the same gradients. */}
      <View style={styles.tile}>
        <GradientBackdrop name={isWell ? 'growing' : 'thirsty'} style={StyleSheet.absoluteFill} />
        {card.garden === null ? (
          <Placeholder name={t('card.hidden')} style={styles.hidden} />
        ) : (
          <View style={styles.zoomed}>
            <GardenScene state={card.garden} size="band" />
          </View>
        )}
        {isExample ? (
          // The mark of the demonstration (maquettes 2026-11-26, "friends"), at the leading top
          // corner of the garden; VoiceOver hears it in the card's label.
          <View
            style={[styles.example, { backgroundColor: colors.exampleChip }]}
            testID={`friend-card-${card.userId}-example`}
          >
            <AppText variant="footnote" color="dateLabel">
              {t('card.example')}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.words}>
        <View style={styles.nameRow}>
          <Avatar
            content={{ initial: initialOf(card.name) }}
            color={avatarIndexOf(card.userId)}
            size="small"
          />
          <AppText variant="headline" style={styles.name}>
            {card.name}
          </AppText>
        </View>
        <AppText variant="subhead" color="muted">
          {cardDetails(card, t)}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: layout.controlGap },
  // The garden fills its tile and its corners are cut by it, as on the home screen's cards.
  tile: { borderRadius: radius.md, overflow: 'hidden', paddingTop: spacing.xs },
  zoomed: { transform: [{ scale: TILE_ZOOM }] },
  hidden: { aspectRatio: GARDEN_PICTURE_ASPECT_RATIO },
  example: {
    position: 'absolute',
    top: spacing.sm,
    start: spacing.sm,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  words: { paddingHorizontal: spacing.xs, paddingBottom: spacing.xs, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
});
