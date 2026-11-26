import * as Haptics from 'expo-haptics';
import { useState } from 'react';

import type { NotificationPermissions } from '@/data/notifications';
import {
  computeGoalPlan,
  readingMomentAt,
  remindersForReadingMoment,
  type Goal,
  type GoalKind,
  type GoalPlan,
  type ReadingMoment,
} from '@/domain/goal-plan';
import type { LocalDate } from '@/domain/shared/local-date';
import { useToday } from '@/features/home/use-today';
import { useAppStore } from '@/store';

import { ONBOARDING_PAGES, type OnboardingPage } from './pages';

/** The prototype's choices before the person touches anything: three months, the evening. */
export const DEFAULT_GOAL: GoalKind = '3-months';
export const DEFAULT_MOMENT: ReadingMoment = 'evening';

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
  /** Today, from which the plan counts. */
  readonly today: LocalDate;
  readonly goal: GoalKind;
  /** What the goal means from today: pages a day, end date, hizb after a month (live). */
  readonly plan: GoalPlan;
  readonly moment: ReadingMoment;
  readonly fridayKahf: boolean;
  readonly thirstyGarden: boolean;
  /** True from the press on the last button until the flow closes. */
  readonly isFinishing: boolean;
}

/** What the person can do in the first-launch flow. */
export interface OnboardingActions {
  showPage: (pageIndex: number) => void;
  chooseGoal: (goal: GoalKind) => void;
  chooseMoment: (moment: ReadingMoment) => void;
  setFridayKahf: (on: boolean) => void;
  setThirstyGarden: (on: boolean) => void;
  /**
   * "Créer mon jardin": saves the goal, the moment and the reminders, marks the introduction
   * done, asks the system for the permission to notify (first launch, a reminder on), then ends.
   */
  finish: () => void;
}

export interface OnboardingDependencies {
  readonly notifications: NotificationPermissions;
  /** Called when the flow ends, to show what comes after it. */
  readonly onFinished: (flow: { isReplay: boolean }) => void;
  readonly pages?: readonly OnboardingPage[];
  /** The page shown first. Defaults to the first one. */
  readonly initialPageIndex?: number;
  /** Today, for the khatma's end date. Defaults to the device's day. */
  readonly today?: LocalDate;
}

/** Builds the model and the actions of the first-launch flow. */
export function useOnboarding({
  notifications,
  onFinished,
  pages = ONBOARDING_PAGES,
  initialPageIndex = 0,
  today: givenToday,
}: OnboardingDependencies): { model: OnboardingModel; actions: OnboardingActions } {
  const settings = useAppStore((state) => state.settings);
  const setReadingGoal = useAppStore((state) => state.setReadingGoal);
  const setReadingMoment = useAppStore((state) => state.setReadingMoment);
  const updateReminders = useAppStore((state) => state.updateReminders);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const deviceToday = useToday();
  const today = givenToday ?? deviceToday;
  // Decided once, when the flow opens: finishing it must not turn it into a replay.
  const [isReplay] = useState(settings.onboardingCompleted);
  const [pageIndex, setPageIndex] = useState(initialPageIndex);
  // Opened again, the flow starts from what the person chose before.
  const [goal, setGoal] = useState<GoalKind>(() =>
    settings.onboardingCompleted ? settings.goalKind : DEFAULT_GOAL,
  );
  const [moment, setMoment] = useState<ReadingMoment>(() =>
    settings.onboardingCompleted
      ? (readingMomentAt(settings.reminders.dailyTime) ?? DEFAULT_MOMENT)
      : DEFAULT_MOMENT,
  );
  const [fridayKahf, setFridayKahf] = useState(settings.reminders.fridayKahfEnabled);
  const [thirstyGarden, setThirstyGarden] = useState(settings.reminders.thirstyGardenEnabled);
  const [isFinishing, setFinishing] = useState(false);
  // The own pace keeps the pages the person already reads, when they come back to it.
  const chosen: Goal =
    goal === 'own-pace' && settings.goalKind === 'own-pace' && settings.onboardingCompleted
      ? { kind: goal, pagesPerDay: settings.dailyGoalPages }
      : { kind: goal };
  const plan = computeGoalPlan(chosen, today);

  const finish = async () => {
    if (isFinishing) return;
    setFinishing(true);
    // On the same frame as the press: a medium impact (motion spec §13, playing-haptics.md › Impact).
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setReadingGoal(chosen);
    setReadingMoment(moment);
    const reminders = remindersForReadingMoment(moment, { fridayKahf, thirstyGarden });
    updateReminders({
      fridayKahfEnabled: reminders.fridayKahfEnabled,
      thirstyGardenEnabled: reminders.thirstyGardenEnabled,
    });
    // At the first launch, the system's alert follows the button (privacy.md › Requesting
    // permission); the daily reminder is always on. Whatever the answer, and even if the system
    // cannot ask, the flow ends: the settings say later when the system blocks the reminders.
    if (!isReplay && reminders.dailyEnabled) {
      try {
        if ((await notifications.getStatus()) === 'undetermined') await notifications.request();
      } catch {
        // Nothing to do: see above.
      }
    }
    completeOnboarding();
    onFinished({ isReplay });
  };

  const tick = () => {
    void Haptics.selectionAsync().catch(() => undefined);
  };

  return {
    model: {
      pages,
      pageIndex,
      isReplay,
      today,
      goal,
      plan,
      moment,
      fridayKahf,
      thirstyGarden,
      isFinishing,
    },
    actions: {
      showPage: (next) => {
        if (next === pageIndex) return;
        setPageIndex(next);
        // A light tick as the page settles into place (playing-haptics.md › Selection).
        tick();
      },
      chooseGoal: (next) => {
        if (next === goal) return;
        setGoal(next);
        tick();
      },
      chooseMoment: (next) => {
        if (next === moment) return;
        setMoment(next);
        tick();
      },
      setFridayKahf,
      setThirstyGarden,
      finish: () => {
        void finish();
      },
    },
  };
}
