import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { PAGE_COUNT } from '@/domain/quran';
import type { StatsPeriod } from '@/domain/stats';
import { useGenderedTranslation } from '@/features/gender';
import {
  ActionButton,
  AppText,
  BarChart,
  Card,
  Icon,
  IconTile,
  ProgressIndicator,
  ProgressRing,
  SectionHeader,
  SegmentedChoice,
  layout,
  radius,
  spacing,
  stateOpacity,
  useColors,
  type BarChartBar,
} from '@/ui';

import { FIGURE_SYMBOLS, PROFILE_SYMBOLS } from './config';
import {
  formatDayLong,
  formatDayMedium,
  formatDayOfMonth,
  formatDuration,
  formatMonthLong,
  formatMonthNarrow,
  formatNumber,
  formatWeekdayNarrow,
  SECONDS_PER_MINUTE,
} from './format';
import {
  STATS_METRICS,
  STATS_PERIODS,
  type ChartBar,
  type KhatmaSummary,
  type ProfileStats,
  type StatsChart,
  type StatsMetric,
} from './stats-model';
import type { ProfileStatsActions, ProfileStatsModel } from './use-profile-stats';

/** In a month of days, the days that carry a label: a week apart, from the first. */
const MONTH_TICK_EVERY_DAYS = 7;

export interface StatsSectionsProps {
  model: ProfileStatsModel;
  actions: ProfileStatsActions;
  /** The next step of a blank profile: opens the reader. */
  onRead: () => void;
}

/**
 * The statistics of the profile, the signature of the tab after the garden (docs/specs/stats.md,
 * section 3), in the visual language of the validated mockups (white cards on the warm canvas).
 *
 * One card, "Le sélecteur" of the wireframes: the period (the system's segmented control,
 * segmented-controls.md › Mobile), then the figure the person follows written large with the
 * sentence that says what matters (charts.md › Descriptive content), the chart of that figure,
 * and the list of every figure of the period, which is also the choice of what the chart follows
 * (charting-data.md › Maintain continuity among multiple charts that use the same data). Every
 * value is on screen without a touch (charts.md › Best practices). Then each khatma, as the
 * garden it grows.
 */
export function StatsSections({ model, actions, onRead }: StatsSectionsProps) {
  const { t } = useGenderedTranslation('profile');
  const { t: tHome } = useGenderedTranslation('home');
  if (model.status === 'loading') {
    return (
      <Card tone="raised">
        <View style={styles.centered}>
          <ProgressIndicator accessibilityLabel={t('loading')} testID="profile-stats-loading" />
        </View>
      </Card>
    );
  }
  if (model.status === 'failed') {
    return (
      <Card tone="raised" testID="profile-stats-failed">
        <View style={styles.message}>
          <Icon symbol={PROFILE_SYMBOLS.failed} textStyle="title1" color="muted" />
          <AppText variant="headline" align="center">
            {t('failed.title')}
          </AppText>
          <AppText color="muted" align="center">
            {t('failed.description')}
          </AppText>
        </View>
      </Card>
    );
  }
  const { stats, period, metric, dailyGoalPages } = model;
  if (!stats.hasAnything) {
    // A blank screen gives its next step, with a button to take it (writing.md › Provide clear
    // next steps on any blank screens). Same action and same name as on the home screen
    // (brand-spec, section 3, Voix): it opens the reader where the person resumes.
    return (
      <Card tone="raised" testID="profile-stats-empty">
        <View style={styles.message}>
          <AppText variant="headline" align="center">
            {t('empty.title')}
          </AppText>
          <AppText color="muted" align="center">
            {t('empty.description')}
          </AppText>
        </View>
        <ActionButton
          label={tHome('actions.read')}
          symbol={PROFILE_SYMBOLS.drop}
          onPress={onRead}
          testID="profile-read"
        />
      </Card>
    );
  }
  return (
    <>
      <Card tone="raised" testID="profile-stats">
        <SegmentedChoice<StatsPeriod>
          label={t('periods.label')}
          options={STATS_PERIODS.map((value) => ({ value, label: t(`periods.${value}`) }))}
          value={period}
          onChange={actions.selectPeriod}
          testID="profile-period"
        />
        <Hero stats={stats} period={period} metric={metric} />
        <Chart chart={stats.chart} metric={metric} />
        <Figures stats={stats} metric={metric} onSelect={actions.selectMetric} />
        <View style={styles.notes}>
          <AppTime stats={stats} />
          <AppText variant="footnote" color="muted" testID="profile-hasanat-note">
            {t('hasanat.note')}
          </AppText>
        </View>
      </Card>
      <Khatmas khatmas={stats.khatmas} dailyGoalPages={dailyGoalPages} />
    </>
  );
}

