import type { NotificationPermissions } from '@/data/notifications';
import type { Gender } from '@/domain/shared/gender';
import { playFeedback } from '@/features/feedback';
import {
  SUPPORTED_LANGUAGES,
  getTranslator,
  isSupportedLanguage,
  resolveLanguage,
  setDisplayedLanguage,
  type AppLanguage,
} from '@/i18n';
import { useAppStore, useAppStoreApi, type DataResetNotice, type ReminderSettings } from '@/store';
import { confirmAction, type ConfirmAction } from '@/ui';

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

/** What the sound and vibration switches show. */
export interface FeedbackSettingsModel {
  readonly soundsEnabled: boolean;
  readonly hapticsEnabled: boolean;
}

/** What the settings screen shows. */
export interface SettingsModel {
  /**
   * Set when stored data could not be read back and started again from nothing: the screen says
   * so, once, until the person has read it.
   */
  readonly dataResetNotice: DataResetNotice | null;
  readonly language: LanguageModel;
  /** What the person says they are (null: prefer not to say, or not said yet). */
  readonly gender: Gender | null;
  readonly dailyGoal: DailyGoalModel;
  readonly reminders: RemindersModel;
  readonly feedback: FeedbackSettingsModel;
}

/** What the person can do on the settings screen. */
export interface SettingsActions {
  dismissDataResetNotice: () => void;
  selectLanguage: (choice: LanguageChoice) => void;
  /** Records what the person says they are, "prefer not to say" (null) included. */
  setGender: (gender: Gender | null) => void;
  restartApp: () => void;
  setDailyGoalPages: (pages: number) => void;
  changeReminders: (change: Partial<ReminderSettings>) => void;
  /** Switches the interface sounds; switching them on plays one, so that the person hears them. */
  setSoundsEnabled: (enabled: boolean) => void;
  /** Switches the interface vibrations; switching them on gives one, so that the person feels it. */
  setHapticsEnabled: (enabled: boolean) => void;
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
  /**
   * Asks before the restart a change of writing direction needs. Defaults to the system's
   * confirmation (`confirmAction`).
   */
  readonly confirm?: ConfirmAction;
}

/** Builds the model and the actions of the settings screen. */
export function useSettings({
  notifications,
  direction,
  getDeviceLanguageCodes = readDeviceLanguageCodes,
  openSystemSettings,
  openIntroduction,
  confirm = confirmAction,
}: SettingsDependencies): { model: SettingsModel; actions: SettingsActions } {
  const store = useAppStoreApi();
  const savedLanguage = useAppStore((state) => state.settings.language);
  const saveLanguage = useAppStore((state) => state.setLanguage);
  const gender = useAppStore((state) => state.settings.gender);
  const setGender = useAppStore((state) => state.setGender);
  const soundsEnabled = useAppStore((state) => state.settings.soundsEnabled);
  const hapticsEnabled = useAppStore((state) => state.settings.hapticsEnabled);
  const saveSoundsEnabled = useAppStore((state) => state.setSoundsEnabled);
  const saveHapticsEnabled = useAppStore((state) => state.setHapticsEnabled);
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
      gender,
      dailyGoal: dailyGoal.model,
      reminders: reminders.model,
      feedback: { soundsEnabled, hapticsEnabled },
    },
    actions: {
      dismissDataResetNotice,
      setGender,
      selectLanguage: (choice) => {
        const chosen = choice === DEVICE_LANGUAGE ? null : choice;
        const language = resolveLanguage(chosen, getDeviceLanguageCodes());
        if (isLaidOutFor(language, direction)) {
          // Same direction: the texts change at once, nothing else has to.
          saveLanguage(chosen);
          setDisplayedLanguage(language);
          chooseDirectionFor(language, direction);
          return;
        }
        // The other direction. React Native lays the app out once, at launch; switching the
        // texts now would leave the app half mirrored (French words laid out right to left, and
        // native parts that follow the recorded direction before the rest). So nothing changes
        // until the person agrees to the restart, asked in the language that is coming; then the
        // choice is written on the phone, the direction recorded, and the app starts again.
        const words = getTranslator(language, 'settings');
        confirm({
          title: words('language.restartConfirm.title'),
          message: words('language.restartConfirm.message'),
          confirmLabel: words('language.restartConfirm.restart'),
          cancelLabel: words('language.restartConfirm.cancel'),
          isDestructive: false,
          onConfirm: () => {
            saveLanguage(chosen);
            chooseDirectionFor(language, direction);
            store
              .whenSaved()
              .then(() => direction.restart())
              .catch((error: unknown) => {
                // The note and its button stay: the direction still applies at the next start.
                console.warn('The app could not restart in its new writing direction.', error);
              });
          },
        });
      },
      restartApp: () => {
        direction.restart().catch((error: unknown) => {
          // The note and the button stay: the direction still applies at the next start.
          console.warn('The app could not restart.', error);
        });
      },
      setDailyGoalPages: dailyGoal.setPages,
      changeReminders: reminders.change,
      setSoundsEnabled: (enabled) => {
        // The store tells the feedback at once, so the sound that follows is heard.
        saveSoundsEnabled(enabled);
        if (enabled) playFeedback('drop');
      },
      setHapticsEnabled: (enabled) => {
        saveHapticsEnabled(enabled);
        if (enabled) playFeedback('select');
      },
      requestNotificationPermission: () => {
        void reminders.requestPermission();
      },
      openSystemSettings,
      replayIntroduction: openIntroduction,
    },
  };
}
