/**
 * Offline-first sync of the person's progress between their phones and their account: the
 * events, how they merge, and what a phone remembers to sync. Pure rules: the store applies them
 * (src/store), the engine moves the events (src/data/sync). See docs/specs/sync.md.
 */
export { DEVICE_ID_PATTERN, SETTING_KEY_PATTERN, SYNC_CONFIG } from './config';
export {
  compareStamps,
  eventId,
  isDeviceId,
  isJsonValue,
  nextStamp,
  observeStamp,
  parseSyncEvent,
} from './events';
export {
  SyncBackendError,
  type PullAnswer,
  type PushAnswer,
  type SyncAnswer,
  type SyncBackend,
  type SyncFailure,
} from './gateway';
export { mergeRemoteEvents, normalizeJournal, type MergeContext } from './merge';
export {
  acknowledgePushed,
  createSyncMeta,
  fullStateEvents,
  readSyncMeta,
  recordLocalChanges,
  settleTimeBaseline,
  startAccount,
  type NewMetaOptions,
} from './meta';
export { nextRetryDelay } from './retry';
export { deriveTime, isSameTime } from './time';
export type {
  BookmarkEvent,
  BookmarkMark,
  DeviceId,
  JsonValue,
  MergeResult,
  PageEvent,
  PauseEvent,
  RegisterRule,
  SettingEvent,
  SettingRule,
  Stamp,
  SyncEvent,
  SyncMeta,
  SyncRules,
  SyncedValues,
  TimeEvent,
} from './types';