/** A value of a figure, as written and as VoiceOver says it. */
function useMetricValue() {
  const { t, i18n } = useTranslation('profile');
  const number = (value: number) => formatNumber(value, i18n.language);
  return {
    /** As written in the chart and its summary: no sign of estimate there. */
    plain: (metric: StatsMetric, value: number) =>
      metric === 'readingTime' ? formatDuration(value, t) : number(value),
    /** As written as a figure: the hasanat carry the sign of an estimate. */
    written: (metric: StatsMetric, value: number) => {
      if (metric === 'readingTime') return formatDuration(value, t);
      if (metric === 'hasanat' && value > 0) return t('hasanat.value', { value: number(value) });
      return number(value);
    },
    spoken: (metric: StatsMetric, value: number) => {
      if (metric === 'readingTime') return formatDuration(value, t, true);
      if (metric === 'hasanat' && value > 0) {
        return t('figures.hasanatSpoken', { value: number(value) });
      }
      return number(value);
    },
  };
}

/** The value of each figure in the period. Reading time is in seconds. */
function valueOf(stats: ProfileStats, metric: StatsMetric): number {
  switch (metric) {
    case 'hasanat':
      return stats.counts.hasanatEstimate;
    case 'verses':
      return stats.counts.verses;
    case 'words':
      return stats.counts.words;
    case 'pages':
      return stats.counts.pages;
    case 'readingTime':
      return stats.time.reader;
  }
}

function dateOf(chart: StatsChart, bar: ChartBar, language: string): string {
  return chart.unit === 'month'
    ? formatMonthLong(bar.start, language)
    : formatDayLong(bar.start, language);
}

/**
 * The figure followed, written large in the serif of the titles: what it is and over which
 * period, its value, and the sentence that gives the chart's main message before the chart
 * (charts.md › Descriptive content; charting-data.md › Aid comprehension by adding descriptive
 * text). The name and the value are read as one element.
 */
function Hero({
  stats,
  period,
  metric,
}: {
  stats: ProfileStats;
  period: StatsPeriod;
  metric: StatsMetric;
}) {
  const { t, i18n } = useTranslation('profile');
  const value = useMetricValue();
  const caption = t(`hero.caption.${metric}.${period}`);
  const amount = valueOf(stats, metric);
  const { chart } = stats;
  const summary =
    chart.best === null
      ? t('chart.nothingYet')
      : t(chart.unit === 'month' ? 'chart.bestMonth' : 'chart.bestDay', {
          date: dateOf(chart, chart.best, i18n.language),
          value: value.plain(metric, chart.best.value),
        });
  return (
    <View style={styles.hero} testID="profile-hero">
      <View accessible accessibilityLabel={`${caption}, ${value.spoken(metric, amount)}`}>
        <AppText variant="subheadEmphasized" color="actionTint">
          {caption}
        </AppText>
        <AppText
          variant="largeTitle"
          color="heading"
          accessibilityRole="text"
          testID="profile-hero-value"
        >
          {value.written(metric, amount)}
        </AppText>
      </View>
      <AppText variant="footnote" color="muted" testID="profile-chart-summary">
        {summary}
      </AppText>
    </View>
  );
}

