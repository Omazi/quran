import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { growthStageOf, isTreeKind, type GardenState } from '@/domain/garden';
import {
  AppText,
  DottedProgress,
  Icon,
  ProgressRing,
  layout,
  spacing,
  type IconColorRole,
  type TextColorRole,
} from '@/ui';

import { HOME_SYMBOLS } from './config';
import type { HomeHizb, HomeWaterRun } from './home-model';

type GrowingKind = NonNullable<GardenState['nextElement']>['element']['kind'];

/** What grows now: the element of the hizb in progress, how far, and its pages. */
export interface GardenGrowing {
  readonly kind: GrowingKind;
  /** From 0 to 1: the share of its hizb read. */
  readonly growth: number;
  /** The pages of that hizb: counted, and in all. Null when unknown. */
  readonly pages: { readonly read: number; readonly total: number } | null;
}

export interface GardenProgressProps {
  hizb: HomeHizb;
  waterRun: HomeWaterRun;
  /** Null when nothing grows (a thirsty garden, a garden complete): the line gives the count. */
  growing: GardenGrowing | null;
}

const WATER_COLORS: Readonly<
  Record<Exclude<HomeWaterRun['kind'], 'none'>, { text: TextColorRole; symbol: IconColorRole }>
> = {
  watered: { text: 'water', symbol: 'waterFill' },
  still: { text: 'drought', symbol: 'thirstIcon' },
  dry: { text: 'drought', symbol: 'thirstIcon' },
};

/** The first letter in capitals: the garden module writes its phrases to sit inside a sentence. */
function sentenceCase(text: string, language: string): string {
  return text.charAt(0).toLocaleUpperCase(language) + text.slice(1);
}

/**
 * How far a tree has come, in words ("un jeune arbre"): the stages of the garden module. A built
 * element or a bed of flowers has no such words: its pages say it.
 */
function stageWords(kind: GrowingKind, growth: number, t: (key: string) => string): string | null {
  if (!isTreeKind(kind)) return null;
  const stage = growthStageOf(growth);
  return stage === 'none' || stage === 'grown' ? null : t(`growthStage.${stage}`);
}

/**
 * The line under the garden (maquettes 2026-11-26, 1A, chosen by the owner): a small ring of how
 * much of the hizb in progress is read, with a leaf; "Un grenadier pousse" and, under it,
 * "Hizb 25 sur 60 · 3 pages sur 10"; at the end, the days of water and what they count. Then one
 * dot per hizb, the one that grows drawn as a small circle. The garden above stays free of words.
 *
 * The ring and the dots are pictures of values written beside them (color.md › Inclusive color;
 * progress-indicators.md: a circular indicator fills clockwise). The water is teal while it runs
 * and amber once it stops, and its words always say which. The line sits on the leading side and
 * the water on the trailing one, so both trade places in Arabic (right-to-left.md › Controls).
 */
export function GardenProgress({ hizb, waterRun, growing }: GardenProgressProps) {
  const { t, i18n } = useTranslation('home');
  const { t: tGarden } = useTranslation('garden');
  const count = tGarden('readout.hizb.value', { hizb: hizb.completed, total: hizb.total });
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        {growing === null || hizb.inProgress === null ? (
          <View style={styles.lead} accessible accessibilityLabel={count}>
            <Icon symbol={HOME_SYMBOLS.leaf} textStyle="callout" color="actionTint" />
            <AppText variant="callout" testID="home-hizb-count">
              {count}
            </AppText>
          </View>
        ) : (
          <GrowingLine
            growing={growing}
            hizb={hizb.inProgress}
            total={hizb.total}
            title={sentenceCase(tGarden(`growing.${growing.kind}`), i18n.language)}
          />
        )}
        {waterRun.kind === 'none' ? null : (
          <View
            style={styles.water}
            accessible
            accessibilityLabel={t(`progress.${waterRun.kind}Label`, { count: waterRun.days })}
            testID="home-water"
          >
            <View style={styles.waterDays}>
              <Icon
                symbol={HOME_SYMBOLS.drop}
                textStyle="footnote"
                color={WATER_COLORS[waterRun.kind].symbol}
              />
              <AppText variant="subheadEmphasized" color={WATER_COLORS[waterRun.kind].text}>
                {t('progress.days', { count: waterRun.days })}
              </AppText>
            </View>
            <AppText variant="footnote" color="muted" align="end">
              {t(`progress.${waterRun.kind}Caption`)}
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

function GrowingLine({
  growing,
  hizb,
  total,
  title,
}: {
  growing: GardenGrowing;
  hizb: number;
  total: number;
  title: string;
}) {
  const { t } = useTranslation('home');
  const { t: tGarden } = useTranslation('garden');
  const pages =
    growing.pages === null
      ? null
      : t('growing.pages', { count: growing.pages.read, total: growing.pages.total });
  const where = t('growing.lineAlone', { hizb, total });
  const detail = pages === null ? where : t('growing.line', { hizb, total, pages });
  const value = t('growing.value', { percent: Math.round(growing.growth * 100) });
  const stage = stageWords(growing.kind, growing.growth, tGarden);
  const spoken = [title, where, pages, stage, value].filter((part) => part !== null);
  return (
    <View
      style={styles.lead}
      accessible
      accessibilityLabel={spoken.join(', ')}
      testID="home-growing"
    >
      <ProgressRing
        progress={growing.growth}
        size="small"
        tone="growth"
        accessibilityLabel={title}
        accessibilityValue={value}
      >
        <Icon symbol={HOME_SYMBOLS.leaf} textStyle="headline" color="growth" />
      </ProgressRing>
      <View style={styles.leadText}>
        <AppText variant="callout">{title}</AppText>
        <AppText variant="footnote" color="muted">
          {detail}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: layout.screenMargin + spacing.xs,
    paddingTop: spacing.lg,
    rowGap: layout.controlGap,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.sm,
  },
  lead: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: layout.controlGap,
    flexShrink: 1,
    flexGrow: 1,
  },
  leadText: { flexShrink: 1 },
  water: { alignItems: 'flex-end', marginStart: 'auto' },
  waterDays: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.xs },
});
