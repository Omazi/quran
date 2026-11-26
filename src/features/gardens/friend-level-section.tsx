import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { SharedLevel } from '@/domain/social';
import { AppText, spacing } from '@/ui';

import { BadgeShelf } from './badge-shelf';
import { friendShelf } from './gardens-model';
import { LevelChip } from './level-chip';

export interface FriendLevelSectionProps {
  /** What the friend shares of their level; null when they hide it: nothing is drawn. */
  level: SharedLevel | null;
  /** Their hizb in the garden in progress, or null when they hide their garden. */
  hizbCompleted: number | null;
}

/**
 * A friend's level and badges (friendProfile.png, D46): "Niveau 3 · Verger au bord de l'eau",
 * then their badges with their dates and the garden they grow now. The level is the one their
 * completed khatmas give, by the same rule as for the person. Hidden whole when they hide it.
 */
export function FriendLevelSection({ level, hizbCompleted }: FriendLevelSectionProps) {
  const { t } = useTranslation('gardens');
  const shelf = useMemo(
    () => (level === null ? null : friendShelf(level.badges, hizbCompleted)),
    [level, hizbCompleted],
  );
  if (shelf === null) return null;
  return (
    <View style={styles.section} testID="friend-level-section">
      <LevelChip level={shelf.level} styleId={shelf.styleId} testID="friend-level-chip" />
      <View style={styles.heading}>
        <AppText variant="title2" color="heading" style={styles.title}>
          {t('friend.title')}
        </AppText>
        <AppText variant="subhead" color="muted">
          {t('badges.count', { count: shelf.items.length - 1 })}
        </AppText>
      </View>
      <BadgeShelf items={shelf.items} testID="friend-badge-shelf" />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { rowGap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'baseline', columnGap: spacing.sm },
  title: { flex: 1 },
});
