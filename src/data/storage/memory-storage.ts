import type { KeyValueStorage } from '@/store';

/** A storage that also lets its content be read at once, to check what was written. */
export interface MemoryStorage extends KeyValueStorage {
  /** The text kept under `key` right now, or null. */
  peek: (key: string) => string | null;
}

/**
 * A storage that lives in memory and is lost with it: for tests, and for a platform that has no
 * storage. `initial` is what it holds at first, as `{ key: text }`.
 */
export function createMemoryStorage(initial: Readonly<Record<string, string>> = {}): MemoryStorage {
  const items = new Map<string, string>(Object.entries(initial));
  return {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value);
    },
    removeItem: async (key) => {
      items.delete(key);
    },
    peek: (key) => items.get(key) ?? null,
  };
}
