import { useTranslation } from 'react-i18next';

import { RemindersSection } from '@/features/settings';
import { AppText, GroupedList } from '@/ui';

import { NotificationPreviews } from './notification-previews';
import { SettingsLayout } from './page-layouts';
import type { OnboardingPageProps } from './page-props';

/**
 * The last page (the prototype's `.page.last`): over the words, the notifications the reminders
 * will send, each one shown or withdrawn as its switch is turned (onboarding.md › Best practices:
 * teach through interactivity); then the system's switches and time pickers in list rows
 * (toggles.md › Mobile; pickers.md), in a group laid on the sky.
 *
 * The one button that ends the flow floats at the bottom of the screen in place of the page dots
 * (`OnboardingScreen`). When the system's permission alert follows it, this page is what Apple
 * calls a pre-alert screen (privacy.md › Pre-alert screens): one button, not named "Allow", the
 * sentence under the reminders that says the phone is about to ask, and no other way out.
 */
export function RemindersPage({ page, model, actions }: OnboardingPageProps) {
  const { t } = useTranslation('onboarding');
  const notice = model.ending === 'ask-permission' ? t('permissionNotice') : undefined;
  return (
    <SettingsLayout
      placement="reminders"
      title={t(page.title)}
      text={t(page.text)}
      words={page.words}
      above={<NotificationPreviews reminders={model.reminders} />}
      below={
        notice === undefined ? null : (
          // Between the reminders and the button it announces, in reading order.
          <AppText variant="footnote" color="muted" testID="onboarding-permission-notice">
            {notice}
          </AppText>
        )
      }
    >
      <GroupedList background="clear" testID="onboarding-reminders">
        <RemindersSection model={model.reminders} onChange={actions.changeReminders} />
      </GroupedList>
    </SettingsLayout>
  );
}
