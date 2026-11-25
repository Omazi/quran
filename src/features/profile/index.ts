/**
 * The profile tab: the person's garden and reading statistics (docs/specs/stats.md, section 3),
 * a row that opens the settings page, and the recording of the time spent in the app and in the reader (D37).
 */

export { ProfileScreen, type ProfileActions, type ProfileScreenProps } from './profile-screen';
export { useProfileGarden, type ProfileGardenDependencies } from './use-profile-garden';
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
