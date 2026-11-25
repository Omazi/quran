import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  DottedProgress,
  Icon,
  AppText,
  layout,
  spacing,
  type IconColorRole,
  type TextColorRole,
} from '@/ui';

import { HOME_SYMBOLS } from './config';
import type { HomeHizb, HomeWaterRun } from './home-model';

export interface GardenProgressProps {
  hizb: HomeHizb;
  waterRun: HomeWaterRun;
}

const WATER_COLORS: Readonly<
  Record<Exclude<HomeWaterRun['kind'], 'none'>, { text: TextColorRole; symbol: IconColorRole }>
> = {
  watered: { text: 'water', symbol: 'waterFill' },
  still: { text: 'drought', symbol: 'thirstIcon' },
  dry: { text: 'drought', symbol: 'thirstIcon' },
};

/**
 * Under the garden (accueil.png): "24 hizb sur 60" with a leaf, how long the water has run or
 * stopped with a drop, then one dot per hizb. The drop is teal while the water runs and amber
 * once it stops, and the words always say which (color.md › Inclusive color). Dots and words
 * say the same count: screen readers hear the dots as one progress element.
 */
export function GardenProgress({ hizb, waterRun }: GardenProgressProps) {
  const { t } = useTranslation('home');
  const { t: tGarden } = useTranslation('garden');
  const count = tGarden('readout.hizb.value', { hizb: hizb.completed, total: hizb.total });
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <View style={styles.item} accessible accessibilityLabel={count}>
          <Icon symbol={HOME_SYMBOLS.leaf} textStyle="subheadEmphasized" color="actionTint" />
          <AppText variant="subheadEmphasized">{count}</AppText>
        </View>
        {waterRun.kind === 'none' ? null : (
          <View
            style={styles.item}
            accessible
            accessibilityLabel={t(`progress.${waterRun.kind}Label`, { count: waterRun.days })}
            testID="home-water"
          >
            <Icon
              symbol={HOME_SYMBOLS.drop}
              textStyle="subheadEmphasized"
              color={WATER_COLORS[waterRun.kind].symbol}
            />
            <AppText variant="subheadEmphasized" color={WATER_COLORS[waterRun.kind].text}>
              {t(`progress.${waterRun.kind}`, { count: waterRun.days })}
            </AppText>
          </View>
        )}
      </View>
      <DottedProgress
        total={hizb.total}
        reached={hizb.completed}
        hasStepInProgress={hizb.inProgress !== null}
        accessibilityLabel={tGarden('readout.hizb.label')}
        accessibilityValue={count}
        testID="home-hizb-dots"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: layout.screenMargin + spacing.xs,
    paddingTop: spacing.xl,
    rowGap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  item: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm },
});
