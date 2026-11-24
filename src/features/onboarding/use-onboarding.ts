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
  readonly ending: OnboardingEnding;
  /** True from the press on the last button until the flow closes. */
  readonly isFinishing: boolean;
}

/**
 * What the last button does, which decides what it is called.
 * `ask-permission`: the system's alert follows it; the page announces it and the button is named
 * "Continue" (privacy.md › Pre-alert screens). `start`: it opens the app. `done`: it closes the
 * flow opened again from the settings.
 */
export type OnboardingEnding = 'ask-permission' | 'start' | 'done';

/** What the person can do in the first-launch flow. */
export interface OnboardingActions {
  showPage: (pageIndex: number) => void;
  setDailyGoalPages: (pages: number) => void;
  changeReminders: (change: Partial<ReminderSettings>) => void;
  /** The last button: shows the system's alert when the ending is `ask-permission`, then ends. */
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
  // At the first launch the last button asks for the permission, after the page has said so.
  // Opened again from the settings, the flow asks as the settings do: when a reminder goes on.
  const reminders = useReminders({ notifications, asks: isReplay ? 'on-enable' : 'on-request' });
  const ending: OnboardingEnding = isReplay
    ? 'done'
    : reminders.willAskPermission
      ? 'ask-permission'
      : 'start';

  const finish = async () => {
    if (isFinishing) return;
    setFinishing(true);
    // Whatever the person answers, and even if the system cannot ask, the flow ends: their
    // reminders stay as they set them, and the settings say when the system blocks them.
    if (ending === 'ask-permission') await reminders.requestPermission();
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
      ending,
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
