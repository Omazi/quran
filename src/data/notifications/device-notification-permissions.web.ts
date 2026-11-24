import { createInertNotificationPermissions } from './inert-notification-permissions';
import type { NotificationPermissions } from './types';

/** On the web the app sends no notification: the permission is inert and reports `denied`. */
export const deviceNotificationPermissions: NotificationPermissions =
  createInertNotificationPermissions();
