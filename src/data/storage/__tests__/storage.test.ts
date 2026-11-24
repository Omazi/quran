import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStorage } from '@/store';

import { createMemoryStorage, deviceStorage } from '..';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const IMPLEMENTATIONS: readonly (readonly [string, () => KeyValueStorage])[] = [
  ['the memory storage', () => createMemoryStorage()],
  ['the device storage', () => deviceStorage],
];

describe.each(IMPLEMENTATIONS)('%s', (_name, create) => {
  beforeEach(() => AsyncStorage.clear());

  it('has nothing under a key never written', async () => {
    await expect(create().getItem('missing')).resolves.toBeNull();
  });

  it('gives back the text it was given, exactly', async () => {
    const storage = create();
    const text = JSON.stringify({
      language: 'ar',
      label: 'العربية',
      note: 'd’où vient ce passage ?',
    });
    await storage.setItem('key', text);
    await expect(storage.getItem('key')).resolves.toBe(text);
  });

  it('replaces the text of a key and keeps the other keys', async () => {
    const storage = create();
    await storage.setItem('first', 'a');
    await storage.setItem('second', 'b');
    await storage.setItem('first', 'c');
    await expect(storage.getItem('first')).resolves.toBe('c');
    await expect(storage.getItem('second')).resolves.toBe('b');
  });

  it('forgets a removed key, and removing a missing key is not an error', async () => {
    const storage = create();
    await storage.setItem('key', 'a');
    await storage.removeItem('key');
    await storage.removeItem('never-written');
    await expect(storage.getItem('key')).resolves.toBeNull();
  });

  it('resolves writes and removals with nothing', async () => {
    const storage = create();
    await expect(storage.setItem('key', 'a')).resolves.toBeUndefined();
    await expect(storage.removeItem('key')).resolves.toBeUndefined();
  });
});

describe('memory storage', () => {
  it('starts with the content it is given and lets it be read at once', async () => {
    const storage = createMemoryStorage({ key: 'a' });
    expect(storage.peek('key')).toBe('a');
    expect(storage.peek('other')).toBeNull();
    await storage.setItem('other', 'b');
    expect(storage.peek('other')).toBe('b');
  });

  it('shares nothing between two storages', async () => {
    const first = createMemoryStorage();
    const second = createMemoryStorage();
    await first.setItem('key', 'a');
    await expect(second.getItem('key')).resolves.toBeNull();
  });
});

describe('device storage', () => {
  it('passes a failure of the device on to its caller', async () => {
    const failure = new Error('disk full');
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(failure);
    await expect(deviceStorage.setItem('key', 'a')).rejects.toBe(failure);
  });
});
