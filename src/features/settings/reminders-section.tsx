import { useTranslation } from 'react-i18next';

import type { ReminderSettings } from '@/store';
import { Button, ListSection, SwitchRow, TimePickerRow } from '@/ui';

import type { RemindersModel } from './reminders';

export interface RemindersSectionProps {
  model: RemindersModel;
  onChange: (change: Partial<ReminderSettings>) => void;
  /** Header of the section. Left out where the screen already names it. */
  title?: string;
  /**
   * Opens the system's settings of the app. Given where a way out to them is welcome: the row
   * then appears when the system blocks the notifications (settings.md › System settings).
   */
  onOpenSystemSettings?: () => void;
}

/**
 * The reminders: one switch each, in list rows (toggles.md › Mobile), and their times as compact
 * pickers (pickers.md › Mobile). A time is shown only while a reminder uses it: the daily
 * reminder and the garden's share one, Friday has its own. The note under the rows says what the
 * person cannot guess: that the system is about to ask, or that it blocks the notifications.
 * Place it in a `GroupedList`.
 */
export function RemindersSection({
  model,
  onChange,
  title,
  onOpenSystemSettings,
}: RemindersSectionProps) {
  const { t } = useTranslation('settings');
  const footer = model.notice === null ? undefined : t(`reminders.notice.${model.notice}`);
  return (
    <ListSection title={title} footer={footer}>
      <SwitchRow
        label={t('reminders.daily')}
        value={model.dailyEnabled}
        onChange={(dailyEnabled) => onChange({ dailyEnabled })}
        testID="reminder-daily"
      />
      <SwitchRow
        label={t('reminders.thirstyGarden')}
        value={model.thirstyGardenEnabled}
        onChange={(thirstyGardenEnabled) => onChange({ thirstyGardenEnabled })}
        testID="reminder-thirsty-garden"
      />
      {model.dailyEnabled || model.thirstyGardenEnabled ? (
        <TimePickerRow
          label={t('reminders.dailyTime')}
          value={model.dailyTime}
          onChange={(dailyTime) => onChange({ dailyTime })}
          testID="reminder-daily-time"
        />
      ) : null}
      <SwitchRow
        label={t('reminders.fridayKahf')}
        value={model.fridayKahfEnabled}
        onChange={(fridayKahfEnabled) => onChange({ fridayKahfEnabled })}
        testID="reminder-friday-kahf"
      />
      {model.fridayKahfEnabled ? (
        <TimePickerRow
          label={t('reminders.fridayTime')}
          value={model.fridayTime}
          onChange={(fridayTime) => onChange({ fridayTime })}
          testID="reminder-friday-time"
        />
      ) : null}
      {model.notice === 'denied' && onOpenSystemSettings !== undefined ? (
        <Button
          label={t('reminders.openSystemSettings')}
          variant="plain"
          onPress={onOpenSystemSettings}
          testID="open-system-settings"
        />
      ) : null}
    </ListSection>
  );
}
