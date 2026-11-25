import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  DEFAULT_ACTION_IDENTIFIER,
  getLastNotificationResponseAsync,
  type NotificationResponse,
} from 'expo-notifications';

import { isNotificationTarget } from '@/domain/reminders';

import type { NotificationTap, SubscribeToNotificationTaps } from './types';

/** The tap in a response, or null for something the app did not schedule or another action. */
export function tapOf(response: NotificationResponse): NotificationTap | null {
  if (response.actionIdentifier !== DEFAULT_ACTION_IDENTIFIER) return null;
  const { request } = response.notification;
  const target: unknown = request.content.data?.target;
  if (!isNotificationTarget(target)) return null;
  return { key: `${request.identifier}@${response.notification.date}`, target };
}

/**
 * Taps on the notifications of the app: those that come while it runs, and the one that opened
 * it. A tap that both ways report is handled once.
 */
export const subscribeToExpoNotificationTaps: SubscribeToNotificationTaps = (onTap) => {
  let isActive = true;
  const handled = new Set<string>();
  const handle = (response: NotificationResponse) => {
    const tap = tapOf(response);
    if (!isActive || tap === null || handled.has(tap.key)) return;
    handled.add(tap.key);
    onTap(tap);
  };

  const subscription = addNotificationResponseReceivedListener(handle);
  getLastNotificationResponseAsync().then(
    (response) => {
      if (response === null) return;
      handle(response);
      // Done with it: a later subscription (a remount) must not open the same page again.
      clearLastNotificationResponse();
    },
    () => {},
  );
  return () => {
    isActive = false;
    subscription.remove();
  };
};
