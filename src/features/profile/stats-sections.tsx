import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { StatsPeriod } from '@/domain/stats';
import {
  AppText,
  BarChart,
  ChoiceRow,
  ContentRow,
  Icon,
  LabelRow,
  ListRow,
  ListSection,
  ProgressIndicator,
  SegmentedChoice,
  spacing,
  type BarChartBar,
  type IconSymbol,
} from '@/ui';

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

const EMPTY_SYMBOL: IconSymbol = { ios: 'chart.bar', android: 'bar_chart' };
const FAILED_SYMBOL: IconSymbol = { ios: 'exclamationmark.circle', android: 'error' };
const KHATMA_IN_PROGRESS_SYMBOL: IconSymbol = { ios: 'book', android: 'menu_book' };
const KHATMA_COMPLETE_SYMBOL: IconSymbol = { ios: 'checkmark.seal', android: 'verified' };

/** In a month of days, the days that carry a label: a week apart, from the first. */
const MONTH_TICK_EVERY_DAYS = 7;

export interface StatsSectionsProps {
  model: ProfileStatsModel;
  actions: ProfileStatsActions;
}

/**
 * The statistics of the profile, the signature of the tab (docs/specs/stats.md, section 3): the
 * period, the hasanat estimate told as one figure with its source, the daily evolution of the
 * figure the person picks, the other figures, and each khatma. Sections of the system's grouped
 * list (lists-and-tables.md), in the order of importance (layout.md › Visual hierarchy). Place
 * it in a `GroupedList`.
 */
export function StatsSections({ model, actions }: StatsSectionsProps) {
  const { t } = useTranslation('profile');
  if (model.status === 'loading') {
    return (
      <ListSection isBare>
        <ContentRow>
          <View style={styles.centered}>
            <ProgressIndicator accessibilityLabel={t('loading')} testID="profile-stats-loading" />
          </View>
        </ContentRow>
      </ListSection>
    );
  }
  if (model.status === 'failed') {
    return (
      <StatsMessage
        symbol={FAILED_SYMBOL}
        title={t('failed.title')}
        description={t('failed.description')}
        testID="profile-stats-failed"
      />
    );
  }
  const { stats, period, metric } = model;
  if (!stats.hasAnything) {
    return (
      <StatsMessage
        symbol={EMPTY_SYMBOL}
        title={t('empty.title')}
        description={t('empty.description')}
        testID="profile-stats-empty"
      />
    );
  }
  return (
    <>
      <ListSection>
        <SegmentedChoice<StatsPeriod>
          label={t('periods.label')}
          options={STATS_PERIODS.map((value) => ({ value, label: t(`periods.${value}`) }))}
          value={period}
          onChange={actions.selectPeriod}
          testID="profile-period"
        />
      </ListSection>
      <HasanatHeadline stats={stats} period={period} />
      <ChartSections chart={stats.chart} metric={metric} onChangeMetric={actions.selectMetric} />
      <FiguresSection stats={stats} />
      <KhatmasSection khatmas={stats.khatmas} />
    </>
  );
}

/**
 * Nothing to count yet, or the counts could not be made: a symbol, a title and one sentence,
 * the shape of the system's empty state (SwiftUI Pro, design.md › Standard system styling),
 * composed here because the system view cannot sit inside a row of the list.
 */
function StatsMessage({
  symbol,
  title,
  description,
  testID,
}: {
  symbol: IconSymbol;
  title: string;
  description: string;
  testID: string;
}) {
  return (
    <ListSection isBare>
      <ContentRow>
        <View style={styles.message} testID={testID}>
          <Icon symbol={symbol} textStyle="largeTitle" color="secondaryLabel" />
          <AppText variant="headline" align="center">
            {title}
          </AppText>
          <AppText color="secondaryLabel" align="center">
            {description}
          </AppText>
        </View>
      </ContentRow>
    </ListSection>
  );
}

/**
 * The one figure told large: the hasanat estimate, in the serif of the titles. Its source and
 * the reminder that Allah alone knows the reward sit right under it, never apart from it
 * (docs/specs/stats.md: always an estimate, always with its source).
 */
function HasanatHeadline({ stats, period }: { stats: ProfileStats; period: StatsPeriod }) {
  const { t, i18n } = useTranslation('profile');
  const value = formatNumber(stats.counts.hasanatEstimate, i18n.language);
  return (
    <ListSection isBare>
      <ContentRow>
        <View style={styles.headline} testID="profile-hasanat">
          <View
            accessible
            accessibilityLabel={`${t(`hasanat.caption.${period}`)}. ${t('hasanat.valueSpoken', { value })}`}
          >
            <AppText color="secondaryLabel">{t(`hasanat.caption.${period}`)}</AppText>
            <AppText variant="displayTitle" accessibilityRole="text" testID="profile-hasanat-value">
              {stats.counts.hasanatEstimate === 0 ? value : t('hasanat.value', { value })}
            </AppText>
          </View>
          <AppText variant="footnote" color="secondaryLabel" testID="profile-hasanat-note">
            {t('hasanat.note')}
          </AppText>
        </View>
      </ContentRow>
    </ListSection>
  );
}

/** A value of a figure, as written on the chart and in its summary. */
function useMetricValue() {
  const { t, i18n } = useTranslation('profile');
  return {
    written: (metric: StatsMetric, value: number) =>
      metric === 'readingTime' ? formatDuration(value, t) : formatNumber(value, i18n.language),
    spoken: (metric: StatsMetric, value: number) =>
      metric === 'readingTime'
        ? formatDuration(value, t, true)
        : formatNumber(value, i18n.language),
  };
}

