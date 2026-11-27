/**
 * Where the phone keeps its account between two launches: one short text (the account id and
 * the refresh token, never the access token). On a phone it must be the keychain
 * (`docs/SECURITY.md`: session tokens in `expo-secure-store`, never in clear); the tests use the
 * memory one.
 */
export interface SessionStorage {
  /** The kept text, or null when there is none. Rejects when it cannot be read. */
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
}

/** A storage in memory: for tests, and for nothing else (it is lost when the app closes). */
export function createMemorySessionStorage(initial: string | null = null): SessionStorage {
  let value = initial;
  return {
    read: async () => value,
    write: async (next) => {
      value = next;
    },
    clear: async () => {
      value = null;
    },
  };
}
