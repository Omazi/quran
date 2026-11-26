/**
 * The reminders as notifications: the plan of the reminders module, kept scheduled on the phone,
 * and what a tap on a notification opens. See docs/specs/reminders.md.
 */

export { AL_KAHF_PAGE } from './config';
export { hrefOfTarget, type NotificationHref } from './notification-routes';
export { buildReminderInput, buildReminderResume, type ReminderSource } from './reminder-input';
export {
  REMINDER_COPY_SOURCES,
  reminderText,
  type ReminderResume,
  type ReminderTextData,
} from './reminder-copy';
export { useNotificationTaps, type NotificationTapsDependencies } from './use-notification-taps';
export {
  momentOf,
  useReminderSync,
  type Clock,
  type ReminderSyncDependencies,
} from './use-reminder-sync';
export { buildWantedNotifications, notificationLabels, slotMoment } from './wanted-notifications';
