import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';

import type { GardenPhase } from '@/domain/garden';
import type { UserId } from '@/domain/social';
import { GARDEN_PICTURE_ASPECT_RATIO, GardenScene } from '@/features/garden';
import {
  layout,
  Placeholder,
  spacing,
  stateOpacity,
  useVisitColors,
  visitShadow,
  visitShape,
} from '@/ui';

import { avatarRoleOf, initialOf } from './friend-avatar';
import { cardDetails, cardLabel } from './friend-words';
import { FriendsAvatar, FriendsText } from './friends-kit';
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
  onOpen: (userId: UserId) => void;
}

/**
 * Friends' gardens as the cards of the "Jardins voisins" carousel of the validated home screen
 * (docs/design/accueil.png): a white card, the garden on a tile of sky (warm when it is well,
 * grey-beige when it is thirsty), the initial in the friend's colour, the name, and the line
 * "38 hizb, arrosé depuis 21 jours". Laid out as a grid, because the tab shows every friend
 * (collections.md › Best practices: the standard grid); two columns, one at large text sizes.
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
        <FriendGardenCard key={card.userId} card={card} width={cardWidth} onOpen={onOpen} />
      ))}
    </View>
  );
}

function FriendGardenCard({
  card,
  width,
  onOpen,
}: {
  card: FriendCard;
  width: number | undefined;
  onOpen: (userId: UserId) => void;
}) {
  const { t } = useTranslation('friends');
  const colors = useVisitColors();
  const appearance = useColorScheme() === 'dark' ? 'dark' : 'light';
  const isWell = card.garden === null || WELL.has(card.garden.phase);
  const [top, bottom] = isWell
    ? [colors.tileWellTop, colors.tileWellBottom]
    : [colors.tileThirstyTop, colors.tileThirstyBottom];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardLabel(card, t)}
      onPress={() => onOpen(card.userId)}
      testID={`friend-card-${card.userId}`}
      style={({ pressed }) => [
        styles.card,
        { width, backgroundColor: colors.card, boxShadow: visitShadow.card[appearance] },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.tile,
          {
            backgroundColor: bottom,
            backgroundImage: `linear-gradient(180deg, ${top}, ${bottom})`,
          },
        ]}
      >
        {card.garden === null ? (
          <Placeholder name={t('card.hidden')} style={styles.hidden} />
        ) : (
          <View style={styles.zoomed}>
            <GardenScene state={card.garden} size="band" />
          </View>
        )}
      </View>
      <View style={styles.words}>
        <View style={styles.nameRow}>
          <FriendsAvatar
            initial={initialOf(card.name)}
            color={avatarRoleOf(card.userId)}
            size="small"
          />
          <FriendsText variant="headline" style={styles.name}>
            {card.name}
          </FriendsText>
        </View>
        <FriendsText variant="subhead" color="inkSecondary">
          {cardDetails(card, t)}
        </FriendsText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: layout.controlGap },
  card: {
    minHeight: layout.touchTarget,
    borderRadius: visitShape.gardenCardRadius,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  // The garden fills its tile and its corners are cut by it, as on the home screen's cards.
  tile: { borderRadius: visitShape.tileRadius, overflow: 'hidden', paddingTop: spacing.xs },
  zoomed: { transform: [{ scale: TILE_ZOOM }] },
  hidden: { aspectRatio: GARDEN_PICTURE_ASPECT_RATIO },
  words: { paddingHorizontal: spacing.xs, paddingBottom: spacing.xs, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  pressed: { opacity: stateOpacity.pressed },
});
