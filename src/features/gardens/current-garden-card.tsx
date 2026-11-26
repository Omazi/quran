import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import type { GardenState } from '@/domain/garden';
import type { Progression } from '@/domain/levels';
import { HIZB_COUNT } from '@/domain/quran';
import { previewGardenState } from '@/features/garden';
import {
  AppText,
  Card,
  DottedProgress,
  getWritingDirection,
  Icon,
  radius,
  spacing,
  useColors,
  type IconSymbol,
} from '@/ui';

import { GardenThumb } from './garden-thumb';

const DISCLOSURE: IconSymbol = { ios: 'chevron.forward', android: 'chevron_right' };
const BARE_EARTH = previewGardenState({ hizbCompleted: 0 });

export interface CurrentGardenCardProps {
  progression: Progression;
  /**
   * The garden on display, as the home screen computes it (its drought included). Used while it is
   * the garden of the current level; a new level not started yet shows its bare earth instead.
   */
  garden: GardenState | null;
  onPress: () => void;
  testID?: string;
}

/**
 * "Jardin en cours" (profile.png): the garden of the person's level, its name, its hizb in words
 * and in sixty dots, and the chevron of a row that opens "Mes jardins". After a completed khatma,
 * the new garden waits on its bare earth until the next page starts it (D20).
 */
export function CurrentGardenCard({
  progression,
  garden,
  onPress,
  testID,
}: CurrentGardenCardProps) {
  const { t } = useTranslation('gardens');
  const colors = useColors();
  const name = t(`styles.${progression.styleId}`);
  const showsLiveGarden = progression.hasStarted || progression.currentKhatm === 1;
  const state = useMemo(
    () => (showsLiveGarden && garden !== null ? garden : BARE_EARTH),
    [showsLiveGarden, garden],
  );
  const progress = progression.hasStarted
    ? t('current.progress', { count: progression.hizbCompleted })
    : t('current.notStarted');
  const mirrorsChevron = Platform.OS !== 'ios' && getWritingDirection() === 'rtl';
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${t('current.title')}, ${name}, ${progress}`}
      testID={testID}
    >
      <View style={styles.row}>
        <View style={[styles.picture, { backgroundColor: colors.thirstSurface }]}>
          <GardenThumb styleId={progression.styleId} state={state} />
        </View>
        <View style={styles.words}>
          <AppText variant="footnote" color="muted">
            {t('current.title')}
          </AppText>
          <AppText variant="title3" color="heading">
            {name}
          </AppText>
          <AppText variant="subhead" color="muted">
            {progress}
          </AppText>
          {progression.hasStarted ? (
            <DottedProgress
              total={HIZB_COUNT}
              reached={progression.hizbCompleted}
              accessibilityLabel={t('current.title')}
              accessibilityValue={progress}
            />
          ) : null}
        </View>
        <View style={mirrorsChevron ? styles.mirrored : null}>
          <Icon symbol={DISCLOSURE} textStyle="footnote" color="muted" />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.md },
  picture: {
    width: '38%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  words: { flex: 1, rowGap: spacing.xs },
  mirrored: { transform: [{ scaleX: -1 }] },
});
