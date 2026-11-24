import type { NotificationPermissions } from '@/data/notifications';
import {
  SUPPORTED_LANGUAGES,
  getDisplayedLanguage,
  setDisplayedLanguage,
  type AppLanguage,
} from '@/i18n';
import { useAppStore, type DataResetNotice, type ReminderSettings } from '@/store';

import { useDailyGoal, type DailyGoalModel } from './daily-goal';
import { useReminders, type RemindersModel } from './reminders';
import {
  chooseDirectionFor,
  isLaidOutFor,
  type WritingDirectionPlatform,
} from './writing-direction';

/** What the language rows show. */
export interface LanguageModel {
  readonly selected: AppLanguage;
  readonly options: readonly AppLanguage[];
  /**
   * True when the selected language is written in the other direction than the running app: the
   * texts are already in that language, the layout will only follow after a restart.
   */
  readonly needsRestart: boolean;
}

/** What the settings screen shows. */
export interface SettingsModel {
  /**
   * Set when stored data could not be read back and started again from nothing: the screen says
   * so, once, until the person has read it.
   */
  readonly dataResetNotice: DataResetNotice | null;
  readonly language: LanguageModel;
  readonly dailyGoal: DailyGoalModel;
  readonly reminders: RemindersModel;
}

/** What the person can do on the settings screen. */
export interface SettingsActions {
  dismissDataResetNotice: () => void;
  selectLanguage: (language: AppLanguage) => void;
  restartApp: () => void;
  setDailyGoalPages: (pages: number) => void;
  changeReminders: (change: Partial<ReminderSettings>) => void;
  /** Makes the system ask for the permission to notify, when it was never asked. */
  requestNotificationPermission: () => void;
  openSystemSettings: () => void;
  replayIntroduction: () => void;
}

export interface SettingsDependencies {
  readonly notifications: NotificationPermissions;
  readonly direction: WritingDirectionPlatform;
  /** Opens the system's settings of the app. */
  readonly openSystemSettings: () => void;
  /** Shows the first-launch flow again. */
  readonly openIntroduction: () => void;
}

/** Builds the model and the actions of the settings screen. */
export function useSettings({
  notifications,
  direction,
  openSystemSettings,
  openIntroduction,
}: SettingsDependencies): { model: SettingsModel; actions: SettingsActions } {
  const savedLanguage = useAppStore((state) => state.settings.language);
  const saveLanguage = useAppStore((state) => state.setLanguage);
  const dataResetNotice = useAppStore((state) => state.dataResetNotice);
  const dismissDataResetNotice = useAppStore((state) => state.dismissDataResetNotice);
  const selected = savedLanguage ?? getDisplayedLanguage();
  const dailyGoal = useDailyGoal();
  const reminders = useReminders({ notifications, asks: 'on-enable' });

  return {
    model: {
      dataResetNotice,
      language: {
        selected,
        options: SUPPORTED_LANGUAGES,
        // The direction of the running app is fixed: only a restart can bring it in line.
        needsRestart: !isLaidOutFor(selected, direction),
      },
      dailyGoal: dailyGoal.model,
      reminders: reminders.model,
    },
    actions: {
      dismissDataResetNotice,
      selectLanguage: (language) => {
        saveLanguage(language);
        // The texts change at once, so that the person can read what follows in the language
        // they chose; the layout follows only if its direction is already the right one.
        setDisplayedLanguage(language);
        chooseDirectionFor(language, direction);
      },
      restartApp: () => {
        direction.restart().catch((error: unknown) => {
          // The note and the button stay: the direction still applies at the next start.
          console.warn('The app could not restart.', error);
        });
      },
      setDailyGoalPages: dailyGoal.setPages,
      changeReminders: reminders.change,
      requestNotificationPermission: () => {
        void reminders.requestPermission();
      },
      openSystemSettings,
      replayIntroduction: openIntroduction,
    },
  };
}
