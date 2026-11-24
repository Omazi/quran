import type { ProgressBackup } from '@/store';

import {
  ICLOUD_BACKUP_ENABLED,
  ICLOUD_BACKUP_KEY,
  ICLOUD_BACKUP_MODULE_NAME,
  createDeviceProgressBackup,
  createICloudProgressBackup,
  createMemoryProgressBackup,
  inertProgressBackup,
  type NativeProgressBackup,
} from '..';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/** A stand-in for the native module: one text per key, as the iCloud key-value store keeps it. */
function createFakeNativeModule(isRefusing = false) {
  const items = new Map<string, string>();
  const native: NativeProgressBackup = {
    isAvailable: () => true,
    read: jest.fn(async (key: string) => items.get(key) ?? null),
    write: jest.fn(async (key: string, value: string) => {
      if (isRefusing) return false;
      items.set(key, value);
      return true;
    }),
  };
  return { native, items };
}

async function expectInert(backup: ProgressBackup) {
  await expect(backup.write('a copy')).resolves.toBeUndefined();
  await expect(backup.read()).resolves.toBeNull();
}

describe('copy that keeps nothing', () => {
  it('finds no copy, and loses quietly what it is given', async () => {
    await expectInert(inertProgressBackup);
  });
});

describe('copy in memory', () => {
  it('starts with the text it is given and gives back the last text written', async () => {
    const backup = createMemoryProgressBackup('first');
    await expect(backup.read()).resolves.toBe('first');
    await backup.write('second');
    await expect(backup.read()).resolves.toBe('second');
    expect(backup.peek()).toBe('second');
    await expect(createMemoryProgressBackup().read()).resolves.toBeNull();
  });
});

describe('copy in iCloud, through the native module', () => {
  it('reads and writes one text, under one key', async () => {
    const { native, items } = createFakeNativeModule();
    const backup = createICloudProgressBackup(native);
    await expect(backup.read()).resolves.toBeNull();
    await backup.write('{"f":1}');
    expect(native.write).toHaveBeenCalledWith(ICLOUD_BACKUP_KEY, '{"f":1}');
    expect([...items.keys()]).toEqual([ICLOUD_BACKUP_KEY]);
    await expect(backup.read()).resolves.toBe('{"f":1}');
  });

  it('reads a key the store has never held as no copy', async () => {
    const { native } = createFakeNativeModule();
    // The native side answers `nil`, which may reach JavaScript as undefined.
    jest.mocked(native.read).mockResolvedValue(undefined as unknown as null);
    await expect(createICloudProgressBackup(native).read()).resolves.toBeNull();
  });

  it('fails when the store refuses the text, so the caller knows nothing was kept', async () => {
    const { native } = createFakeNativeModule(true);
    await expect(createICloudProgressBackup(native).write('a copy')).rejects.toThrow();
  });
});

describe('copy of this device', () => {
  it('is switched on, and names the module the Swift side registers', () => {
    expect(ICLOUD_BACKUP_ENABLED).toBe(true);
    expect(ICLOUD_BACKUP_MODULE_NAME).toBe('ProgressBackup');
  });

  it('uses the native module when the app was built with it', async () => {
    const { native, items } = createFakeNativeModule();
    const backup = createDeviceProgressBackup({ findNativeModule: () => native });
    await backup.write('a copy');
    expect(items.get(ICLOUD_BACKUP_KEY)).toBe('a copy');
  });

  it('keeps nothing when the app was built without the module', async () => {
    await expectInert(createDeviceProgressBackup({ findNativeModule: () => null }));
  });

  it('keeps nothing when the module cannot even be looked up', async () => {
    const findNativeModule = () => {
      throw new Error('no native modules here');
    };
    await expectInert(createDeviceProgressBackup({ findNativeModule }));
  });

  it('keeps nothing, and does not look for the module, when the switch is off', async () => {
    const { native } = createFakeNativeModule();
    const findNativeModule = jest.fn(() => native);
    await expectInert(createDeviceProgressBackup({ enabled: false, findNativeModule }));
    expect(findNativeModule).not.toHaveBeenCalled();
    expect(native.write).not.toHaveBeenCalled();
  });

  it('keeps nothing under Jest, where no native module is linked', async () => {
    await expectInert(createDeviceProgressBackup());
  });
});
