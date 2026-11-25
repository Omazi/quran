import { subscribeToExpoNotificationTaps } from './expo-notification-taps';
import type { SubscribeToNotificationTaps } from './types';

/** Taps on the notifications of this device. The web has its own file, picked by its name. */
export const subscribeToDeviceNotificationTaps: SubscribeToNotificationTaps =
  subscribeToExpoNotificationTaps;
