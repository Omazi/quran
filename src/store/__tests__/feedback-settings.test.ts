/**
 * The two switches "Sons" and "Vibrations" (owner's "wow" experience, 27 November 2026): both on
 * by default, kept on the device, and synced with the account (the latest choice wins).
 */
import { createMemoryStorage } from '@/data/storage';

import { loadAppStore } from '../app-store';
import { createTestAppStore } from '../test-support/test-store';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let clock = 10_000;

function load(storage = createMemoryStorage()) {
  return loadAppStore({
    storage,
    drawUserSeed: () => 5,
    onStorageError: jest.fn(),
    now: () => clock,
    newDeviceId: () => 'phone',
  });
}

describe('sounds and vibrations', () => {
  it('are both on at the first launch', () => {
    const { settings } = createTestAppStore().getState();
    expect(settings.soundsEnabled).toBe(true);
    expect(settings.hapticsEnabled).toBe(true);
  });

  it('are switched one at a time', () => {
    const store = createTestAppStore();
    store.getState().setSoundsEnabled(false);
    expect(store.getState().settings).toMatchObject({ soundsEnabled: false, hapticsEnabled: true });
    store.getState().setHapticsEnabled(false);
    expect(store.getState().settings).toMatchObject({
      soundsEnabled: false,
      hapticsEnabled: false,
    });
    store.getState().setSoundsEnabled(true);
    expect(store.getState().settings).toMatchObject({ soundsEnabled: true, hapticsEnabled: false });
  });

  it('change nothing, and write nothing, when set to what they already are', () => {
    const store = createTestAppStore();
    const before = store.getState().settings;
    store.getState().setSoundsEnabled(true);
    store.getState().setHapticsEnabled(true);
    expect(store.getState().settings).toBe(before);
  });

  it('refuse anything but true or false', () => {
    const store = createTestAppStore();
    expect(() => store.getState().setSoundsEnabled('no' as unknown as boolean)).toThrow(TypeError);
    expect(() => store.getState().setHapticsEnabled(undefined as unknown as boolean)).toThrow(
      TypeError,
    );
    expect(store.getState().settings).toMatchObject({ soundsEnabled: true, hapticsEnabled: true });
  });

  it('are written to the device and read back at the next launch', async () => {
    const storage = createMemoryStorage();
    const first = await load(storage);
    first.store.getState().setSoundsEnabled(false);
    await first.store.whenSaved();

    const second = await load(storage);
    expect(second.store.getState().settings).toMatchObject({
      soundsEnabled: false,
      hapticsEnabled: true,
    });
  });
});

describe('sounds and vibrations follow the person to their other phones', () => {
  it('send the setting that changed', async () => {
    const { store } = await load();
    store.getState().syncStartAccount('user-1');
    clock += 1;
    store.getState().setHapticsEnabled(false);
    expect(store.getState().sync.outbox).toContainEqual(
      expect.objectContaining({ kind: 'setting', key: 'hapticsEnabled', value: false }),
    );
  });

  it('the latest choice wins, in whichever order the events arrive', async () => {
    const { store } = await load();
    store.getState().syncStartAccount('user-1');
    const receive = (value: boolean, at: number, cursor: number) =>
      store
        .getState()
        .syncReceive(
          [{ kind: 'setting', key: 'soundsEnabled', value, at, device: 'tablet' }],
          cursor,
          clock,
        );
    receive(false, 90_000, 1);
    expect(store.getState().settings.soundsEnabled).toBe(false);
    // An older "on" that arrives late does not undo the newer "off".
    receive(true, 60_000, 2);
    expect(store.getState().settings.soundsEnabled).toBe(false);
    receive(true, 95_000, 3);
    expect(store.getState().settings.soundsEnabled).toBe(true);
  });

  it('refuse a value that is not true or false: the current one stays', async () => {
    const { store } = await load();
    store.getState().syncStartAccount('user-1');
    store
      .getState()
      .syncReceive(
        [{ kind: 'setting', key: 'hapticsEnabled', value: 'off', at: 50_000, device: 'tablet' }],
        1,
        clock,
      );
    expect(store.getState().settings.hapticsEnabled).toBe(true);
  });
});
