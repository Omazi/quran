import { useTranslation } from 'react-i18next';

import { DailyGoalSection } from '@/features/settings';
import { GroupedList } from '@/ui';

import { SettingsPageLayout } from './page-layouts';
import type { OnboardingPageProps } from './page-props';

/**
 * The page where the person sets their daily goal: a grouped list with one stepper row, whose
 * note changes as they step (onboarding.md › Best practices: teach through interactivity).
 * A goal is already in place, so the page can be passed without touching anything.
 */
export function GoalPage({ page, model, actions, bottomInset }: OnboardingPageProps) {
  const { t } = useTranslation('onboarding');
  return (
    <SettingsPageLayout title={t(page.title)} text={t(page.text)} bottomInset={bottomInset}>
      <GroupedList testID="onboarding-goal">
        <DailyGoalSection model={model.dailyGoal} onChange={actions.setDailyGoalPages} />
      </GroupedList>
    </SettingsPageLayout>
  );
}
