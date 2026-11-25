import { render, screen, act } from '@testing-library/react-native';

import type { SyncStatus } from '@/data/sync';
import { initI18n, type AppLanguage } from '@/i18n';
import { GroupedList } from '@/ui';

import { SyncProvider, type SyncStatusSource } from '../sync-context';
import { SyncStatusSection } from '../sync-status-section';
import { describeSyncStatus } from '../sync-status-model';

// The first render loads the whole design system: slow on a busy machine.
jest.setTimeout(30_000);

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

function source(initial: SyncStatus) {
  let status = initial;
  const listeners = new Set<(status: SyncStatus) => void>();
  const value: SyncStatusSource & { set: (next: SyncStatus) => void } = {
    getStatus: () => status,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      status = next;
      for (const listener of listeners) listener(next);
    },
  };
  return value;
}

async function show(status: SyncStatus | null, language: AppLanguage = 'fr') {
  initI18n(language);
  const fake = status === null ? null : source(status);
  await render(
    <SyncProvider source={fake}>
      <GroupedList>
        <SyncStatusSection clock={() => NOW} />
      </GroupedList>
    </SyncProvider>,
  );
  return fake;
}

describe('what the backup row says', () => {
  it.each([
    [{ state: 'local-only' }, null],
    [{ state: 'syncing', lastSyncedAt: null }, { key: 'syncing' }],
    [{ state: 'synced', lastSyncedAt: NOW - 10_000 }, { key: 'justNow' }],
    [
      { state: 'synced', lastSyncedAt: NOW - 2 * MINUTE },
      { key: 'minutes', count: 2 },
    ],
    [
      { state: 'synced', lastSyncedAt: NOW - 3 * 60 * MINUTE },
      { key: 'hours', count: 3 },
    ],
    [
      { state: 'synced', lastSyncedAt: NOW - 50 * 60 * MINUTE },
      { key: 'days', count: 2 },
    ],
    [{ state: 'synced', lastSyncedAt: NOW + 5_000 }, { key: 'justNow' }],
    [{ state: 'offline', lastSyncedAt: null, pending: 3 }, { key: 'offline' }],
    [{ state: 'waiting', lastSyncedAt: null, pending: 3 }, { key: 'waiting' }],
  ] as const)('%j', (status, expected) => {
    expect(describeSyncStatus(status, NOW)).toEqual(expected);
  });
});

describe('the backup section of the settings', () => {
  it('without a sync, says the progress is saved on this phone, and nothing more', async () => {
    await show(null);
    expect(screen.getByText('Sauvegarde')).toBeTruthy();
    expect(screen.getByText('Sauvegardé sur ce téléphone')).toBeTruthy();
    expect(screen.queryByText(/ynchronis/)).toBeNull();
  });

  it('says when it last synced, and follows the changes', async () => {
    const fake = await show({ state: 'synced', lastSyncedAt: NOW - 2 * MINUTE });
    expect(screen.getByText('Synchronisé il y a 2 min')).toBeTruthy();
    await act(async () => fake?.set({ state: 'offline', lastSyncedAt: null, pending: 1 }));
    expect(screen.getByText('Hors ligne — sera synchronisé')).toBeTruthy();
  });

  it.each([
    ['en', 'Saved on this phone', 'Synced 2 min ago'],
    ['ar', 'محفوظ على هذا الهاتف', 'تمت المزامنة قبل دقيقتين'],
  ] as const)('speaks %s', async (language, onPhone, synced) => {
    await show({ state: 'synced', lastSyncedAt: NOW - 2 * MINUTE }, language);
    expect(screen.getByText(onPhone)).toBeTruthy();
    expect(screen.getByText(synced)).toBeTruthy();
  });
});
