/**
 * The sync of the progress, as the app shows and starts it (docs/specs/sync.md): the backup row
 * of the settings, and the hook that runs the sync for the life of the app.
 */
export {
  SyncProvider,
  useNow,
  useSyncStatus,
  type SyncProviderProps,
  type SyncStatusSource,
} from './sync-context';
export { SyncStatusSection, type SyncStatusSectionProps } from './sync-status-section';
export { describeSyncStatus, type SyncStatusLine } from './sync-status-model';
export { useAppSync, type AppSyncDependencies } from './use-app-sync';
