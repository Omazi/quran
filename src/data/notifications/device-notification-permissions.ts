import { expoNotificationPermissions } from './expo-notification-permissions';
import type { NotificationPermissions } from './types';

/** The permission to notify of this device. The web has its own file, picked by its name. */
export const deviceNotificationPermissions: NotificationPermissions = expoNotificationPermissions;
