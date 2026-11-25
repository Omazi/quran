import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { GardenState } from '@/domain/garden';
import { GardenScene } from '@/features/garden';
import {
  AppText,
  Icon,
  ProgressRing,
  layout,
  pieceSizes,
  radius,
  spacing,
  useColors,
  useElevation,
} from '@/ui';

import { HOME_SYMBOLS } from './config';

export interface GardenStageProps {
  garden: GardenState;
  /** Shows the floating label of the element growing (accueil.png: "Hizb 25 · un grenadier pousse"). */
  showsGrowing: boolean;
}

/**
 * The garden, edge to edge on its gradient (the signature of the screen; charter, section 1), and
 * over it the label of the element the hizb in progress grows, with a ring of how much of that
 * hizb is read. The label sits at the trailing side, so it moves to the left in Arabic; the garden
 * itself is never mirrored (right-to-left.md › Images).
 */
export function GardenStage({ garden, showsGrowing }: GardenStageProps) {
  const next = garden.nextElement;
  return (
    <View style={styles.stage}>
      <GardenScene state={garden} size="band" />
      {showsGrowing && next !== null ? (
        <GrowingLabel
          hizb={garden.hizbCompleted + 1}
          kind={next.element.kind}
          growth={next.growth}
        />
      ) : null}
    </View>
  );
}

function GrowingLabel({
  hizb,
  kind,
  growth,
}: {
  hizb: number;
  kind: NonNullable<GardenState['nextElement']>['element']['kind'];
  growth: number;
}) {
  const { t } = useTranslation('home');
  const { t: tGarden } = useTranslation('garden');
  const colors = useColors();
  const shadow = useElevation('floating');
  const title = t('growing.title', { hizb });
  const phrase = tGarden(`growing.${kind}`);
  const value = t('growing.value', { percent: Math.round(growth * 100) });
  return (
    <View
      accessible
      accessibilityLabel={`${title}, ${phrase}, ${value}`}
      style={[styles.label, { backgroundColor: colors.surface, boxShadow: shadow }]}
      testID="home-growing"
    >
      <ProgressRing
        progress={growth}
        size="small"
        tone="growth"
        accessibilityLabel={title}
        accessibilityValue={value}
      >
        <Icon symbol={HOME_SYMBOLS.leaf} textStyle="footnote" color="actionTint" />
      </ProgressRing>
      <View style={styles.labelText}>
        <AppText variant="subheadEmphasized">{title}</AppText>
        <AppText variant="footnote" color="muted">
          {phrase}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'stretch', marginTop: spacing.md },
  label: {
    position: 'absolute',
    top: pieceSizes.sceneLabelTop,
    end: layout.screenMargin,
    maxWidth: pieceSizes.sceneLabelMaxWidth,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: layout.controlGap - spacing.xs,
    paddingVertical: spacing.sm,
    paddingStart: spacing.sm,
    paddingEnd: layout.controlGap,
    borderRadius: radius.lg,
  },
  labelText: { flexShrink: 1 },
});
