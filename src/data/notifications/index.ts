/**
 * Notifications: the permission to show them (docs/specs/ui-lot1.md, A.5) and the local reminders
 * the app schedules from the plan of the reminders module (docs/specs/reminders.md).
 */

export { deviceNotificationPermissions } from './device-notification-permissions';
export { deviceNotificationScheduler } from './device-notification-scheduler';
export { subscribeToDeviceNotificationTaps } from './device-notification-taps';
export {
  createInertNotificationPermissions,
  type InertNotificationPermissionsOptions,
} from './inert-notification-permissions';
export {
  createInertNotificationScheduler,
  type InertNotificationScheduler,
} from './inert-notification-scheduler';
export { subscribeToPermissionChanges } from './permission-changes';
export {
  createNotificationSync,
  type NotificationSync,
  type NotificationSyncDependencies,
  type NotificationSyncRequest,
  type NotificationSyncResult,
  type NotificationSyncStatus,
} from './sync-notifications';
export type {
  NotificationLabels,
  NotificationPermissionStatus,
  NotificationPermissions,
  NotificationScheduler,
  NotificationTap,
  NotificationToSchedule,
  PendingNotification,
  SubscribeToNotificationTaps,
} from './types';
