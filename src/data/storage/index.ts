/**
 * Storage on the device and beside it: implementations of the `KeyValueStorage` and
 * `ProgressBackup` interfaces the store declares.
 */

export { deviceStorage } from './device-storage';
export {
  ICLOUD_BACKUP_ENABLED,
  ICLOUD_BACKUP_KEY,
  ICLOUD_BACKUP_MODULE_NAME,
  createDeviceProgressBackup,
  createICloudProgressBackup,
  type DeviceProgressBackupOptions,
  type NativeProgressBackup,
} from './icloud-progress-backup';
export { inertProgressBackup } from './inert-progress-backup';
export { createMemoryProgressBackup, type MemoryProgressBackup } from './memory-progress-backup';
export { createMemoryStorage, type MemoryStorage } from './memory-storage';
