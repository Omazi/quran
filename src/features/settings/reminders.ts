import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { NotificationPermissionStatus, NotificationPermissions } from '@/data/notifications';
import { useAppStore, type ReminderSettings } from '@/store';

/** The permission as a screen knows it: `unknown` until the system has answered. */
export type NotificationPermissionState = NotificationPermissionStatus | 'unknown';

/**
 * What the person must be told under the reminders, so that the switches never promise a
 * notification that cannot come. `denied`: reminders are on but the system blocks them.
 * `not-asked`: reminders are on but the system was never asked (the introduction was skipped
 * because the progress came back from its copy, or its request was never shown).
 * `none-enabled`: every reminder is off.
 */
export type ReminderNotice = 'denied' | 'not-asked' | 'none-enabled';

/** What the reminders section shows. */
export interface RemindersModel extends ReminderSettings {
  readonly notice: ReminderNotice | null;
}

export function hasReminderEnabled(reminders: ReminderSettings): boolean {
  return reminders.dailyEnabled || reminders.thirstyGardenEnabled || reminders.fridayKahfEnabled;
}

export function reminderNotice(
  reminders: ReminderSettings,
  permission: NotificationPermissionState,
): ReminderNotice | null {
  if (!hasReminderEnabled(reminders)) return 'none-enabled';
  if (permission === 'denied') return 'denied';
  if (permission === 'undetermined') return 'not-asked';
  return null;
}

/** Whether a change switches on a reminder that was off. */
function turnsReminderOn(current: ReminderSettings, change: Partial<ReminderSettings>): boolean {
  return (
    (change.dailyEnabled === true && !current.dailyEnabled) ||
    (change.thirstyGardenEnabled === true && !current.thirstyGardenEnabled) ||
    (change.fridayKahfEnabled === true && !current.fridayKahfEnabled)
  );
}

export interface UseRemindersOptions {
  readonly notifications: NotificationPermissions;
  /**
   * `on-enable`: switching a reminder on asks for the permission at once, in context (the
   * settings). `on-request`: the screen asks later, with `requestPermission` (the first-launch
   * flow, whose last button announces it).
   */
  readonly asks: 'on-enable' | 'on-request';
}

export interface UseRemindersResult {
  readonly model: RemindersModel;
  readonly change: (change: Partial<ReminderSettings>) => void;
  /**
   * True when `requestPermission` would show the system's alert: the screen asks later, a
   * reminder is on, and the person has not been asked yet. The screen must then announce it.
   */
  readonly willAskPermission: boolean;
  /**
   * Shows the system's alert when the person has not been asked yet and a reminder is on.
   * Resolves once the person has answered.
   */
  readonly requestPermission: () => Promise<void>;
}

/** The reminders of the person and the permission to notify, ready for `RemindersSection`. */
export function useReminders({ notifications, asks }: UseRemindersOptions): UseRemindersResult {
  const reminders = useAppStore((state) => state.settings.reminders);
  const updateReminders = useAppStore((state) => state.updateReminders);
  const [permission, setPermission] = useState<NotificationPermissionState>('unknown');
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const show = (state: NotificationPermissionState) => {
      if (isMounted) setPermission(state);
    };
    // A system that cannot answer leaves the state unknown: no notice is shown about it.
    const read = () => {
      notifications.getStatus().then(show, () => show('unknown'));
    };
    read();
    // The person may change the permission in the system's settings and come back.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [notifications]);

  const ask = async () => {
    if (isAsking) return;
    setIsAsking(true);
    try {
      setPermission(await notifications.request());
    } catch {
      setPermission('unknown');
    } finally {
      setIsAsking(false);
    }
  };

  const canAsk = permission === 'undetermined' && hasReminderEnabled(reminders);
  const willAskPermission = asks === 'on-request' && canAsk;
  const notice = reminderNotice(reminders, permission);
  // Nothing to say about a request that is being shown, or that the screen itself announces.
  const isRequestExpected = isAsking || asks === 'on-request';

  return {
    model: { ...reminders, notice: notice === 'not-asked' && isRequestExpected ? null : notice },
    change: (reminderChange) => {
      const turnsOn = turnsReminderOn(reminders, reminderChange);
      updateReminders(reminderChange);
      if (asks === 'on-enable' && turnsOn && permission === 'undetermined') void ask();
    },
    willAskPermission,
    requestPermission: async () => {
      if (canAsk) await ask();
    },
  };
}
