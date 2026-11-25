import {
  AndroidImportance,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  scheduleNotificationAsync,
  setNotificationCategoryAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  SchedulableTriggerInputTypes,
} from 'expo-notifications';

import type { NotificationScheduler } from './types';

/** The channel of the reminders on Android (the system lists notifications by channel). */
export const REMINDERS_CHANNEL_ID = 'reminders';

/** iOS category of the Friday reminder: it names a sourate, so it has its own hidden-preview text. */
export const FRIDAY_CATEGORY_ID = 'friday-kahf';

let isHandlerSet = false;

/**
 * While the app is open the person is already where the reminder leads: it is not shown then.
 * The next opening plans again anyway.
 */
function stayQuietInTheForeground(): void {
  if (isHandlerSet) return;
  isHandlerSet = true;
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * The notifications of the phone, through expo-notifications: local ones, delivered by the
 * system at a date, with no server. The date trigger is an absolute moment, which is why the app
 * plans again whenever it opens, so a change of time zone or of clock is taken into account.
 */
export const expoNotificationScheduler: NotificationScheduler = {
  prepare: async ({ channelName, hiddenPreview }) => {
    stayQuietInTheForeground();
    await Promise.all([
      // Idempotent: it updates the name. The importance of an existing channel cannot change.
      setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
        name: channelName,
        importance: AndroidImportance.DEFAULT,
      }),
      setNotificationCategoryAsync(FRIDAY_CATEGORY_ID, [], { previewPlaceholder: hiddenPreview }),
    ]);
  },
  getPending: async () =>
    (await getAllScheduledNotificationsAsync()).map(({ identifier, content }) => {
      const signature: unknown = content.data?.signature;
      return { id: identifier, signature: typeof signature === 'string' ? signature : null };
    }),
  schedule: async ({ id, date, title, body, target, signature }) => {
    await scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        data: { target, signature },
        // The reminders are normal, never urgent (docs/specs/reminders.md).
        interruptionLevel: 'active',
        categoryIdentifier: target === 'al-kahf' ? FRIDAY_CATEGORY_ID : undefined,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date,
        channelId: REMINDERS_CHANNEL_ID,
      },
    });
  },
  cancel: async (ids) => {
    await Promise.all(ids.map((id) => cancelScheduledNotificationAsync(id)));
  },
};
