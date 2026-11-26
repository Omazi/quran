/**
 * The two settings of levels and badges (D46): whether friends see the level, and the last khatma
 * whose celebration was shown. Both travel with the account.
 */
import { createMemoryStorage } from '@/data/storage';

import { loadAppStore } from '../app-store';
import { createTestAppStore } from '../test-support/test-store';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let clock = 10_000;

function load() {
  return loadAppStore({
    storage: createMemoryStorage(),
    drawUserSeed: () => 5,
    onStorageError: jest.fn(),
    now: () => clock,
    newDeviceId: () => 'phone',
  });
}

describe('showing the level to friends', () => {
  it('is on at the first launch, and the person can switch it off and on', () => {
    const store = createTestAppStore();
    expect(store.getState().settings.showLevel).toBe(true);
    store.getState().setShowLevel(false);
    expect(store.getState().settings.showLevel).toBe(false);
    store.getState().setShowLevel(true);
    expect(store.getState().settings.showLevel).toBe(true);
  });

  it('refuses anything but true or false', () => {
    const store = createTestAppStore();
    expect(() => store.getState().setShowLevel('no' as unknown as boolean)).toThrow(TypeError);
    expect(store.getState().settings.showLevel).toBe(true);
  });

  it('follows the person to their other phones: the latest choice wins', async () => {
    const { store } = await load();
    store.getState().syncStartAccount('user-1');
    clock += 1;
    store.getState().setShowLevel(false);
    expect(store.getState().sync.outbox).toContainEqual(
      expect.objectContaining({ kind: 'setting', key: 'showLevel', value: false }),
    );
    store
      .getState()
      .syncReceive(
        [{ kind: 'setting', key: 'showLevel', value: true, at: 90_000, device: 'tablet' }],
        1,
        clock,
      );
    expect(store.getState().settings.showLevel).toBe(true);
  });
});

describe('the last khatma celebrated', () => {
  it('is none at the first launch and only goes up', () => {
    const store = createTestAppStore();
    expect(store.getState().settings.celebratedKhatm).toBe(0);
    store.getState().markKhatmaCelebrated(2);
    expect(store.getState().settings.celebratedKhatm).toBe(2);
    const before = store.getState().settings;
    store.getState().markKhatmaCelebrated(1);
    store.getState().markKhatmaCelebrated(2);
    expect(store.getState().settings).toBe(before);
  });

  it('refuses a number that is not a khatma', () => {
    const store = createTestAppStore();
    for (const khatm of [0, -1, 1.5, Number.NaN]) {
      expect(() => store.getState().markKhatmaCelebrated(khatm)).toThrow(RangeError);
    }
  });

  it('a celebration seen on another phone is not shown again here; a lower one changes nothing', async () => {
    const { store } = await load();
    store.getState().syncStartAccount('user-1');
    store
      .getState()
      .syncReceive(
        [{ kind: 'setting', key: 'celebratedKhatm', value: 3, at: 50_000, device: 'tablet' }],
        1,
        clock,
      );
    expect(store.getState().settings.celebratedKhatm).toBe(3);
    store
      .getState()
      .syncReceive(
        [{ kind: 'setting', key: 'celebratedKhatm', value: 1, at: 90_000, device: 'tablet' }],
        2,
        clock,
      );
    expect(store.getState().settings.celebratedKhatm).toBe(3);
  });
});
