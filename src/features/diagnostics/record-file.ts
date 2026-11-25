/**
 * Where the record of the last fatal error lives: one small text file of the app. Its three
 * operations are synchronous on purpose. The record is written from the global error handler,
 * a moment before the app ends: an asynchronous write (AsyncStorage) would never finish.
 */
export interface RecordFile {
  /** The text, or null when there is none. May throw: the caller must not depend on it. */
  read: () => string | null;
  write: (text: string) => void;
  remove: () => void;
}

/** A file in memory, for tests. */
export function createMemoryRecordFile(initial: string | null = null): RecordFile {
  let content = initial;
  return {
    read: () => content,
    write: (text) => {
      content = text;
    },
    remove: () => {
      content = null;
    },
  };
}
