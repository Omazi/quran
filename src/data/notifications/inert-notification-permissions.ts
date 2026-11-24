import type { NotificationPermissionStatus, NotificationPermissions } from './types';

export interface InertNotificationPermissionsOptions {
  /** The state reported at first. Defaults to `denied`: nothing can be shown. */
  status?: NotificationPermissionStatus;
  /** What asking turns `undetermined` into, as the person's answer would. Defaults to `denied`. */
  answer?: Exclude<NotificationPermissionStatus, 'undetermined'>;
}

/**
 * A permission to notify that reaches no system: for the web, where the app sends no
 * notification, and for tests, which choose the state and the answer. Asking never shows
 * anything.
 */
export function createInertNotificationPermissions({
  status = 'denied',
  answer = 'denied',
}: InertNotificationPermissionsOptions = {}): NotificationPermissions {
  let current = status;
  return {
    getStatus: async () => current,
    request: async () => {
      if (current === 'undetermined') current = answer;
      return current;
    },
  };
}
