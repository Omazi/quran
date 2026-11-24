import type { ProgressBackup } from '@/store';

/** A copy that also lets its text be read at once, to check what was written. */
export interface MemoryProgressBackup extends ProgressBackup {
  /** The text of the copy right now, or null. */
  peek: () => string | null;
}

/** A copy that lives in memory, for tests. `initial` is the text it holds at first. */
export function createMemoryProgressBackup(initial: string | null = null): MemoryProgressBackup {
  let document = initial;
  return {
    read: async () => document,
    write: async (next) => {
      document = next;
    },
    peek: () => document,
  };
}
