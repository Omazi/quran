import type { SyncStatus } from '@/data/sync';

/** The second line of the backup row: which text, and the number it counts. */
export type SyncStatusLine =
  | { readonly key: 'syncing' | 'justNow' | 'offline' | 'waiting' }
  | { readonly key: 'minutes' | 'hours' | 'days'; readonly count: number };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * What the backup row says under "Sauvegardé sur ce téléphone" (docs/specs/sync.md, 5): nothing
 * when the progress lives on this phone only, otherwise where the account stands, in words a
 * person reads at a glance (ux-writing: short, calm, no technical term, no alarm). A failure
 * other than the network is not detailed: the app tries again by itself.
 */
export function describeSyncStatus(status: SyncStatus, now: number): SyncStatusLine | null {
  switch (status.state) {
    case 'local-only':
      return null;
    case 'syncing':
      return { key: 'syncing' };
    case 'offline':
      return { key: 'offline' };
    case 'waiting':
      return { key: 'waiting' };
    case 'synced': {
      const elapsed = Math.max(0, now - status.lastSyncedAt);
      if (elapsed < MINUTE) return { key: 'justNow' };
      if (elapsed < HOUR) return { key: 'minutes', count: Math.floor(elapsed / MINUTE) };
      if (elapsed < DAY) return { key: 'hours', count: Math.floor(elapsed / HOUR) };
      return { key: 'days', count: Math.floor(elapsed / DAY) };
    }
  }
}