function tickLabel(chart: StatsChart, bar: ChartBar, index: number, language: string) {
  if (chart.unit === 'month') return formatMonthNarrow(bar.start, language);
  if (chart.bars.length <= 7) return formatWeekdayNarrow(bar.start, language);
  return index % MONTH_TICK_EVERY_DAYS === 0 ? formatDayOfMonth(bar.start, language) : undefined;
}

/**
 * The daily evolution, right under the headline figure: a sentence says what matters before the
 * chart shows it (charting-data.md › Aid comprehension by adding descriptive text), one bar
 * chart, and under it the menu that picks the figure it follows (the system's pop-up button,
 * pop-up-buttons.md). Under the chart, so that the radio list Android draws for it never pushes
 * the chart away from the headline.
 */
function ChartSections({
  chart,
  metric,
  onChangeMetric,
}: {
  chart: StatsChart;
  metric: StatsMetric;
  onChangeMetric: (metric: StatsMetric) => void;
}) {
  const { t, i18n } = useTranslation('profile');
  const language = i18n.language;
  const value = useMetricValue();
  const metricName = t(`chart.metrics.${metric}`);
  const dateOf = (bar: ChartBar) =>
    chart.unit === 'month'
      ? formatMonthLong(bar.start, language)
      : formatDayLong(bar.start, language);
  const bars: BarChartBar[] = chart.bars.map((bar, index) => ({
    key: bar.start,
    // Reading time is drawn in minutes, so the axis reads in round minutes.
    value: metric === 'readingTime' ? bar.value / SECONDS_PER_MINUTE : bar.value,
    tickLabel: tickLabel(chart, bar, index, language),
    isCurrent: bar.isCurrent,
    isFuture: bar.isFuture,
    accessibilityLabel: t('chart.bar', {
      date: dateOf(bar),
      metric: metricName,
      value: value.spoken(metric, bar.value),
    }),
  }));
  const summary =
    chart.best === null
      ? t('chart.nothingYet')
      : t(chart.unit === 'month' ? 'chart.bestMonth' : 'chart.bestDay', {
          date: dateOf(chart.best),
          value: value.written(metric, chart.best.value),
        });
  return (
    <>
      <ListSection isBare title={t(chart.unit === 'month' ? 'chart.titleMonth' : 'chart.titleDay')}>
        <ContentRow>
          <View style={styles.chart}>
            <AppText variant="footnote" color="secondaryLabel" testID="profile-chart-summary">
              {summary}
            </AppText>
            <BarChart
              bars={bars}
              formatValue={(axisValue) =>
                value.written(
                  metric,
                  metric === 'readingTime' ? axisValue * SECONDS_PER_MINUTE : axisValue,
                )
              }
              testID="profile-chart"
            />
          </View>
        </ContentRow>
      </ListSection>
      <ListSection>
        <ChoiceRow<StatsMetric>
          label={t('chart.metricLabel')}
          options={STATS_METRICS.map((option) => ({
            value: option,
            label: t(`chart.metrics.${option}`),
          }))}
          value={metric}
          onChange={onChangeMetric}
          testID="profile-chart-metric"
        />
      </ListSection>
    </>
  );
}

/** The other figures of the period, as rows of label and value (lists-and-tables.md › Content). */
function FiguresSection({ stats }: { stats: ProfileStats }) {
  const { t, i18n } = useTranslation('profile');
  const number = (value: number) => formatNumber(value, i18n.language);
  return (
    <ListSection>
      <ListRow
        label={t('figures.versesRead')}
        value={number(stats.counts.verses)}
        testID="profile-verses"
      />
      <ListRow
        label={t('figures.wordsRead')}
        value={number(stats.counts.words)}
        testID="profile-words"
      />
      <ListRow
        label={t('figures.pagesRead')}
        value={number(stats.counts.pages)}
        testID="profile-pages"
      />
      <ListRow
        label={t('figures.readingTime')}
        value={formatDuration(stats.time.reader, t)}
        testID="profile-reading-time"
      />
      <ListRow
        label={t('figures.appTime')}
        value={formatDuration(stats.time.app, t)}
        testID="profile-app-time"
      />
    </ListSection>
  );
}

/** Each khatma, the one in progress first, with all its figures; the estimate keeps its source. */
function KhatmasSection({ khatmas }: { khatmas: readonly KhatmaSummary[] }) {
  const { t, i18n } = useTranslation('profile');
  if (khatmas.length === 0) return null;
  const number = (value: number) => formatNumber(value, i18n.language);
  return (
    <ListSection title={t('khatmas.title')} footer={t('hasanat.shortNote')}>
      {khatmas.map((khatma) => (
        <LabelRow
          key={khatma.khatm}
          label={
            khatma.isComplete
              ? t('khatmas.complete', {
                  number: khatma.khatm,
                  date: formatDayMedium(khatma.lastDate, i18n.language),
                })
              : t('khatmas.inProgress', { number: khatma.khatm })
          }
          detail={t('khatmas.detail', {
            pages: number(khatma.counts.pages),
            verses: number(khatma.counts.verses),
            words: number(khatma.counts.words),
            hasanat: number(khatma.counts.hasanatEstimate),
          })}
          symbol={khatma.isComplete ? KHATMA_COMPLETE_SYMBOL : KHATMA_IN_PROGRESS_SYMBOL}
          tone={khatma.isComplete ? 'secondaryLabel' : 'accent'}
          testID={`profile-khatma-${khatma.khatm}`}
        />
      ))}
    </ListSection>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: spacing.lg },
  message: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  headline: { gap: spacing.sm, paddingVertical: spacing.sm },
  chart: { gap: spacing.xs, paddingTop: spacing.sm },
});
