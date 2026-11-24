import { useTranslation } from 'react-i18next';

import { RemindersSection } from '@/features/settings';
import { Button, GroupedList } from '@/ui';

import { SettingsPageLayout } from './page-layouts';
import type { OnboardingPageProps } from './page-props';

/**
 * The last page: the reminders, then the one button that ends the flow. NOT A VALIDATED DESIGN
 * (docs/specs/ui-lot1.md, A.3): it is kept plain, system components only. Replace this file to
 * change it; the pager and the other pages do not depend on it.
 *
 * When a reminder is on, the button is followed by the system's permission alert, so this page
 * is what Apple calls a pre-alert screen (privacy.md › Pre-alert screens, windows, or views): it
 * has a single button, named "Continue" and not "Allow", the note under the switches says that
 * the system is about to ask, and nothing else leads out of the page.
 */
export function RemindersPage({ page, model, actions }: OnboardingPageProps) {
  const { t } = useTranslation('onboarding');
  return (
    <SettingsPageLayout
      title={t(page.title)}
      text={t(page.text)}
      footer={
        <Button
          label={t('finish')}
          variant="primary"
          fullWidth
          disabled={model.isFinishing}
          onPress={actions.finish}
          testID="onboarding-finish"
        />
      }
    >
      <GroupedList testID="onboarding-reminders">
        <RemindersSection model={model.reminders} onChange={actions.changeReminders} />
      </GroupedList>
    </SettingsPageLayout>
  );
}
