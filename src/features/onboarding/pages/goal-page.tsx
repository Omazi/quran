import { useTranslation } from 'react-i18next';

import { DailyGoalSection } from '@/features/settings';
import { GroupedList } from '@/ui';

import { SettingsLayout } from './page-layouts';
import type { OnboardingPageProps } from './page-props';

/**
 * The page where the person sets their daily goal, under the bare earth they are about to start
 * (the prototype's goal page): the system's stepper in a group laid on the sky, and under it a
 * note that changes as they step (onboarding.md › Best practices: teach through interactivity;
 * steppers.md › Best practices: the value is obvious). No buttons of landmarks: the owner did not
 * want big choices on the last pages. A goal is already in place, so the page can be passed
 * without touching anything (onboarding.md › Additional requests).
 */
export function GoalPage({ page, model, actions }: OnboardingPageProps) {
  const { t } = useTranslation('onboarding');
  return (
    <SettingsLayout placement="goal" title={t(page.title)} text={t(page.text)} words={page.words}>
      <GroupedList background="clear" testID="onboarding-goal">
        <DailyGoalSection model={model.dailyGoal} onChange={actions.setDailyGoalPages} />
      </GroupedList>
    </SettingsLayout>
  );
}
