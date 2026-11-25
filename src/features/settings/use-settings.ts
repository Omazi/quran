import type { NotificationPermissions } from '@/data/notifications';
import {
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  resolveLanguage,
  setDisplayedLanguage,
  type AppLanguage,
} from '@/i18n';
import { useAppStore, type DataResetNotice, type ReminderSettings } from '@/store';

import { useDailyGoal, type DailyGoalModel } from './daily-goal';
import { readDeviceLanguageCodes } from './device-languages';
import { useReminders, type RemindersModel } from './reminders';
import {
  chooseDirectionFor,
  isLaidOutFor,
  type WritingDirectionPlatform,
} from './writing-direction';

/** The option that follows the phone's language: nothing is chosen in the app (D32). */
export const DEVICE_LANGUAGE = 'device';

/** An option of the language setting: the phone's language, or one of the app's. */
export type LanguageChoice = typeof DEVICE_LANGUAGE | AppLanguage;

/** The options, the phone's language first: it is the default (pop-up-buttons.md › Best practices). */
export const LANGUAGE_CHOICES: readonly LanguageChoice[] = [
  DEVICE_LANGUAGE,
  ...SUPPORTED_LANGUAGES,
];

/** What the language rows show. */
export interface LanguageModel {
  readonly selected: LanguageChoice;
  readonly options: readonly LanguageChoice[];
  /**
   * True when the language shown is written in the other direction than the running app: the
   * texts are already in that language, the layout will only follow after a restart.
   */
  readonly needsRestart: boolean;
  /**
   * True when the app follows the phone but has none of its languages, and so shows its fallback
   * language.
   */
  readonly isDeviceLanguageMissing: boolean;
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
  selectLanguage: (choice: LanguageChoice) => void;
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
  /**
   * The languages of the phone, most wanted first, as language codes ("fr", "ar"). Defaults to
   * the phone's own, read the same way as at start-up.
   */
  readonly getDeviceLanguageCodes?: () => readonly (string | null)[];
  /** Opens the system's settings of the app. */
  readonly openSystemSettings: () => void;
  /** Shows the first-launch flow again. */
  readonly openIntroduction: () => void;
}

/** Builds the model and the actions of the settings screen. */
export function useSettings({
  notifications,
  direction,
  getDeviceLanguageCodes = readDeviceLanguageCodes,
  openSystemSettings,
  openIntroduction,
}: SettingsDependencies): { model: SettingsModel; actions: SettingsActions } {
  const savedLanguage = useAppStore((state) => state.settings.language);
  const saveLanguage = useAppStore((state) => state.setLanguage);
  const dataResetNotice = useAppStore((state) => state.dataResetNotice);
  const dismissDataResetNotice = useAppStore((state) => state.dismissDataResetNotice);
  const dailyGoal = useDailyGoal();
  const reminders = useReminders({ notifications, asks: 'on-enable' });

  // Read at each render: the phone's languages are its own, and may change while the app runs.
  const deviceLanguageCodes = getDeviceLanguageCodes();
  // The language the app shows, worked out exactly as at start-up.
  const shown = resolveLanguage(savedLanguage, deviceLanguageCodes);
  const hasDeviceLanguage = deviceLanguageCodes.some(
    (code) => code !== null && isSupportedLanguage(code),
  );

  return {
    model: {
      dataResetNotice,
      language: {
        selected: savedLanguage ?? DEVICE_LANGUAGE,
        options: LANGUAGE_CHOICES,
        // The direction of the running app is fixed: only a restart can bring it in line.
        needsRestart: !isLaidOutFor(shown, direction),
        isDeviceLanguageMissing: savedLanguage === null && !hasDeviceLanguage,
      },
      dailyGoal: dailyGoal.model,
      reminders: reminders.model,
    },
    actions: {
      dismissDataResetNotice,
      selectLanguage: (choice) => {
        const chosen = choice === DEVICE_LANGUAGE ? null : choice;
        saveLanguage(chosen);
        const language = resolveLanguage(chosen, getDeviceLanguageCodes());
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
