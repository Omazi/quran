import {
  getPermissionsAsync,
  IosAuthorizationStatus,
  PermissionStatus,
  requestPermissionsAsync,
  type NotificationPermissionsStatus,
} from 'expo-notifications';

import type { NotificationPermissionStatus, NotificationPermissions } from './types';

/**
 * On iOS a provisional or ephemeral authorisation also lets notifications through, although
 * `granted` is then false (expo-notifications, "Interpret the iOS permissions response").
 */
const IOS_STATUSES_THAT_NOTIFY: readonly IosAuthorizationStatus[] = [
  IosAuthorizationStatus.AUTHORIZED,
  IosAuthorizationStatus.PROVISIONAL,
  IosAuthorizationStatus.EPHEMERAL,
];

function toStatus(response: NotificationPermissionsStatus): NotificationPermissionStatus {
  if (response.granted) return 'granted';
  if (response.ios !== undefined && IOS_STATUSES_THAT_NOTIFY.includes(response.ios.status)) {
    return 'granted';
  }
  return response.status === PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied';
}

/**
 * The permission to notify on a phone, through expo-notifications. Only local notifications are
 * concerned: the app asks for no push token, so nothing is sent to a server.
 */
export const expoNotificationPermissions: NotificationPermissions = {
  getStatus: async () => toStatus(await getPermissionsAsync()),
  // The reminders are alerts with a sound; the app shows no badge.
  request: async () =>
    toStatus(
      await requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      }),
    ),
};
