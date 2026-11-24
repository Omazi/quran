/**
 * Notifications: for now only the permission to show them (docs/specs/ui-lot1.md, A.5).
 * Scheduling the reminders comes with the reminders module (docs/specs/reminders.md).
 */

export { deviceNotificationPermissions } from './device-notification-permissions';
export {
  createInertNotificationPermissions,
  type InertNotificationPermissionsOptions,
} from './inert-notification-permissions';
export type { NotificationPermissionStatus, NotificationPermissions } from './types';
