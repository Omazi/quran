/**
 * The gender the person says they have (owner decision of 26 November 2026, "on demandera le
 * genre"): kept in the settings, synced with the account (the latest choice wins), and whether
 * the question was already asked, so that it is never asked twice.
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

describe('the gender of the person', () => {
  it('is unspecified and not yet asked at the first launch', () => {
    const { settings } = createTestAppStore().getState();
    expect(settings.gender).toBeNull();
    expect(settings.genderAsked).toBe(false);
  });

  it('is set to male or female, and the question counts as asked', () => {
    const store = createTestAppStore();
    store.getState().setGender('female');
    expect(store.getState().settings).toMatchObject({ gender: 'female', genderAsked: true });
    store.getState().setGender('male');
    expect(store.getState().settings).toMatchObject({ gender: 'male', genderAsked: true });
  });

  it('"prefer not to say" is null, and it also counts as an answer', () => {
    const store = createTestAppStore({ settings: { gender: 'male', genderAsked: true } });
    store.getState().setGender(null);
    expect(store.getState().settings).toMatchObject({ gender: null, genderAsked: true });
    const fresh = createTestAppStore();
    fresh.getState().setGender(null);
    expect(fresh.getState().settings).toMatchObject({ gender: null, genderAsked: true });
  });

  it('the same answer again changes nothing at all', () => {
    const store = createTestAppStore({ settings: { gender: 'female', genderAsked: true } });
    const before = store.getState().settings;
    store.getState().setGender('female');
    expect(store.getState().settings).toBe(before);
  });

  it('refuses anything but male, female or null, and nothing changes', () => {
    const store = createTestAppStore();
    expect(() => store.getState().setGender('other' as unknown as 'male')).toThrow(RangeError);
    expect(() => store.getState().setGender(undefined as unknown as null)).toThrow(TypeError);
    expect(store.getState().settings).toMatchObject({ gender: null, genderAsked: false });
  });

  it('is written to the device and read back at the next launch', async () => {
    const storage = createMemoryStorage();
    const first = await load(storage);
    first.store.getState().setGender('female');
    await first.store.whenSaved();

    const second = await load(storage);
    expect(second.store.getState().settings).toMatchObject({ gender: 'female', genderAsked: true });
  });
});

describe('the gender follows the person to their other phones', () => {
  it('sends both the gender and the fact that it was asked', async () => {
    const { store } = await load();
    store.getState().syncStartAccount('user-1');
    clock += 1;
    store.getState().setGender('female');
    const { outbox } = store.getState().sync;
    expect(outbox).toContainEqual(
      expect.objectContaining({ kind: 'setting', key: 'gender', value: 'female' }),
    );
    expect(outbox).toContainEqual(
      expect.objectContaining({ kind: 'setting', key: 'genderAsked', value: true }),
    );
  });

  it('the latest choice wins, "prefer not to say" (null) included', async () => {
    const { store } = await load();
    store.getState().syncStartAccount('user-1');
    store
      .getState()
      .syncReceive(
        [{ kind: 'setting', key: 'gender', value: 'male', at: 50_000, device: 'tablet' }],
        1,
        clock,
      );
    expect(store.getState().settings.gender).toBe('male');
    store
      .getState()
      .syncReceive(
        [{ kind: 'setting', key: 'gender', value: null, at: 90_000, device: 'tablet' }],
        2,
        clock,
      );
    expect(store.getState().settings.gender).toBeNull();
    // An older choice that arrives late does not undo the newer one.
    store
      .getState()
      .syncReceive(
        [{ kind: 'setting', key: 'gender', value: 'female', at: 60_000, device: 'tablet' }],
        3,
        clock,
      );
    expect(store.getState().settings.gender).toBeNull();
  });

  it('refuses a gender that is neither male, female nor null: the current one stays', async () => {
    const { store } = await load();
    store.getState().syncStartAccount('user-1');
    store
      .getState()
      .syncReceive(
        [{ kind: 'setting', key: 'gender', value: 'robot', at: 50_000, device: 'tablet' }],
        1,
        clock,
      );
    expect(store.getState().settings.gender).toBeNull();
  });

  it('a question answered on one phone is not asked again on another, whatever the order', async () => {
    const { store } = await load();
    store.getState().syncStartAccount('user-1');
    store
      .getState()
      .syncReceive(
        [{ kind: 'setting', key: 'genderAsked', value: true, at: 50_000, device: 'tablet' }],
        1,
        clock,
      );
    expect(store.getState().settings.genderAsked).toBe(true);
    store
      .getState()
      .syncReceive(
        [{ kind: 'setting', key: 'genderAsked', value: false, at: 90_000, device: 'tablet' }],
        2,
        clock,
      );
    expect(store.getState().settings.genderAsked).toBe(true);
  });
});
