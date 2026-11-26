import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import type { GardenStyleId } from '@/domain/levels';
import { AppText, radius, spacing, useColors, useColorValues } from '@/ui';

import { BADGE_BOX, starPoints } from './badge-geometry';

const STAR_SIZE = 18;

export interface LevelChipProps {
  level: number;
  styleId: GardenStyleId;
  testID?: string;
}

/**
 * "Niveau 2 · Oasis" under a name (profile.png, friendProfile.png): the level and its garden, with
 * the small gold star of the badges. Read as one element.
 */
export function LevelChip({ level, styleId, testID }: LevelChipProps) {
  const { t } = useTranslation('gardens');
  const colors = useColors();
  const values = useColorValues();
  const garden = t(`styles.${styleId}`);
  return (
    <View
      accessible
      accessibilityLabel={t('level.chipLabel', { level, garden })}
      style={[styles.chip, { backgroundColor: colors.actionTonal }]}
      testID={testID}
    >
      <Svg width={STAR_SIZE} height={STAR_SIZE} viewBox={`0 0 ${BADGE_BOX} ${BADGE_BOX}`}>
        <Polygon
          points={starPoints(BADGE_BOX / 2, 44)}
          fill={values.goldLight}
          stroke={values.goldDeep}
          strokeWidth={8}
          strokeLinejoin="round"
        />
      </Svg>
      <AppText variant="subheadEmphasized" color="actionTint" style={styles.words}>
        {t('level.chip', { level, garden })}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    columnGap: spacing.sm,
    borderRadius: radius.full,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md - 2,
  },
  words: { flexShrink: 1 },
});
