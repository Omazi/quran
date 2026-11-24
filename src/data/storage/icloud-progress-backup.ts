import { requireOptionalNativeModule } from 'expo';

import type { ProgressBackup } from '@/store';

import { inertProgressBackup } from './inert-progress-backup';

/**
 * The one switch of the iCloud copy on the JavaScript side. The native module itself is kept out
 * of native builds until it has been compiled and tested (docs/specs/backup.md › Activation). `false` makes the app behave exactly as if the native module
 * did not exist: nothing is read from iCloud and nothing is written to it.
 */
export const ICLOUD_BACKUP_ENABLED: boolean = true;

/** The name the native module registers (modules/progress-backup, `ProgressBackupModule.swift`). */
export const ICLOUD_BACKUP_MODULE_NAME = 'ProgressBackup';

/** The key of the copy in the person's iCloud key-value store. */
export const ICLOUD_BACKUP_KEY = 'progress';

/** What the native module offers. */
export interface NativeProgressBackup {
  /** Whether the person is signed in to iCloud. */
  isAvailable: () => boolean;
  read: (key: string) => Promise<string | null>;
  /** Resolves to false when the store refused the text. */
  write: (key: string, value: string) => Promise<boolean>;
}

/** The copy in iCloud, through the native module. */
export function createICloudProgressBackup(native: NativeProgressBackup): ProgressBackup {
  return {
    read: async () => (await native.read(ICLOUD_BACKUP_KEY)) ?? null,
    write: async (document) => {
      const wasKept = await native.write(ICLOUD_BACKUP_KEY, document);
      if (!wasKept) throw new Error('The iCloud key-value store refused the copy.');
    },
  };
}

export interface DeviceProgressBackupOptions {
  /** Defaults to the switch above. */
  readonly enabled?: boolean;
  /** Finds the native module, or null when the app was built without it. */
  readonly findNativeModule?: () => NativeProgressBackup | null;
}

function findLinkedNativeModule(): NativeProgressBackup | null {
  return requireOptionalNativeModule<NativeProgressBackup>(ICLOUD_BACKUP_MODULE_NAME);
}

/**
 * The copy of this device: iCloud where the native module is built into the app, nothing
 * elsewhere (the web, Android, a build made before the module was linked) and when the switch is
 * off. Being signed in to iCloud is not required: without an account the system keeps the copy
 * on the device and sends it when an account appears.
 */
export function createDeviceProgressBackup({
  enabled = ICLOUD_BACKUP_ENABLED,
  findNativeModule = findLinkedNativeModule,
}: DeviceProgressBackupOptions = {}): ProgressBackup {
  if (!enabled) return inertProgressBackup;
  let native: NativeProgressBackup | null = null;
  try {
    native = findNativeModule();
  } catch {
    // A module that cannot even be looked up is a module that is not there.
  }
  return native === null ? inertProgressBackup : createICloudProgressBackup(native);
}