function tickLabel(chart: StatsChart, bar: ChartBar, index: number, language: string) {
  if (chart.unit === 'month') return formatMonthNarrow(bar.start, language);
  if (chart.bars.length <= 7) return formatWeekdayNarrow(bar.start, language);
  return index % MONTH_TICK_EVERY_DAYS === 0 ? formatDayOfMonth(bar.start, language) : undefined;
}

/**
 * The evolution of the figure followed, day by day (or month by month for the whole history), in
 * the green of what grows: the water blue keeps its one meaning (brand-spec, palette of the
 * mockups). Each bar is read by VoiceOver with its date and its value in words (charts.md ›
 * Enhancing the accessibility of a chart).
 */
function Chart({ chart, metric }: { chart: StatsChart; metric: StatsMetric }) {
  const { t, i18n } = useTranslation('profile');
  const language = i18n.language;
  const value = useMetricValue();
  const metricName = t(`chart.metrics.${metric}`);
  const bars: BarChartBar[] = chart.bars.map((bar, index) => ({
    key: bar.start,
    // Reading time is drawn in minutes, so the axis reads in round minutes.
    value: metric === 'readingTime' ? bar.value / SECONDS_PER_MINUTE : bar.value,
    tickLabel: tickLabel(chart, bar, index, language),
    isCurrent: bar.isCurrent,
    isFuture: bar.isFuture,
    accessibilityLabel: t('chart.bar', {
      date: dateOf(chart, bar, language),
      metric: metricName,
      value: value.spoken(metric, bar.value),
    }),
  }));
  return (
    <View style={styles.chart}>
      <BarChart
        bars={bars}
        tone="growth"
        formatValue={(axisValue) =>
          value.plain(metric, metric === 'readingTime' ? axisValue * SECONDS_PER_MINUTE : axisValue)
        }
        testID="profile-chart"
      />
    </View>
  );
}

/**
 * Every figure of the period, one row each, and the choice of the one the chart follows: a radio
 * group for VoiceOver, the chosen row on the pale green of the mockups' quiet actions, its words
 * in green and bolder, so the choice is told by a shape and a weight, not by colour alone
 * (lists-and-tables.md › Provide appropriate feedback when people select a list item;
 * accessibility.md › Vision). Rows are 44 points tall at least, with a press state
 * (buttons.md › Best practices).
 */
