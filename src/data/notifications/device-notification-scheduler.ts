import { expoNotificationScheduler } from './expo-notification-scheduler';
import type { NotificationScheduler } from './types';

/** The scheduler of this device. The web has its own file, picked by its name. */
export const deviceNotificationScheduler: NotificationScheduler = expoNotificationScheduler;
