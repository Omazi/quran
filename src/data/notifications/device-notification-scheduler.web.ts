import { createInertNotificationScheduler } from './inert-notification-scheduler';
import type { NotificationScheduler } from './types';

/** On the web the app sends no notification: scheduling holds nothing. */
export const deviceNotificationScheduler: NotificationScheduler =
  createInertNotificationScheduler();
