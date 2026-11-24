import type { ProgressBackup } from '@/store';

/**
 * A copy that keeps nothing: for the web, for a phone without the iCloud module, and wherever the
 * copy is switched off. Reading finds no copy and writing is quietly lost, so nothing breaks and
 * nothing is asked of the person.
 */
export const inertProgressBackup: ProgressBackup = {
  read: async () => null,
  write: async () => {},
};
