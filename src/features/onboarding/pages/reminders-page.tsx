import { useTranslation } from 'react-i18next';

import { RemindersSection } from '@/features/settings';
import { ButtonRow, GroupedList, ListSection } from '@/ui';

import { SettingsPageLayout } from './page-layouts';
import type { OnboardingPageProps } from './page-props';

/**
 * The last page: the reminders, then the one button that ends the flow. NOT A VALIDATED DESIGN
 * (docs/specs/ui-lot1.md, A.3): it is kept plain, system components only. Replace this file to
 * change it; the pager and the other pages do not depend on it.
 *
 * The button is the row that follows the reminders, in a section of its own, as the system's
 * forms end (deviation 61): it sits right under the group it concludes instead of at the bottom
 * of the page, so there is no empty stretch between them. It says what it does (writing.md ›
 * Best practices). When the system's permission alert follows it, this page is what Apple calls a
 * pre-alert screen (privacy.md › Pre-alert screens, windows, or views): a single button, named
 * "Continue" and not "Allow", a sentence that says the phone is about to ask, and nothing else
 * that leads out of the page. Otherwise the button starts the app, or closes the flow opened
 * again from the settings.
 */
export function RemindersPage({ page, model, actions, bottomInset }: OnboardingPageProps) {
  const { t } = useTranslation('onboarding');
  return (
    <SettingsPageLayout title={t(page.title)} text={t(page.text)} bottomInset={bottomInset}>
      <GroupedList testID="onboarding-reminders">
        <RemindersSection model={model.reminders} onChange={actions.changeReminders} />
        <ListSection footer={model.ending === 'ask-permission' ? t('permissionNotice') : undefined}>
          <ButtonRow
            variant="primary"
            label={t(`finish.${model.ending}`)}
            disabled={model.isFinishing}
            onPress={actions.finish}
            testID="onboarding-finish"
          />
        </ListSection>
      </GroupedList>
    </SettingsPageLayout>
  );
}
