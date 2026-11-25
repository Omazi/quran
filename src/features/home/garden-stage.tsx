import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { growthStageOf, isTreeKind, type GardenState } from '@/domain/garden';
import { GardenView3D } from '@/features/garden';
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
  /** The pages of the hizb in progress: counted, and in all. Null when nothing grows. */
  growingPages?: { readonly read: number; readonly total: number } | null;
  /** The home screen is in front (not under the reader): the growth plays when it is. */
  isActive?: boolean;
}

/**
 * The garden, edge to edge on its gradient (the signature of the screen; charter, section 1), in
 * 3D: it turns under the finger and zooms with a pinch (D40). Over it the label of the element the hizb in progress grows, with a ring of how much of that
 * hizb is read. The label sits at the trailing side, so it moves to the left in Arabic; the garden
 * itself is never mirrored (right-to-left.md › Images).
 */
export function GardenStage({
  garden,
  showsGrowing,
  growingPages = null,
  isActive = true,
}: GardenStageProps) {
  const next = garden.nextElement;
  return (
    <View style={styles.stage}>
      <GardenView3D state={garden} playsGrowth isActive={isActive} testID="home-garden-3d" />
      {showsGrowing && next !== null ? (
        <GrowingLabel
          hizb={garden.hizbCompleted + 1}
          kind={next.element.kind}
          growth={next.growth}
          pages={growingPages}
        />
      ) : null}
    </View>
  );
}

type GrowingKind = NonNullable<GardenState['nextElement']>['element']['kind'];

/**
 * How far a tree has come, in words ("un jeune arbre"): the stages of the garden module. A built
 * element or a bed of flowers has no such words: its pages say it.
 */
function stageWords(kind: GrowingKind, growth: number, t: (key: string) => string): string | null {
  if (!isTreeKind(kind)) return null;
  const stage = growthStageOf(growth);
  return stage === 'none' || stage === 'grown' ? null : t(`growthStage.${stage}`);
}

function GrowingLabel({
  hizb,
  kind,
  growth,
  pages,
}: {
  hizb: number;
  kind: GrowingKind;
  growth: number;
  pages: { readonly read: number; readonly total: number } | null;
}) {
  const { t } = useTranslation('home');
  const { t: tGarden } = useTranslation('garden');
  const colors = useColors();
  const shadow = useElevation('floating');
  const title = t('growing.title', { hizb });
  const phrase = tGarden(`growing.${kind}`);
  const value = t('growing.value', { percent: Math.round(growth * 100) });
  const pageWords =
    pages === null ? null : t('growing.pages', { count: pages.read, total: pages.total });
  const stage = stageWords(kind, growth, tGarden);
  const detail =
    pageWords === null
      ? stage
      : stage === null
        ? pageWords
        : t('growing.detail', { pages: pageWords, stage });
  const spoken = [title, phrase, pageWords, stage, value].filter((part) => part !== null);
  return (
    <View
      accessible
      accessibilityLabel={spoken.join(', ')}
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
        {detail === null ? null : (
          <AppText variant="footnote" color="muted" testID="home-growing-detail">
            {detail}
          </AppText>
        )}
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
