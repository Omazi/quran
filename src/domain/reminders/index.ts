/**
 * Public API of the reminders module. Everything else in this folder is private.
 * See README.md for the model and the decisions taken on the specification.
 */
export { planReminders } from './plan-reminders';
export { copyVariantIndex, readingGoalOn, type ReadingGoalOfDay } from './reminder-copy';
export {
  buildNotificationSlots,
  diffNotifications,
  isNotificationTarget,
  isReminderIdentifier,
  notificationSignature,
  notificationTargetOf,
} from './notification-schedule';
export type {
  NotificationDiff,
  NotificationRef,
  NotificationSlot,
  NotificationTarget,
} from './notification-schedule';
export { REMINDER_PRIORITY, REMINDERS_CONFIG } from './config';
export type {
  GardenReminderKind,
  LocalMoment,
  QuietHours,
  ReadingReminderKind,
  Reminder,
  ReminderGardenInput,
  ReminderKind,
  ReminderParams,
  ReminderPlan,
  ReminderSettings,
  RemindersInput,
  TimeOfDay,
} from './types';
