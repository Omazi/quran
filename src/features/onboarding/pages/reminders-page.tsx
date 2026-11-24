import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { RemindersSection } from '@/features/settings';
import { AppText, Button, GroupedList, spacing } from '@/ui';

import { SettingsPageLayout } from './page-layouts';
import type { OnboardingPageProps } from './page-props';

/**
 * The last page: the reminders, then the one button that ends the flow. NOT A VALIDATED DESIGN
 * (docs/specs/ui-lot1.md, A.3): it is kept plain, system components only. Replace this file to
 * change it; the pager and the other pages do not depend on it.
 *
 * The button says what it does (writing.md › Best practices). When the system's permission alert
 * follows it, this page is what Apple calls a pre-alert screen (privacy.md › Pre-alert screens,
 * windows, or views): a single button, named "Continue" and not "Allow", a sentence right above
 * it that says the phone is about to ask, and nothing else that leads out of the page. Otherwise
 * the button starts the app, or closes the flow opened again from the settings.
 */
export function RemindersPage({ page, model, actions }: OnboardingPageProps) {
  const { t } = useTranslation('onboarding');
  return (
    <SettingsPageLayout
      title={t(page.title)}
      text={t(page.text)}
      footer={
        <View style={styles.footer}>
          {model.ending === 'ask-permission' ? (
            <AppText variant="subhead" testID="onboarding-permission-notice">
              {t('permissionNotice')}
            </AppText>
          ) : null}
          <Button
            label={t(`finish.${model.ending}`)}
            variant="primary"
            fullWidth
            disabled={model.isFinishing}
            onPress={actions.finish}
            testID="onboarding-finish"
          />
        </View>
      }
    >
      <GroupedList testID="onboarding-reminders">
        <RemindersSection model={model.reminders} onChange={actions.changeReminders} />
      </GroupedList>
    </SettingsPageLayout>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.md },
});
