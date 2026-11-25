/**
 * The store of the app: the person's settings and their reading journal, kept on the device.
 * See docs/specs/ui-lot1.md, section A.2. Everything else in this folder is private.
 */

export {
  loadAppStore,
  type AppStore,
  type AppStoreDependencies,
  type LoadedAppStore,
} from './app-store';
export { AppStoreProvider, useAppStore, type AppStoreProviderProps } from './app-store-context';
export {
  DAILY_GOAL_RANGE,
  DEFAULT_DAILY_GOAL_PAGES,
  DEFAULT_READER_SCRIPT,
  DEFAULT_READER_TEXT_SIZE,
  DEFAULT_REMINDERS,
  EMPTY_TIME_SPENT,
  MAX_PAUSES,
  MAX_TIME_DAYS,
  READER_SCRIPTS,
  READER_TEXT_SIZE_RANGE,
  REJECTED_DATA_KEY,
  RESET_NOTICE_KEY,
  STORED_DATA_KEY,
  STORED_DATA_VERSION,
  STORED_DATE_RANGE,
} from './config';
export {
  BACKUP_FORMAT,
  BACKUP_MAX_KHATMAS,
  BACKUP_SIZE_LIMIT,
  hasProgress,
  readBackupDocument,
  writeBackupDocument,
  type ProgressBackup,
} from './progress-backup';
export type { KeyValueStorage } from './storage';
export type { StoredDataPart } from './stored-data';
export type {
  AppData,
  AppDataToWrite,
  AppSettings,
  AppState,
  DataResetNotice,
  ForegroundTime,
  QuietHours,
  ReaderScript,
  ReminderSettings,
  ReminderTime,
} from './types';
