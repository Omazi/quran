/**
 * Settings: the screen, the pieces the first-launch flow shares with it (daily goal, reminders),
 * and what applies the settings when the app starts (language, writing direction).
 * See docs/specs/ui-lot1.md, section A.
 */

export {
  describeDailyGoal,
  useDailyGoal,
  type DailyGoalModel,
  type DailyGoalPace,
  type GoalLandmark,
} from './daily-goal';
export { DailyGoalSection, type DailyGoalSectionProps } from './daily-goal-section';
export {
  hasReminderEnabled,
  reminderNotice,
  useReminders,
  type NotificationPermissionState,
  type ReminderNotice,
  type RemindersModel,
  type UseRemindersOptions,
  type UseRemindersResult,
} from './reminders';
export { RemindersSection, type RemindersSectionProps } from './reminders-section';
export { SettingsScreen, type SettingsScreenProps } from './settings-screen';
export {
  startApp,
  useAppStartup,
  type AppStartup,
  type StartedApp,
  type StartupDependencies,
} from './startup';
export { readDeviceLanguageCodes } from './device-languages';
export {
  DEVICE_LANGUAGE,
  LANGUAGE_CHOICES,
  useSettings,
  type LanguageChoice,
  type LanguageModel,
  type SettingsActions,
  type SettingsDependencies,
  type SettingsModel,
} from './use-settings';
export {
  DIRECTION_RESTART_KEY,
  RESTART_GRACE_MS,
  alignDirectionAtStartup,
  chooseDirectionFor,
  deviceWritingDirection,
  isLaidOutFor,
  type WritingDirectionPlatform,
} from './writing-direction';
