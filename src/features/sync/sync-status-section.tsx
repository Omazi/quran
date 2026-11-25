import { useTranslation } from 'react-i18next';

import { ListRow, ListSection } from '@/ui';

import { useNow, useSyncStatus } from './sync-context';
import { describeSyncStatus } from './sync-status-model';

const REFRESH_MS = 30_000;

export interface SyncStatusSectionProps {
  /** The clock, for tests. Defaults to `Date.now`. */
  readonly clock?: () => number;
}

/**
 * The backup, in one calm row of the settings (docs/specs/sync.md, 5): the progress is always
 * saved on the phone; the footer says where the account stands, when there is one. Nothing to
 * press: the sync needs nothing from the person (settings.md › Best practices).
 */
export function SyncStatusSection({ clock }: SyncStatusSectionProps) {
  const { t } = useTranslation('sync');
  const status = useSyncStatus();
  const now = useNow(REFRESH_MS, clock);
  const line = describeSyncStatus(status, now);
  const footer =
    line === null
      ? undefined
      : 'count' in line
        ? t(`status.${line.key}`, { count: line.count })
        : t(`status.${line.key}`);
  return (
    <ListSection title={t('title')} footer={footer}>
      <ListRow label={t('onPhone')} testID="sync-status" />
    </ListSection>
  );
}
