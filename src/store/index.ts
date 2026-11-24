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
  DEFAULT_REMINDERS,
  STORED_DATA_KEY,
  STORED_DATA_VERSION,
} from './config';
export type { KeyValueStorage } from './storage';
export type { StoredDataPart } from './stored-data';
export type {
  AppData,
  AppSettings,
  AppState,
  QuietHours,
  ReminderSettings,
  ReminderTime,
} from './types';
