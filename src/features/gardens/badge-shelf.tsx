import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { HIZB_COUNT } from '@/domain/quran';
import { AppText, Card, spacing } from '@/ui';

import { formatBadgeDate } from './format';
import type { BadgeView } from './gardens-model';
import { KhatmaBadge } from './khatma-badge';

/** Size of a badge on the shelf, and of the column that holds it with its two lines. */
const SHELF_BADGE = 92;
const SHELF_COLUMN = 112;

/** Up to this many places the shelf shares its width; past it, it scrolls sideways. */
const PLACES_WITHOUT_SCROLL = 3;

export interface BadgeShelfProps {
  items: readonly BadgeView[];
  testID?: string;
}

/**
 * The badges of a person (profile.png, friendProfile.png): each completed khatma's badge with its
 * garden and date, the garden in progress, and on the person's own profile the next level, "À
 * venir", nothing more (D46: a surprise). Each place is one element for VoiceOver, its whole
 * sentence; the row scrolls sideways once there are more than three.
 */
export function BadgeShelf({ items, testID }: BadgeShelfProps) {
  const isScrolling = items.length > PLACES_WITHOUT_SCROLL;
  const places = items.map((item) => (
    <ShelfPlace
      key={placeKey(item)}
      item={item}
      grows={!isScrolling}
      testID={testID === undefined ? undefined : `${testID}-${placeKey(item)}`}
    />
  ));
  return (
    <Card testID={testID}>
      {isScrolling ? (
        <ScrollView
          horizontal
          testID={testID === undefined ? undefined : `${testID}-scroll`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {places}
        </ScrollView>
      ) : (
        <View style={styles.row}>{places}</View>
      )}
    </Card>
  );
}

function placeKey(item: BadgeView): string {
  return item.kind === 'earned' ? `khatma-${item.khatm}` : `${item.kind}-${item.level}`;
}

function ShelfPlace({ item, grows, testID }: { item: BadgeView; grows: boolean; testID?: string }) {
  const { t, i18n } = useTranslation('gardens');
  const words = shelfWords(item, t, i18n.language);
  return (
    <View
      accessible
      accessibilityLabel={words.label}
      style={[styles.place, grows ? styles.grows : styles.fixed]}
      testID={testID}
    >
      <KhatmaBadge view={item} size={SHELF_BADGE} />
      <View style={styles.words}>
        <AppText
          variant="subheadEmphasized"
          color={item.kind === 'locked' ? 'muted' : 'heading'}
          align="center"
        >
          {words.name}
        </AppText>
        <AppText variant="footnote" color="muted" align="center">
          {words.caption}
        </AppText>
      </View>
    </View>
  );
}

function shelfWords(item: BadgeView, t: TFunction<'gardens'>, language: string) {
  switch (item.kind) {
    case 'earned': {
      const garden = t(`styles.${item.styleId}`);
      const date = formatBadgeDate(item.completedOn, language);
      return {
        name: garden,
        caption: date,
        label: t('badges.earnedLabel', { khatm: item.khatm, garden, date }),
      };
    }
    case 'in-progress': {
      const garden = t(`styles.${item.styleId}`);
      const progress =
        item.hizbCompleted === null
          ? t('badges.inProgress')
          : t('current.progress', { count: item.hizbCompleted, total: HIZB_COUNT });
      return {
        name: garden,
        caption: t('badges.inProgress'),
        label: t('badges.inProgressLabel', { garden, progress }),
      };
    }
    case 'locked':
      return {
        name: t('badges.lockedName', { level: item.level }),
        caption: t('badges.locked'),
        label: t('badges.lockedLabel', { level: item.level }),
      };
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', columnGap: spacing.sm },
  place: { alignItems: 'center', rowGap: spacing.sm },
  grows: { flex: 1, flexBasis: 0 },
  fixed: { width: SHELF_COLUMN },
  words: { alignSelf: 'stretch', rowGap: 2 },
});
