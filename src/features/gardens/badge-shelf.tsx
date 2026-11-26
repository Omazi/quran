import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { HIZB_COUNT } from '@/domain/quran';
import { ActionButton, AppText, Card, spacing } from '@/ui';

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
  /**
   * Shares the badge of this khatma as a picture: a "Partager" under each earned badge. Omitted on a
   * friend's shelf, which is theirs to share, not ours.
   */
  onShare?: (khatm: number) => void;
  /** Turns the "Partager" buttons off while a share runs. */
  isShareDisabled?: boolean;
  testID?: string;
}

/**
 * The badges of a person (profile.png, friendProfile.png): each completed khatma's badge with its
 * garden and date, the garden in progress, and on the person's own profile the next level, "À
 * venir", nothing more (D46: a surprise). Each place is one element for VoiceOver, its whole
 * sentence; the row scrolls sideways once there are more than three.
 */
export function BadgeShelf({ items, onShare, isShareDisabled = false, testID }: BadgeShelfProps) {
  const isScrolling = items.length > PLACES_WITHOUT_SCROLL;
  const places = items.map((item) => (
    <ShelfPlace
      key={placeKey(item)}
      item={item}
      grows={!isScrolling}
      onShare={onShare}
      isShareDisabled={isShareDisabled}
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

function ShelfPlace({
  item,
  grows,
  onShare,
  isShareDisabled,
  testID,
}: {
  item: BadgeView;
  grows: boolean;
  onShare?: (khatm: number) => void;
  isShareDisabled: boolean;
  testID?: string;
}) {
  const { t, i18n } = useTranslation('gardens');
  const words = shelfWords(item, t, i18n.language);
  return (
    <View style={[styles.place, grows ? styles.grows : styles.fixed]} testID={testID}>
      {/* The badge and its words are one element for VoiceOver; the button is its own, beside it. */}
      <View accessible accessibilityLabel={words.label} style={styles.group}>
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
      {item.kind === 'earned' && onShare !== undefined ? (
        <ActionButton
          variant="plain"
          label={t('share.button')}
          accessibilityLabel={t('share.buttonLabel', { khatm: item.khatm })}
          onPress={() => onShare(item.khatm)}
          disabled={isShareDisabled}
          fullWidth={false}
          testID={testID === undefined ? undefined : `${testID}-share`}
        />
      ) : null}
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
  place: { alignItems: 'center', rowGap: spacing.xs },
  group: { alignSelf: 'stretch', alignItems: 'center', rowGap: spacing.sm },
  grows: { flex: 1, flexBasis: 0 },
  fixed: { width: SHELF_COLUMN },
  words: { alignSelf: 'stretch', rowGap: 2 },
});