function Figures({
  stats,
  metric,
  onSelect,
}: {
  stats: ProfileStats;
  metric: StatsMetric;
  onSelect: (metric: StatsMetric) => void;
}) {
  const { t } = useTranslation('profile');
  const colors = useColors();
  const value = useMetricValue();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('figures.label')}
      style={styles.figures}
      testID="profile-figures"
    >
      {STATS_METRICS.map((option) => {
        const isSelected = option === metric;
        const name = t(`chart.metrics.${option}`);
        const amount = valueOf(stats, option);
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={t('figures.choice', {
              name,
              value: value.spoken(option, amount),
            })}
            accessibilityState={{ checked: isSelected, selected: isSelected }}
            onPress={() => onSelect(option)}
            testID={`profile-figure-${option}`}
            style={({ pressed }) => [
              styles.figure,
              isSelected && { backgroundColor: colors.actionTonal },
              pressed && styles.pressed,
            ]}
          >
            <Icon
              symbol={FIGURE_SYMBOLS[option]}
              textStyle="body"
              color={isSelected ? 'actionTint' : 'muted'}
            />
            <AppText
              variant={isSelected ? 'headline' : 'body'}
              color={isSelected ? 'actionTint' : 'label'}
              style={styles.figureName}
            >
              {name}
            </AppText>
            <AppText variant="headline" color={isSelected ? 'actionTint' : 'heading'}>
              {value.written(option, amount)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The time in the app, which no chart follows: one line under the figures, said in words. */
function AppTime({ stats }: { stats: ProfileStats }) {
  const { t } = useTranslation('profile');
  return (
    <AppText
      variant="footnote"
      color="muted"
      accessibilityLabel={t('figures.appTimeSpoken', {
        value: formatDuration(stats.time.app, t, true),
      })}
      testID="profile-app-time"
    >
      {t('figures.appTime', { value: formatDuration(stats.time.app, t) })}
    </AppText>
  );
}

/**
 * Each khatma told as the garden it grows (D23: each khatma completed opens the next level and
 * its garden), the one in progress first with how far it has grown and when it would end at the
 * pace of the daily goal (owner's decision, 25 November 2026; the estimate the home screen gave),
 * the pace said under the card. The source of the hasanat is said once, in the card above.
 */
function Khatmas({
  khatmas,
  dailyGoalPages,
}: {
  khatmas: readonly KhatmaSummary[];
  dailyGoalPages: number;
}) {
  const { t, i18n } = useTranslation('profile');
  if (khatmas.length === 0) return null;
  const number = (value: number) => formatNumber(value, i18n.language);
  const hasEstimate = khatmas.some((khatma) => khatma.estimatedFinishDate !== null);
  return (
    <View style={styles.group}>
      <SectionHeader title={t('khatmas.title')} />
      <Card tone="raised">
        <View style={styles.khatmas}>
          {khatmas.map((khatma) => {
            const title = khatma.isComplete
              ? t('khatmas.complete', {
                  number: khatma.khatm,
                  date: formatDayMedium(khatma.lastDate, i18n.language),
                })
              : khatma.estimatedFinishDate === null
                ? t('khatmas.inProgress', { number: khatma.khatm })
                : t('khatmas.inProgressUntil', {
                    number: khatma.khatm,
                    date: formatDayMedium(khatma.estimatedFinishDate, i18n.language),
                  });
            const detail = t('khatmas.detail', {
              number: khatma.khatm,
              pages: number(khatma.counts.pages),
              verses: number(khatma.counts.verses),
              words: number(khatma.counts.words),
              hasanat: number(khatma.counts.hasanatEstimate),
            });
            return (
              <View
                key={khatma.khatm}
                accessible
                accessibilityLabel={`${title}, ${detail}`}
                style={styles.khatma}
                testID={`profile-khatma-${khatma.khatm}`}
              >
                {khatma.isComplete ? (
                  <IconTile symbol={PROFILE_SYMBOLS.completed} tone="growth" size="medium" />
                ) : (
                  <ProgressRing
                    progress={Math.min(1, khatma.counts.pages / PAGE_COUNT)}
                    size="small"
                    tone="growth"
                    accessibilityLabel={title}
                    accessibilityValue={detail}
                  >
                    <Icon symbol={PROFILE_SYMBOLS.leaf} textStyle="footnote" color="actionTint" />
                  </ProgressRing>
                )}
                <View style={styles.khatmaWords}>
                  <AppText variant="callout">{title}</AppText>
                  <AppText variant="footnote" color="muted">
                    {detail}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      </Card>
      {hasEstimate ? (
        <AppText variant="footnote" color="muted" style={styles.groupNote}>
          {t('khatmas.pace', { count: dailyGoalPages })}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: spacing.lg },
  message: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  hero: { marginTop: spacing.lg, gap: spacing.xs },
  chart: { marginTop: spacing.md },
  figures: { marginTop: spacing.md, rowGap: spacing.xs },
  figure: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: layout.controlGap,
    paddingHorizontal: layout.controlGap,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  figureName: { flexGrow: 1, flexShrink: 1 },
  pressed: { opacity: stateOpacity.pressed },
  notes: { marginTop: spacing.md, gap: spacing.sm },
  group: { rowGap: spacing.sm },
  groupNote: { paddingHorizontal: spacing.xs },
  khatmas: { rowGap: spacing.md },
  khatma: { flexDirection: 'row', alignItems: 'center', columnGap: layout.controlGap },
  khatmaWords: { flex: 1, rowGap: spacing.none },
});
