import { useMemo, useState } from 'react';

import type { LocalDate } from '@/domain/shared/local-date';
import type { PageStatsTable, StatsPeriod } from '@/domain/stats';
import { useToday, type Clock } from '@/features/home';
import { useAppStore } from '@/store';

import { usePageStatsTable } from './page-stats-table';
import { usePreviewedStatsSource } from './state-preview';
import { buildProfileStats, type ProfileStats, type StatsMetric } from './stats-model';

export type ProfileStatsModel =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
      readonly status: 'ready';
      readonly period: StatsPeriod;
      readonly metric: StatsMetric;
      readonly today: LocalDate;
      readonly stats: ProfileStats;
    };

export interface ProfileStatsActions {
  readonly selectPeriod: (period: StatsPeriod) => void;
  readonly selectMetric: (metric: StatsMetric) => void;
}

export interface ProfileStatsDependencies {
  /** Defaults to the device clock. */
  readonly clock?: Clock;
  /** Defaults to the table of the app's mushaf, built once. */
  readonly loadTable?: () => Promise<PageStatsTable>;
}

/** The period first shown: the week, which has a shape on a chart from the first days. */
const FIRST_PERIOD: StatsPeriod = 'week';
const FIRST_METRIC: StatsMetric = 'hasanat';

/**
 * The statistics section's model: the person's journal and time, the period and the figure they
 * chose, rebuilt only when one of them, the table or the day changes.
 */
export function useProfileStats({ clock, loadTable }: ProfileStatsDependencies = {}): {
  model: ProfileStatsModel;
  actions: ProfileStatsActions;
} {
  const today = useToday(clock);
  const tableState = usePageStatsTable(loadTable);
  const storedJournal = useAppStore((state) => state.journal);
  const storedTime = useAppStore((state) => state.timeSpent);
  const { journal, timeSpent } = usePreviewedStatsSource({
    journal: storedJournal,
    timeSpent: storedTime,
  });
  const [period, setPeriod] = useState<StatsPeriod>(FIRST_PERIOD);
  const [metric, setMetric] = useState<StatsMetric>(FIRST_METRIC);

  const model = useMemo((): ProfileStatsModel => {
    if (tableState.status !== 'ready') return tableState;
    try {
      const stats = buildProfileStats({
        journal,
        table: tableState.table,
        timeSpent,
        period,
        metric,
        today,
      });
      return { status: 'ready', period, metric, today, stats };
    } catch (error) {
      // A damaged journal: an explanation on screen, never made-up numbers.
      console.error('The statistics could not be computed.', error);
      return { status: 'failed' };
    }
  }, [tableState, journal, timeSpent, period, metric, today]);

  const actions = useMemo(() => ({ selectPeriod: setPeriod, selectMetric: setMetric }), []);
  return { model, actions };
}
