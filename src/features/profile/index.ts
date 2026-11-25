/**
 * The profile tab: the reading statistics (docs/specs/stats.md, section 3) above the settings,
 * and the recording of the time spent in the app and in the reader (D37).
 */

export { ProfileScreen, type ProfileScreenProps } from './profile-screen';
export { StatsSections, type StatsSectionsProps } from './stats-sections';
export {
  buildProfileStats,
  STATS_METRICS,
  STATS_PERIODS,
  type ChartBar,
  type KhatmaSummary,
  type ProfileStats,
  type StatsChart,
  type StatsMetric,
} from './stats-model';
export {
  useProfileStats,
  type ProfileStatsActions,
  type ProfileStatsDependencies,
  type ProfileStatsModel,
} from './use-profile-stats';
export {
  getPageStatsTable,
  loadPageStatsTable,
  usePageStatsTable,
  type PageStatsTableState,
} from './page-stats-table';
export {
  createForegroundTimeRecorder,
  type ForegroundTimeRecorder,
  type ForegroundTimeRecorderOptions,
} from './foreground-time';
export {
  useForegroundTimeRecording,
  type ForegroundTimeClocks,
} from './use-foreground-time-recording';
export { useReaderPresence } from './use-reader-presence';
