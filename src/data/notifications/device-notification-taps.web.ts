import type { SubscribeToNotificationTaps } from './types';

/** On the web there is no notification to tap. */
export const subscribeToDeviceNotificationTaps: SubscribeToNotificationTaps = () => () => {};
