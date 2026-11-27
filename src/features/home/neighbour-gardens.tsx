import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { GARDEN_PICTURE_ASPECT_RATIO, GardenScene } from '@/features/garden';
import type { UserId } from '@/domain/social';
import { useGenderedTranslation } from '@/features/gender';
import {
  AppText,
  Avatar,
  Card,
  GradientBackdrop,
  SectionHeader,
  layout,
  pieceSizes,
  radius,
  spacing,
} from '@/ui';

import type { NeighbourDetail, NeighbourGarden, NeighbourGardens } from './neighbours';

export interface NeighbourGardensSectionProps {
  neighbours: NeighbourGardens;
  onSeeAll: () => void;
  onOpenFriend: (userId: UserId) => void;
}

function detailText(detail: NeighbourDetail, t: ReturnType<typeof useTranslation<'home'>>['t']) {
  switch (detail.kind) {
    case 'watered':
    case 'rested':
    case 'thirsty':
      return t(`neighbours.${detail.kind}`, { hizb: detail.hizb, count: detail.days });
    case 'dry':
    case 'new':
      return t(`neighbours.${detail.kind}`, { hizb: detail.hizb });
    case 'complete':
    case 'hidden':
      return t(`neighbours.${detail.kind}`);
  }
}

/**
 * "Jardins voisins" (accueil.png): friends' gardens in the standard horizontal row of a
 * collection (collections.md › Best practices), each card a button to the friend's page. The row
 * starts on the leading side, so it reads from the right in Arabic. Signed out, or without
 * friends yet, one card says how to see gardens here (writing.md: an empty state says what to do).
 */
export function NeighbourGardensSection({
  neighbours,
  onSeeAll,
  onOpenFriend,
}: NeighbourGardensSectionProps) {
  const { t } = useGenderedTranslation('home');
  if (neighbours.status === 'loading') return null;
  const gardens = neighbours.status === 'ready' ? neighbours.gardens : [];
  return (
    <View style={styles.section} testID="home-neighbours">
      <View style={styles.header}>
        <SectionHeader
          title={t('neighbours.title')}
          action={{ label: t('neighbours.seeAll'), onPress: onSeeAll, testID: 'home-see-all' }}
        />
      </View>
      {gardens.length === 0 ? (
        <View style={styles.header}>
          <Card tone="raised" onPress={onSeeAll} accessibilityLabel={emptyText(neighbours, t)}>
            <AppText color="muted">{emptyText(neighbours, t)}</AppText>
          </Card>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {gardens.map((garden) => (
            <NeighbourCard
              key={garden.userId}
              garden={garden}
              detail={detailText(garden.detail, t)}
              onPress={() => onOpenFriend(garden.userId)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function emptyText(
  neighbours: NeighbourGardens,
  t: ReturnType<typeof useTranslation<'home'>>['t'],
): string {
  return neighbours.status === 'signed-out' ? t('neighbours.signedOut') : t('neighbours.empty');
}

function NeighbourCard({
  garden,
  detail,
  onPress,
}: {
  garden: NeighbourGarden;
  detail: string;
  onPress: () => void;
}) {
  const suffers = garden.garden !== null && garden.garden.phase !== 'thriving';
  return (
    <Card
      tone="raised"
      padding="sm"
      onPress={onPress}
      accessibilityLabel={`${garden.name}, ${detail}`}
      style={styles.card}
      testID={`home-neighbour-${garden.userId}`}
    >
      <View style={styles.thumbnail}>
        <GradientBackdrop name={suffers ? 'thirsty' : 'growing'} style={StyleSheet.absoluteFill} />
        {garden.garden === null ? null : <GardenScene state={garden.garden} size="band" />}
      </View>
      <View style={styles.name}>
        <Avatar
          content={garden.initial === null ? { initial: '·' } : { initial: garden.initial }}
          color={garden.colorIndex}
          size="small"
        />
        <AppText variant="callout" style={styles.nameText}>
          {garden.name}
        </AppText>
      </View>
      <AppText variant="footnote" color="muted" style={styles.detail}>
        {detail}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { rowGap: spacing.xs },
  header: { paddingHorizontal: layout.screenMargin + spacing.xs },
  row: {
    paddingHorizontal: layout.screenMargin + spacing.xs,
    paddingVertical: spacing.sm,
    columnGap: layout.controlGap,
  },
  card: { width: pieceSizes.neighbourCardWidth },
  thumbnail: {
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'center',
    aspectRatio: GARDEN_PICTURE_ASPECT_RATIO,
  },
  name: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    marginTop: layout.controlGap,
    paddingHorizontal: spacing.xs,
  },
  nameText: { flexShrink: 1 },
  detail: { paddingHorizontal: spacing.xs, marginTop: spacing.xs },
});
