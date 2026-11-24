import { useState } from 'react';

import type { NotificationPermissions } from '@/data/notifications';
import {
  useDailyGoal,
  useReminders,
  type DailyGoalModel,
  type RemindersModel,
} from '@/features/settings';
import { useAppStore, type ReminderSettings } from '@/store';

import { ONBOARDING_PAGES, type OnboardingPage } from './pages';

/** What the first-launch flow shows. */
export interface OnboardingModel {
  readonly pages: readonly OnboardingPage[];
  /** Zero-based index of the page shown. */
  readonly pageIndex: number;
  /**
   * True when the person opened the flow again from the settings. They can then leave it at any
   * time; at the first launch the only way forward is the last page.
   */
  readonly isReplay: boolean;
  readonly dailyGoal: DailyGoalModel;
  readonly reminders: RemindersModel;
  /** True from the press on the last button until the flow closes. */
  readonly isFinishing: boolean;
}

/** What the person can do in the first-launch flow. */
export interface OnboardingActions {
  showPage: (pageIndex: number) => void;
  setDailyGoalPages: (pages: number) => void;
  changeReminders: (change: Partial<ReminderSettings>) => void;
  /**
   * The last button: lets the system ask for the permission to notify if a reminder is on, then
   * ends the flow.
   */
  finish: () => void;
}

export interface OnboardingDependencies {
  readonly notifications: NotificationPermissions;
  /** Called when the flow ends, to show what comes after it. */
  readonly onFinished: (flow: { isReplay: boolean }) => void;
  /** Defaults to the pages chosen by `ONBOARDING_LENGTH`. */
  readonly pages?: readonly OnboardingPage[];
  /** The page shown first. Defaults to the first one. */
  readonly initialPageIndex?: number;
}

/** Builds the model and the actions of the first-launch flow. */
export function useOnboarding({
  notifications,
  onFinished,
  pages = ONBOARDING_PAGES,
  initialPageIndex = 0,
}: OnboardingDependencies): { model: OnboardingModel; actions: OnboardingActions } {
  const isCompleted = useAppStore((state) => state.settings.onboardingCompleted);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  // Decided once, when the flow opens: finishing it must not turn it into a replay.
  const [isReplay] = useState(isCompleted);
  const [pageIndex, setPageIndex] = useState(initialPageIndex);
  const [isFinishing, setFinishing] = useState(false);
  const dailyGoal = useDailyGoal();
  const reminders = useReminders({ notifications, asks: 'on-request' });

  const finish = async () => {
    if (isFinishing) return;
    setFinishing(true);
    // Whatever the person answers, and even if the system cannot ask, the flow ends: their
    // reminders stay as they set them, and the settings say when the system blocks them.
    await reminders.requestPermission();
    completeOnboarding();
    onFinished({ isReplay });
  };

  return {
    model: {
      pages,
      pageIndex,
      isReplay,
      dailyGoal: dailyGoal.model,
      reminders: reminders.model,
      isFinishing,
    },
    actions: {
      showPage: setPageIndex,
      setDailyGoalPages: dailyGoal.setPages,
      changeReminders: reminders.change,
      finish: () => {
        void finish();
      },
    },
  };
}
